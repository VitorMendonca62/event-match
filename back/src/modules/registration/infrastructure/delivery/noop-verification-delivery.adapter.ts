import { Injectable } from '@nestjs/common';
import type { VerificationDeliveryPort } from '../../domain/ports/outbound/security.ports';

/** Deliberately does not call a provider; delivery integration is a later vertical slice. */
@Injectable()
export class NoopVerificationDeliveryAdapter implements VerificationDeliveryPort {
  async send(): Promise<{ accepted: boolean }> { return { accepted: true }; }
}
