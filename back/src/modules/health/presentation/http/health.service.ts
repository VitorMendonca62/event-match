import { Injectable } from '@nestjs/common';

import { getHealth } from '../../application/use-cases/get-health';
import type { GetHealthPort, HealthResult } from '../../domain/ports/inbound/get-health.port';

@Injectable()
export class HealthService implements GetHealthPort {
  execute(): HealthResult {
    return getHealth();
  }
}
