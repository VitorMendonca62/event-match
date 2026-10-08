import 'server-only';

import { cookies } from 'next/headers';
import { getBffEnv } from '@/shared/config/bff-env.server';
import { isSessionToken, sessionCookieName } from './authentication-cookie';
import { readOwnProfile } from './profile-bff';

export async function currentProfileView() {
  const store = await cookies();
  const env = getBffEnv();
  if (!env.PROFILE_UI_ENABLED) return { kind: 'disabled' as const };
  const value = store.get(sessionCookieName(env))?.value;
  if (!isSessionToken(value)) return { kind: 'anonymous' as const };
  return readOwnProfile(value, { env });
}
