import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { TermsRepositoryPort } from '../../domain/ports/outbound/persistence.ports';
import type { ClockPort } from '../../domain/ports/outbound/runtime.ports';
import { LegalDocumentText } from '../../domain/value-objects/legal-document-text';
import type { TermsDocumentKind } from '../../domain/value-objects/terms-document-kind';

export interface CurrentLegalDocument {
  readonly id: string;
  readonly kind: TermsDocumentKind;
  readonly version: string;
  readonly locale: string;
  readonly effectiveAt: Date;
  readonly body: string;
}

/**
 * Effective approved documents with their text (RF005, ADR-012, ADR-028). Placeholders, retired and
 * future versions never leave the adapter, so a missing kind keeps the acceptance step blocked.
 */
export class ListCurrentLegalDocuments {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly terms: TermsRepositoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: { locale: string }): Promise<CurrentLegalDocument[]> {
    const documents = await this.uow.execute((context) =>
      this.terms.listCurrent(context, input.locale, this.clock.now()),
    );
    return documents.map(({ content, ...metadata }) => ({
      ...metadata,
      body: LegalDocumentText.fromArtifact(content).body,
    }));
  }
}
