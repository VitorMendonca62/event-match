import { Injectable, Logger } from '@nestjs/common';

import type {
  RegistrationEvent,
  RegistrationTelemetryPort,
} from '../../domain/ports/outbound/registration-telemetry.port';

/** One structured JSON line per event; the port contract already excludes PII and secrets. */
@Injectable()
export class LoggerRegistrationTelemetryAdapter implements RegistrationTelemetryPort {
  record(event: RegistrationEvent): void {
    const { name, ...fields } = event;
    Logger.log(JSON.stringify({ event: `registration.${name}`, ...fields }), 'Registration');
  }
}
