import { getBffEnv } from '@/shared/config/bff-env.server';
import { expiredSessionCookie, readSessionCookie } from '@/shared/server/authentication-cookie';
import { jsonResponse } from '@/shared/server/bff-proxy';
import { readOwnProfile } from '@/shared/server/profile-bff';
import { serializeInvitationCookie } from '@/shared/server/profile-invitation-cookie';
import { hasJsonContentType, hasTrustedOrigin } from '@/shared/server/same-origin';
import { logBffEvent } from '@/shared/server/bff-logger';

export async function POST(request: Request): Promise<Response> {
  const startedAt = performance.now();
  const correlationId = crypto.randomUUID();
  const env = getBffEnv();
  const envelope = (statusCode: number, cookies: string[] = []) => {
    logBffEvent({ scope: 'profile-bff', operation: 'profile.invite.dismiss', status: statusCode, durationMs: performance.now() - startedAt, correlationId });
    return jsonResponse({ data: {}, message: statusCode === 200 ? 'Invitation dismissed.' : 'Request failed.', statusCode }, cookies);
  };
  if (!env.PROFILE_UI_ENABLED) return envelope(404);
  if (!hasTrustedOrigin(request, env) || !hasJsonContentType(request)) return envelope(403);
  const session = readSessionCookie(request.headers.get('cookie'), env);
  if (!session) return envelope(401, [expiredSessionCookie(env)]);
  const profile = await readOwnProfile(session, { env });
  if (profile.kind === 'ok') return envelope(200, [serializeInvitationCookie(profile.value.invitationSubject, env)]);
  if (profile.kind === 401) return envelope(401, [expiredSessionCookie(env)]);
  return envelope(profile.kind === 403 ? 403 : 503);
}
