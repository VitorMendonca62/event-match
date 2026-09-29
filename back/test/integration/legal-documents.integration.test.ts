import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';

import { DrizzleTermsRepository } from '../../src/modules/registration/infrastructure/persistence/repositories/drizzle-terms.repository';
import { createEphemeralDatabase, type EphemeralDatabase } from '../support/ephemeral-database';

const adminUrl = process.env.DATABASE_INTEGRATION_URL;
if (!adminUrl) throw new Error('DATABASE_INTEGRATION_URL is required for PostgreSQL integration tests.');

const LEGAL_DIR = join(process.cwd(), '..', 'docs', 'legal', 'pt-BR');
const SEEDED = [
  { id: '019c0000-0000-7000-8000-000000000001', kind: 'terms', file: 'termos-de-uso-v1.0.0.md' },
  { id: '019c0000-0000-7000-8000-000000000002', kind: 'privacy', file: 'politica-de-privacidade-v1.0.0.md' },
  { id: '019c0000-0000-7000-8000-000000000003', kind: 'community_rules', file: 'regras-de-convivencia-v1.0.0.md' },
] as const;

describe('legal document content (ADR-028)', () => {
  let database: EphemeralDatabase;
  const repository = new DrizzleTermsRepository();
  const query = async <Row extends object = Record<string, unknown>>(text: string, values: unknown[] = []) =>
    (await database.pool.query(text, values)).rows as Row[];
  const inTransaction = <T>(work: Parameters<ReturnType<typeof drizzle>['transaction']>[0]) =>
    drizzle({ client: database.pool }).transaction(work as never) as Promise<T>;

  beforeAll(async () => {
    database = await createEphemeralDatabase(adminUrl);
  });

  afterAll(async () => {
    await database?.drop();
  });

  test('the seeded text is byte-identical to docs/legal and matches the stored digest', async () => {
    for (const document of SEEDED) {
      const disk = readFileSync(join(LEGAL_DIR, document.file));
      const [row] = await query<{ content: string; digest: string; matches: boolean }>(
        `select content, encode(content_digest, 'hex') as digest,
                sha256(convert_to(content, 'UTF8')) = content_digest as matches
         from terms_document where id = $1`,
        [document.id],
      );
      expect(Buffer.from(row!.content, 'utf8').equals(disk)).toBe(true);
      expect(row!.digest).toBe(createHash('sha256').update(disk).digest('hex'));
      expect(row!.matches).toBe(true);
    }
  });

  test('the dollar-quote delimiter never appears in the published files', () => {
    for (const document of SEEDED) {
      expect(readFileSync(join(LEGAL_DIR, document.file), 'utf8')).not.toContain('$eventmatch_legal$');
    }
  });

  test('CHECK constraints reject a digest mismatch and an approved document without text', async () => {
    await expect(
      query(
        `insert into terms_document (id, kind, version, locale, effective_at, content_digest, content, status)
         values (gen_random_uuid(), 'terms', 'bad-digest', 'pt-BR', now(), sha256('other'::bytea), 'text', 'placeholder')`,
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      query(
        `insert into terms_document (id, kind, version, locale, effective_at, content_digest, status)
         values (gen_random_uuid(), 'terms', 'no-text', 'pt-BR', now(), '\\x00', 'approved')`,
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  test('the trigger keeps published rows immutable but allows approved → retired', async () => {
    const [id] = ['019c0000-0000-7000-8000-0000000000f1'];
    await query(
      `insert into terms_document (id, kind, version, locale, effective_at, content_digest, content, status)
       values ($1, 'privacy', 'trigger-test', 'pt-BR', now() - interval '1 day',
               sha256(convert_to('texto', 'UTF8')), 'texto', 'approved')`,
      [id],
    );

    await expect(query(`update terms_document set content = 'outro' where id = $1`, [id])).rejects.toMatchObject({
      code: '23514',
    });
    await expect(
      query(`update terms_document set content_digest = sha256('x'::bytea) where id = $1`, [id]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(query(`update terms_document set version = '9.9.9' where id = $1`, [id])).rejects.toMatchObject({
      code: '23514',
    });
    await query(`update terms_document set status = 'retired' where id = $1`, [id]);
    await expect(query(`update terms_document set status = 'approved' where id = $1`, [id])).rejects.toMatchObject({
      code: '23514',
    });
  });

  test('listCurrent returns one effective version per kind; findCurrent refuses the rest', async () => {
    const now = new Date();
    const insert = (id: string, version: string, offset: string, status: string) =>
      query(
        `insert into terms_document (id, kind, version, locale, effective_at, content_digest, content, status)
         values ($1, 'terms', $2, 'pt-BR', $3::timestamptz + $4::interval, sha256(convert_to($2, 'UTF8')), $2, $5)`,
        [id, version, now, offset, status],
      );
    const NEWER = '019c0000-0000-7000-8000-0000000000e1';
    const FUTURE = '019c0000-0000-7000-8000-0000000000e2';
    const PLACEHOLDER = '019c0000-0000-7000-8000-0000000000e3';
    await insert(NEWER, '1.1.0', '-1 hour', 'approved');
    await insert(FUTURE, '2.0.0', '1 day', 'approved');
    await insert(PLACEHOLDER, '3.0.0', '-30 minutes', 'placeholder');

    const current = await inTransaction<{ id: string; kind: string; content: string }[]>((transaction) =>
      repository.listCurrent(transaction, 'pt-BR', now),
    );
    expect(current.map(({ id }) => id).sort()).toEqual([NEWER, SEEDED[1].id, SEEDED[2].id].sort());
    expect(current.find(({ id }) => id === NEWER)?.content).toBe('1.1.0');
    await expect(
      inTransaction((transaction) => repository.listCurrent(transaction, 'en-US', now)),
    ).resolves.toEqual([]);

    const accepted = await inTransaction<{ id: string }[]>((transaction) =>
      repository.findCurrent(
        transaction,
        [SEEDED[0].id, NEWER, FUTURE, PLACEHOLDER, SEEDED[1].id, 'not-a-uuid'],
        now,
      ),
    );
    expect(accepted.map(({ id }) => id).sort()).toEqual([NEWER, SEEDED[1].id].sort());
  });
});
