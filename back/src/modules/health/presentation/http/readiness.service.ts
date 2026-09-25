import { Inject, Injectable } from '@nestjs/common';

import {
  checkReadiness,
} from '../../application/use-cases/check-readiness';
import type {
  DatabaseReadinessPort,
  DatabaseReadinessResult,
} from '../../../../shared/application/ports/database-readiness.port';
import { DATABASE_READINESS_PORT } from '../../../../shared/application/ports/database-readiness.port';

@Injectable()
export class ReadinessService {
  constructor(
    @Inject(DATABASE_READINESS_PORT)
    private readonly databaseReadiness: DatabaseReadinessPort,
  ) {}

  check(): Promise<DatabaseReadinessResult> {
    return checkReadiness(this.databaseReadiness);
  }
}
