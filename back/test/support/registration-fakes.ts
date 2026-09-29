import type { TransactionContext, UnitOfWorkPort } from '../../src/shared/application/ports/unit-of-work.port';
import type { InterestCatalogReaderPort, InterestRef } from '../../src/modules/catalog/domain/ports/interest-catalog-reader.port';
import type { ProfileWriterPort, RequiredProfileData } from '../../src/modules/profiles/domain/ports/profile-writer.port';
import { ContactRetention } from '../../src/modules/registration/application/services/contact-retention';
import { RegistrationFlowGate } from '../../src/modules/registration/application/services/registration-flow-gate';
import { VerificationDispatcher } from '../../src/modules/registration/application/services/verification-dispatcher';
import { CheckRegistrationEligibility } from '../../src/modules/registration/application/use-cases/check-registration-eligibility.use-case';
import { CompleteRegistration } from '../../src/modules/registration/application/use-cases/complete-registration.use-case';
import { ExpireStaleRegistrations } from '../../src/modules/registration/application/use-cases/expire-stale-registrations.use-case';
import { CancelRegistration } from '../../src/modules/registration/application/use-cases/cancel-registration.use-case';
import { ListCurrentLegalDocuments } from '../../src/modules/registration/application/use-cases/list-current-legal-documents.use-case';
import { RegistrationFlow } from '../../src/modules/registration/application/use-cases/registration-flow.use-case';
import { RequestContactVerification } from '../../src/modules/registration/application/use-cases/request-contact-verification.use-case';
import { ResendContactVerification } from '../../src/modules/registration/application/use-cases/resend-contact-verification.use-case';
import { SaveRequiredData } from '../../src/modules/registration/application/use-cases/save-required-data.use-case';
import { StartRegistration } from '../../src/modules/registration/application/use-cases/start-registration.use-case';
import { VerifyContact } from '../../src/modules/registration/application/use-cases/verify-contact.use-case';
import { VerifyContactByLink } from '../../src/modules/registration/application/use-cases/verify-contact-by-link.use-case';
import type { RegistrationFlowSession } from '../../src/modules/registration/domain/entities/registration-flow-session';
import type {
  FlowOperation,
  IdempotencyRecord,
  NewIdempotencyReservation,
  RegistrationFlowSessionRepositoryPort,
  RegistrationFlowTokenPort,
  RegistrationIdempotencyRepositoryPort,
  StoredOutcome,
} from '../../src/modules/registration/domain/ports/outbound/flow.ports';
import type { Account } from '../../src/modules/registration/domain/entities/account';
import type { ContactVerification } from '../../src/modules/registration/domain/entities/contact-verification';
import type { Registration } from '../../src/modules/registration/domain/entities/registration';
import { RegistrationError } from '../../src/modules/registration/domain/errors/registration.error';
import type {
  AccountRepositoryPort,
  ApprovedTermsDocument,
  CurrentTermsDocument,
  NewIncompleteAccount,
  RateLimitKind,
  RateLimitRepositoryPort,
  RateLimitScope,
  RegistrationRepositoryPort,
  TermsAcceptance,
  TermsRepositoryPort,
  VerificationRepositoryPort,
} from '../../src/modules/registration/domain/ports/outbound/persistence.ports';
import type { RegistrationEvent, RegistrationTelemetryPort } from '../../src/modules/registration/domain/ports/outbound/registration-telemetry.port';
import type { ClockPort, IdGeneratorPort } from '../../src/modules/registration/domain/ports/outbound/runtime.ports';
import type {
  CommonPasswordCheckerPort,
  ContactProtectorPort,
  GeneratedSecret,
  PasswordHasherPort,
  SealedContact,
  VerificationDeliveryPort,
  VerificationDeliveryRequest,
  VerificationSecretPort,
} from '../../src/modules/registration/domain/ports/outbound/security.ports';
import { ContactIdentifier, type ContactChannel } from '../../src/modules/registration/domain/value-objects/contact-identifier';
import type { Password } from '../../src/modules/registration/domain/value-objects/password';
import type { TermsDocumentKind } from '../../src/modules/registration/domain/value-objects/terms-document-kind';

interface AccountContactRecord {
  channel: ContactChannel;
  contactHash: Buffer | null;
  holdsContact: boolean;
}

interface State {
  verifications: Map<string, ContactVerification>;
  registrations: Map<string, Registration>;
  accounts: Map<string, Account>;
  accountContacts: Map<string, AccountContactRecord>;
  credentials: Map<string, string | null>;
  rateWindows: Map<string, { request: number; resend: number }>;
  termsDocuments: Map<string, FakeTermsDocument>;
  acceptances: Map<string, { accountId: string; documentId: string }>;
  profiles: Map<string, { displayName: string | null; region: string | null }>;
  usageIntents: Map<string, string[]>;
  interests: Map<string, string[]>;
  catalog: Set<string>;
  sessions: Map<string, RegistrationFlowSession>;
  idempotency: Map<string, IdempotencyRow>;
}

interface IdempotencyRow {
  id: string;
  flowSessionId: string;
  operation: FlowOperation;
  keyHash: Buffer;
  requestHash: Buffer;
  outcome: StoredOutcome | null;
  expiresAt: Date;
}

const emptyState = (): State => ({
  verifications: new Map(),
  registrations: new Map(),
  accounts: new Map(),
  accountContacts: new Map(),
  credentials: new Map(),
  rateWindows: new Map(),
  termsDocuments: new Map(),
  acceptances: new Map(),
  profiles: new Map(),
  usageIntents: new Map(),
  interests: new Map(),
  catalog: new Set(),
  sessions: new Map(),
  idempotency: new Map(),
});

/** Copies every collection so a failed unit of work can be rolled back; entities are immutable. */
const snapshot = (state: State): State => ({
  verifications: new Map(state.verifications),
  registrations: new Map(state.registrations),
  accounts: new Map(state.accounts),
  accountContacts: new Map([...state.accountContacts].map(([key, value]) => [key, { ...value }])),
  credentials: new Map(state.credentials),
  rateWindows: new Map([...state.rateWindows].map(([key, value]) => [key, { ...value }])),
  termsDocuments: new Map(state.termsDocuments),
  acceptances: new Map(state.acceptances),
  profiles: new Map([...state.profiles].map(([key, value]) => [key, { ...value }])),
  usageIntents: new Map(state.usageIntents),
  interests: new Map(state.interests),
  catalog: new Set(state.catalog),
  sessions: new Map(state.sessions),
  idempotency: new Map([...state.idempotency].map(([key, value]) => [key, { ...value }])),
});

export class InMemoryDatabase {
  state = emptyState();
  commits = 0;
  rollbacks = 0;
}

const TRANSACTION = Object.freeze({ fake: 'transaction' });

export class FakeUnitOfWork implements UnitOfWorkPort {
  constructor(private readonly database: InMemoryDatabase) {}

  async execute<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    const before = snapshot(this.database.state);
    try {
      const result = await work(TRANSACTION);
      this.database.commits += 1;
      return result;
    } catch (error) {
      this.database.state = before;
      this.database.rollbacks += 1;
      throw error;
    }
  }
}

const sameHash = (left: Buffer | null, right: Buffer) => left !== null && left.equals(right);

class InMemoryVerificationRepository implements VerificationRepositoryPort {
  constructor(private readonly database: InMemoryDatabase) {}
  private get rows() {
    return this.database.state.verifications;
  }
  async findById(_: TransactionContext, id: string) {
    return this.rows.get(id) ?? null;
  }
  async findForUpdate(_: TransactionContext, id: string) {
    return this.rows.get(id) ?? null;
  }
  async findByLinkDigestForUpdate(_: TransactionContext, linkTokenDigest: Buffer) {
    return [...this.rows.values()].find((row) => row.linkTokenDigest?.equals(linkTokenDigest)) ?? null;
  }
  async findActiveByContactForUpdate(_: TransactionContext, contactHash: Buffer) {
    return (
      [...this.rows.values()].find(
        (row) => row.contactHash.equals(contactHash) && ['open', 'verified'].includes(row.status),
      ) ?? null
    );
  }
  async insert(context: TransactionContext, value: ContactVerification) {
    if (await this.findActiveByContactForUpdate(context, value.contactHash)) {
      throw new RegistrationError('CONTACT_UNAVAILABLE');
    }
    this.rows.set(value.id, value);
  }
  async save(_: TransactionContext, value: ContactVerification) {
    this.rows.set(value.id, value);
  }
}

class InMemoryRegistrationRepository implements RegistrationRepositoryPort {
  constructor(private readonly database: InMemoryDatabase) {}
  private get rows() {
    return this.database.state.registrations;
  }
  async findInProgressForUpdate(_: TransactionContext, id: string) {
    const row = this.rows.get(id);
    return row?.status === 'registration_in_progress' ? row : null;
  }
  async findInProgressByContactForUpdate(_: TransactionContext, contactHash: Buffer) {
    return (
      [...this.rows.values()].find(
        (row) => row.status === 'registration_in_progress' && sameHash(row.retained?.contactHash ?? null, contactHash),
      ) ?? null
    );
  }
  async insert(context: TransactionContext, value: Registration) {
    if (value.retained && (await this.findInProgressByContactForUpdate(context, value.retained.contactHash))) {
      throw new RegistrationError('CONTACT_UNAVAILABLE');
    }
    this.rows.set(value.id, value);
  }
  async save(_: TransactionContext, value: Registration) {
    this.rows.set(value.id, value);
  }
  async expireStale(_: TransactionContext, now: Date, batch: number) {
    const stale = [...this.rows.values()]
      .filter((row) => row.status === 'registration_in_progress' && row.isExpired(now))
      .slice(0, batch);
    stale.forEach((row) => this.rows.set(row.id, row.expire(now)));
    return stale.length;
  }
}

class InMemoryAccountRepository implements AccountRepositoryPort {
  constructor(private readonly database: InMemoryDatabase) {}
  private get state() {
    return this.database.state;
  }
  async findHoldingContactForUpdate(_: TransactionContext, channel: ContactChannel, contactHash: Buffer) {
    for (const [accountId, contact] of this.state.accountContacts) {
      if (contact.holdsContact && contact.channel === channel && sameHash(contact.contactHash, contactHash)) {
        return this.state.accounts.get(accountId) ?? null;
      }
    }
    return null;
  }
  async findForUpdate(_: TransactionContext, id: string) {
    return this.state.accounts.get(id) ?? null;
  }
  async insertIncomplete(context: TransactionContext, input: NewIncompleteAccount) {
    if (await this.findHoldingContactForUpdate(context, input.channel, input.retained.contactHash)) {
      throw new RegistrationError('CONTACT_UNAVAILABLE');
    }
    this.state.accounts.set(input.account.id, input.account);
    this.state.accountContacts.set(input.account.id, {
      channel: input.channel,
      contactHash: input.retained.contactHash,
      holdsContact: true,
    });
    this.state.credentials.set(input.account.id, input.retained.passwordHash);
  }
  async activate(_: TransactionContext, account: Account) {
    if (this.state.accounts.get(account.id)?.status !== 'account_incomplete') return false;
    this.state.accounts.set(account.id, account);
    return true;
  }
  async expire(_: TransactionContext, account: Account) {
    this.state.accounts.set(account.id, account);
    this.release(account.id);
  }
  async expireStale(_: TransactionContext, staleBefore: Date, now: Date, batch: number) {
    const stale = [...this.state.accounts.values()]
      .filter((row) => row.status === 'account_incomplete' && row.lastUpdatedAt <= staleBefore)
      .slice(0, batch);
    stale.forEach((row) => {
      this.state.accounts.set(row.id, row.expire(now));
      this.release(row.id);
    });
    return stale.map((row) => row.id);
  }
  private release(accountId: string) {
    const contact = this.state.accountContacts.get(accountId);
    if (contact) this.state.accountContacts.set(accountId, { ...contact, contactHash: null, holdsContact: false });
    this.state.credentials.set(accountId, null);
  }
}

class InMemoryRateLimitRepository implements RateLimitRepositoryPort {
  constructor(private readonly database: InMemoryDatabase) {}
  async tryConsume(
    _: TransactionContext,
    scope: RateLimitScope,
    subjectHash: Buffer,
    windowStart: Date,
    kind: RateLimitKind,
    limit: number,
  ) {
    const key = `${scope}:${subjectHash.toString('hex')}:${windowStart.toISOString()}`;
    const window = this.database.state.rateWindows.get(key) ?? { request: 0, resend: 0 };
    const field = kind === 'challenge' ? 'request' : 'resend';
    if (window[field] >= limit) return false;
    window[field] += 1;
    this.database.state.rateWindows.set(key, window);
    return true;
  }
}

export interface FakeTermsDocument {
  kind: TermsDocumentKind;
  status: 'placeholder' | 'approved' | 'retired';
  version?: string;
  effectiveAt?: Date;
  content?: string;
}

class InMemoryTermsRepository implements TermsRepositoryPort {
  failOnRecord = false;
  constructor(private readonly database: InMemoryDatabase) {}
  async listCurrent(_: TransactionContext, locale: string, now: Date): Promise<CurrentTermsDocument[]> {
    return this.currentDocuments(locale, now).map(([id, document]) => ({
      id,
      kind: document.kind,
      version: document.version ?? 'test',
      locale,
      effectiveAt: document.effectiveAt ?? new Date('2026-01-01T00:00:00.000Z'),
      content: document.content ?? '# Documento de teste\n',
    }));
  }
  async findCurrent(_: TransactionContext, documentIds: string[], now: Date): Promise<ApprovedTermsDocument[]> {
    const current = new Set(this.currentDocuments('pt-BR', now).map(([id]) => id));
    return documentIds.flatMap((id) => {
      const document = this.database.state.termsDocuments.get(id);
      return document && current.has(id) ? [{ id, kind: document.kind }] : [];
    });
  }
  /** One effective approved version per kind, newest first (ADR-028). */
  private currentDocuments(locale: string, now: Date): [string, FakeTermsDocument][] {
    if (locale !== 'pt-BR') return [];
    const newest = new Map<TermsDocumentKind, [string, FakeTermsDocument]>();
    for (const entry of this.database.state.termsDocuments) {
      const [, document] = entry;
      if (document.status !== 'approved') continue;
      if ((document.effectiveAt ?? new Date(0)).getTime() > now.getTime()) continue;
      const known = newest.get(document.kind);
      if (!known || (document.effectiveAt ?? new Date(0)) > (known[1].effectiveAt ?? new Date(0))) {
        newest.set(document.kind, entry);
      }
    }
    return [...newest.values()];
  }
  async recordAcceptances(_: TransactionContext, accountId: string, acceptances: TermsAcceptance[]) {
    if (this.failOnRecord) throw new Error('simulated persistence failure');
    acceptances.forEach((acceptance) =>
      this.database.state.acceptances.set(acceptance.id, { accountId, documentId: acceptance.documentId }),
    );
  }
}

class InMemoryProfileWriter implements ProfileWriterPort {
  constructor(private readonly database: InMemoryDatabase) {}
  async upsertRequired(_: TransactionContext, accountId: string, data: RequiredProfileData) {
    this.database.state.profiles.set(accountId, { ...data });
  }
  async replaceUsageIntents(_: TransactionContext, accountId: string, intents: readonly string[]) {
    this.database.state.usageIntents.set(accountId, [...intents]);
  }
  async replaceInterests(_: TransactionContext, accountId: string, interestIds: readonly string[]) {
    this.database.state.interests.set(accountId, [...interestIds]);
  }
  async erasePersonalData(_: TransactionContext, accountIds: readonly string[]) {
    accountIds.forEach((id) => {
      this.database.state.profiles.set(id, { displayName: null, region: null });
      this.database.state.usageIntents.delete(id);
      this.database.state.interests.delete(id);
    });
  }
}

class InMemoryInterestCatalog implements InterestCatalogReaderPort {
  constructor(private readonly database: InMemoryDatabase) {}
  async findActiveByIds(_: TransactionContext, ids: readonly string[]): Promise<InterestRef[]> {
    return ids.filter((id) => this.database.state.catalog.has(id)).map((id) => ({ id }));
  }
  async listActive() {
    return [...this.database.state.catalog].sort().map((id) => ({ id, slug: `slug-${id}`, label: `Label ${id}` }));
  }
}

/** Reversible, recognisable transforms: tests assert that raw values never reach persistence. */
export class FakeContactProtector implements ContactProtectorPort {
  blindIndex(contact: ContactIdentifier) {
    return Buffer.from(`hash:${contact.channel}:${contact.value}`);
  }
  rateLimitSubject(contact: ContactIdentifier) {
    return Buffer.from(`rate:${contact.channel}:${contact.value}`);
  }
  seal(contact: ContactIdentifier): SealedContact {
    return { ciphertext: Buffer.from(contact.value).reverse(), keyVersion: 1 };
  }
  open(channel: ContactChannel, sealed: SealedContact) {
    return ContactIdentifier.create(channel, Buffer.from(sealed.ciphertext).reverse().toString());
  }
}

export class FakeVerificationSecret implements VerificationSecretPort {
  private sequence = 0;
  generateOtp(): GeneratedSecret {
    this.sequence += 1;
    const plain = String(100_000 + this.sequence);
    return { plain, digest: Buffer.from(`digest:${plain}`) };
  }
  generateLinkToken(): GeneratedSecret {
    this.sequence += 1;
    const plain = Buffer.alloc(32, this.sequence).toString('base64url');
    return { plain, digest: this.digest(plain) };
  }
  digest(plain: string) {
    return Buffer.from(`digest:${plain}`);
  }
  matches(plain: string, digest: Buffer) {
    return Buffer.from(`digest:${plain}`).equals(digest);
  }
}

class FakePasswordHasher implements PasswordHasherPort {
  async hash(password: Password) {
    return `argon2id$fake$${password.value.length}`;
  }
  async verify() {
    return true;
  }
}

class FakeCommonPasswordChecker implements CommonPasswordCheckerPort {
  isCommon(password: Password) {
    return ['password1', 'iloveyou123'].includes(password.value.toLowerCase());
  }
}

export class FakeClock implements ClockPort {
  constructor(public current = new Date('2026-09-26T12:00:00.000Z')) {}
  now() {
    return new Date(this.current);
  }
  advance(milliseconds: number) {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

class SequentialIds implements IdGeneratorPort {
  private sequence = 0;
  next() {
    this.sequence += 1;
    return `00000000-0000-7000-8000-${String(this.sequence).padStart(12, '0')}`;
  }
}

export class CapturingDelivery implements VerificationDeliveryPort {
  readonly sent: VerificationDeliveryRequest[] = [];
  failing = false;
  async send(request: VerificationDeliveryRequest) {
    if (this.failing) throw new Error('provider unavailable');
    this.sent.push(request);
    return { accepted: true };
  }
  lastOtp(): string {
    return this.lastVerify().otp;
  }
  lastLinkToken(): string {
    const token = this.lastVerify().linkToken;
    if (!token) throw new Error('No link delivered.');
    return token;
  }
  private lastVerify() {
    const last = [...this.sent].reverse().find((request) => request.kind === 'verify');
    if (!last || last.kind !== 'verify') throw new Error('No OTP delivered.');
    return last;
  }
}

export class CapturingTelemetry implements RegistrationTelemetryPort {
  readonly events: RegistrationEvent[] = [];
  record(event: RegistrationEvent) {
    this.events.push(event);
  }
}

class InMemoryFlowSessionRepository implements RegistrationFlowSessionRepositoryPort {
  constructor(private readonly database: InMemoryDatabase) {}
  private get rows() {
    return this.database.state.sessions;
  }
  async insert(_: TransactionContext, session: RegistrationFlowSession) {
    this.rows.set(session.id, session);
  }
  async findByTokenForUpdate(_: TransactionContext, tokenDigest: Buffer, now: Date) {
    return [...this.rows.values()].find((row) => row.match(tokenDigest, now) !== null) ?? null;
  }
  async findByIdForUpdate(_: TransactionContext, id: string) {
    return this.rows.get(id) ?? null;
  }
  async findPendingByVerificationForUpdate(_: TransactionContext, verificationId: string, now: Date) {
    return (
      [...this.rows.values()].find(
        (row) => row.isActive(now) && row.stage === 'verification_pending' && row.verificationId === verificationId,
      ) ?? null
    );
  }
  async save(_: TransactionContext, session: RegistrationFlowSession) {
    this.rows.set(session.id, session);
  }
  async expireStale(_: TransactionContext, now: Date, batch: number) {
    const stale = [...this.rows.values()].filter((row) => row.tokenDigest && row.expiresAt <= now).slice(0, batch);
    stale.forEach((row) =>
      this.rows.set(row.id, Object.assign(Object.create(Object.getPrototypeOf(row)), row, {
        tokenDigest: null,
        previousTokenDigest: null,
        previousValidUntil: null,
      })),
    );
    return stale.length;
  }
}

class InMemoryIdempotencyRepository implements RegistrationIdempotencyRepositoryPort {
  constructor(private readonly database: InMemoryDatabase) {}
  private get rows() {
    return this.database.state.idempotency;
  }
  async findForUpdate(_: TransactionContext, flowSessionId: string, operation: FlowOperation, keyHash: Buffer) {
    const row = [...this.rows.values()].find(
      (candidate) =>
        candidate.flowSessionId === flowSessionId && candidate.operation === operation && candidate.keyHash.equals(keyHash),
    );
    return row ? ({ ...row } as IdempotencyRecord) : null;
  }
  async reserve(_: TransactionContext, reservation: NewIdempotencyReservation) {
    if (await this.findForUpdate(_, reservation.flowSessionId, reservation.operation, reservation.keyHash)) {
      throw new RegistrationError('IDEMPOTENCY_CONFLICT');
    }
    this.rows.set(reservation.id, { ...reservation, outcome: null });
  }
  async renew(_: TransactionContext, id: string, requestHash: Buffer, expiresAt: Date) {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, requestHash, outcome: null, expiresAt });
  }
  async complete(_: TransactionContext, id: string, outcome: StoredOutcome, expiresAt: Date) {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, outcome, expiresAt });
  }
  async release(_: TransactionContext, id: string) {
    if (this.rows.get(id)?.outcome === null) this.rows.delete(id);
  }
}

/** Recognisable, deterministic digests; tokens keep the production shape (43 base64url chars). */
export class FakeFlowTokens implements RegistrationFlowTokenPort {
  private sequence = 0;
  generate(): GeneratedSecret {
    this.sequence += 1;
    const plain = Buffer.alloc(32, 200 + this.sequence).toString('base64url');
    return { plain, digest: this.digest(plain) };
  }
  digest(token: string) {
    return Buffer.from(`flow:${token}`);
  }
  fingerprint(purpose: string, value: string) {
    return Buffer.from(`${purpose}:${value}`);
  }
}

export function createRegistrationHarness() {
  const database = new InMemoryDatabase();
  const uow = new FakeUnitOfWork(database);
  const verifications = new InMemoryVerificationRepository(database);
  const registrations = new InMemoryRegistrationRepository(database);
  const accounts = new InMemoryAccountRepository(database);
  const limits = new InMemoryRateLimitRepository(database);
  const terms = new InMemoryTermsRepository(database);
  const profiles = new InMemoryProfileWriter(database);
  const catalog = new InMemoryInterestCatalog(database);
  const contacts = new FakeContactProtector();
  const secrets = new FakeVerificationSecret();
  const clock = new FakeClock();
  const ids = new SequentialIds();
  const delivery = new CapturingDelivery();
  const telemetry = new CapturingTelemetry();
  const retention = new ContactRetention(registrations, accounts, profiles);
  const dispatcher = new VerificationDispatcher(delivery, telemetry);
  const sessions = new InMemoryFlowSessionRepository(database);
  const idempotency = new InMemoryIdempotencyRepository(database);
  const tokens = new FakeFlowTokens();
  const gate = new RegistrationFlowGate(uow, sessions, idempotency, tokens, ids, clock, telemetry);
  const request = new RequestContactVerification(uow, verifications, limits, retention, contacts, secrets, ids, clock, dispatcher, telemetry);
  const resend = new ResendContactVerification(uow, verifications, limits, contacts, secrets, clock, dispatcher, telemetry);
  const verify = new VerifyContact(uow, verifications, secrets, clock, telemetry);
  const verifyByLink = new VerifyContactByLink(uow, verifications, secrets, clock, telemetry);
  const start = new StartRegistration(uow, verifications, registrations, retention, new FakePasswordHasher(), new FakeCommonPasswordChecker(), ids, clock, telemetry);
  const saveRequiredData = new SaveRequiredData(uow, registrations, accounts, profiles, ids, clock, telemetry);
  const complete = new CompleteRegistration(uow, accounts, profiles, catalog, terms, ids, clock, telemetry);

  return {
    database,
    terms,
    clock,
    contacts,
    delivery,
    telemetry,
    request,
    resend,
    verify,
    verifyByLink,
    start,
    saveRequiredData,
    complete,
    cancel: new CancelRegistration(uow, sessions, tokens, registrations, accounts, profiles, clock, telemetry),
    expireStale: new ExpireStaleRegistrations(uow, registrations, accounts, profiles, sessions, clock, telemetry),
    eligibility: new CheckRegistrationEligibility(uow, sessions, tokens, ids, clock, telemetry),
    legalDocuments: new ListCurrentLegalDocuments(uow, terms, clock),
    flow: new RegistrationFlow(gate, uow, sessions, tokens, clock, request, resend, verify, verifyByLink, start, saveRequiredData, complete),
  };
}

export type RegistrationHarness = ReturnType<typeof createRegistrationHarness>;

export const ADULT_BIRTH_DATE = '1990-05-10';
export const INTEREST_IDS = [1, 2, 3, 4].map((n) => `00000000-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`);
export const DOCUMENTS = {
  terms: '10000000-0000-7000-8000-000000000001',
  privacy: '10000000-0000-7000-8000-000000000002',
  community_rules: '10000000-0000-7000-8000-000000000003',
} as const;

export function seedCatalogAndTerms(harness: RegistrationHarness): void {
  INTEREST_IDS.forEach((id) => harness.database.state.catalog.add(id));
  (Object.entries(DOCUMENTS) as [TermsDocumentKind, string][]).forEach(([kind, id]) =>
    harness.database.state.termsDocuments.set(id, { kind, status: 'approved' }),
  );
}

/** Runs the flow up to an incomplete account and returns its id. */
export async function createIncompleteAccount(
  harness: RegistrationHarness,
  contact = 'ana@example.test',
): Promise<string> {
  const { verificationId } = await harness.request.execute({ channel: 'email', contact });
  await harness.verify.execute({ verificationId, otp: harness.delivery.lastOtp() });
  const { registrationId } = await harness.start.execute({ verificationId, password: 'uma senha longa' });
  const { accountId } = await harness.saveRequiredData.execute({
    registrationId,
    displayName: 'Ana',
    region: 'Recife - PE',
    usageIntents: ['friendship'],
  });
  return accountId;
}
