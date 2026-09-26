import type { RegistrationTelemetryPort } from '../../domain/ports/outbound/registration-telemetry.port';
import type {
  VerificationDeliveryPort,
  VerificationDeliveryRequest,
} from '../../domain/ports/outbound/security.ports';

/**
 * Sends after commit (ADR-016). Delivery failures never change the neutral response
 * (ADR-010); they are recorded without contact or code.
 */
export class VerificationDispatcher {
  constructor(
    private readonly delivery: VerificationDeliveryPort,
    private readonly telemetry: RegistrationTelemetryPort,
  ) {}

  async dispatch(request: VerificationDeliveryRequest): Promise<void> {
    try {
      const result = await this.delivery.send(request);
      if (result.accepted) return;
    } catch {
      // Falls through to the neutral failure event below.
    }
    this.telemetry.record({
      name: 'verification.delivery_failed',
      outcome: request.kind,
      channel: request.channel,
      verificationId: request.kind === 'verify' ? request.verificationId : undefined,
    });
  }
}
