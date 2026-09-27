import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type {
  ApprovedTermsMetadata,
  TermsRepositoryPort,
} from '../../domain/ports/outbound/persistence.ports';

/**
 * Metadata of approved documents only (RF005, ADR-012). Placeholders and retired versions never
 * leave the adapter, so the list stays empty until legal content is published.
 */
export class ListApprovedLegalDocuments {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly terms: TermsRepositoryPort,
  ) {}

  execute(input: { locale: string }): Promise<ApprovedTermsMetadata[]> {
    return this.uow.execute((context) => this.terms.listApproved(context, input.locale));
  }
}
