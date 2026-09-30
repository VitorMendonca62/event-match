export const IDENTITY_CLOCK_PORT = Symbol('IDENTITY_CLOCK_PORT');
export const IDENTITY_ID_GENERATOR_PORT = Symbol('IDENTITY_ID_GENERATOR_PORT');

export interface ClockPort {
  now(): Date;
}

export interface IdGeneratorPort {
  next(): string;
}
