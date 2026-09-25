import 'reflect-metadata';

process.env.DATABASE_URL ??= 'postgresql://eventmatch:eventmatch@localhost:5432/eventmatch';
process.env.DATABASE_POOL_MAX ??= '1';
process.env.DATABASE_IDLE_TIMEOUT_MS ??= '10000';
process.env.DATABASE_CONNECTION_TIMEOUT_MS ??= '2000';
process.env.DATABASE_STATEMENT_TIMEOUT_MS ??= '5000';
process.env.DATABASE_SSL_MODE ??= 'disable';
