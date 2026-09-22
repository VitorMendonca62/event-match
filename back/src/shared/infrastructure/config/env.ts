import { z } from 'zod';

const portSchema = z.coerce.number().int().min(1).max(65_535);
const booleanSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: portSchema.default(3001),
  HOSTNAME: z.string().trim().min(1).default('0.0.0.0'),
  SWAGGER_ENABLED: booleanSchema.default(true),
  SWAGGER_PATH: z.string().trim().min(1).default('docs'),
});

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
