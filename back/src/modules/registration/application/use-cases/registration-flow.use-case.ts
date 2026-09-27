import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { FlowStage } from '../../domain/entities/registration-flow-session';
import { RegistrationError } from '../../domain/errors/registration.error';
import type {
  RegistrationFlowSessionRepositoryPort,
  RegistrationFlowTokenPort,
} from '../../domain/ports/outbound/flow.ports';
import type { ClockPort } from '../../domain/ports/outbound/runtime.ports';
import { REGISTRATION_POLICY } from '../../domain/value-objects/verification-policy';
import type {
  FlowAdmission,
  FlowCredentials,
  FlowResult,
  RegistrationFlowGate,
} from '../services/registration-flow-gate';
import type { CompleteRegistration } from './complete-registration.use-case';
import type { RequestContactVerification } from './request-contact-verification.use-case';
import type { ResendContactVerification } from './resend-contact-verification.use-case';
import type { SaveRequiredData } from './save-required-data.use-case';
import type { StartRegistration } from './start-registration.use-case';
import type { VerifyContact } from './verify-contact.use-case';
import type { VerifyContactByLink } from './verify-contact-by-link.use-case';

export type VerificationWindowBody = { readonly expiresAt: string; readonly nextResendAt: string };
export type VerifiedBody = { readonly verified: boolean };
export type StageBody = { readonly stage: FlowStage; readonly expiresAt: string };
export type ActivatedBody = { readonly status: 'active' };

export interface RegistrationSnapshot {
  readonly stage: FlowStage;
  readonly expiresAt: Date;
  readonly nextResendAt?: Date;
}

/**
 * HTTP-facing registration journey (ADR-019 to ADR-021). Every internal id comes from the session
 * authorized by the continuation token; callers never supply `verificationId`, `registrationId` or
 * `accountId`. Business rules stay in the wrapped use cases; this class only sequences them.
 */
export class RegistrationFlow {
  private readonly policy = REGISTRATION_POLICY;

  constructor(
    private readonly gate: RegistrationFlowGate,
    private readonly uow: UnitOfWorkPort,
    private readonly sessions: RegistrationFlowSessionRepositoryPort,
    private readonly tokens: RegistrationFlowTokenPort,
    private readonly clock: ClockPort,
    private readonly requestVerification: RequestContactVerification,
    private readonly resendVerification: ResendContactVerification,
    private readonly verifyContact: VerifyContact,
    private readonly verifyContactByLink: VerifyContactByLink,
    private readonly startRegistration: StartRegistration,
    private readonly saveRequired: SaveRequiredData,
    private readonly completeRegistration: CompleteRegistration,
  ) {}

  /** E-mail only in this version (ADR-025). The answer is neutral for every contact state. */
  async requestContactVerification(
    credentials: FlowCredentials,
    input: { contact: string; originFingerprint: Buffer },
  ): Promise<FlowResult<VerificationWindowBody>> {
    const admitted = await this.gate.admit<VerificationWindowBody>(
      credentials,
      'contact_request',
      { channel: 'email', contact: input.contact },
      ['age_eligible', 'verification_pending'],
    );
    return this.gate.run(admitted, async (admission) => {
      const result = await this.requestVerification.execute(
        {
          channel: 'email',
          contact: input.contact,
          originFingerprint: input.originFingerprint,
        },
        async (context, settled) => {
          const body = {
            expiresAt: settled.expiresAt.toISOString(),
            nextResendAt: settled.nextResendAt.toISOString(),
          };
          await this.gate.settle(
            context,
            admission,
            (session, now) =>
              session.awaitVerification(settled.issued ? settled.verificationId : null, settled.expiresAt, now),
            body,
            false,
          );
        },
      );
      const body = { expiresAt: result.expiresAt.toISOString(), nextResendAt: result.nextResendAt.toISOString() };
      return { body, continuation: null };
    });
  }

  async resendContactVerification(credentials: FlowCredentials): Promise<FlowResult<VerificationWindowBody>> {
    const admitted = await this.gate.admit<VerificationWindowBody>(credentials, 'contact_resend', {}, [
      'verification_pending',
    ]);
    return this.gate.run(admitted, async (admission) => {
      const result = await this.resendVerification.execute(
        { verificationId: admission.session.verificationId },
        async (context, settled) => {
          const body = {
            expiresAt: settled.expiresAt.toISOString(),
            nextResendAt: settled.nextResendAt.toISOString(),
          };
          await this.gate.settle(
            context,
            admission,
            (session, now) => session.extendVerification(settled.expiresAt, now),
            body,
            false,
          );
        },
      );
      const body = { expiresAt: result.expiresAt.toISOString(), nextResendAt: result.nextResendAt.toISOString() };
      return { body, continuation: null };
    });
  }

  /** Wrong, expired, locked or never-issued codes all answer `verified: false`. */
  async confirmContact(credentials: FlowCredentials, input: { otp: string }): Promise<FlowResult<VerifiedBody>> {
    const admitted = await this.gate.admit<VerifiedBody>(credentials, 'contact_confirm', { otp: input.otp }, [
      'verification_pending',
    ]);
    return this.gate.run(admitted, async (admission) => {
      const verificationId = admission.session.verificationId;
      if (verificationId === null) {
        const body = { verified: false };
        await this.gate.settleAlone(admission, (session) => session, body);
        return { body, continuation: null };
      }

      let continuation: string | null = null;
      const result = await this.verifyContact.execute({ verificationId, otp: input.otp }, async (context, attempt) => {
        const body = { verified: attempt.verified };
        continuation = await this.gate.settle(
          context,
          admission,
          (session, now) => (attempt.verified && attempt.expiresAt ? session.confirmContact(attempt.expiresAt, now) : session),
          body,
          attempt.verified,
        );
      });
      return { body: { verified: result.verified }, continuation };
    });
  }

  /**
   * The link alone proves possession of the mailbox, so it may be opened in another browser: on
   * success the pending session moves to `contact_verified` and a new continuation is issued.
   */
  async confirmContactByLink(input: { token: string }): Promise<FlowResult<VerifiedBody>> {
    let continuation: string | null = null;
    const { verified } = await this.verifyContactByLink.execute(input, async (context, link) => {
      const now = this.clock.now();
      const session = await this.sessions.findPendingByVerificationForUpdate(context, link.verificationId, now);
      if (!session) throw new RegistrationError('FLOW_UNAUTHORIZED');
      const token = this.tokens.generate();
      await this.sessions.save(
        context,
        session.confirmContact(link.expiresAt, now).rotate(token.digest, now, this.policy),
      );
      continuation = token.plain;
    });
    return { body: { verified }, continuation: verified ? continuation : null };
  }

  /** The password never enters the idempotency fingerprint; the key alone identifies the retry. */
  async choosePassword(credentials: FlowCredentials, input: { password: string }): Promise<FlowResult<StageBody>> {
    const admitted = await this.gate.admit<StageBody>(credentials, 'password', {}, ['contact_verified']);
    return this.gate.run(admitted, (admission) =>
      this.transactional(admission, (hook) =>
        this.startRegistration.execute(
          { verificationId: this.bound(admission.session.verificationId), password: input.password },
          (context, created) => hook(context, 'registration_in_progress', created.expiresAt, (session, now) =>
            session.startRegistration(created.registrationId, created.expiresAt, now),
          ),
        ),
      ),
    );
  }

  async saveRequiredData(
    credentials: FlowCredentials,
    input: { displayName: string; region: string; usageIntents: readonly string[] },
  ): Promise<FlowResult<StageBody>> {
    const admitted = await this.gate.admit<StageBody>(
      credentials,
      'required_data',
      { displayName: input.displayName, region: input.region, usageIntents: [...input.usageIntents] },
      ['registration_in_progress'],
    );
    return this.gate.run(admitted, (admission) =>
      this.transactional(admission, (hook) =>
        this.saveRequired.execute(
          { registrationId: this.bound(admission.session.registrationId), ...input },
          (context, saved) => hook(context, 'account_incomplete', saved.expiresAt, (session, now) =>
            session.createAccount(saved.accountId, saved.expiresAt, now),
          ),
        ),
      ),
    );
  }

  /** The birth date is revalidated under the account lock and kept out of the fingerprint (ADR-019). */
  async complete(
    credentials: FlowCredentials,
    input: { birthDate: string; documentIds: readonly string[]; interestIds: readonly string[] },
  ): Promise<FlowResult<ActivatedBody>> {
    const admitted = await this.gate.admit<ActivatedBody>(
      credentials,
      'complete',
      { documentIds: [...input.documentIds].sort(), interestIds: [...input.interestIds].sort() },
      ['account_incomplete'],
    );
    return this.gate.run(admitted, async (admission) => {
      const body: ActivatedBody = { status: 'active' };
      await this.completeRegistration.execute(
        { accountId: this.bound(admission.session.accountId), ...input },
        async (context) => {
          await this.gate.settle(context, admission, (session, now) => session.complete(now), body, false);
        },
      );
      return { body, continuation: null };
    });
  }

  /** Minimal resume snapshot: never contact, birth date or internal ids. */
  async snapshot(token: string): Promise<RegistrationSnapshot> {
    const digest = this.tokens.digest(token);
    return this.uow.execute(async (context) => {
      const now = this.clock.now();
      const session = await this.sessions.findByTokenForUpdate(context, digest, now);
      if (!session || session.match(digest, now) !== 'current') throw new RegistrationError('FLOW_UNAUTHORIZED');
      // Derived from the session alone, so neutral and real requests look the same (RNF004).
      const nextResendAt =
        session.stage === 'verification_pending'
          ? new Date(session.updatedAt.getTime() + this.policy.resendIntervalMs)
          : undefined;
      return { stage: session.stage, expiresAt: session.expiresAt, nextResendAt };
    });
  }

  /** Adapts a use case hook into a session transition that also answers `{ stage, expiresAt }`. */
  private async transactional(
    admission: FlowAdmission,
    execute: (
      hook: (
        context: object,
        stage: FlowStage,
        expiresAt: Date,
        transition: Parameters<RegistrationFlowGate['settle']>[2],
      ) => Promise<void>,
    ) => Promise<unknown>,
  ): Promise<FlowResult<StageBody>> {
    const settled: { result?: FlowResult<StageBody> } = {};
    await execute(async (context, stage, expiresAt, transition) => {
      const body = { stage, expiresAt: expiresAt.toISOString() };
      const continuation = await this.gate.settle(context, admission, transition, body, true);
      settled.result = { body, continuation };
    });
    if (!settled.result) throw new RegistrationError('FLOW_STAGE_CONFLICT');
    return settled.result;
  }

  /** The stage guarantees the binding; a missing one means corrupted state, not a user error. */
  private bound(id: string | null): string {
    if (id === null) throw new RegistrationError('FLOW_STAGE_CONFLICT');
    return id;
  }
}
