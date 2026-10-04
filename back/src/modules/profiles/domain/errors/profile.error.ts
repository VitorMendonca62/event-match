export type ProfileErrorCode =
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_REVISION_CONFLICT'
  | 'INVALID_PROFILE_CONTENT'
  | 'INACTIVE_INTEREST'
  | 'PHOTO_UPLOAD_EXPIRED'
  | 'PHOTO_REJECTED'
  | 'MEDIA_RATE_LIMITED'
  | 'MEDIA_UNAVAILABLE';

export class ProfileError extends Error {
  constructor(readonly code: ProfileErrorCode) {
    super(code);
    this.name = 'ProfileError';
  }
}
