/**
 * Structured BFF log line built from an allowlist: route, operation, status, duration and a
 * generated correlation id. Bodies, queries, cookies, headers and personal data never get here.
 */
export type BffLogEntry = Readonly<{
  /** Defaults to the registration BFF; the auth BFF logs as `auth-bff`. */
  scope?: 'registration-bff' | 'auth-bff';
  operation: string;
  status: number;
  durationMs: number;
  correlationId: string;
}>;

export function logBffEvent(entry: BffLogEntry, sink: (line: string) => void = console.info): void {
  sink(
    JSON.stringify({
      scope: entry.scope ?? 'registration-bff',
      operation: entry.operation,
      status: entry.status,
      durationMs: Math.round(entry.durationMs),
      correlationId: entry.correlationId,
    }),
  );
}
