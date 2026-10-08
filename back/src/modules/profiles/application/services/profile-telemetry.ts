import { ProfileError } from '../../domain/errors/profile.error';
import type { ProfileEventName, ProfileEventOutcome, ProfileTelemetryPort } from '../../domain/ports/outbound/profile-telemetry.port';

const ERROR_EVENT: Record<ProfileError['code'], { outcome: ProfileEventOutcome; status: number }> = {
  PROFILE_NOT_FOUND: { outcome: 'not_found', status: 404 },
  PROFILE_REVISION_CONFLICT: { outcome: 'conflict', status: 409 },
  INVALID_PROFILE_CONTENT: { outcome: 'invalid', status: 400 },
  INVALID_LOCATION: { outcome: 'invalid', status: 400 },
  INACTIVE_INTEREST: { outcome: 'invalid', status: 400 },
  UNKNOWN_LANGUAGE: { outcome: 'invalid', status: 422 },
  INACTIVE_LANGUAGE: { outcome: 'invalid', status: 422 },
  UNKNOWN_ACTIVITY_PREFERENCE: { outcome: 'invalid', status: 422 },
  INACTIVE_ACTIVITY_PREFERENCE: { outcome: 'invalid', status: 422 },
  PHOTO_UPLOAD_EXPIRED: { outcome: 'expired', status: 410 },
  PHOTO_REJECTED: { outcome: 'rejected', status: 422 },
  MEDIA_RATE_LIMITED: { outcome: 'rate_limited', status: 429 },
  MEDIA_UNAVAILABLE: { outcome: 'provider_error', status: 503 },
};

export async function observed<T>(telemetry: ProfileTelemetryPort, name: ProfileEventName, operation: () => Promise<T>, extra: { provider?: 'cloudinary' | 'fake'; successStatus?: number } = {}): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await operation();
    const { successStatus = 200, ...eventExtra } = extra;
    telemetry.record({ name, outcome: 'success', status: successStatus, durationMs: Date.now() - startedAt, ...eventExtra });
    return result;
  } catch (error) {
    const mapped = error instanceof ProfileError ? ERROR_EVENT[error.code] : { outcome: 'failed' as const, status: 500 };
    const eventName = error instanceof ProfileError && error.code === 'PROFILE_REVISION_CONFLICT'
      ? 'profile.conflict'
      : error instanceof ProfileError && error.code === 'PHOTO_REJECTED'
        ? 'profile.photo.reject'
        : name;
    const { successStatus, ...eventExtra } = extra;
    void successStatus;
    telemetry.record({ name: eventName, ...mapped, durationMs: Date.now() - startedAt, ...eventExtra });
    throw error;
  }
}
