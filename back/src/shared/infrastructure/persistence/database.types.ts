import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

export type PostgresPool = Pool;
export type DrizzleDatabase = NodePgDatabase<Record<string, never>>;
