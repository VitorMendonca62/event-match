import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from './modules/health/health.module';
import { RegistrationModule } from './modules/registration/registration.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { validateEnv } from './shared/infrastructure/config/env';
import { PersistenceModule } from './shared/infrastructure/persistence/persistence.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PersistenceModule,
    ProfilesModule,
    CatalogModule,
    RegistrationModule,
    HealthModule,
  ],
})
export class AppModule {}
