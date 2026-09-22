import { formatEnvError, envSchema } from './env';

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(formatEnvError(parsed.error));
  process.exitCode = 1;
}
