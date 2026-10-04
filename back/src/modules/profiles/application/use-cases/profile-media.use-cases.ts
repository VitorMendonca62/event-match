/** @format */

import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import { ProfileError } from '../../domain/errors/profile.error';
import type {
  ProfileImageStorePort,
  ProfileMediaRepositoryPort,
} from '../../domain/ports/outbound/profile-media.ports';
import type { ProfileMediaSubjectPort } from '../../domain/ports/outbound/profile-security.port';
import type { ProfileRepositoryPort } from '../../domain/ports/outbound/profile-repository.port';
import type { ProfileTelemetryPort } from '../../domain/ports/outbound/profile-telemetry.port';
import { observed } from '../services/profile-telemetry';

export type ProfileMediaPolicy = Readonly<{
  enabled: boolean;
  uploadTtlMs: number;
  accountLimit: number;
  originLimit: number;
}>;
export const PROFILE_MEDIA_POLICY = Symbol('PROFILE_MEDIA_POLICY');

const runOpportunisticCleanup = (cleanup: CleanupProfileMedia): void => {
  void cleanup.execute(2).catch(() => undefined);
};

export class CreateProfilePhotoUpload {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly media: ProfileMediaRepositoryPort,
    private readonly store: ProfileImageStorePort,
    private readonly subjects: ProfileMediaSubjectPort,
    private readonly policy: ProfileMediaPolicy,
    private readonly profiles: ProfileRepositoryPort,
    private readonly telemetry: ProfileTelemetryPort,
    private readonly cleanup: CleanupProfileMedia,
  ) {}
  async execute(input: { accountId: string; originSubject: string; revision: number }) {
    return observed(
      this.telemetry,
      'profile.photo.grant',
      async () => {
        const now = new Date();
        const id = crypto.randomUUID();
        const expiresAt = new Date(now.getTime() + this.policy.uploadTtlMs);
        const pending = {
          id,
          accountId: input.accountId,
          publicId: `profiles/${crypto.randomUUID()}`,
          expiresAt,
        };
        await this.uow.execute(async (context) => {
          const profile = await this.profiles.findOwn(context, input.accountId);
          if (!profile) throw new ProfileError('PROFILE_NOT_FOUND');
          if (profile.revision !== input.revision)
            throw new ProfileError('PROFILE_REVISION_CONFLICT');
          const result = await this.media.consumeLimit(context, {
            accountSubject: this.subjects.digest('account', input.accountId),
            originSubject: this.subjects.digest('origin', input.originSubject),
            now,
            accountLimit: this.policy.accountLimit,
            originLimit: this.policy.originLimit,
          });
          if (result !== 'allowed') throw new ProfileError('MEDIA_RATE_LIMITED');
          await this.media.createPending(context, pending);
        });
        const grant = await this.store.createSignedUpload({
          uploadId: id,
          publicId: pending.publicId,
          expiresAt,
        });
        runOpportunisticCleanup(this.cleanup);
        return grant;
      },
      { provider: this.store.provider, successStatus: 201 },
    );
  }
}

export class FinalizeProfilePhotoUpload {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly media: ProfileMediaRepositoryPort,
    private readonly store: ProfileImageStorePort,
    private readonly telemetry: ProfileTelemetryPort,
    private readonly cleanup: CleanupProfileMedia,
  ) {}
  async execute(input: {
    accountId: string;
    uploadId: string;
    revision: number;
    providerResponse: Record<string, unknown>;
  }) {
    return observed(
      this.telemetry,
      'profile.photo.finalize',
      async () => {
        const pending = await this.uow.execute((context) =>
          this.media.findPending(context, input.accountId, input.uploadId),
        );
        if (!pending) throw new ProfileError('PROFILE_NOT_FOUND');
        if (pending.expiresAt <= new Date())
          throw new ProfileError('PHOTO_UPLOAD_EXPIRED');
        const image = await this.store.verifyUploaded({
          pending,
          providerResponse: input.providerResponse,
        });
        const result = await this.uow.execute((context) =>
          this.media.activate(context, {
            accountId: input.accountId,
            uploadId: input.uploadId,
            expectedRevision: input.revision,
            image,
            now: new Date(),
          }),
        );
        if (result === 'conflict') throw new ProfileError('PROFILE_REVISION_CONFLICT');
        if (result === 'expired') throw new ProfileError('PHOTO_UPLOAD_EXPIRED');
        runOpportunisticCleanup(this.cleanup);
        return { activated: true as const };
      },
      { provider: this.store.provider },
    );
  }
}

export class RemoveProfilePhoto {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly media: ProfileMediaRepositoryPort,
    private readonly telemetry: ProfileTelemetryPort,
    private readonly cleanup: CleanupProfileMedia,
  ) {}
  async execute(input: { accountId: string; revision: number }) {
    return observed(this.telemetry, 'profile.photo.remove', async () => {
      const result = await this.uow.execute((context) =>
        this.media.removeActive(context, input.accountId, input.revision, new Date()),
      );
      if (result === 'conflict') throw new ProfileError('PROFILE_REVISION_CONFLICT');
      runOpportunisticCleanup(this.cleanup);
      return { removed: result === 'marked' };
    });
  }
}

export class CleanupProfileMedia {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly media: ProfileMediaRepositoryPort,
    private readonly store: ProfileImageStorePort,
    private readonly telemetry: ProfileTelemetryPort,
  ) {}
  async execute(limit = 20): Promise<{ processed: number; failed: number }> {
    const startedAt = Date.now();
    const now = new Date();
    const candidates = await this.uow.execute((context) =>
      this.media.listCleanup(context, now, limit),
    );
    let failed = 0;
    for (const candidate of candidates) {
      try {
        await this.store.delete(candidate.publicId);
        await this.uow.execute((context) =>
          this.media.cleanupSucceeded(context, candidate.id),
        );
      } catch {
        failed += 1;
        await this.uow.execute((context) =>
          this.media.cleanupFailed(context, candidate.id, new Date()),
        );
      }
    }
    const result = { processed: candidates.length, failed };
    this.telemetry.record({
      name: 'profile.media.cleanup',
      outcome: failed ? 'failed' : 'success',
      status: failed ? 503 : 200,
      durationMs: Date.now() - startedAt,
      provider: this.store.provider,
      processedCount: result.processed,
      failedCount: result.failed,
    });
    return result;
  }
}
