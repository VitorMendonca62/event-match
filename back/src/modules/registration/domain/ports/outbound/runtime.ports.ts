export const CLOCK_PORT = Symbol('CLOCK_PORT');
export const ID_GENERATOR_PORT = Symbol('ID_GENERATOR_PORT');
export interface ClockPort { now(): Date; }
export interface IdGeneratorPort { next(): string; }
