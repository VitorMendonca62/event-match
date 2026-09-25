import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';

import type { PostgresPool } from './database.types';
import { PG_POOL } from './tokens';

@Injectable()
export class PostgresPoolLifecycle implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: PostgresPool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
