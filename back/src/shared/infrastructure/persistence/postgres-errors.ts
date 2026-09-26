export const POSTGRES_UNIQUE_VIOLATION = '23505';

/** Reads the SQLSTATE from a `pg` error, directly or wrapped by Drizzle's `DrizzleQueryError`. */
export function postgresErrorCode(error: unknown): string | undefined {
  for (let current = error, depth = 0; current && depth < 3; depth += 1) {
    if (typeof current !== 'object') return undefined;
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * Runs a write and replaces a unique violation with a typed application error, so SQL, parameters
 * and constraint names never cross the adapter boundary (ADR-016).
 */
export async function translateUniqueViolation<T>(
  write: () => Promise<T>,
  toError: () => Error,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (postgresErrorCode(error) === POSTGRES_UNIQUE_VIOLATION) throw toError();
    throw error;
  }
}
