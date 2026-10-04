import type { BffEnv } from '@/shared/config/bff-env.server';

const SEVEN_DAYS = 604_800;
export const profileInvitationCookieName = (env: Pick<BffEnv, 'NODE_ENV'>) => env.NODE_ENV === 'production' ? '__Host-eventmatch_profile_invite' : 'eventmatch_profile_invite';
export function invitationDismissed(value: string | undefined, subject: string, now = new Date()): boolean {
  if (!value) return false;
  const match = /^(v1\.[A-Za-z0-9_-]{43})\.(\d{10,13})$/u.exec(value);
  if (!match || match[1] !== subject) return false;
  const until = Number(match[2]);
  return Number.isSafeInteger(until) && until > now.getTime() && until <= now.getTime() + SEVEN_DAYS * 1000;
}
export function serializeInvitationCookie(subject: string, env: Pick<BffEnv, 'NODE_ENV'>, now = new Date()): string {
  const until = now.getTime() + SEVEN_DAYS * 1000;
  return `${profileInvitationCookieName(env)}=${subject}.${until}; Path=/; Max-Age=${SEVEN_DAYS}; HttpOnly; SameSite=Lax${env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
