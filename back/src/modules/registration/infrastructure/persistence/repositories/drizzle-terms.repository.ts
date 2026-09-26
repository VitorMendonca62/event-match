import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';

import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../../shared/infrastructure/persistence/resolve-executor';
import { isUuid } from '../../../../../shared/infrastructure/persistence/uuid';
import type {
  ApprovedTermsDocument,
  TermsAcceptance,
  TermsRepositoryPort,
} from '../../../domain/ports/outbound/persistence.ports';
import type { TermsDocumentKind } from '../../../domain/value-objects/terms-document-kind';
import { termsAcceptance, termsDocument } from '../schema/registration.schema';

@Injectable()
export class DrizzleTermsRepository implements TermsRepositoryPort {
  /**
   * Placeholders never count as acceptance (ADR-012). `FOR SHARE` keeps the selected documents
   * approved until the activation commits (ADR-013), while other activations can still read them.
   */
  async findApproved(context: TransactionContext, documentIds: string[]): Promise<ApprovedTermsDocument[]> {
    const candidates = documentIds.filter(isUuid);
    if (candidates.length === 0) return [];
    const rows = await resolveExecutor(context)
      .select({ id: termsDocument.id, kind: termsDocument.kind })
      .from(termsDocument)
      .where(and(inArray(termsDocument.id, candidates), eq(termsDocument.status, 'approved')))
      .for('share');
    return rows.map((row) => ({ id: row.id, kind: row.kind as TermsDocumentKind }));
  }

  async recordAcceptances(
    context: TransactionContext,
    accountId: string,
    acceptances: TermsAcceptance[],
    acceptedAt: Date,
  ): Promise<void> {
    if (acceptances.length === 0) return;
    await resolveExecutor(context)
      .insert(termsAcceptance)
      .values(
        acceptances.map((acceptance) => ({
          id: acceptance.id,
          accountId,
          documentId: acceptance.documentId,
          acceptedAt,
          context: {},
        })),
      )
      .onConflictDoNothing({ target: [termsAcceptance.accountId, termsAcceptance.documentId] });
  }
}
