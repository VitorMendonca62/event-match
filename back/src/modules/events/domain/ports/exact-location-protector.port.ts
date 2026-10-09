import type { ExactLocation } from '../value-objects/event-location';

export const EXACT_LOCATION_PROTECTOR_PORT = Symbol('EXACT_LOCATION_PROTECTOR_PORT');

export type ProtectedExactLocation = Readonly<{ ciphertext: Buffer; iv: Buffer; authTag: Buffer; keyVersion: number }>;

export interface ExactLocationProtectorPort {
  protect(value: ExactLocation): ProtectedExactLocation;
  reveal(value: ProtectedExactLocation): ExactLocation;
}
