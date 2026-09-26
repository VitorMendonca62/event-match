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
 * Every setup failure releases both pools and drops whatever was created.
 */
export async function createEphemeralDatabase(
  adminUrl: string,
  options: { initialMigrationsFolder?: string } = {},
): Promise<EphemeralDatabase> {
  const name = `eventmatch_it_${randomBytes(6).toString('hex')}`;
  const admin = new Pool({ connectionString: adminUrl, max: 1 });
  let pool: Pool | undefined;
  let created = false;

  const release = async () => {
    await pool?.end();
    try {
      if (created) await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    } finally {
      await admin.end();
    }
  };

  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;

    const url = new URL(adminUrl);
    url.pathname = `/${name}`;
    const databasePool = new Pool({ connectionString: url.toString(), max: 2 });
    pool = databasePool;
    const migrateDatabase = () => migrate(drizzle({ client: databasePool }), MIGRATIONS_CONFIG);
    // A partial folder lets tests seed legacy rows before the remaining migrations run.
    await migrate(drizzle({ client: databasePool }), {
      ...MIGRATIONS_CONFIG,
      migrationsFolder: options.initialMigrationsFolder ?? MIGRATIONS_CONFIG.migrationsFolder,
    });

    return { url: url.toString(), pool: databasePool, migrate: migrateDatabase, drop: release };
  } catch (error) {
    await release();
    throw error;
  }
}
