export const IDEMPOTENCY_HEADER = 'idempotency-key';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;

export function readIdempotencyKey(request: Request): string | null | undefined {
  const value = request.headers.get(IDEMPOTENCY_HEADER);
  if (value === null) return null;
  return IDEMPOTENCY_KEY.test(value) ? value : undefined;
}
