import { Injectable, Logger } from '@nestjs/common';

import type {
  AuthenticationEvent,
  AuthenticationTelemetryPort,
} from '../../domain/ports/outbound/authentication-telemetry.port';

/**
 * One structured JSON line per event built from an allowlist, so no field outside the port
 * contract (and therefore no PII, token or hash) can reach the log.
 */
@Injectable()
export class LoggerAuthenticationTelemetryAdapter implements AuthenticationTelemetryPort {
  record(event: AuthenticationEvent): void {
    Logger.log(
      JSON.stringify({
        event: `identity_access.${event.name}`,
        outcome: event.outcome,
        correlationId: event.correlationId,
        ...(event.durationMs === undefined ? {} : { durationMs: Math.round(event.durationMs) }),
        ...(event.scope ? { scope: event.scope } : {}),
        ...(event.count === undefined ? {} : { count: event.count }),
      }),
      'IdentityAccess',
    );
  }
}
