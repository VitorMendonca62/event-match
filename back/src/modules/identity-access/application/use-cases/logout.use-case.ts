import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { AuthenticatedSessionRepositoryPort } from '../../domain/ports/outbound/authenticated-session-repository.port';
import type { SessionTokenPort } from '../../domain/ports/outbound/authentication-security.ports';
import type { AuthenticationTelemetryPort } from '../../domain/ports/outbound/authentication-telemetry.port';
import type { ClockPort, IdGeneratorPort } from '../../domain/ports/outbound/runtime.ports';

/**
 * Revokes the presented session only (RF011 partial): other sessions of the account survive.
 * Idempotent for the person — an unknown, expired or already revoked token still ends logged out.
 */
export class Logout {
  constructor(
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly sessions: AuthenticatedSessionRepositoryPort,
    private readonly tokens: SessionTokenPort,
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly telemetry: AuthenticationTelemetryPort,
  ) {}

  async execute(input: { readonly token: string }): Promise<{ readonly loggedOut: true }> {
    const digest = this.tokens.digest(input.token);
    const now = this.clock.now();
    const removed = await this.unitOfWork.execute((context) => this.sessions.deleteByDigest(context, digest, now));
    this.telemetry.record({
      name: 'logout',
      outcome: removed ? 'success' : 'revoked',
      correlationId: this.ids.next(),
    });
    return { loggedOut: true };
  }
}
