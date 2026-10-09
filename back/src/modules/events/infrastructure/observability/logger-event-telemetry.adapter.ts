import { Injectable, Logger } from '@nestjs/common';

import type { EventTelemetryEntry, EventTelemetryPort } from '../../domain/ports/event-telemetry.port';

@Injectable()
export class LoggerEventTelemetryAdapter implements EventTelemetryPort {
  record(entry: EventTelemetryEntry): void {
    Logger.log(JSON.stringify({ event: `events.${entry.name}`, outcome: entry.outcome, correlationId: entry.correlationId }), 'Events');
  }
}
