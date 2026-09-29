import type { ZodError } from 'zod';

import { parseBffEnv } from './bff-env.server';
import { formatEnvError, validateEnvOrThrow } from './env.server';

try {
  validateEnvOrThrow();
  parseBffEnv(process.env);
} catch (error) {
  if (error instanceof Error && 'issues' in error) {
    console.error(formatEnvError(error as ZodError));
  } else {
    console.error('Invalid environment configuration.');
  }

  process.exitCode = 1;
}
