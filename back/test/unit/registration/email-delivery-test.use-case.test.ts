import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';

import { SendEmailDeliveryTest } from '../../../src/modules/registration/application/use-cases/send-email-delivery-test.use-case';
import { ID_GENERATOR_PORT } from '../../../src/modules/registration/domain/ports/outbound/runtime.ports';
import {
  CONTACT_PROTECTOR_PORT,
  VERIFICATION_DELIVERY_PORT,
} from '../../../src/modules/registration/domain/ports/outbound/security.ports';
import { useCaseProvider } from '../../../src/shared/infrastructure/nest/use-case.provider';
import { CapturingDelivery, FakeContactProtector } from '../../support/registration-fakes';

describe('SendEmailDeliveryTest', () => {
  let module: TestingModule;
  let useCase: SendEmailDeliveryTest;
  const contacts = new FakeContactProtector();
  const delivery = new CapturingDelivery();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        useCaseProvider(SendEmailDeliveryTest, [
          CONTACT_PROTECTOR_PORT,
          VERIFICATION_DELIVERY_PORT,
          ID_GENERATOR_PORT,
        ]),
        { provide: CONTACT_PROTECTOR_PORT, useValue: contacts },
        { provide: VERIFICATION_DELIVERY_PORT, useValue: delivery },
        { provide: ID_GENERATOR_PORT, useValue: { next: () => '00000000-0000-7000-8000-000000000099' } },
      ],
    }).compile();
    useCase = module.get(SendEmailDeliveryTest);
  });

  afterAll(async () => {
    await module.close();
  });

  test('sends the production verification template without creating a usable challenge', async () => {
    const result = await useCase.execute({
      contact: ' Smoke@Example.TEST ',
      idempotencyKey: '0192f4c4-7d1a-7b8e-9d3f-3a6c1e2b4f50',
    });

    expect(result).toEqual({ accepted: true });
    expect(delivery.sent).toHaveLength(1);
    expect(delivery.sent[0]).toMatchObject({
      kind: 'verify',
      verificationId: '00000000-0000-7000-8000-000000000099',
      channel: 'email',
      otp: '000000',
      linkToken: null,
      idempotencyKey: 'email-delivery-test:0192f4c4-7d1a-7b8e-9d3f-3a6c1e2b4f50',
    });
    const sent = delivery.sent[0];
    if (!sent) throw new Error('Expected one delivery.');
    expect(contacts.open('email', sent.sealedContact).value).toBe('smoke@example.test');
  });
});
