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
