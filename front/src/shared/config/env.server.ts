import { z } from 'zod';

const portSchema = z.coerce.number().int().min(1).max(65_535);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: portSchema.default(3000),
  HOSTNAME: z.string().trim().min(1).default('0.0.0.0'),
});

export type FrontendEnv = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined>): FrontendEnv {
  return envSchema.parse(input);
}

export function formatEnvError(error: z.ZodError): string {
  const details = error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ');

  return `Invalid environment configuration. ${details}`;
}

export function validateEnvOrThrow(
  input: Record<string, string | undefined> = process.env,
): FrontendEnv {
  return parseEnv(input);
}
