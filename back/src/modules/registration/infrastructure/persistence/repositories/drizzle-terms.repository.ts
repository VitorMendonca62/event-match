import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, lte, notExists, or, gt } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../../shared/infrastructure/persistence/resolve-executor';
import { isUuid } from '../../../../../shared/infrastructure/persistence/uuid';
import type {
  ApprovedTermsDocument,
  CurrentTermsDocument,
  TermsAcceptance,
  TermsRepositoryPort,
} from '../../../domain/ports/outbound/persistence.ports';
import type { TermsDocumentKind } from '../../../domain/value-objects/terms-document-kind';
import { termsAcceptance, termsDocument } from '../schema/registration.schema';

@Injectable()
export class DrizzleTermsRepository implements TermsRepositoryPort {
  async listCurrent(context: TransactionContext, locale: string, now: Date): Promise<CurrentTermsDocument[]> {
    const rows = await resolveExecutor(context)
      .selectDistinctOn([termsDocument.kind], {
        id: termsDocument.id,
        kind: termsDocument.kind,
        version: termsDocument.version,
        locale: termsDocument.locale,
        effectiveAt: termsDocument.effectiveAt,
        content: termsDocument.content,
      })
      .from(termsDocument)
      .where(
        and(
          eq(termsDocument.status, 'approved'),
          eq(termsDocument.locale, locale),
          lte(termsDocument.effectiveAt, now),
        ),
      )
      .orderBy(termsDocument.kind, desc(termsDocument.effectiveAt), desc(termsDocument.version));
    return rows.flatMap((row) =>
      row.content === null ? [] : [{ ...row, kind: row.kind as TermsDocumentKind, content: row.content }],
    );
  }

  /**
   * Placeholders never count as acceptance (ADR-012) and neither do superseded or future versions
   * (ADR-028). `FOR SHARE` keeps the selected documents approved until the activation commits
   * (ADR-013), while other activations can still read them.
   */
  async findCurrent(context: TransactionContext, documentIds: string[], now: Date): Promise<ApprovedTermsDocument[]> {
    const candidates = documentIds.filter(isUuid);
    if (candidates.length === 0) return [];
    const newer = alias(termsDocument, 'newer_document');
    const rows = await resolveExecutor(context)
      .select({ id: termsDocument.id, kind: termsDocument.kind })
      .from(termsDocument)
      .where(
        and(
          inArray(termsDocument.id, candidates),
          eq(termsDocument.status, 'approved'),
          lte(termsDocument.effectiveAt, now),
          notExists(
            resolveExecutor(context)
              .select({ id: newer.id })
              .from(newer)
              .where(
                and(
                  eq(newer.kind, termsDocument.kind),
                  eq(newer.locale, termsDocument.locale),
                  eq(newer.status, 'approved'),
                  lte(newer.effectiveAt, now),
                  or(
                    gt(newer.effectiveAt, termsDocument.effectiveAt),
                    and(eq(newer.effectiveAt, termsDocument.effectiveAt), gt(newer.version, termsDocument.version)),
                  ),
                ),
              ),
          ),
        ),
      )
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
