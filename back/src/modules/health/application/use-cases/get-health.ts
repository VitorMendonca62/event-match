import type { HealthResult } from '../../domain/ports/inbound/get-health.port';

export function getHealth(): HealthResult {
  return { status: 'ok' };
}
