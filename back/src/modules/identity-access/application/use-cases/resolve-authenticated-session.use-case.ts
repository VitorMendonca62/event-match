import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { AuthenticatedSession } from '../../domain/entities/authenticated-session';
import { IdentityAccessError, type IdentityAccessErrorCode } from '../../domain/errors/identity-access.error';
import type { AccountAccessPolicyPort } from '../../domain/ports/outbound/account-access-policy.port';
import type { AuthenticationAccountReaderPort } from '../../domain/ports/outbound/authentication-account-reader.port';
import type { AuthenticatedSessionRepositoryPort } from '../../domain/ports/outbound/authenticated-session-repository.port';
import type { SessionTokenPort } from '../../domain/ports/outbound/authentication-security.ports';
import type {
  AuthenticationOutcome,
  AuthenticationTelemetryPort,
} from '../../domain/ports/outbound/authentication-telemetry.port';
import type { ClockPort, IdGeneratorPort } from '../../domain/ports/outbound/runtime.ports';
import type { SessionPolicy } from '../../domain/services/session-policy';
import { type AccountCapability, canHoldCommonSession } from '../../domain/value-objects/account-access';

export interface ResolveAuthenticatedSessionInput {
  readonly token: string;
  readonly capability: AccountCapability;
  /** Only the BFF maintenance call rotates; RSC renders validate without rotating (ADR-034). */
  readonly allowRotation: boolean;
}

/** Server-only principal: identity and deadlines, never status or permissions (ADR-036). */
export interface ResolvedSession {
  readonly accountId: string;
  readonly sessionId: string;
  readonly expiresAt: Date;
  readonly idleExpiresAt: Date;
  readonly remembered: boolean;
  /** Rotation is due but was not performed by this call. */
  readonly rotationDue: boolean;
  /** New opaque token when this call rotated; delivered only through the internal header. */
  readonly rotatedToken: string | null;
}

type Resolution =
  | { readonly kind: 'resolved'; readonly value: ResolvedSession }
  | { readonly kind: 'refused'; readonly code: IdentityAccessErrorCode; readonly outcome: AuthenticationOutcome };

/**
 * Resolves and authorizes a session on every protected request (ADR-033, ADR-036). The account
 * state and capability are read live; a session without a usable account is removed, while a
 * denied capability of an `active` account keeps it. Refusals are decided inside the transaction
 * and raised after commit, so a revocation is never rolled back by its own error.
 */
export class ResolveAuthenticatedSession {
  constructor(
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly sessions: AuthenticatedSessionRepositoryPort,
    private readonly accounts: AuthenticationAccountReaderPort,
    private readonly policy: AccountAccessPolicyPort,
    private readonly tokens: SessionTokenPort,
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly telemetry: AuthenticationTelemetryPort,
    private readonly sessionPolicy: SessionPolicy,
  ) {}

  async execute(input: ResolveAuthenticatedSessionInput): Promise<ResolvedSession> {
    const digest = this.tokens.digest(input.token);
    const now = this.clock.now();

    const resolution = await this.unitOfWork.execute(async (context): Promise<Resolution> => {
      const match = await this.sessions.findByDigestForUpdate(context, digest, now);
      if (!match) return { kind: 'refused', code: 'SESSION_REVOKED', outcome: 'revoked' };

      let session = match.session;
      if (session.expiry(now)) {
        await this.sessions.delete(context, session.id);
        return { kind: 'refused', code: 'SESSION_EXPIRED', outcome: 'expired' };
      }

      const status = await this.accounts.findStatus(context, session.accountId);
      if (!status || !canHoldCommonSession(status)) {
        await this.sessions.delete(context, session.id);
        return { kind: 'refused', code: 'SESSION_REVOKED', outcome: 'revoked' };
      }
      if ((await this.policy.decide(session.accountId, status, input.capability)) !== 'allow') {
        return { kind: 'refused', code: 'CAPABILITY_DENIED', outcome: 'denied' };
      }

      let changed = false;
      if (session.activityWriteDue(now, this.sessionPolicy)) {
        session = session.touch(now);
        changed = true;
      }

      // Only the current token under lock may rotate: one replica wins, the loser matches `previous`.
      let rotatedToken: string | null = null;
      const due = match.matched === 'current' && session.rotationDue(now, this.sessionPolicy);
      if (due && input.allowRotation) {
        const issued = this.tokens.issue();
        session = session.rotate(issued.digest, now, this.sessionPolicy);
        rotatedToken = issued.token;
        changed = true;
      }
      if (changed) await this.sessions.save(context, session);

      return { kind: 'resolved', value: this.view(session, due && rotatedToken === null, rotatedToken) };
    });

    if (resolution.kind === 'refused') {
      this.record('session', resolution.outcome);
      throw new IdentityAccessError(resolution.code);
    }
    if (resolution.value.rotatedToken) this.record('session.rotated', 'success');
    return resolution.value;
  }

  private view(session: AuthenticatedSession, rotationDue: boolean, rotatedToken: string | null): ResolvedSession {
    return {
      accountId: session.accountId,
      sessionId: session.id,
      expiresAt: session.absoluteExpiresAt,
      idleExpiresAt: session.idleExpiresAt,
      remembered: session.remembered,
      rotationDue,
      rotatedToken,
    };
  }

  private record(name: 'session' | 'session.rotated', outcome: AuthenticationOutcome): void {
    this.telemetry.record({ name, outcome, correlationId: this.ids.next() });
  }
}
