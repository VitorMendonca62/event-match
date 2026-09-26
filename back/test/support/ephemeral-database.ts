import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

export const MIGRATIONS_CONFIG = {
  migrationsFolder: join(process.cwd(), 'drizzle'),
  migrationsSchema: 'drizzle',
  migrationsTable: '__drizzle_migrations',
};

export interface EphemeralDatabase {
  readonly url: string;
  /** Direct access for assertions and fixtures; never used by the code under test. */
  readonly pool: Pool;
  migrate(): Promise<void>;
  drop(): Promise<void>;
}

/**
 * Creates `eventmatch_it_<random>` through the administrative connection and applies the
 * versioned migrations with the Drizzle migrator, so tests never share a database (SDD-007 §7).
 */
export async function createEphemeralDatabase(adminUrl: string): Promise<EphemeralDatabase> {
  const name = `eventmatch_it_${randomBytes(6).toString('hex')}`;
  const admin = new Pool({ connectionString: adminUrl, max: 1 });
  await admin.query(`CREATE DATABASE "${name}"`);

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString(), max: 2 });
  const database: EphemeralDatabase = {
    url: url.toString(),
    pool,
    migrate: () => migrate(drizzle({ client: pool }), MIGRATIONS_CONFIG),
    async drop() {
      await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
    },
  };

  try {
    await database.migrate();
  } catch (error) {
    await database.drop();
    throw error;
  }
  return database;
}
