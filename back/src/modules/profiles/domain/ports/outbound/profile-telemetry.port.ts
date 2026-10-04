export const PROFILE_TELEMETRY_PORT = Symbol('PROFILE_TELEMETRY_PORT');

export type ProfileEventName =
  | 'profile.read'
  | 'profile.update'
  | 'profile.conflict'
  | 'profile.preview'
  | 'profile.photo.grant'
  | 'profile.photo.finalize'
  | 'profile.photo.reject'
  | 'profile.photo.remove'
  | 'profile.media.cleanup';

export type ProfileEventOutcome =
  | 'success'
  | 'not_found'
  | 'invalid'
  | 'conflict'
  | 'expired'
  | 'rate_limited'
  | 'provider_error'
  | 'rejected'
  | 'failed';

/** PII-free allowlist: never profile content, account/provider ids, URLs, signatures or subjects. */
export interface ProfileEvent {
  readonly name: ProfileEventName;
  readonly outcome: ProfileEventOutcome;
  readonly status: number;
  readonly durationMs: number;
  readonly provider?: 'cloudinary' | 'fake';
  readonly processedCount?: number;
  readonly failedCount?: number;
}

export interface ProfileTelemetryPort {
  record(event: ProfileEvent): void;
}
