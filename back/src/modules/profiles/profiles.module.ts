import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';

import { UNIT_OF_WORK_PORT } from '../../shared/application/ports/unit-of-work.port';
import { useCaseProvider } from '../../shared/infrastructure/nest/use-case.provider';
import { PersistenceModule } from '../../shared/infrastructure/persistence/persistence.module';
import { NoStoreMiddleware } from '../../shared/presentation/http/no-store.middleware';
import { CatalogModule } from '../catalog/catalog.module';
import { INTEREST_CATALOG_READER_PORT } from '../catalog/domain/ports/interest-catalog-reader.port';
import { IdentityAccessModule } from '../identity-access/identity-access.module';
import { GetOwnProfile, PreviewOwnProfile, UpdateOwnProfile } from './application/use-cases/profile.use-cases';
import { PROFILE_REPOSITORY_PORT } from './domain/ports/outbound/profile-repository.port';
import { PROFILE_INVITATION_SUBJECT_PORT, PROFILE_MEDIA_SUBJECT_PORT } from './domain/ports/outbound/profile-security.port';
import { PROFILE_IMAGE_STORE_PORT, PROFILE_MEDIA_REPOSITORY_PORT } from './domain/ports/outbound/profile-media.ports';
import { CreateProfilePhotoUpload, FinalizeProfilePhotoUpload, RemoveProfilePhoto, CleanupProfileMedia, PROFILE_MEDIA_POLICY } from './application/use-cases/profile-media.use-cases';
import { ConfigService } from '@nestjs/config';
import type { BackendEnv } from '../../shared/infrastructure/config/env';
import { CloudinaryProfileImageStoreAdapter } from './infrastructure/media/cloudinary-profile-image-store.adapter';
import { DrizzleProfileMediaRepository } from './infrastructure/persistence/drizzle-profile-media.repository';
import { FakeProfileImageStoreAdapter } from './infrastructure/media/fake-profile-image-store.adapter';
import type { ProfileImageStorePort } from './domain/ports/outbound/profile-media.ports';
import { PROFILE_WRITER_PORT } from './domain/ports/profile-writer.port';
import { DrizzleProfileRepositoryAdapter } from './infrastructure/persistence/drizzle-profile-repository.adapter';
import { DrizzleProfileWriterAdapter } from './infrastructure/persistence/drizzle-profile-writer.adapter';
import { ProfileInvitationSubjectAdapter } from './infrastructure/security/profile-invitation-subject.adapter';
import { ProfileMediaSubjectAdapter } from './infrastructure/security/profile-media-subject.adapter';
import { PROFILE_TELEMETRY_PORT } from './domain/ports/outbound/profile-telemetry.port';
import { LoggerProfileTelemetryAdapter } from './infrastructure/observability/logger-profile-telemetry.adapter';
import { ProfileController } from './presentation/http/controllers/profile.controller';
import { ProfileBffGuard, ProfileMediaGuard, ProfileReadGuard, ProfileWriteGuard } from './presentation/http/profile-auth.guard';

@Module({
  imports: [PersistenceModule, CatalogModule, IdentityAccessModule],
  controllers: [ProfileController],
  providers: [
    { provide: PROFILE_WRITER_PORT, useClass: DrizzleProfileWriterAdapter },
    { provide: PROFILE_REPOSITORY_PORT, useClass: DrizzleProfileRepositoryAdapter },
    { provide: PROFILE_INVITATION_SUBJECT_PORT, useClass: ProfileInvitationSubjectAdapter },
    { provide: PROFILE_MEDIA_SUBJECT_PORT, useClass: ProfileMediaSubjectAdapter },
    CloudinaryProfileImageStoreAdapter,
    FakeProfileImageStoreAdapter,
    { provide: PROFILE_IMAGE_STORE_PORT, inject: [ConfigService, CloudinaryProfileImageStoreAdapter, FakeProfileImageStoreAdapter], useFactory: (config: ConfigService<BackendEnv, true>, cloudinary: CloudinaryProfileImageStoreAdapter, fake: FakeProfileImageStoreAdapter): ProfileImageStorePort => config.getOrThrow<string>('PROFILE_MEDIA_PROVIDER') === 'fake' ? fake : cloudinary },
    { provide: PROFILE_MEDIA_REPOSITORY_PORT, useClass: DrizzleProfileMediaRepository },
    { provide: PROFILE_TELEMETRY_PORT, useClass: LoggerProfileTelemetryAdapter },
    { provide: PROFILE_MEDIA_POLICY, inject: [ConfigService], useFactory: (config: ConfigService<BackendEnv, true>) => ({ enabled: config.getOrThrow<boolean>('PROFILE_MEDIA_ENABLED'), uploadTtlMs: config.getOrThrow<number>('PROFILE_PHOTO_UPLOAD_TTL_SECONDS') * 1000, accountLimit: config.getOrThrow<number>('PROFILE_PHOTO_ACCOUNT_DAILY_LIMIT'), originLimit: config.getOrThrow<number>('PROFILE_PHOTO_ORIGIN_15M_LIMIT') }) },
    useCaseProvider(GetOwnProfile, [UNIT_OF_WORK_PORT, PROFILE_REPOSITORY_PORT, PROFILE_INVITATION_SUBJECT_PORT, INTEREST_CATALOG_READER_PORT, PROFILE_MEDIA_REPOSITORY_PORT, PROFILE_IMAGE_STORE_PORT, PROFILE_TELEMETRY_PORT, PROFILE_MEDIA_POLICY]),
    useCaseProvider(UpdateOwnProfile, [UNIT_OF_WORK_PORT, PROFILE_REPOSITORY_PORT, INTEREST_CATALOG_READER_PORT, PROFILE_MEDIA_REPOSITORY_PORT, PROFILE_IMAGE_STORE_PORT, PROFILE_TELEMETRY_PORT, PROFILE_MEDIA_POLICY]),
    useCaseProvider(PreviewOwnProfile, [UNIT_OF_WORK_PORT, PROFILE_REPOSITORY_PORT, INTEREST_CATALOG_READER_PORT, PROFILE_MEDIA_REPOSITORY_PORT, PROFILE_IMAGE_STORE_PORT, PROFILE_TELEMETRY_PORT, PROFILE_MEDIA_POLICY]),
    useCaseProvider(CleanupProfileMedia, [UNIT_OF_WORK_PORT, PROFILE_MEDIA_REPOSITORY_PORT, PROFILE_IMAGE_STORE_PORT, PROFILE_TELEMETRY_PORT]),
    useCaseProvider(CreateProfilePhotoUpload, [UNIT_OF_WORK_PORT, PROFILE_MEDIA_REPOSITORY_PORT, PROFILE_IMAGE_STORE_PORT, PROFILE_MEDIA_SUBJECT_PORT, PROFILE_MEDIA_POLICY, PROFILE_REPOSITORY_PORT, PROFILE_TELEMETRY_PORT, CleanupProfileMedia]),
    useCaseProvider(FinalizeProfilePhotoUpload, [UNIT_OF_WORK_PORT, PROFILE_MEDIA_REPOSITORY_PORT, PROFILE_IMAGE_STORE_PORT, PROFILE_TELEMETRY_PORT, CleanupProfileMedia]),
    useCaseProvider(RemoveProfilePhoto, [UNIT_OF_WORK_PORT, PROFILE_MEDIA_REPOSITORY_PORT, PROFILE_TELEMETRY_PORT, CleanupProfileMedia]),
    ProfileBffGuard, ProfileMediaGuard, ProfileReadGuard, ProfileWriteGuard,
  ],
  exports: [PROFILE_WRITER_PORT],
})
export class ProfilesModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void { consumer.apply(NoStoreMiddleware).forRoutes(ProfileController); }
}
