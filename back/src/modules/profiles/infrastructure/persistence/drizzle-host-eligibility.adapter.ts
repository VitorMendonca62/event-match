import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { HostEligibilityPort } from '../../domain/ports/host-eligibility.port';
import { accountInterest, profile, profilePhotoAsset } from './schema/profiles.schema';
import { accountContactProjection, accountProjection, termsAcceptanceProjection, termsDocumentProjection } from './host-eligibility.projection';

/**
 * Composes only the facts needed to decide whether an account may host an event. The adapter
 * deliberately returns a boolean: callers must not learn which profile, contact or legal fact
 * was missing (ADR-057).
 */
@Injectable()
export class DrizzleHostEligibilityAdapter implements HostEligibilityPort {
  async isEligible(context: TransactionContext, accountId: string): Promise<boolean> {
    const database = resolveExecutor(context);
    const [accountRow, profileRow, interests, photos, contacts, rules] = await Promise.all([
      database.select({ status: accountProjection.status }).from(accountProjection).where(eq(accountProjection.id, accountId)).limit(1),
      database.select({ presentation: profile.presentation }).from(profile).where(eq(profile.accountId, accountId)).limit(1),
      database.select({ accountId: accountInterest.accountId }).from(accountInterest).where(eq(accountInterest.accountId, accountId)),
      database.select({ id: profilePhotoAsset.id }).from(profilePhotoAsset).where(and(eq(profilePhotoAsset.accountId, accountId), eq(profilePhotoAsset.state, 'active'))).limit(1),
      database.select({ channel: accountContactProjection.channel, holdsContact: accountContactProjection.holdsContact })
        .from(accountContactProjection).where(eq(accountContactProjection.accountId, accountId)),
      database.select({ kind: termsDocumentProjection.kind })
        .from(termsAcceptanceProjection)
        .innerJoin(termsDocumentProjection, eq(termsAcceptanceProjection.documentId, termsDocumentProjection.id))
        .where(and(eq(termsAcceptanceProjection.accountId, accountId), eq(termsDocumentProjection.kind, 'community_rules'), eq(termsDocumentProjection.status, 'approved'))),
    ]);

    const channels = new Set(contacts.filter((contact) => contact.holdsContact).map(({ channel }) => channel));
    return Boolean(
      accountRow[0]?.status === 'active' &&
      profileRow[0]?.presentation?.trim() &&
      interests.length >= 3 &&
      photos.length > 0 &&
      channels.has('email') &&
      channels.has('whatsapp') &&
      rules.length > 0,
    );
  }
}
