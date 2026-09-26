import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { InterestCatalogReaderPort } from '../../../catalog/domain/ports/interest-catalog-reader.port';
import type { ProfileWriterPort } from '../../../profiles/domain/ports/profile-writer.port';
import { RegistrationError } from '../../domain/errors/registration.error';
import type {
  AccountRepositoryPort,
  TermsRepositoryPort,
} from '../../domain/ports/outbound/persistence.ports';
import type { RegistrationTelemetryPort } from '../../domain/ports/outbound/registration-telemetry.port';
import type { ClockPort, IdGeneratorPort } from '../../domain/ports/outbound/runtime.ports';
import { BirthDate } from '../../domain/value-objects/birth-date';
import { coversRequiredTerms } from '../../domain/value-objects/terms-document-kind';
import { REGISTRATION_POLICY } from '../../domain/value-objects/verification-policy';

export interface CompleteRegistrationInput {
  readonly accountId: string;
  readonly birthDate: string;
  readonly interestIds: readonly string[];
  readonly documentIds: readonly string[];
}

type Outcome = 'activated' | 'expired' | 'rejected';

export class CompleteRegistration {
  private readonly policy = REGISTRATION_POLICY;

  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly accounts: AccountRepositoryPort,
    private readonly profiles: ProfileWriterPort,
    private readonly interests: InterestCatalogReaderPort,
    private readonly terms: TermsRepositoryPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly telemetry: RegistrationTelemetryPort,
  ) {}

  /**
   * Activation (RF001, RF005–RF006, ADR-012): adult birth date, three approved documents and at least
   * three active interests, validated under the account lock. Any refusal leaves no partial effect.
   */
  async execute(input: CompleteRegistrationInput): Promise<{ accountId: string; status: 'active' }> {
    const birthDate = BirthDate.create(input.birthDate);
    const outcome = await this.uow.execute(async (context): Promise<Outcome> => {
      const now = this.clock.now();
      const account = await this.accounts.findForUpdate(context, input.accountId);
      if (!account || account.status !== 'account_incomplete') return 'rejected';
      if (account.isStale(now, this.policy)) {
        // Committed on purpose: the overdue account releases its contact (ADR-017).
        await this.accounts.expire(context, account.expire(now));
        await this.profiles.erasePersonalData(context, [account.id]);
        return 'expired';
      }
      if (!birthDate.isAdultAt(now)) return 'rejected';

      const interests = await this.interests.findActiveByIds(context, [...new Set(input.interestIds)]);
      const documents = await this.terms.findApproved(context, [...new Set(input.documentIds)]);
      if (
        interests.length < this.policy.minInterests ||
        !coversRequiredTerms(documents.map((document) => document.kind))
      ) {
        return 'rejected';
      }

      if (!(await this.accounts.activate(context, account.activate(birthDate, now, this.policy)))) return 'rejected';
      await this.profiles.replaceInterests(
        context,
        account.id,
        interests.map((interest) => interest.id),
      );
      await this.terms.recordAcceptances(
        context,
        account.id,
        documents.map((document) => ({ id: this.ids.next(), documentId: document.id })),
        now,
      );
      return 'activated';
    });

    this.telemetry.record({ name: 'account.activation', outcome, accountId: input.accountId });
    if (outcome !== 'activated') throw new RegistrationError('ACCOUNT_CANNOT_BE_ACTIVATED');
    return { accountId: input.accountId, status: 'active' };
  }
}
