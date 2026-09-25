import { Module } from '@nestjs/common';

import { PersistenceModule } from '../../shared/infrastructure/persistence/persistence.module';
import { GET_HEALTH_PORT } from './domain/ports/inbound/get-health.token';
import { HealthController } from './presentation/http/health.controller';
import { HealthService } from './presentation/http/health.service';
import { ReadinessService } from './presentation/http/readiness.service';

@Module({
  imports: [PersistenceModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    ReadinessService,
    {
      provide: GET_HEALTH_PORT,
      useExisting: HealthService,
    },
  ],
})
export class HealthModule {}
