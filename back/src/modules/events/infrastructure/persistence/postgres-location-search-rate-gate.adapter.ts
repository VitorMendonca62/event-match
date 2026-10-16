import { Inject, Injectable } from '@nestjs/common';

import type { LocationSearchRateGatePort } from '../../domain/ports/location-search-rate-gate.port';
import type { PostgresPool } from '../../../../shared/infrastructure/persistence/database.types';
import { PG_POOL } from '../../../../shared/infrastructure/persistence/tokens';

@Injectable()
export class PostgresLocationSearchRateGateAdapter implements LocationSearchRateGatePort {
  constructor(@Inject(PG_POOL) private readonly pool: PostgresPool) {}

  async tryAcquire(): Promise<boolean> {
    const result = await this.pool.query(
      `update event_location_search_rate_gate
       set next_allowed_at = clock_timestamp() + interval '1 second'
       where key = 'nominatim' and next_allowed_at <= clock_timestamp()
       returning key`,
    );
    return result.rowCount === 1;
  }
}
