import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { CONTACT_PROTECTOR_PORT, type VerificationDeliveryRequest } from '../../../src/modules/registration/domain/ports/outbound/security.ports';
import { ContactIdentifier } from '../../../src/modules/registration/domain/value-objects/contact-identifier';
import {
  BREVO_DELIVERY_OPTIONS,
  BrevoVerificationDeliveryAdapter,
} from '../../../src/modules/registration/infrastructure/delivery/brevo-verification-delivery.adapter';
import { validateEnv } from '../../../src/shared/infrastructure/config/env';
import { FakeContactProtector } from '../../support/registration-fakes';

interface Captured {
  method: string;
  path: string;
  apiKey: string | null;
  transportIdempotencyKey: string | null;
  body: {
    sender: { email: string; name?: string };
    to: Array<{ email: string }>;
    subject: string;
    htmlContent: string;
    textContent: string;
    headers: { idempotencyKey: string };
  };
}

type Handler = (request: Request) => Response | Promise<Response>;

const API_KEY = 'xkeysib-fictitious-contract-key';
const LINK_TOKEN = Buffer.alloc(32, 3).toString('base64url');
const contacts = new FakeContactProtector();
const verifyRequest: VerificationDeliveryRequest = {
  kind: 'verify',
  verificationId: '00000000-0000-7000-8000-000000000001',
  channel: 'email',
  sealedContact: contacts.seal(ContactIdentifier.create('email', 'ana@example.test')),
  otp: '123456',
  linkToken: LINK_TOKEN,
  idempotencyKey: '00000000-0000-7000-8000-00000000000a',
};

describe('BrevoVerificationDeliveryAdapter (provider contract, fake transport)', () => {
  let module: TestingModule;
  let captured: Captured[] = [];
  let aborted = 0;
  let handlers: Handler[] = [];
  let sleeps: number[] = [];
  let adapter: BrevoVerificationDeliveryAdapter;

  beforeAll(async () => {
    const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      captured.push({
        method: request.method,
        path: url.pathname,
        apiKey: request.headers.get('api-key'),
        transportIdempotencyKey: request.headers.get('idempotency-key'),
        body: (await request.json()) as Captured['body'],
      });
      request.signal.addEventListener('abort', () => {
        aborted += 1;
      });
      const handler = handlers.shift() ?? (() => Response.json({ messageId: 'email-id' }, { status: 201 }));
      return handler(request);
    }) as typeof fetch;

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          validate: (environment) =>
            validateEnv({
              ...environment,
              VERIFICATION_DELIVERY_MODE: 'brevo',
              BREVO_API_KEY: API_KEY,
              BREVO_BASE_URL: 'http://brevo.example.test/v3',
              EMAIL_FROM: 'EventMatch <nao-responda@example.test>',
              FRONTEND_PUBLIC_URL: 'https://app.example.test',
            }),
        }),
      ],
      providers: [
        BrevoVerificationDeliveryAdapter,
        { provide: CONTACT_PROTECTOR_PORT, useValue: contacts },
        {
          provide: BREVO_DELIVERY_OPTIONS,
          useValue: {
            timeoutMs: 150,
            sleep: async (milliseconds: number) => {
              sleeps.push(milliseconds);
            },
            fetch: fakeFetch,
          },
        },
      ],
    }).compile();
    adapter = module.get(BrevoVerificationDeliveryAdapter);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    captured = [];
    handlers = [];
    sleeps = [];
    aborted = 0;
  });

  test('POSTs /v3/smtp/email with the API key, stable idempotency and versioned template', async () => {
    await expect(adapter.send(verifyRequest)).resolves.toEqual({ accepted: true });

    expect(captured).toHaveLength(1);
    const [call] = captured;
    expect(call).toMatchObject({
      method: 'POST',
      path: '/v3/smtp/email',
      apiKey: API_KEY,
      transportIdempotencyKey: null,
    });
    expect(call?.body.sender).toEqual({ email: 'nao-responda@example.test', name: 'EventMatch' });
    expect(call?.body.to).toEqual([{ email: 'ana@example.test' }]);
    expect(call?.body.headers.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(call?.body.textContent).toContain('123456');
    expect(call?.body.htmlContent).toContain(
      `https://app.example.test/api/registration/contact-verification/confirm-link?token=${LINK_TOKEN}`,
    );
  });

  test('the recovery notice is neutral and carries no code or link', async () => {
    await adapter.send({
      kind: 'recovery_notice',
      channel: 'email',
      sealedContact: verifyRequest.sealedContact,
      idempotencyKey: 'recovery-key-0001',
    });
    expect(captured[0]?.body.textContent).not.toMatch(/\d{6}|token=/);
  });

  test('derives a provider UUID from a composed resend key', async () => {
    await adapter.send({ ...verifyRequest, idempotencyKey: `${verifyRequest.idempotencyKey}:resend:1` });

    expect(captured[0]?.body.headers.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(captured[0]?.body.headers.idempotencyKey).not.toContain(':');
  });

  test('retries 5xx at most twice with the same key, then gives up', async () => {
    handlers = [0, 1, 2].map(() => () => Response.json({ code: 'internal_error', message: 'x' }, { status: 500 }));

    await expect(adapter.send(verifyRequest)).resolves.toEqual({ accepted: false });
    expect(captured).toHaveLength(3);
    expect(new Set(captured.map((call) => call.body.headers.idempotencyKey)).size).toBe(1);
    expect(sleeps).toEqual([250, 500]);
  });

  test('honours a bounded Retry-After on 429', async () => {
    handlers = [
      () => Response.json({ code: 'rate_limit', message: 'x' }, { status: 429, headers: { 'Retry-After': '2' } }),
      () => Response.json({ code: 'rate_limit', message: 'x' }, { status: 429, headers: { 'Retry-After': '120' } }),
    ];

    await expect(adapter.send(verifyRequest)).resolves.toEqual({ accepted: true });
    expect(sleeps).toEqual([2_000, 5_000]);
  });

  test.each([400, 401, 422])('does not retry a definitive HTTP %s', async (status) => {
    handlers = [() => Response.json({ code: 'invalid_parameter', message: 'x' }, { status })];

    await expect(adapter.send(verifyRequest)).resolves.toEqual({ accepted: false });
    expect(captured).toHaveLength(1);
  });

  test('aborts a hanging attempt through the SDK and retries it', async () => {
    const hang: Handler = (request) =>
      new Promise<Response>((resolve) => {
        request.signal.addEventListener('abort', () => resolve(new Response(null, { status: 499 })));
      });
    handlers = [hang, hang];

    const started = performance.now();
    await expect(adapter.send(verifyRequest)).resolves.toEqual({ accepted: true });

    expect(captured).toHaveLength(3);
    await Bun.sleep(20);
    expect(aborted).toBeGreaterThanOrEqual(2);
    expect(performance.now() - started).toBeLessThan(1_500);
  });

  test('refuses WhatsApp instead of pretending it was delivered (ADR-025)', async () => {
    await expect(adapter.send({ ...verifyRequest, channel: 'whatsapp' })).resolves.toEqual({ accepted: false });
    expect(captured).toHaveLength(0);
  });
});
