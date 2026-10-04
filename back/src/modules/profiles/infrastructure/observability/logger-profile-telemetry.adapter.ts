import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { ProfileEvent, ProfileTelemetryPort } from '../../domain/ports/outbound/profile-telemetry.port';

@Injectable()
export class LoggerProfileTelemetryAdapter implements ProfileTelemetryPort {
  record(event: ProfileEvent): void {
    Logger.log(JSON.stringify({
      event: event.name,
      outcome: event.outcome,
      status: event.status,
      durationMs: Math.max(0, Math.round(event.durationMs)),
      correlationId: randomUUID(),
      ...(event.provider ? { provider: event.provider } : {}),
      ...(event.processedCount === undefined ? {} : { processedCount: event.processedCount }),
      ...(event.failedCount === undefined ? {} : { failedCount: event.failedCount }),
    }), 'Profiles');
  }
}
