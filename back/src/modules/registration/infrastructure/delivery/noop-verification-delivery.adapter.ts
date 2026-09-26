import { Injectable } from '@nestjs/common';

import type {
  VerificationDeliveryPort,
  VerificationDeliveryRequest,
} from '../../domain/ports/outbound/security.ports';

/**
 * Deliberately calls no provider. Only for tests and explicitly configured local development
 * (`VERIFICATION_DELIVERY_MODE=noop`); the environment schema refuses it in production (ADR-025).
 * It must not log the request, which carries the OTP and the link token.
 */
@Injectable()
export class NoopVerificationDeliveryAdapter implements VerificationDeliveryPort {
  async send(request: VerificationDeliveryRequest): Promise<{ accepted: boolean }> {
    void request;
    return { accepted: true };
  }
}
