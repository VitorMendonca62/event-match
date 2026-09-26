const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards `uuid` lookups: a malformed id must behave as "not found" instead of raising
 * `22P02`, which would abort the surrounding transaction.
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
