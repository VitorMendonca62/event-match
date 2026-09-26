import { Injectable } from '@nestjs/common';

import type {
  VerificationDeliveryPort,
  VerificationDeliveryRequest,
} from '../../domain/ports/outbound/security.ports';

/**
 * Deliberately calls no provider; Resend and WhatsApp adapters are a later vertical slice
 * (ADR-010). It must not log the request, which carries the OTP.
 */
@Injectable()
export class NoopVerificationDeliveryAdapter implements VerificationDeliveryPort {
  async send(request: VerificationDeliveryRequest): Promise<{ accepted: boolean }> {
    void request;
    return { accepted: true };
  }
}
