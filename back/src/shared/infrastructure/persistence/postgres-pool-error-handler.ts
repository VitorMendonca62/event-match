import { Logger } from '@nestjs/common';

import type { PostgresPool } from './database.types';

type PoolErrorLogger = (entry: string) => void;

const defaultPoolErrorLogger: PoolErrorLogger = (entry) => Logger.error(entry);

export function attachPostgresPoolErrorHandler(
  pool: Pick<PostgresPool, 'on'>,
  log: PoolErrorLogger = defaultPoolErrorLogger,
): void {
  pool.on('error', () => {
    log(JSON.stringify({ event: 'database.pool.idle_client_error' }));
  });
}
