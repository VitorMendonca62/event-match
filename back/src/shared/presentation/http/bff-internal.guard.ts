import { timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
  type Type,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { BackendEnv } from '../../infrastructure/config/env';
import { BFF_TOKEN_HEADER } from './bff-headers';

export type BffRolloutFlag = 'REGISTRATION_HTTP_ENABLED' | 'AUTH_HTTP_ENABLED' | 'PROFILE_HTTP_ENABLED' | 'PROFILE_MEDIA_ENABLED' | 'EVENTS_HTTP_ENABLED';

/**
 * Internal routes accept only the Next.js BFF (ADR-022, ADR-023, ADR-034): the shared internal
 * token is compared in constant time before any use case runs. While the context's rollout flag is
 * off its routes answer 404, as if they did not exist. One implementation serves every context.
 */
export function bffInternalGuardFor(flag: BffRolloutFlag): Type<CanActivate> {
  @Injectable()
  class BffInternalGuard implements CanActivate {
    private readonly enabled: boolean;
    private readonly expected: Buffer;

    constructor(config: ConfigService<BackendEnv, true>) {
      this.enabled = config.getOrThrow<boolean>(flag);
      this.expected = Buffer.from(config.getOrThrow<string>('BFF_INTERNAL_TOKEN'), 'utf8');
    }

    canActivate(context: ExecutionContext): boolean {
      if (!this.enabled) throw new NotFoundException();
      const presented = context.switchToHttp().getRequest<Request>().headers[BFF_TOKEN_HEADER];
      const actual = Buffer.from(typeof presented === 'string' ? presented : '', 'utf8');
      // Compare equal-length buffers so the length check does not short-circuit on content.
      const same = actual.length === this.expected.length && timingSafeEqual(actual, this.expected);
      if (!same) throw new UnauthorizedException();
      return true;
    }
  }
  return BffInternalGuard;
}
