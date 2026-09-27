import type { IdGeneratorPort } from '../../domain/ports/outbound/runtime.ports';
import type {
  ContactProtectorPort,
  VerificationDeliveryPort,
} from '../../domain/ports/outbound/security.ports';
import { ContactIdentifier } from '../../domain/value-objects/contact-identifier';

export interface SendEmailDeliveryTestResult {
  readonly accepted: boolean;
}

/**
 * Sends the production verification template without creating a usable challenge. This use case is
 * exposed only by a non-production, Brevo-only HTTP route guarded in the presentation layer.
 */
export class SendEmailDeliveryTest {
  constructor(
    private readonly contacts: ContactProtectorPort,
    private readonly delivery: VerificationDeliveryPort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async execute(input: { contact: string; idempotencyKey: string }): Promise<SendEmailDeliveryTestResult> {
    const contact = ContactIdentifier.create('email', input.contact);
    return this.delivery.send({
      kind: 'verify',
      verificationId: this.ids.next(),
      channel: 'email',
      sealedContact: this.contacts.seal(contact),
      otp: '000000',
      linkToken: null,
      idempotencyKey: `email-delivery-test:${input.idempotencyKey}`,
    });
  }
}
