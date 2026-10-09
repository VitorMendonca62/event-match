import { z } from 'zod';

const portSchema = z.coerce.number().int().min(1).max(65_535);
const booleanSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');
const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};
const hasProtocol = (value: string, protocols: readonly string[]): boolean => {
  const parsed = parseUrl(value);
  return parsed !== null && protocols.includes(parsed.protocol);
};
const databaseUrlSchema = z
  .string()
  .trim()
  .url()
  .refine(
    (value) => hasProtocol(value, ['postgres:', 'postgresql:']),
    'must use postgres:// or postgresql://',
  );
const nonNegativeIntSchema = z.coerce.number().int().min(0);
const positiveIntSchema = z.coerce.number().int().min(1);
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
/** ADR-014: canonical base64 only, so placeholders and URL-safe text are rejected. */
const base64SecretSchema = (bytes: { exact: number } | { min: number }) =>
  z
    .string()
    .trim()
    .regex(BASE64_PATTERN, 'must be standard base64')
    .refine(
      (value) => {
        const length = Buffer.from(value, 'base64').length;
        return 'exact' in bytes ? length === bytes.exact : length >= bytes.min;
      },
      'exact' in bytes
        ? `must decode to exactly ${bytes.exact} bytes`
        : `must decode to at least ${bytes.min} bytes`,
    );
const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => hasProtocol(value, ['http:', 'https:']), 'must use http:// or https://');
const optionalEnvironmentValue = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema.optional(),
  );
const databaseUrlTlsParameters = new Set([
  'ssl',
  'sslcert',
  'sslcrl',
  'sslkey',
  'sslmode',
  'sslrootcert',
  'require_ssl',
]);

/**
 * Production floors of the session and login policy (ADR-033, ADR-035). Test environments may use
 * shorter values to exercise expiry; production never loosens the limits nor shortens the windows
 * below these documented minimums.
 */
export const AUTH_PRODUCTION_MINIMUMS = {
  AUTH_SESSION_ABSOLUTE_TTL_SECONDS: 3_600,
  AUTH_SESSION_IDLE_TTL_SECONDS: 300,
  AUTH_REMEMBERED_ABSOLUTE_TTL_SECONDS: 86_400,
  AUTH_REMEMBERED_IDLE_TTL_SECONDS: 3_600,
  AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS: 60,
  AUTH_SESSION_RENEWAL_INTERVAL_SECONDS: 3_600,
  AUTH_SESSION_PREVIOUS_TOKEN_GRACE_SECONDS: 10,
  AUTH_LOGIN_WINDOW_SECONDS: 900,
} as const;
const AUTH_PRODUCTION_MAXIMUMS = {
  AUTH_SESSION_PREVIOUS_TOKEN_GRACE_SECONDS: 300,
  AUTH_LOGIN_CONTACT_LIMIT: 5,
  AUTH_LOGIN_ORIGIN_LIMIT: 30,
} as const;

export const PROFILE_POLICY_BOUNDS = {
  uploadTtlSeconds: { min: 60, max: 900 },
  maxBytes: { min: 1_024, max: 5_242_880 },
  accountDailyLimit: { min: 1, max: 10 },
  origin15mLimit: { min: 1, max: 30 },
} as const;

type AuthenticationEnvironment = Record<keyof typeof AUTH_PRODUCTION_MINIMUMS, number> &
  Record<'AUTH_MAX_SESSIONS_PER_ACCOUNT' | 'AUTH_LOGIN_CONTACT_LIMIT' | 'AUTH_LOGIN_ORIGIN_LIMIT', number> & {
    AUTH_HTTP_ENABLED: boolean;
    AUTH_SESSION_SECRET?: string;
    REGISTRATION_FLOW_SECRET: string;
  };

type ProfileEnvironment = {
  PROFILE_HTTP_ENABLED: boolean;
  PROFILE_MEDIA_ENABLED: boolean;
  PROFILE_INVITATION_KEY?: string;
  PROFILE_MEDIA_KEY?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_PROFILE_UPLOAD_PRESET?: string;
  PROFILE_MEDIA_PROVIDER: 'cloudinary' | 'fake';
  PROFILE_MEDIA_SMOKE_ENABLED: boolean;
  PROFILE_MEDIA_SMOKE_FIXTURE?: string;
  PROFILE_PHOTO_ACCOUNT_DAILY_LIMIT: number;
  PROFILE_PHOTO_ORIGIN_15M_LIMIT: number;
};

type EventsEnvironment = {
  EVENTS_HTTP_ENABLED: boolean;
  EVENT_EXACT_LOCATION_KEY?: string;
  EVENT_APPROXIMATE_RADIUS_METERS: number;
};

export const EVENT_POLICY_BOUNDS = {
  approximateRadiusMeters: { min: 200, max: 5_000 },
} as const;

function validateProfile(environment: ProfileEnvironment, issue: (path: string, message: string) => void): void {
  if (environment.PROFILE_HTTP_ENABLED && !environment.PROFILE_INVITATION_KEY) issue('PROFILE_INVITATION_KEY', 'is required when PROFILE_HTTP_ENABLED is true');
  if (environment.PROFILE_PHOTO_ACCOUNT_DAILY_LIMIT > environment.PROFILE_PHOTO_ORIGIN_15M_LIMIT) issue('PROFILE_PHOTO_ACCOUNT_DAILY_LIMIT', 'must not exceed PROFILE_PHOTO_ORIGIN_15M_LIMIT');
  if (!environment.PROFILE_MEDIA_ENABLED) return;
  const names = environment.PROFILE_MEDIA_PROVIDER === 'cloudinary'
    ? ['PROFILE_MEDIA_KEY', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_PROFILE_UPLOAD_PRESET'] as const
    : ['PROFILE_MEDIA_KEY'] as const;
  for (const name of names) {
    if (!environment[name]) issue(name, 'is required when PROFILE_MEDIA_ENABLED is true');
  }
  if (environment.PROFILE_MEDIA_SMOKE_ENABLED) {
    if (environment.PROFILE_MEDIA_PROVIDER !== 'cloudinary') issue('PROFILE_MEDIA_PROVIDER', 'must be cloudinary when PROFILE_MEDIA_SMOKE_ENABLED is true');
    if (!environment.PROFILE_MEDIA_SMOKE_FIXTURE) issue('PROFILE_MEDIA_SMOKE_FIXTURE', 'is required when PROFILE_MEDIA_SMOKE_ENABLED is true');
  }
}

function validateEvents(environment: EventsEnvironment, issue: (path: string, message: string) => void): void {
  if (environment.EVENTS_HTTP_ENABLED && !environment.EVENT_EXACT_LOCATION_KEY) {
    issue('EVENT_EXACT_LOCATION_KEY', 'is required when EVENTS_HTTP_ENABLED is true');
  }
}

/** Relations between the session deadlines are checked here so the policy can never be incoherent. */
function validateAuthentication(
  environment: AuthenticationEnvironment,
  production: boolean,
  issue: (path: string, message: string) => void,
): void {
  if ((environment.AUTH_HTTP_ENABLED || production) && !environment.AUTH_SESSION_SECRET) {
    issue('AUTH_SESSION_SECRET', 'is required when AUTH_HTTP_ENABLED is true or NODE_ENV is production');
  }
  if (environment.AUTH_SESSION_SECRET && environment.AUTH_SESSION_SECRET === environment.REGISTRATION_FLOW_SECRET) {
    issue('AUTH_SESSION_SECRET', 'must differ from REGISTRATION_FLOW_SECRET');
  }
  const relations: readonly [boolean, string, string][] = [
    [
      environment.AUTH_SESSION_IDLE_TTL_SECONDS <= environment.AUTH_SESSION_ABSOLUTE_TTL_SECONDS,
      'AUTH_SESSION_IDLE_TTL_SECONDS',
      'must not exceed AUTH_SESSION_ABSOLUTE_TTL_SECONDS',
    ],
    [
      environment.AUTH_REMEMBERED_IDLE_TTL_SECONDS <= environment.AUTH_REMEMBERED_ABSOLUTE_TTL_SECONDS,
      'AUTH_REMEMBERED_IDLE_TTL_SECONDS',
      'must not exceed AUTH_REMEMBERED_ABSOLUTE_TTL_SECONDS',
    ],
    [
      environment.AUTH_SESSION_ABSOLUTE_TTL_SECONDS <= environment.AUTH_REMEMBERED_ABSOLUTE_TTL_SECONDS,
      'AUTH_SESSION_ABSOLUTE_TTL_SECONDS',
      'must not exceed AUTH_REMEMBERED_ABSOLUTE_TTL_SECONDS',
    ],
    [
      environment.AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS < environment.AUTH_SESSION_IDLE_TTL_SECONDS,
      'AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS',
      'must be shorter than AUTH_SESSION_IDLE_TTL_SECONDS',
    ],
    [
      environment.AUTH_SESSION_RENEWAL_INTERVAL_SECONDS < environment.AUTH_REMEMBERED_ABSOLUTE_TTL_SECONDS,
      'AUTH_SESSION_RENEWAL_INTERVAL_SECONDS',
      'must be shorter than AUTH_REMEMBERED_ABSOLUTE_TTL_SECONDS',
    ],
    [
      environment.AUTH_SESSION_PREVIOUS_TOKEN_GRACE_SECONDS < environment.AUTH_SESSION_RENEWAL_INTERVAL_SECONDS,
      'AUTH_SESSION_PREVIOUS_TOKEN_GRACE_SECONDS',
      'must be shorter than AUTH_SESSION_RENEWAL_INTERVAL_SECONDS',
    ],
  ];
  for (const [valid, path, message] of relations) if (!valid) issue(path, message);

  if (!production) return;
  for (const [name, minimum] of Object.entries(AUTH_PRODUCTION_MINIMUMS)) {
    if (environment[name as keyof typeof AUTH_PRODUCTION_MINIMUMS] < minimum) {
      issue(name, `must be at least ${minimum} when NODE_ENV is production`);
    }
  }
  for (const [name, maximum] of Object.entries(AUTH_PRODUCTION_MAXIMUMS)) {
    if (environment[name as keyof typeof AUTH_PRODUCTION_MAXIMUMS] > maximum) {
      issue(name, `must be at most ${maximum} when NODE_ENV is production`);
    }
  }
}

const rawEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: portSchema.default(3001),
    HOSTNAME: z.string().trim().min(1).default('0.0.0.0'),
    SWAGGER_ENABLED: booleanSchema.default(true),
    SWAGGER_PATH: z.string().trim().min(1).default('docs'),
    DATABASE_URL: databaseUrlSchema,
    DATABASE_POOL_MAX: z.literal('1').default('1').transform(() => 1),
    DATABASE_IDLE_TIMEOUT_MS: nonNegativeIntSchema.default(10_000),
    DATABASE_CONNECTION_TIMEOUT_MS: positiveIntSchema.default(2_000),
    DATABASE_STATEMENT_TIMEOUT_MS: positiveIntSchema.default(5_000),
    DATABASE_SSL_MODE: z.enum(['disable', 'require']).optional(),
    CONTACT_HASH_KEY: base64SecretSchema({ min: 32 }),
    CONTACT_ENCRYPTION_KEY: base64SecretSchema({ exact: 32 }),
    VERIFICATION_SECRET_KEY: base64SecretSchema({ min: 32 }),
    // ADR-021: digests of continuation tokens, idempotency keys and payloads.
    REGISTRATION_FLOW_SECRET: base64SecretSchema({ min: 32 }),
    // ADR-023: shared only with the Next.js BFF; authenticates every registration request.
    BFF_INTERNAL_TOKEN: base64SecretSchema({ min: 32 }),
    // Rollout flag (SDD-009 §8): registration routes answer 404 until the BFF is ready.
    REGISTRATION_HTTP_ENABLED: booleanSchema.default(false),
    // ADR-025/ADR-026: explicit choice; `noop` is refused in production.
    VERIFICATION_DELIVERY_MODE: z.enum(['brevo', 'noop']),
    BREVO_API_KEY: optionalEnvironmentValue(z.string().trim().min(1)),
    BREVO_BASE_URL: httpUrlSchema.default('https://api.brevo.com/v3'),
    EMAIL_FROM: optionalEnvironmentValue(z.string().trim().min(3).max(320)),
    FRONTEND_PUBLIC_URL: optionalEnvironmentValue(httpUrlSchema),
    // SDD-013 (ADR-033..036): `/api/v1/auth` answers 404 until the rollout enables it.
    AUTH_HTTP_ENABLED: booleanSchema.default(false),
    // ADR-033: HMAC key of session tokens; independent of REGISTRATION_FLOW_SECRET.
    AUTH_SESSION_SECRET: optionalEnvironmentValue(base64SecretSchema({ min: 32 })),
    AUTH_SESSION_ABSOLUTE_TTL_SECONDS: positiveIntSchema.default(43_200),
    AUTH_SESSION_IDLE_TTL_SECONDS: positiveIntSchema.default(1_800),
    AUTH_REMEMBERED_ABSOLUTE_TTL_SECONDS: positiveIntSchema.default(2_592_000),
    AUTH_REMEMBERED_IDLE_TTL_SECONDS: positiveIntSchema.default(604_800),
    AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS: positiveIntSchema.default(300),
    AUTH_SESSION_RENEWAL_INTERVAL_SECONDS: positiveIntSchema.default(86_400),
    AUTH_SESSION_PREVIOUS_TOKEN_GRACE_SECONDS: positiveIntSchema.default(60),
    AUTH_MAX_SESSIONS_PER_ACCOUNT: z.coerce.number().int().min(1).max(20).default(5),
    // ADR-035: sliding window shared by both buckets.
    AUTH_LOGIN_WINDOW_SECONDS: positiveIntSchema.default(900),
    AUTH_LOGIN_CONTACT_LIMIT: positiveIntSchema.default(5),
    AUTH_LOGIN_ORIGIN_LIMIT: positiveIntSchema.default(30),
    PROFILE_HTTP_ENABLED: booleanSchema.default(false),
    PROFILE_MEDIA_ENABLED: booleanSchema.default(false),
    PROFILE_INVITATION_KEY: optionalEnvironmentValue(base64SecretSchema({ min: 32 })),
    PROFILE_MEDIA_KEY: optionalEnvironmentValue(base64SecretSchema({ min: 32 })),
    PROFILE_PHOTO_UPLOAD_TTL_SECONDS: z.coerce.number().int().min(PROFILE_POLICY_BOUNDS.uploadTtlSeconds.min).max(PROFILE_POLICY_BOUNDS.uploadTtlSeconds.max).default(300),
    PROFILE_PHOTO_MAX_BYTES: z.coerce.number().int().min(PROFILE_POLICY_BOUNDS.maxBytes.min).max(PROFILE_POLICY_BOUNDS.maxBytes.max).default(5_242_880),
    PROFILE_PHOTO_ACCOUNT_DAILY_LIMIT: z.coerce.number().int().min(PROFILE_POLICY_BOUNDS.accountDailyLimit.min).max(PROFILE_POLICY_BOUNDS.accountDailyLimit.max).default(10),
    PROFILE_PHOTO_ORIGIN_15M_LIMIT: z.coerce.number().int().min(PROFILE_POLICY_BOUNDS.origin15mLimit.min).max(PROFILE_POLICY_BOUNDS.origin15mLimit.max).default(30),
    PROFILE_MEDIA_PROVIDER: z.enum(['cloudinary', 'fake']).default('cloudinary'),
    PROFILE_MEDIA_SMOKE_ENABLED: booleanSchema.default(false),
    PROFILE_MEDIA_SMOKE_FIXTURE: optionalEnvironmentValue(z.string().trim().min(1)),
    CLOUDINARY_CLOUD_NAME: optionalEnvironmentValue(z.string().trim().min(1)),
    CLOUDINARY_API_KEY: optionalEnvironmentValue(z.string().trim().min(1)),
    CLOUDINARY_API_SECRET: optionalEnvironmentValue(z.string().trim().min(1)),
    CLOUDINARY_PROFILE_UPLOAD_PRESET: optionalEnvironmentValue(z.string().trim().min(1)),
    // SDD-025 / ADR-055: independent AES-256 key for exact event locations.
    EVENTS_HTTP_ENABLED: booleanSchema.default(false),
    EVENT_EXACT_LOCATION_KEY: optionalEnvironmentValue(base64SecretSchema({ exact: 32 })),
    EVENT_APPROXIMATE_RADIUS_METERS: z.coerce.number().int().min(EVENT_POLICY_BOUNDS.approximateRadiusMeters.min).max(EVENT_POLICY_BOUNDS.approximateRadiusMeters.max).default(500),
  })
  .superRefine((environment, context) => {
    const databaseUrl = parseUrl(environment.DATABASE_URL);
    const hasTlsParameter = [...(databaseUrl?.searchParams.keys() ?? [])]
      .some((parameter) => databaseUrlTlsParameters.has(parameter.toLowerCase()));

    if (hasTlsParameter) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'must not contain TLS parameters; use DATABASE_SSL_MODE',
      });
    }

    const production = environment.NODE_ENV === 'production';
    const issue = (path: string, message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (production && environment.VERIFICATION_DELIVERY_MODE === 'noop') {
      issue('VERIFICATION_DELIVERY_MODE', 'must be brevo when NODE_ENV is production');
    }
    if (environment.VERIFICATION_DELIVERY_MODE === 'brevo') {
      for (const name of ['BREVO_API_KEY', 'EMAIL_FROM', 'FRONTEND_PUBLIC_URL'] as const) {
        if (!environment[name]) issue(name, 'is required when VERIFICATION_DELIVERY_MODE is brevo');
      }
    }
    if (production) {
      for (const name of ['BREVO_BASE_URL', 'FRONTEND_PUBLIC_URL'] as const) {
        const value = environment[name];
        if (value && !hasProtocol(value, ['https:'])) issue(name, 'must use https:// when NODE_ENV is production');
      }
    }

    validateAuthentication(environment, production, issue);
    validateProfile(environment, issue);
    validateEvents(environment, issue);
    if (environment.PROFILE_MEDIA_PROVIDER === 'fake' && environment.NODE_ENV !== 'test') issue('PROFILE_MEDIA_PROVIDER', 'fake is allowed only when NODE_ENV is test');

    if (
      production &&
      environment.DATABASE_SSL_MODE === 'disable'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_SSL_MODE'],
        message: 'must be require when NODE_ENV is production',
      });
    }
  });

export const envSchema = rawEnvSchema.transform((environment) => ({
  ...environment,
  DATABASE_SSL_MODE:
    environment.DATABASE_SSL_MODE ??
    (environment.NODE_ENV === 'production' ? 'require' : 'disable'),
}));

export type BackendEnv = z.infer<typeof envSchema>;

export function formatEnvError(error: z.ZodError): string {
  const details = error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ');

  return `Invalid environment configuration. ${details}`;
}

export function validateEnv(input: Record<string, string | undefined>): BackendEnv {
  const parsed = envSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(formatEnvError(parsed.error));
  }

  return parsed.data;
}
