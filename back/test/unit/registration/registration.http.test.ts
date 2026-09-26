import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ListActiveInterests } from '../../../src/modules/catalog/application/use-cases/list-active-interests.use-case';
import { CatalogModule } from '../../../src/modules/catalog/catalog.module';
import { ProfilesModule } from '../../../src/modules/profiles/profiles.module';
import { CheckRegistrationEligibility } from '../../../src/modules/registration/application/use-cases/check-registration-eligibility.use-case';
import { ListApprovedLegalDocuments } from '../../../src/modules/registration/application/use-cases/list-approved-legal-documents.use-case';
import { RegistrationFlow } from '../../../src/modules/registration/application/use-cases/registration-flow.use-case';
import { RegistrationError } from '../../../src/modules/registration/domain/errors/registration.error';
import { RegistrationModule } from '../../../src/modules/registration/registration.module';
import { configureApplication } from '../../../src/main';
import { validateEnv } from '../../../src/shared/infrastructure/config/env';

const BFF = { 'X-EventMatch-BFF-Token': process.env.BFF_INTERNAL_TOKEN! };
const TOKEN = 'A'.repeat(43);
const ROTATED = 'B'.repeat(43);
const FINGERPRINT = Buffer.alloc(32, 7).toString('base64url');
const KEY = '0192f4c4-7d1a-7b8e-9d3f-3a6c1e2b4f50';
const BASE = '/api/v1/registration';
const WINDOW = { expiresAt: '2026-09-26T12:15:00.000Z', nextResendAt: '2026-09-26T12:01:00.000Z' };

const flow = {
  requestContactVerification: mock(async () => ({ body: WINDOW, continuation: null })),
  resendContactVerification: mock(async () => ({ body: WINDOW, continuation: null })),
  confirmContact: mock(async () => ({ body: { verified: true }, continuation: ROTATED })),
  confirmContactByLink: mock(async () => ({ body: { verified: false }, continuation: null })),
  choosePassword: mock(async (): Promise<unknown> => ({
    body: { stage: 'registration_in_progress', expiresAt: '2026-09-27T12:00:00.000Z' },
    continuation: ROTATED,
  })),
  saveRequiredData: mock(async () => ({ body: {}, continuation: null })),
  complete: mock(async () => ({ body: { status: 'active' }, continuation: null })),
  snapshot: mock(async () => ({
    stage: 'verification_pending',
    expiresAt: new Date('2026-09-26T12:15:00.000Z'),
    nextResendAt: new Date('2026-09-26T12:01:00.000Z'),
  })),
};
const eligibility = { execute: mock(async (): Promise<unknown> => ({ eligible: true, continuation: TOKEN, expiresAt: new Date() })) };

async function createApp(overrides: Record<string, string> = {}): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        isGlobal: true,
        validate: (environment) => validateEnv({ ...environment, ...overrides }),
      }),
      ProfilesModule,
      CatalogModule,
      RegistrationModule,
    ],
  })
    .overrideProvider(RegistrationFlow)
    .useValue(flow)
    .overrideProvider(CheckRegistrationEligibility)
    .useValue(eligibility)
    .overrideProvider(ListApprovedLegalDocuments)
    .useValue({ execute: async () => [] })
    .overrideProvider(ListActiveInterests)
    .useValue({ execute: async () => [{ id: '00000000-0000-7000-8000-000000000001', slug: 'cinema', label: 'Cinema' }] })
    .compile();
  const app = module.createNestApplication();
  configureApplication(app);
  await app.init();
  return app;
}

describe('registration HTTP contract v1', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const authorized = { ...BFF, Authorization: `Bearer ${TOKEN}`, 'Idempotency-Key': KEY };

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    Object.values(flow).forEach((fn) => fn.mockClear());
    eligibility.execute.mockClear();
  });

  describe('BFF boundary (ADR-022, ADR-023)', () => {
    test.each([
      ['missing', {}],
      ['wrong', { 'X-EventMatch-BFF-Token': Buffer.alloc(32, 6).toString('base64') }],
    ])('rejects a %s internal token before any use case, with no-store', async (_label, headers) => {
      const response = await http().post(`${BASE}/eligibility`).set(headers).send({ birthDate: '1990-05-10' }).expect(401);

      expect(response.body).toEqual({ data: {}, message: 'Authentication is required.', statusCode: 401 });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(eligibility.execute).not.toHaveBeenCalled();
    });

    test('a forged forwarding header is not an origin fingerprint', async () => {
      await http()
        .post(`${BASE}/contact-verification`)
        .set({ ...authorized, 'X-Forwarded-For': '203.0.113.9' })
        .send({ channel: 'email', contact: 'ana@example.test' })
        .expect(400);
      expect(flow.requestContactVerification).not.toHaveBeenCalled();
    });
  });

  describe('eligibility', () => {
    test('hands the continuation over in the internal header only when eligible', async () => {
      const response = await http().post(`${BASE}/eligibility`).set(BFF).send({ birthDate: '1990-05-10' }).expect(200);

      expect(response.body).toEqual({ data: { eligible: true }, message: 'Elegibilidade verificada.', statusCode: 200 });
      expect(response.headers['x-registration-continuation']).toBe(TOKEN);

      eligibility.execute.mockResolvedValueOnce({ eligible: false });
      const minor = await http().post(`${BASE}/eligibility`).set(BFF).send({ birthDate: '2015-01-01' }).expect(200);
      expect(minor.body.data).toEqual({ eligible: false });
      expect(minor.headers['x-registration-continuation']).toBeUndefined();
    });

    test('rejects malformed dates without echoing them', async () => {
      const response = await http().post(`${BASE}/eligibility`).set(BFF).send({ birthDate: '10/05/1990' }).expect(400);
      expect(JSON.stringify(response.body)).not.toContain('1990');
    });

    test('maps a nonexistent date to 422 with a safe reason', async () => {
      eligibility.execute.mockRejectedValueOnce(new RegistrationError('INVALID_BIRTH_DATE'));
      const response = await http().post(`${BASE}/eligibility`).set(BFF).send({ birthDate: '2001-02-30' }).expect(422);
      expect(response.body).toEqual({
        data: { reason: 'invalid_birth_date' },
        message: 'The request could not be processed.',
        statusCode: 422,
      });
    });
  });

  describe('contact verification', () => {
    test('accepts e-mail with continuation, key and fingerprint and answers 202 neutrally', async () => {
      const response = await http()
        .post(`${BASE}/contact-verification`)
        .set({ ...authorized, 'X-EventMatch-Origin-Fingerprint': FINGERPRINT })
        .send({ channel: 'email', contact: 'ana@example.test' })
        .expect(202);

      expect(response.body).toEqual({
        data: WINDOW,
        message: 'Se o contato puder ser usado, enviaremos um código.',
        statusCode: 202,
      });
      expect(flow.requestContactVerification).toHaveBeenCalledWith(
        { token: TOKEN, idempotencyKey: KEY },
        { contact: 'ana@example.test', originFingerprint: Buffer.from(FINGERPRINT, 'base64url') },
      );
    });

    test('rejects WhatsApp in validation, before any effect (ADR-025)', async () => {
      await http()
        .post(`${BASE}/contact-verification`)
        .set({ ...authorized, 'X-EventMatch-Origin-Fingerprint': FINGERPRINT })
        .send({ channel: 'whatsapp', contact: '+5581999999999' })
        .expect(400);
      expect(flow.requestContactVerification).not.toHaveBeenCalled();
    });

    test('a missing continuation is 401 even when the body is invalid', async () => {
      await http().post(`${BASE}/contact-verification`).set(BFF).send({ channel: 'fax' }).expect(401);
    });

    test.each([
      ['no idempotency key', { 'Idempotency-Key': undefined }],
      ['a short idempotency key', { 'Idempotency-Key': 'short' }],
    ])('rejects %s', async (_label, override) => {
      const headers: Record<string, string> = { ...authorized, 'X-EventMatch-Origin-Fingerprint': FINGERPRINT };
      for (const [name, value] of Object.entries(override)) {
        if (value === undefined) delete headers[name];
        else headers[name] = value;
      }
      await http().post(`${BASE}/contact-verification`).set(headers).send({ channel: 'email', contact: 'ana@example.test' }).expect(400);
      expect(flow.requestContactVerification).not.toHaveBeenCalled();
    });

    test('never accepts internal ids from the browser', async () => {
      await http()
        .post(`${BASE}/contact-verification/confirm`)
        .set(authorized)
        .send({ otp: '123456', verificationId: '00000000-0000-7000-8000-000000000001' })
        .expect(400);
      expect(flow.confirmContact).not.toHaveBeenCalled();
    });

    test('rotates the continuation on confirmation', async () => {
      const response = await http().post(`${BASE}/contact-verification/confirm`).set(authorized).send({ otp: '123456' }).expect(200);
      expect(response.body.data).toEqual({ verified: true });
      expect(response.headers['x-registration-continuation']).toBe(ROTATED);
    });

    test('confirms by link without a continuation', async () => {
      const response = await http()
        .post(`${BASE}/contact-verification/confirm-link`)
        .set(BFF)
        .send({ token: TOKEN })
        .expect(200);
      expect(response.body.data).toEqual({ verified: false });
      expect(flow.confirmContactByLink).toHaveBeenCalledWith({ token: TOKEN });
    });
  });

  describe('password and errors', () => {
    test('the confirmation must match and never reaches the flow', async () => {
      await http()
        .put(`${BASE}/password`)
        .set(authorized)
        .send({ password: 'uma senha longa', passwordConfirmation: 'outra senha longa' })
        .expect(400);
      await http()
        .put(`${BASE}/password`)
        .set(authorized)
        .send({ password: 'uma senha longa', passwordConfirmation: 'uma senha longa' })
        .expect(200);
      expect(flow.choosePassword).toHaveBeenCalledWith({ token: TOKEN, idempotencyKey: KEY }, { password: 'uma senha longa' });
    });

    test.each([
      ['WEAK_PASSWORD', 422, { reason: 'weak_password' }],
      ['FLOW_UNAUTHORIZED', 401, {}],
      ['FLOW_STAGE_CONFLICT', 409, {}],
      ['IDEMPOTENCY_CONFLICT', 409, {}],
    ] as const)('maps %s to %i', async (code, status, data) => {
      flow.choosePassword.mockRejectedValueOnce(new RegistrationError(code));
      const response = await http()
        .put(`${BASE}/password`)
        .set(authorized)
        .send({ password: 'uma senha longa', passwordConfirmation: 'uma senha longa' })
        .expect(status);
      expect(response.body.data).toEqual(data);
      expect(response.headers['cache-control']).toBe('no-store');
    });

    test('unexpected failures keep the generic 500 envelope', async () => {
      flow.choosePassword.mockRejectedValueOnce(new Error('database exploded with secrets'));
      const response = await http()
        .put(`${BASE}/password`)
        .set(authorized)
        .send({ password: 'uma senha longa', passwordConfirmation: 'uma senha longa' })
        .expect(500);
      expect(JSON.stringify(response.body)).not.toContain('secrets');
    });
  });

  describe('reads', () => {
    test('the snapshot is minimal and private', async () => {
      const response = await http().get(BASE).set({ ...BFF, Authorization: `Bearer ${TOKEN}` }).expect(200);
      expect(response.body.data).toEqual({
        stage: 'verification_pending',
        expiresAt: '2026-09-26T12:15:00.000Z',
        nextResendAt: '2026-09-26T12:01:00.000Z',
      });
      expect(response.headers['cache-control']).toBe('no-store');
    });

    test('legal documents answer an empty list while nothing is approved', async () => {
      const response = await http().get(`${BASE}/legal-documents?locale=pt-BR`).set(BFF).expect(200);
      expect(response.body.data).toEqual({ documents: [] });
      await http().get(`${BASE}/legal-documents?locale=en-US`).set(BFF).expect(400);
    });

    test('the interest catalog is public', async () => {
      const response = await http().get('/api/v1/catalog/interests?locale=pt-BR').expect(200);
      expect(response.body.data.interests).toHaveLength(1);
    });
  });

  test('completion validates arrays and delegates the ids untouched', async () => {
    await http()
      .post(`${BASE}/complete`)
      .set(authorized)
      .send({ birthDate: '1990-05-10', documentIds: ['not-a-uuid'], interestIds: [] })
      .expect(400);
    const body = {
      birthDate: '1990-05-10',
      documentIds: ['10000000-0000-7000-8000-000000000001'],
      interestIds: ['00000000-0000-7000-8000-000000000001'],
    };
    await http().post(`${BASE}/complete`).set(authorized).send(body).expect(200);
    expect(flow.complete).toHaveBeenCalledWith({ token: TOKEN, idempotencyKey: KEY }, body);
  });

  test('the OpenAPI contract is versioned and documents every route and internal header', async () => {
    const response = await http().get('/docs-json').expect(200);
    const document = response.body as {
      info: { version: string };
      paths: Record<string, Record<string, { parameters?: { name: string; in: string; required?: boolean }[] }>>;
    };

    expect(document.info.version).toBe('0.9.0');
    const contract = Object.fromEntries(
      Object.entries(document.paths)
        .filter(([path]) => path.startsWith('/api/v1/'))
        .map(([path, operations]) => [
          path,
          Object.fromEntries(
            Object.entries(operations).map(([method, operation]) => [
              method,
              (operation.parameters ?? [])
                .filter((parameter) => parameter.in === 'header')
                .map((parameter) => `${parameter.name}${parameter.required ? '*' : ''}`)
                .sort(),
            ]),
          ),
        ]),
    );
    expect(contract).toMatchSnapshot();
    expect(JSON.stringify(document)).not.toContain(process.env.BFF_INTERNAL_TOKEN!);
  });
});

describe('registration routes behind the rollout flag', () => {
  test('answer 404 while REGISTRATION_HTTP_ENABLED is false', async () => {
    const app = await createApp({ REGISTRATION_HTTP_ENABLED: 'false' });
    try {
      await request(app.getHttpServer()).post(`${BASE}/eligibility`).set(BFF).send({ birthDate: '1990-05-10' }).expect(404);
    } finally {
      await app.close();
    }
  });
});
