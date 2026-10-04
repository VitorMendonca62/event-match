import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, lt, or, sql } from 'drizzle-orm';
import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import type { ActivePhoto, PendingPhoto, ProfileMediaRepositoryPort, VerifiedProfileImage } from '../../domain/ports/outbound/profile-media.ports';
import { profile, profileMediaAttempt, profilePhotoAsset } from './schema/profiles.schema';

@Injectable()
export class DrizzleProfileMediaRepository implements ProfileMediaRepositoryPort {
  async consumeLimit(context: TransactionContext, input: { accountSubject: Buffer; originSubject: Buffer; now: Date; accountLimit: number; originLimit: number }) {
    const db = resolveExecutor(context);
    await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`profile-media:${input.accountSubject.toString('base64url')}`}, 0)), pg_advisory_xact_lock(hashtextextended(${`profile-media:${input.originSubject.toString('base64url')}`}, 0))`);
    const day = new Date(input.now.getTime() - 86_400_000); const quarter = new Date(input.now.getTime() - 900_000);
    await db.delete(profileMediaAttempt).where(lt(profileMediaAttempt.attemptedAt, day));
    const [accountRows, originRows] = await Promise.all([
      db.select({ value: count() }).from(profileMediaAttempt).where(and(eq(profileMediaAttempt.scope, 'account'), eq(profileMediaAttempt.subjectHash, input.accountSubject), sql`${profileMediaAttempt.attemptedAt} >= ${day}`)),
      db.select({ value: count() }).from(profileMediaAttempt).where(and(eq(profileMediaAttempt.scope, 'origin'), eq(profileMediaAttempt.subjectHash, input.originSubject), sql`${profileMediaAttempt.attemptedAt} >= ${quarter}`)),
    ]);
    if ((accountRows[0]?.value ?? 0) >= input.accountLimit) return 'account_limited' as const;
    if ((originRows[0]?.value ?? 0) >= input.originLimit) return 'origin_limited' as const;
    await db.insert(profileMediaAttempt).values([
      { id: crypto.randomUUID(), scope: 'account', subjectHash: input.accountSubject, attemptedAt: input.now },
      { id: crypto.randomUUID(), scope: 'origin', subjectHash: input.originSubject, attemptedAt: input.now },
    ]);
    return 'allowed' as const;
  }
  async createPending(context: TransactionContext, input: PendingPhoto): Promise<void> {
    const db = resolveExecutor(context); const now = new Date();
    await db.update(profilePhotoAsset).set({ state: 'delete_pending', deleteAfter: now, updatedAt: now }).where(and(eq(profilePhotoAsset.accountId, input.accountId), eq(profilePhotoAsset.state, 'pending')));
    await db.insert(profilePhotoAsset).values({ id: input.id, accountId: input.accountId, provider: 'cloudinary', publicId: input.publicId, state: 'pending', uploadExpiresAt: input.expiresAt, createdAt: now, updatedAt: now });
  }
  async findPending(context: TransactionContext, accountId: string, uploadId: string): Promise<PendingPhoto | null> {
    const [row] = await resolveExecutor(context).select().from(profilePhotoAsset).where(and(eq(profilePhotoAsset.id, uploadId), eq(profilePhotoAsset.accountId, accountId), eq(profilePhotoAsset.state, 'pending'))).limit(1);
    return row ? { id: row.id, accountId: row.accountId, publicId: row.publicId, expiresAt: row.uploadExpiresAt } : null;
  }
  async findActive(context: TransactionContext, accountId: string): Promise<ActivePhoto | null> {
    const [row] = await resolveExecutor(context).select().from(profilePhotoAsset).where(and(eq(profilePhotoAsset.accountId, accountId), eq(profilePhotoAsset.state, 'active'))).limit(1);
    return row?.version ? { id: row.id, publicId: row.publicId, version: row.version } : null;
  }
  async activate(context: TransactionContext, input: { accountId: string; uploadId: string; expectedRevision: number; image: VerifiedProfileImage; now: Date }) {
    const db = resolveExecutor(context);
    const pending = await this.findPending(context, input.accountId, input.uploadId);
    if (!pending || pending.expiresAt <= input.now) return 'expired' as const;
    const changed = await db.update(profile).set({ revision: input.expectedRevision + 1, updatedAt: input.now }).where(and(eq(profile.accountId, input.accountId), eq(profile.revision, input.expectedRevision))).returning({ id: profile.accountId });
    if (changed.length === 0) return 'conflict' as const;
    await db.update(profilePhotoAsset).set({ state: 'delete_pending', deleteAfter: input.now, updatedAt: input.now }).where(and(eq(profilePhotoAsset.accountId, input.accountId), eq(profilePhotoAsset.state, 'active')));
    await db.update(profilePhotoAsset).set({ state: 'active', providerAssetId: input.image.providerAssetId, version: input.image.version, format: input.image.format, bytes: input.image.bytes, width: input.image.width, height: input.image.height, activatedAt: input.now, updatedAt: input.now }).where(eq(profilePhotoAsset.id, input.uploadId));
    return 'activated' as const;
  }
  async removeActive(context: TransactionContext, accountId: string, expectedRevision: number, now: Date) {
    const db = resolveExecutor(context); const active = await this.findActive(context, accountId); if (!active) return 'absent' as const;
    const changed = await db.update(profile).set({ revision: expectedRevision + 1, updatedAt: now }).where(and(eq(profile.accountId, accountId), eq(profile.revision, expectedRevision))).returning({ id: profile.accountId });
    if (changed.length === 0) return 'conflict' as const;
    await db.update(profilePhotoAsset).set({ state: 'delete_pending', deleteAfter: now, updatedAt: now }).where(eq(profilePhotoAsset.id, active.id)); return 'marked' as const;
  }
  async listCleanup(context: TransactionContext, now: Date, limit: number) {
    return resolveExecutor(context).select({ id: profilePhotoAsset.id, publicId: profilePhotoAsset.publicId }).from(profilePhotoAsset).where(or(and(eq(profilePhotoAsset.state, 'pending'), lt(profilePhotoAsset.uploadExpiresAt, now)), and(eq(profilePhotoAsset.state, 'delete_pending'), sql`${profilePhotoAsset.deleteAfter} <= ${now}`))).orderBy(asc(profilePhotoAsset.updatedAt)).limit(limit);
  }
  async cleanupSucceeded(context: TransactionContext, id: string) { await resolveExecutor(context).delete(profilePhotoAsset).where(eq(profilePhotoAsset.id, id)); }
  async cleanupFailed(context: TransactionContext, id: string, now: Date) {
    await resolveExecutor(context).update(profilePhotoAsset).set({
      deleteAttempts: sql`${profilePhotoAsset.deleteAttempts} + 1`,
      deleteAfter: sql`${now} + (least(3600, 60 * power(2, least(${profilePhotoAsset.deleteAttempts}, 6))) * interval '1 second')`,
      updatedAt: now,
    }).where(eq(profilePhotoAsset.id, id));
  }
}
