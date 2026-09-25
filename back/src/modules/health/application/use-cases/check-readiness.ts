import type {
  DatabaseReadinessPort,
  DatabaseReadinessResult,
} from '../../../../shared/application/ports/database-readiness.port';

export function checkReadiness(
  database: DatabaseReadinessPort,
): Promise<DatabaseReadinessResult> {
  return database.check();
}
