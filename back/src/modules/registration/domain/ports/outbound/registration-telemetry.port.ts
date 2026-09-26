import type { ContactChannel } from '../../value-objects/contact-identifier';

export const REGISTRATION_TELEMETRY_PORT = Symbol('REGISTRATION_TELEMETRY_PORT');

export type RegistrationEventName =
  | 'verification.requested'
  | 'verification.resent'
  | 'verification.attempted'
  | 'verification.delivery_failed'
  | 'registration.started'
  | 'registration.required_data_saved'
  | 'account.activation'
  | 'registration.stale_expired';

/** Structured event with opaque ids and result codes only; never contact, OTP or password. */
export interface RegistrationEvent {
  readonly name: RegistrationEventName;
  readonly outcome: string;
  readonly channel?: ContactChannel;
  readonly verificationId?: string;
  readonly registrationId?: string;
  readonly accountId?: string;
  readonly count?: number;
}

export interface RegistrationTelemetryPort {
  record(event: RegistrationEvent): void;
}
