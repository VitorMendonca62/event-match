import { Injectable } from '@nestjs/common';

import type { AccountAccessPolicyPort } from '../../domain/ports/outbound/account-access-policy.port';
import {
  ACCOUNT_CAPABILITIES,
  type AccessDecision,
  type AccountCapability,
  type AccountStatus,
  canHoldCommonSession,
} from '../../domain/value-objects/account-access';

/**
 * MVP capability gate (ADR-036): no restriction store exists yet, so an `active` account holds
 * exactly the published capabilities and everything else is denied. A future restriction adapter
 * replaces this binding without touching the use cases.
 */
@Injectable()
export class DefaultAccountAccessPolicyAdapter implements AccountAccessPolicyPort {
  decide(_accountId: string, status: AccountStatus, capability: AccountCapability): Promise<AccessDecision> {
    const allowed = canHoldCommonSession(status) && (ACCOUNT_CAPABILITIES as readonly string[]).includes(capability);
    return Promise.resolve(allowed ? 'allow' : 'deny');
  }
}
