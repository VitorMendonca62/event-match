import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../shared/infrastructure/persistence/persistence.module';
import { PROFILE_WRITER_PORT } from './domain/ports/profile-writer.port';
import { DrizzleProfileWriterAdapter } from './infrastructure/persistence/drizzle-profile-writer.adapter';
@Module({ imports: [PersistenceModule], providers: [DrizzleProfileWriterAdapter, { provide: PROFILE_WRITER_PORT, useExisting: DrizzleProfileWriterAdapter }], exports: [PROFILE_WRITER_PORT] })
export class ProfilesModule {}
