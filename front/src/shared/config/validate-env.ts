import { formatEnvError, validateEnvOrThrow } from './env.server';

try {
  validateEnvOrThrow();
} catch (error) {
  if (error instanceof Error && 'issues' in error) {
    console.error(formatEnvError(error as import('zod').ZodError));
  } else {
    console.error('Invalid environment configuration.');
  }

  process.exitCode = 1;
}
