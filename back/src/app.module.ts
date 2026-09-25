import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from './modules/health/health.module';
import { validateEnv } from './shared/infrastructure/config/env';
import { PersistenceModule } from './shared/infrastructure/persistence/persistence.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PersistenceModule,
    HealthModule,
  ],
})
export class AppModule {}
