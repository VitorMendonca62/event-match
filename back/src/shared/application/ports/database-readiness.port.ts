export const DATABASE_READINESS_PORT = Symbol('DATABASE_READINESS_PORT');

export type DatabaseReadinessResult = Readonly<{
  status: 'up';
  latencyMs: number;
}>;

export interface DatabaseReadinessPort {
  check(): Promise<DatabaseReadinessResult>;
}
