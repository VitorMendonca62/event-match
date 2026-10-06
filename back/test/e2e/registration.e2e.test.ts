import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const baseUrl = process.env.E2E_BASE_URL;
const brevoUrl = process.env.E2E_FAKE_BREVO_URL;
const databaseUrl = process.env.E2E_DATABASE_URL;
const bffToken = process.env.E2E_BFF_INTERNAL_TOKEN;
if (!baseUrl || !brevoUrl || !databaseUrl || !bffToken) {
  throw new Error('E2E_BASE_URL, E2E_FAKE_BREVO_URL, E2E_DATABASE_URL and E2E_BFF_INTERNAL_TOKEN are required.');
}

const ADULT = '1990-05-10';
const PASSWORD = 'uma senha longa e rara';
const DOCUMENT_IDS = [randomUUID(), randomUUID(), randomUUID()];
const NEW_TERMS_ID = randomUUID();
const INTEREST_IDS = [1, 2, 3].map((n) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`);

interface Reply {
  status: number;
  body: { data: Record<string, unknown>; message: string; statusCode: number };
  continuation: string | null;
  cacheControl: string | null;
}

interface Email {
  to: string[];
  text: string;
}

/** Plays the Next.js BFF: internal token, origin fingerprint and continuation kept server-side. */
async function call(
  method: string,
  path: string,
  options: { body?: unknown; token?: string | null; key?: string; fingerprint?: string; bff?: string } = {},
): Promise<Reply> {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-eventmatch-bff-token': options.bff ?? bffToken! };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.key) headers['idempotency-key'] = options.key;
  if (options.fingerprint) headers['x-eventmatch-origin-fingerprint'] = options.fingerprint;
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return {
    status: response.status,
    body: (await response.json()) as Reply['body'],
    continuation: response.headers.get('x-registration-continuation'),
    cacheControl: response.headers.get('cache-control'),
  };
}

const key = () => randomUUID();
const fingerprint = () => randomBytes(32).toString('base64url');
const unique = (label: string) => `${label}-${randomBytes(4).toString('hex')}@example.test`;

async function emailsTo(address: string): Promise<Email[]> {
  const messages = (await (await fetch(new URL('/__messages', brevoUrl))).json()) as Email[];
  return messages.filter((message) => message.to.includes(address));
}

async function lastOtp(address: string): Promise<string> {
  const [last] = (await emailsTo(address)).slice(-1);
  const otp = last?.text.match(/\b(\d{6})\b/)?.[1];
  if (!otp) throw new Error('no OTP delivered');
  return otp;
}

async function lastLinkToken(address: string): Promise<string> {
  const [last] = (await emailsTo(address)).slice(-1);
  const token = last?.text.match(/token=([A-Za-z0-9_-]{43})/)?.[1];
  if (!token) throw new Error('no link delivered');
  return token;
}

async function eligible(): Promise<string> {
  const reply = await call('POST', '/api/v1/registration/eligibility', { body: { birthDate: ADULT } });
  expect(reply.status).toBe(200);
  return reply.continuation!;
}

async function requestCode(token: string, contact: string, origin = fingerprint()): Promise<Reply> {
  return call('POST', '/api/v1/registration/contact-verification', {
    token,
    key: key(),
    fingerprint: origin,
    body: { channel: 'email', contact },
  });
}

async function incompleteAccount(contact: string): Promise<string> {
  let token = await eligible();
  expect((await requestCode(token, contact)).status).toBe(202);
  const confirmed = await call('POST', '/api/v1/registration/contact-verification/confirm', {
    token,
    key: key(),
    body: { otp: await lastOtp(contact) },
  });
  expect(confirmed.body.data).toEqual({ verified: true });
  token = confirmed.continuation!;
  const password = await call('PUT', '/api/v1/registration/password', {
    token,
    key: key(),
    body: { password: PASSWORD, passwordConfirmation: PASSWORD },
  });
  expect(password.status).toBe(200);
  const required = await call('PUT', '/api/v1/registration/required-data', {
    token: password.continuation,
    key: key(),
    body: { displayName: 'Ana', region: 'Recife - PE', usageIntents: ['friendship'] },
  });
  expect(required.body.data).toMatchObject({ stage: 'account_incomplete' });
  return required.continuation!;
}

describe('Registration API v1 (e2e, container + fake Brevo)', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });

  afterAll(async () => {
    await pool.end();
  });

  describe('seeded legal documents (ADR-028)', () => {
    const SEEDED_IDS = [1, 2, 3].map((n) => `019c0000-0000-7000-8000-00000000000${n}`);

    test('the list carries the Markdown text without frontmatter and is never cached', async () => {
      const response = await fetch(new URL('/api/v1/registration/legal-documents?locale=pt-BR', baseUrl), {
        headers: { 'x-eventmatch-bff-token': bffToken! },
      });
      const body = (await response.json()) as { data: { documents: Record<string, string>[] } };

      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(body.data.documents.map((document) => document.kind)).toEqual(['community_rules', 'privacy', 'terms']);
      for (const document of body.data.documents) {
        expect(SEEDED_IDS).toContain(document.id);
        expect(document.version).toBe('1.0.0');
        expect(document.content.startsWith('# ')).toBe(true);
        expect(document.content).not.toContain('document_id:');
      }
    });
  });

  describe('without a current legal document', () => {
    beforeAll(async () => {
      await pool.query(`update terms_document set status = 'retired' where status = 'approved'`);
    });

    test('activation is refused with a safe 422 and the document list is empty', async () => {
      const documents = await call('GET', '/api/v1/registration/legal-documents?locale=pt-BR');
      expect(documents.body.data).toEqual({ documents: [] });

      const token = await incompleteAccount(unique('sem-termos'));
      const reply = await call('POST', '/api/v1/registration/complete', {
        token,
        key: key(),
        body: { birthDate: ADULT, documentIds: DOCUMENT_IDS, interestIds: INTEREST_IDS },
      });
      expect(reply.status).toBe(422);
      expect(reply.body.data).toEqual({ reason: 'activation_unavailable' });
    });
  });

  describe('with approved fixtures in the disposable database', () => {
    beforeAll(async () => {
      for (const [index, kind] of ['terms', 'privacy', 'community_rules'].entries()) {
        await pool.query(
          `insert into terms_document (id, kind, version, locale, effective_at, content_digest, content, status)
           values ($1, $2, 'e2e-fixture', 'pt-BR', now() - interval '1 hour', sha256(convert_to('# fixture', 'UTF8')), '# fixture', 'approved')`,
          [DOCUMENT_IDS[index], kind],
        );
      }
    });

    test('eligibility → e-mail OTP → password → required data → interests/terms → active', async () => {
      const contact = unique('feliz');
      const token = await incompleteAccount(contact);
      const documents = await call('GET', '/api/v1/registration/legal-documents?locale=pt-BR');
      const documentIds = (documents.body.data.documents as { id: string }[]).map((document) => document.id);
      const interests = await fetch(new URL('/api/v1/catalog/interests?locale=pt-BR', baseUrl)).then((response) => response.json());
      const interestIds = (interests.data.interests as { id: string }[]).slice(0, 3).map((interest) => interest.id);

      const reply = await call('POST', '/api/v1/registration/complete', {
        token,
        key: key(),
        body: { birthDate: ADULT, documentIds, interestIds },
      });

      expect(reply.status).toBe(200);
      expect(reply.body).toEqual({ data: { status: 'active' }, message: 'Cadastro concluído.', statusCode: 200 });
      expect(reply.cacheControl).toBe('no-store');
      expect((await call('GET', '/api/v1/registration', { token })).status).toBe(401);
    });

    test('a version published during the flow makes the accepted ids stale until they are reloaded', async () => {
      const token = await incompleteAccount(unique('troca'));
      const listed = async () =>
        ((await call('GET', '/api/v1/registration/legal-documents?locale=pt-BR')).body.data.documents as { id: string }[]).map(
          (document) => document.id,
        );
      const before = await listed();
      expect(before.sort()).toEqual([...DOCUMENT_IDS].sort());
      const interests = await fetch(new URL('/api/v1/catalog/interests?locale=pt-BR', baseUrl)).then((response) => response.json());
      const interestIds = (interests.data.interests as { id: string }[]).slice(0, 3).map((interest) => interest.id);

      await pool.query(
        `insert into terms_document (id, kind, version, locale, effective_at, content_digest, content, status)
         values ($1, 'terms', 'e2e-fixture-2', 'pt-BR', now(), sha256(convert_to('# novo', 'UTF8')), '# novo', 'approved')`,
        [NEW_TERMS_ID],
      );

      const stale = await call('POST', '/api/v1/registration/complete', {
        token,
        key: key(),
        body: { birthDate: ADULT, documentIds: before, interestIds },
      });
      expect(stale.status).toBe(422);
      expect(stale.body.data).toEqual({ reason: 'activation_unavailable' });

      const reloaded = await listed();
      expect(reloaded).toContain(NEW_TERMS_ID);
      expect(reloaded).not.toContain(DOCUMENT_IDS[0]!);
      const fresh = await call('POST', '/api/v1/registration/complete', {
        token,
        key: key(),
        body: { birthDate: ADULT, documentIds: reloaded, interestIds },
      });
      expect(fresh.status).toBe(200);
    });

    test('the e-mail link confirms once and hands over a new continuation', async () => {
      const contact = unique('link');
      const token = await eligible();
      await requestCode(token, contact);
      const link = await lastLinkToken(contact);

      const first = await call('POST', '/api/v1/registration/contact-verification/confirm-link', { body: { token: link } });
      expect(first.body.data).toEqual({ verified: true });
      expect(first.continuation).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect((await call('GET', '/api/v1/registration', { token: first.continuation })).body.data).toMatchObject({
        stage: 'contact_verified',
      });
      const second = await call('POST', '/api/v1/registration/contact-verification/confirm-link', { body: { token: link } });
      expect(second.body.data).toEqual({ verified: false });
      expect(second.continuation).toBeNull();
    });
  });

  test('cancelling after the password answers 200, revokes the continuation and frees the contact (ADR-030)', async () => {
    const contact = unique('cancela');
    let token = await eligible();
    expect((await requestCode(token, contact)).status).toBe(202);
    const confirmed = await call('POST', '/api/v1/registration/contact-verification/confirm', {
      token,
      key: key(),
      body: { otp: await lastOtp(contact) },
    });
    const password = await call('PUT', '/api/v1/registration/password', {
      token: confirmed.continuation!,
      key: key(),
      body: { password: PASSWORD, passwordConfirmation: PASSWORD },
    });
    token = password.continuation!;

    const cancelled = await call('DELETE', '/api/v1/registration', { token });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toEqual({ data: { cancelled: true }, message: 'Cadastro cancelado.', statusCode: 200 });
    expect(cancelled.cacheControl).toBe('no-store');

    expect((await call('GET', '/api/v1/registration', { token })).status).toBe(401);
    expect((await call('DELETE', '/api/v1/registration', { token })).status).toBe(401);
    expect((await call('DELETE', '/api/v1/registration', { token: null })).status).toBe(401);
    const [row] = (await pool.query(
      `select status, contact_hash is null as no_contact from registration order by last_updated_at desc limit 1`,
    )).rows;
    expect(row).toEqual({ status: 'expired', no_contact: true });
  });

  test('a minor receives no continuation and no row is written', async () => {
    const [before] = (await pool.query(`select count(*)::int as count from registration_flow_session`)).rows;
    const reply = await call('POST', '/api/v1/registration/eligibility', { body: { birthDate: '2015-01-01' } });

    expect(reply.body.data).toEqual({ eligible: false });
    expect(reply.continuation).toBeNull();
    const [after] = (await pool.query(`select count(*)::int as count from registration_flow_session`)).rows;
    expect(after).toEqual(before);
  });

  test('WhatsApp is rejected in validation without any message or challenge (ADR-025)', async () => {
    const token = await eligible();
    const [before] = (await pool.query(`select count(*)::int as count from contact_verification`)).rows;
    const reply = await call('POST', '/api/v1/registration/contact-verification', {
      token,
      key: key(),
      fingerprint: fingerprint(),
      body: { channel: 'whatsapp', contact: '+5581999999999' },
    });

    expect(reply.status).toBe(400);
    const [after] = (await pool.query(`select count(*)::int as count from contact_verification`)).rows;
    expect(after).toEqual(before);
  });

  test('a wrong OTP answers verified false, and a resend within the cooldown stays neutral', async () => {
    const contact = unique('otp');
    const token = await eligible();
    await requestCode(token, contact);

    const wrong = await call('POST', '/api/v1/registration/contact-verification/confirm', {
      token,
      key: key(),
      body: { otp: (Number(await lastOtp(contact)) === 0 ? 1 : 0).toString().padStart(6, '0') },
    });
    expect(wrong.body.data).toEqual({ verified: false });

    const resend = await call('POST', '/api/v1/registration/contact-verification/resend', { token, key: key() });
    expect(resend.status).toBe(202);
    expect(Object.keys(resend.body.data).sort()).toEqual(['expiresAt', 'nextResendAt']);
    expect(await emailsTo(contact)).toHaveLength(1);
  });

  test('status, shape, message and timing do not reveal that a contact is taken', async () => {
    const taken = unique('existente');
    await incompleteAccount(taken);
    const probes: { reply: Reply; ms: number }[] = [];
    for (const contact of [taken, unique('novo')]) {
      const token = await eligible();
      const started = performance.now();
      const reply = await requestCode(token, contact);
      probes.push({ reply, ms: performance.now() - started });
    }

    const [existing, fresh] = probes;
    expect(existing?.reply.status).toBe(fresh?.reply.status);
    expect(existing?.reply.body.message).toBe(fresh?.reply.body.message);
    expect(Object.keys(existing!.reply.body.data).sort()).toEqual(Object.keys(fresh!.reply.body.data).sort());
    // Generous tolerance for a shared CI host; both paths do one send after one short transaction.
    expect(Math.abs(existing!.ms - fresh!.ms)).toBeLessThan(750);
    const notices = await emailsTo(taken);
    expect(notices.at(-1)?.text).not.toMatch(/\b\d{6}\b/);
  });

  test('replaying the same key returns the stored outcome without a second message', async () => {
    const contact = unique('replay');
    const token = await eligible();
    const options = { token, key: key(), fingerprint: fingerprint(), body: { channel: 'email', contact } };
    const first = await call('POST', '/api/v1/registration/contact-verification', options);
    const replay = await call('POST', '/api/v1/registration/contact-verification', options);
    const conflict = await call('POST', '/api/v1/registration/contact-verification', {
      ...options,
      body: { channel: 'email', contact: unique('outro') },
    });

    expect(replay.body).toEqual(first.body);
    expect(await emailsTo(contact)).toHaveLength(1);
    expect(conflict.status).toBe(409);
  });

  test('stolen, invalid or out-of-order continuations are refused', async () => {
    const token = await eligible();
    expect((await call('GET', '/api/v1/registration', { token: 'A'.repeat(43) })).status).toBe(401);
    expect((await call('GET', '/api/v1/registration', { token: 'not-a-token' })).status).toBe(401);
    const skipped = await call('PUT', '/api/v1/registration/password', {
      token,
      key: key(),
      body: { password: PASSWORD, passwordConfirmation: PASSWORD },
    });
    expect(skipped.status).toBe(409);
    expect(skipped.cacheControl).toBe('no-store');
  });

  test('a direct call without the BFF credential is refused', async () => {
    const reply = await call('POST', '/api/v1/registration/eligibility', {
      body: { birthDate: ADULT },
      bff: randomBytes(32).toString('base64'),
    });
    expect(reply.status).toBe(401);
    expect(reply.continuation).toBeNull();
  });

  test('the published OpenAPI document describes the registration contract', async () => {
    const document = await fetch(new URL('/docs-json', baseUrl)).then((response) => response.json());
    expect(document.info.version).toBe('0.13.0');
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/registration/eligibility',
        '/api/v1/registration/contact-verification',
        '/api/v1/registration/complete',
        '/api/v1/catalog/interests',
      ]),
    );
  });
});
