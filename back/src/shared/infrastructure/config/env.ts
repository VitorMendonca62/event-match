import { z } from 'zod';

const portSchema = z.coerce.number().int().min(1).max(65_535);
const booleanSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');
const databaseUrlSchema = z.string().trim().url();
const nonNegativeIntSchema = z.coerce.number().int().min(0);
const positiveIntSchema = z.coerce.number().int().min(1);

const rawEnvSchema = z.object({
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
