import type {
  TransactionContext,
  UnitOfWorkPort,
} from '../../../../shared/application/ports/unit-of-work.port';
import type {
  FlowStage,
  RegistrationFlowSession,
} from '../../domain/entities/registration-flow-session';
import { RegistrationError } from '../../domain/errors/registration.error';
import type {
  FlowOperation,
  RegistrationFlowSessionRepositoryPort,
  RegistrationFlowTokenPort,
  RegistrationIdempotencyRepositoryPort,
} from '../../domain/ports/outbound/flow.ports';
import type { RegistrationTelemetryPort } from '../../domain/ports/outbound/registration-telemetry.port';
import type { ClockPort, IdGeneratorPort } from '../../domain/ports/outbound/runtime.ports';
import { REGISTRATION_POLICY } from '../../domain/value-objects/verification-policy';

/** Credentials of one HTTP command, as resolved by the presentation guard. */
export interface FlowCredentials {
  readonly token: string;
  readonly idempotencyKey: string;
}

export type FlowBody = Readonly<Record<string, unknown>>;

/** Secret-free, JSON-safe body plus the continuation to hand back, when one was issued. */
export interface FlowResult<T extends FlowBody> {
  readonly body: T;
  readonly continuation: string | null;
}

export interface FlowAdmission {
  readonly session: RegistrationFlowSession;
  readonly operation: FlowOperation;
  readonly reservationId: string;
}

type Admitted<T extends FlowBody> = { kind: 'replay'; result: FlowResult<T> } | { kind: 'proceed'; admission: FlowAdmission };

/**
 * Authorization and idempotency of continuation commands (ADR-021):
 *
 * 1. `admit` locks the session by token digest, replays a finished request with the same key and
 *    payload, refuses a different payload, and reserves the key before any business effect. The
 *    previous token only ever reaches the replay branch.
 * 2. `settle` runs inside the business unit of work: it re-locks the session, applies the stage
 *    transition, rotates the token when privileges change and stores the safe outcome, so the
 *    effect, the session and the idempotency record commit together.
 * 3. `release` drops the reservation after a refusal, allowing a corrected retry.
 */
export class RegistrationFlowGate {
  private readonly policy = REGISTRATION_POLICY;

  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly sessions: RegistrationFlowSessionRepositoryPort,
    private readonly idempotency: RegistrationIdempotencyRepositoryPort,
    private readonly tokens: RegistrationFlowTokenPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly telemetry: RegistrationTelemetryPort,
  ) {}

  /** `request` must hold only non-sensitive fields: birth date and password never enter it. */
  async admit<T extends FlowBody>(
    credentials: FlowCredentials,
    operation: FlowOperation,
    request: FlowBody,
    stages: readonly FlowStage[],
  ): Promise<Admitted<T>> {
    const tokenDigest = this.tokens.digest(credentials.token);
    const keyHash = this.tokens.fingerprint('idempotency_key', credentials.idempotencyKey);
    const requestHash = this.tokens.fingerprint('request', `${operation}:${canonicalJson(request)}`);

    const admitted = await this.uow.execute(async (context): Promise<Admitted<T>> => {
      const now = this.clock.now();
      const session = await this.sessions.findByTokenForUpdate(context, tokenDigest, now);
      const match = session?.match(tokenDigest, now) ?? null;
      if (!session || !match) throw new RegistrationError('FLOW_UNAUTHORIZED');

      const record = await this.idempotency.findForUpdate(context, session.id, operation, keyHash);
      const live = record !== null && record.expiresAt > now;
      if (live && !record.requestHash.equals(requestHash)) throw new RegistrationError('IDEMPOTENCY_CONFLICT');
      if (live && record.outcome) {
        // Lost-response recovery: the business effect is not repeated; a fresh token is issued.
        const continuation = record.outcome.rotates ? await this.rotate(context, session, now) : null;
        return { kind: 'replay', result: { body: record.outcome.body as T, continuation } };
      }
      if (live) throw new RegistrationError('IDEMPOTENCY_CONFLICT');
      if (match === 'previous') throw new RegistrationError('FLOW_UNAUTHORIZED');
      if (!stages.includes(session.stage)) throw new RegistrationError('FLOW_STAGE_CONFLICT');

      const leaseUntil = new Date(now.getTime() + this.policy.idempotencyLeaseMs);
      let reservationId: string;
      if (record) {
        reservationId = record.id;
        await this.idempotency.renew(context, record.id, requestHash, leaseUntil);
      } else {
        reservationId = this.ids.next();
        await this.idempotency.reserve(context, {
          id: reservationId,
          flowSessionId: session.id,
          operation,
          keyHash,
          requestHash,
          expiresAt: leaseUntil,
        });
      }
      return { kind: 'proceed', admission: { session, operation, reservationId } };
    });

    if (admitted.kind === 'replay') {
      this.record(operation, 'replayed');
    }
    return admitted;
  }

  /** Must run inside the unit of work that performs the business effect. */
  async settle(
    context: TransactionContext,
    admission: FlowAdmission,
    transition: (session: RegistrationFlowSession, now: Date) => RegistrationFlowSession,
    body: FlowBody,
    rotates: boolean,
  ): Promise<string | null> {
    const now = this.clock.now();
    const current = await this.sessions.findByIdForUpdate(context, admission.session.id);
    // Another command moved the session meanwhile: roll the business effect back.
    if (!current || !current.isActive(now) || current.stage !== admission.session.stage) {
      throw new RegistrationError('FLOW_STAGE_CONFLICT');
    }

    let next = transition(current, now);
    let continuation: string | null = null;
    if (rotates) {
      const token = this.tokens.generate();
      next = next.rotate(token.digest, now, this.policy);
      continuation = token.plain;
    }
    await this.sessions.save(context, next);
    await this.idempotency.complete(
      context,
      admission.reservationId,
      { body, rotates },
      new Date(now.getTime() + this.policy.idempotencyTtlMs),
    );
    this.record(admission.operation, 'completed', current.id);
    return continuation;
  }

  /** `settle` in its own unit of work, for commands whose business effect already committed. */
  settleAlone(
    admission: FlowAdmission,
    transition: (session: RegistrationFlowSession, now: Date) => RegistrationFlowSession,
    body: FlowBody,
  ): Promise<string | null> {
    return this.uow.execute((context) => this.settle(context, admission, transition, body, false));
  }

  async release(admission: FlowAdmission): Promise<void> {
    try {
      await this.uow.execute((context) => this.idempotency.release(context, admission.reservationId));
    } catch {
      // The lease expires on its own; the original error is the one worth reporting.
    }
    this.record(admission.operation, 'refused', admission.session.id);
  }

  /** Runs `work` for an admitted command and releases the reservation when it throws. */
  async run<T extends FlowBody>(
    admitted: Admitted<T>,
    work: (admission: FlowAdmission) => Promise<FlowResult<T>>,
  ): Promise<FlowResult<T>> {
    if (admitted.kind === 'replay') return admitted.result;
    try {
      return await work(admitted.admission);
    } catch (error) {
      await this.release(admitted.admission);
      throw error;
    }
  }

  private async rotate(
    context: TransactionContext,
    session: RegistrationFlowSession,
    now: Date,
  ): Promise<string> {
    const token = this.tokens.generate();
    await this.sessions.save(context, session.rotate(token.digest, now, this.policy));
    return token.plain;
  }

  private record(operation: FlowOperation, outcome: string, flowSessionId?: string): void {
    this.telemetry.record({ name: 'registration.flow', operation, outcome, flowSessionId });
  }
}

/** Stable serialization with sorted keys, so equal payloads always hash equally. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
