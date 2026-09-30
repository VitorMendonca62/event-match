import type { AccessDecision, AccountCapability, AccountStatus } from '../../value-objects/account-access';

export const ACCOUNT_ACCESS_POLICY_PORT = Symbol('ACCOUNT_ACCESS_POLICY_PORT');

/**
 * Live capability gate (ADR-036): consulted on every login and session resolution with the
 * current account state. Implementations deny anything they do not explicitly allow.
 */
export interface AccountAccessPolicyPort {
  decide(accountId: string, status: AccountStatus, capability: AccountCapability): Promise<AccessDecision>;
}
