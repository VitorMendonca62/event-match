import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../../shared/infrastructure/persistence/resolve-executor';
import { Account } from '../../../domain/entities/account';
import { ContactVerification } from '../../../domain/entities/contact-verification';
import { Registration } from '../../../domain/entities/registration';
import type { AccountRepositoryPort, ApprovedTermsDocument, RateLimitRepositoryPort, RegistrationRepositoryPort, TermsRepositoryPort, VerificationRepositoryPort } from '../../../domain/ports/outbound/persistence.ports';
import type { ContactChannel } from '../../../domain/value-objects/contact-identifier';
import { BirthDate } from '../../../domain/value-objects/birth-date';

type Row = Record<string, unknown>;
const rows = async (context: TransactionContext, statement: ReturnType<typeof sql>): Promise<Row[]> => (await resolveExecutor(context).execute(statement)).rows as Row[];
const b = (value: unknown): Buffer => Buffer.from(value as Uint8Array);
const d = (value: unknown): Date => new Date(value as string | Date);
const verification = (row: Row) => new ContactVerification(row.id as string, row.channel as ContactChannel, b(row.contact_hash), b(row.contact_ciphertext), Number(row.key_version), b(row.otp_digest), d(row.expires_at), row.delivery_idempotency_key as string, d(row.last_sent_at), row.status as 'open' | 'verified' | 'consumed' | 'expired', Number(row.failed_attempts), Number(row.resend_count), row.locked_until ? d(row.locked_until) : null);
const registration = (row: Row) => new Registration(row.id as string, row.verification_id as string, row.channel as ContactChannel, row.contact_hash ? b(row.contact_hash) : null, row.contact_ciphertext ? b(row.contact_ciphertext) : null, row.key_version ? Number(row.key_version) : null, row.password_hash as string | null, d(row.last_updated_at), d(row.expires_at), row.status as 'registration_in_progress' | 'expired', row.expired_at ? d(row.expired_at) : null);
const account = (row: Row) => new Account(row.id as string, row.registration_id as string, row.status as 'account_incomplete' | 'active' | 'expired', row.birth_date ? BirthDate.create(String(row.birth_date)) : null, d(row.last_updated_at), row.activated_at ? d(row.activated_at) : null, row.expired_at ? d(row.expired_at) : null);

@Injectable()
export class DrizzleVerificationRepository implements VerificationRepositoryPort {
  async findOpenForUpdate(context: TransactionContext, contactHash: Buffer): Promise<ContactVerification | null> { const [row] = await rows(context, sql`select * from contact_verification where contact_hash = ${contactHash} and purpose = 'registration' and status in ('open','verified') for update`); return row ? verification(row) : null; }
  async findForUpdate(context: TransactionContext, id: string): Promise<ContactVerification | null> { const [row] = await rows(context, sql`select * from contact_verification where id = ${id} for update`); return row ? verification(row) : null; }
  async insert(context: TransactionContext, value: ContactVerification): Promise<void> { await rows(context, sql`insert into contact_verification (id,purpose,channel,contact_hash,contact_ciphertext,key_version,otp_digest,expires_at,delivery_idempotency_key,last_sent_at,status,failed_attempts,resend_count,locked_until,created_at,updated_at) values (${value.id},'registration',${value.channel},${value.contactHash},${value.ciphertext},${value.keyVersion},${value.otpDigest},${value.expiresAt},${value.deliveryIdempotencyKey},${value.lastSentAt},${value.status},${value.failedAttempts},${value.resendCount},${value.lockedUntil},now(),now())`); }
  async save(context: TransactionContext, value: ContactVerification): Promise<void> { await rows(context, sql`update contact_verification set status=${value.status}, failed_attempts=${value.failedAttempts}, resend_count=${value.resendCount}, locked_until=${value.lockedUntil}, last_sent_at=${value.lastSentAt}, consumed_at=${value.status === 'consumed' ? value.lastSentAt : null}, updated_at=now() where id=${value.id}`); }
  async expireOpen(context: TransactionContext, contactHash: Buffer, now: Date): Promise<void> { await rows(context, sql`update contact_verification set status='expired', updated_at=${now} where contact_hash=${contactHash} and status in ('open','verified') and expires_at <= ${now}`); }
}

@Injectable()
export class DrizzleRateLimitRepository implements RateLimitRepositoryPort {
  async tryConsume(context: TransactionContext, scope: 'contact' | 'origin', subjectHash: Buffer, windowStart: Date, kind: 'challenge' | 'resend', limit: number): Promise<boolean> {
    await rows(context, sql`delete from verification_rate_window where scope=${scope} and subject_hash=${subjectHash} and window_start < ${new Date(windowStart.getTime() - 2 * 3_600_000)}`);
    const column = kind === 'challenge' ? sql.raw('request_count') : sql.raw('resend_count');
    const [row] = await rows(context, sql`insert into verification_rate_window (scope,subject_hash,window_start,request_count,resend_count) values (${scope},${subjectHash},${windowStart},${kind === 'challenge' ? 1 : 0},${kind === 'resend' ? 1 : 0}) on conflict (scope,subject_hash,window_start) do update set ${column} = verification_rate_window.${column} + 1 where verification_rate_window.${column} < ${limit} returning ${column}`);
    return Boolean(row);
  }
}

@Injectable()
export class DrizzleRegistrationRepository implements RegistrationRepositoryPort {
  async findInProgressForUpdate(context: TransactionContext, id: string): Promise<Registration | null> { const [row] = await rows(context, sql`select * from registration where id=${id} and status='registration_in_progress' for update`); return row ? registration(row) : null; }
  async insert(context: TransactionContext, value: Registration): Promise<void> { await rows(context, sql`insert into registration (id,verification_id,channel,contact_hash,contact_ciphertext,password_hash,status,last_updated_at,expires_at) values (${value.id},${value.verificationId},${value.channel},${value.contactHash},${value.ciphertext},${value.passwordHash},${value.status},${value.lastUpdatedAt},${value.expiresAt})`); }
  async save(context: TransactionContext, value: Registration): Promise<void> { await rows(context, sql`update registration set contact_hash=${value.contactHash}, contact_ciphertext=${value.ciphertext}, password_hash=${value.passwordHash}, status=${value.status}, last_updated_at=${value.lastUpdatedAt}, expired_at=${value.expiredAt} where id=${value.id}`); }
  async expireStale(context: TransactionContext, now: Date, batch: number): Promise<number> { const result = await rows(context, sql`with stale as (select id from registration where status='registration_in_progress' and expires_at <= ${now} limit ${batch} for update skip locked) update registration set status='expired', contact_hash=null, contact_ciphertext=null, password_hash=null, expired_at=${now}, last_updated_at=${now} where id in (select id from stale) returning id`); return result.length; }
}

@Injectable()
export class DrizzleAccountRepository implements AccountRepositoryPort {
  async existsHoldingContact(context: TransactionContext, channel: ContactChannel, hash: Buffer): Promise<boolean> { return (await rows(context, sql`select 1 from account_contact where channel=${channel} and contact_hash=${hash} and holds_contact=true limit 1`)).length > 0; }
  async insertIncomplete(context: TransactionContext, input: Parameters<AccountRepositoryPort['insertIncomplete']>[1]): Promise<void> { const { account: value } = input; await rows(context, sql`insert into account (id,registration_id,status,birth_date,last_updated_at) values (${value.id},${value.registrationId},'account_incomplete',${value.birthDate?.value ?? null},${value.lastUpdatedAt})`); await rows(context, sql`insert into account_contact (account_id,channel,contact_hash,contact_ciphertext,key_version,confirmed_at,holds_contact) values (${value.id},${input.channel},${input.contactHash},${input.ciphertext},${input.keyVersion},${value.lastUpdatedAt},true)`); await rows(context, sql`insert into account_credential (account_id,password_hash,algorithm,updated_at) values (${value.id},${input.passwordHash},'argon2id',${value.lastUpdatedAt})`); }
  async findForUpdate(context: TransactionContext, id: string): Promise<Account | null> { const [row] = await rows(context, sql`select * from account where id=${id} for update`); return row ? account(row) : null; }
  async save(context: TransactionContext, value: Account): Promise<void> { await rows(context, sql`update account set status=${value.status}, birth_date=${value.birthDate?.value ?? null}, last_updated_at=${value.lastUpdatedAt}, activated_at=${value.activatedAt}, expired_at=${value.expiredAt} where id=${value.id}`); }
  async expireStale(context: TransactionContext, now: Date, batch: number): Promise<number> { const result = await rows(context, sql`with stale as (select id from account where status='account_incomplete' and last_updated_at <= ${new Date(now.getTime() - 15 * 86_400_000)} limit ${batch} for update skip locked) update account set status='expired', birth_date=null, expired_at=${now}, last_updated_at=${now} where id in (select id from stale) returning id`); await rows(context, sql`update account_contact set contact_hash=null, contact_ciphertext=null, holds_contact=false where account_id in (select id from account where status='expired' and expired_at=${now})`); return result.length; }
}

@Injectable()
export class DrizzleTermsRepository implements TermsRepositoryPort {
  async findApproved(context: TransactionContext, ids: string[]): Promise<ApprovedTermsDocument[]> { if (!ids.length) return []; const result = await rows(context, sql`select id, kind from terms_document where id = any(${ids}::uuid[]) and status='approved'`); return result.map((row) => ({ id: row.id as string, kind: row.kind as ApprovedTermsDocument['kind'] })); }
  async recordAcceptances(context: TransactionContext, accountId: string, ids: string[], acceptedAt: Date): Promise<void> { for (const id of ids) await rows(context, sql`insert into terms_acceptance (id,account_id,document_id,accepted_at,context) values (${randomUUID()},${accountId},${id},${acceptedAt},'{}'::jsonb) on conflict (account_id,document_id) do nothing`); }
}
