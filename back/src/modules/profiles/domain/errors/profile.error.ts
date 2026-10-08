export type ProfileErrorCode =
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_REVISION_CONFLICT'
  | 'INVALID_PROFILE_CONTENT'
  | 'INVALID_LOCATION'
  | 'INACTIVE_INTEREST'
  | 'UNKNOWN_LANGUAGE'
  | 'INACTIVE_LANGUAGE'
  | 'UNKNOWN_ACTIVITY_PREFERENCE'
  | 'INACTIVE_ACTIVITY_PREFERENCE'
  | 'PHOTO_UPLOAD_EXPIRED'
  | 'PHOTO_REJECTED'
  | 'MEDIA_RATE_LIMITED'
  | 'MEDIA_UNAVAILABLE';

export type ProfileErrorReason =
  | 'invalid_location'
  | 'unknown_language'
  | 'inactive_language'
  | 'unknown_activity_preference'
  | 'inactive_activity_preference';

export class ProfileError extends Error {
  constructor(readonly code: ProfileErrorCode, readonly reason?: ProfileErrorReason) {
    super(code);
    this.name = 'ProfileError';
  }
}
