import type { UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { InterestCatalogReaderPort } from '../../../catalog/domain/ports/interest-catalog-reader.port';
import { Profile, type EditableProfileVisibility, type UsageIntent } from '../../domain/entities/profile';
import { ProfileError } from '../../domain/errors/profile.error';
import type { ProfileRepositoryPort } from '../../domain/ports/outbound/profile-repository.port';
import type { ProfileInvitationSubjectPort } from '../../domain/ports/outbound/profile-security.port';
import type { ProfileImageStorePort, ProfileMediaRepositoryPort } from '../../domain/ports/outbound/profile-media.ports';
import { ProfileCompletion } from '../../domain/services/profile-completion';
import { ProfilePreviewProjector } from '../../domain/services/profile-preview-projector';
import type { ProfileTelemetryPort } from '../../domain/ports/outbound/profile-telemetry.port';
import { observed } from '../services/profile-telemetry';
import type { ProfileMediaPolicy } from './profile-media.use-cases';

function ownView(profile: ReturnType<Profile['snapshot']>, hasActivePhoto = profile.photo !== null) {
  return {
    revision: profile.revision, displayName: profile.displayName, region: profile.region,
    usageIntents: profile.usageIntents, interests: profile.interests, presentation: profile.presentation,
    photoVisibility: profile.photoVisibility, presentationVisibility: profile.presentationVisibility, photo: profile.photo,
    completion: new ProfileCompletion().calculate(profile, hasActivePhoto),
  };
}

export type UpdateOwnProfileInput = Readonly<{
  accountId: string; revision: number; displayName: string; region: string;
  usageIntents: readonly UsageIntent[]; interestIds: readonly string[]; presentation: string | null;
  photoVisibility: EditableProfileVisibility; presentationVisibility: EditableProfileVisibility;
}>;

export class GetOwnProfile {
  constructor(private readonly uow: UnitOfWorkPort, private readonly profiles: ProfileRepositoryPort, private readonly subjects: ProfileInvitationSubjectPort, private readonly catalog: InterestCatalogReaderPort, private readonly media: ProfileMediaRepositoryPort, private readonly images: ProfileImageStorePort, private readonly telemetry: ProfileTelemetryPort, private readonly mediaPolicy: ProfileMediaPolicy) {}
  async execute(accountId: string) {
    return observed(this.telemetry, 'profile.read', async () => {
    const loaded = await this.uow.execute(async (context) => {
      const found = await this.profiles.findOwn(context, accountId);
      if (!found) return null;
      const active = await this.catalog.listActive(context);
      const selected = new Set(found.interests.map(({ id }) => id));
      return { profile: { ...found, interests: active.filter(({ id }) => selected.has(id)) }, photo: this.mediaPolicy.enabled ? await this.media.findActive(context, accountId) : null };
    });
    if (!loaded) throw new ProfileError('PROFILE_NOT_FOUND');
    const delivery = loaded.photo ? await this.images.createSignedDelivery(loaded.photo) : null;
    const profile = { ...loaded.profile, photo: delivery ? { deliveryUrl: delivery.url, width: 512 as const, height: 512 as const } : null };
    return { ...ownView(profile, loaded.profile.photo !== null), invitationSubject: this.subjects.digest(accountId) };
    });
  }
}

export class UpdateOwnProfile {
  constructor(private readonly uow: UnitOfWorkPort, private readonly profiles: ProfileRepositoryPort, private readonly catalog: InterestCatalogReaderPort, private readonly media: ProfileMediaRepositoryPort, private readonly images: ProfileImageStorePort, private readonly telemetry: ProfileTelemetryPort, private readonly mediaPolicy: ProfileMediaPolicy) {}
  async execute(input: UpdateOwnProfileInput) {
    return observed(this.telemetry, 'profile.update', async () => {
    const updated = await this.uow.execute(async (context) => {
      const current = await this.profiles.findOwn(context, input.accountId);
      if (!current) throw new ProfileError('PROFILE_NOT_FOUND');
      if (current.revision !== input.revision) throw new ProfileError('PROFILE_REVISION_CONFLICT');
      const interests = await this.catalog.findActiveByIds(context, input.interestIds);
      if (interests.length !== new Set(input.interestIds).size) throw new ProfileError('INACTIVE_INTEREST');
      const summaries = await this.catalog.listActive(context);
      const selected = new Set(input.interestIds);
      const next = Profile.restore(current).update({
        displayName: input.displayName, region: input.region, usageIntents: input.usageIntents,
        interests: summaries.filter((item) => selected.has(item.id)), presentation: input.presentation,
        photoVisibility: input.photoVisibility, presentationVisibility: input.presentationVisibility,
      });
      if (await this.profiles.updateIfRevision(context, next, input.revision) === 'conflict') throw new ProfileError('PROFILE_REVISION_CONFLICT');
      return { profile: next.snapshot(), photo: this.mediaPolicy.enabled ? await this.media.findActive(context, input.accountId) : null };
    });
    const delivery = updated.photo ? await this.images.createSignedDelivery(updated.photo) : null;
    return ownView(
      { ...updated.profile, photo: delivery ? { deliveryUrl: delivery.url, width: 512 as const, height: 512 as const } : null },
      updated.profile.photo !== null,
    );
    });
  }
}

export class PreviewOwnProfile {
  constructor(private readonly uow: UnitOfWorkPort, private readonly profiles: ProfileRepositoryPort, private readonly catalog: InterestCatalogReaderPort, private readonly media: ProfileMediaRepositoryPort, private readonly images: ProfileImageStorePort, private readonly telemetry: ProfileTelemetryPort, private readonly mediaPolicy: ProfileMediaPolicy) {}
  async execute(accountId: string) {
    return observed(this.telemetry, 'profile.preview', async () => {
    const loaded = await this.uow.execute(async (context) => {
      const found = await this.profiles.findOwn(context, accountId);
      if (!found) return null;
      const active = await this.catalog.listActive(context);
      const selected = new Set(found.interests.map(({ id }) => id));
      return { profile: { ...found, interests: active.filter(({ id }) => selected.has(id)) }, photo: this.mediaPolicy.enabled ? await this.media.findActive(context, accountId) : null };
    });
    if (!loaded) throw new ProfileError('PROFILE_NOT_FOUND');
    const delivery = loaded.photo ? await this.images.createSignedDelivery(loaded.photo) : null;
    const profile = { ...loaded.profile, photo: delivery ? { deliveryUrl: delivery.url, width: 512 as const, height: 512 as const } : null };
    return new ProfilePreviewProjector().project(profile);
    });
  }
}
