/**
 * Canonical account states recognized by the schema (ADR-036). Registration still produces only
 * the first three; the others exist so authorization can deny them explicitly.
 */
export const ACCOUNT_STATUSES = [
  'account_incomplete',
  'active',
  'expired',
  'age_verification',
  'recovery_restricted',
  'deactivation_pending',
  'deactivated',
  'deletion_pending',
  'deleted',
  'suspended',
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Capabilities a common session may request; anything else is denied by default (ADR-036). */
export const ACCOUNT_CAPABILITIES = ['authenticated_home', 'logout', 'profile_read', 'profile_write', 'events_write'] as const;

export type AccountCapability = (typeof ACCOUNT_CAPABILITIES)[number];

export type AccessDecision = 'allow' | 'deny';

export function isAccountStatus(value: string): value is AccountStatus {
  return (ACCOUNT_STATUSES as readonly string[]).includes(value);
}

/** Only `active` accounts may hold a common session; every other state is unusable (ADR-036). */
export function canHoldCommonSession(status: AccountStatus): boolean {
  return status === 'active';
}
