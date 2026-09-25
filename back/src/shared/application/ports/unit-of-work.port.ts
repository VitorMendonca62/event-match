export const UNIT_OF_WORK_PORT = Symbol('UNIT_OF_WORK_PORT');

export type TransactionContext = object;

export interface UnitOfWorkPort {
  execute<T>(work: (context: TransactionContext) => Promise<T>): Promise<T>;
}
