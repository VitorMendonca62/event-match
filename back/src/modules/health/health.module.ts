import { Module } from '@nestjs/common';

import { GET_HEALTH_PORT } from './domain/ports/inbound/get-health.token';
import { HealthController } from './presentation/http/health.controller';
import { HealthService } from './presentation/http/health.service';

@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: GET_HEALTH_PORT,
      useExisting: HealthService,
    },
  ],
})
export class HealthModule {}
