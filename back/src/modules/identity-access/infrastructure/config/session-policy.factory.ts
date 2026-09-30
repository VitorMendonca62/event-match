import type { ConfigService } from '@nestjs/config';

import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import type { SessionPolicy } from '../../domain/services/session-policy';

const SECOND = 1000;

/** Builds the domain policy from the already validated environment (relations checked in env.ts). */
export function sessionPolicyFromConfig(config: ConfigService<BackendEnv, true>): SessionPolicy {
  const seconds = (name: keyof BackendEnv) => config.getOrThrow<number>(name) * SECOND;
  return Object.freeze({
    browser: {
      absoluteTtlMs: seconds('AUTH_SESSION_ABSOLUTE_TTL_SECONDS'),
      idleTtlMs: seconds('AUTH_SESSION_IDLE_TTL_SECONDS'),
    },
    remembered: {
      absoluteTtlMs: seconds('AUTH_REMEMBERED_ABSOLUTE_TTL_SECONDS'),
      idleTtlMs: seconds('AUTH_REMEMBERED_IDLE_TTL_SECONDS'),
    },
    activityWriteIntervalMs: seconds('AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS'),
    renewalIntervalMs: seconds('AUTH_SESSION_RENEWAL_INTERVAL_SECONDS'),
    previousTokenGraceMs: seconds('AUTH_SESSION_PREVIOUS_TOKEN_GRACE_SECONDS'),
    maxSessionsPerAccount: config.getOrThrow<number>('AUTH_MAX_SESSIONS_PER_ACCOUNT'),
    login: {
      windowMs: seconds('AUTH_LOGIN_WINDOW_SECONDS'),
      contactLimit: config.getOrThrow<number>('AUTH_LOGIN_CONTACT_LIMIT'),
      originLimit: config.getOrThrow<number>('AUTH_LOGIN_ORIGIN_LIMIT'),
    },
  });
}
