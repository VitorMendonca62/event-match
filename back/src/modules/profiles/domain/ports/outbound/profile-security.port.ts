export const PROFILE_INVITATION_SUBJECT_PORT = Symbol('PROFILE_INVITATION_SUBJECT_PORT');
export interface ProfileInvitationSubjectPort { digest(accountId: string): string; }
export const PROFILE_MEDIA_SUBJECT_PORT = Symbol('PROFILE_MEDIA_SUBJECT_PORT');
export interface ProfileMediaSubjectPort { digest(scope: 'account' | 'origin', value: string): Buffer; }
