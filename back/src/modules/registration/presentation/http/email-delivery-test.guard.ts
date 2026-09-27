import { type CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { BackendEnv } from '../../../../shared/infrastructure/config/env';

/** Keeps the temporary smoke route unavailable in production and when it would only hit noop. */
@Injectable()
export class EmailDeliveryTestGuard implements CanActivate {
  constructor(private readonly config: ConfigService<BackendEnv, true>) {}

  canActivate(): boolean {
    const isProduction = this.config.getOrThrow<string>('NODE_ENV') === 'production';
    const usesBrevo = this.config.getOrThrow<string>('VERIFICATION_DELIVERY_MODE') === 'brevo';
    if (isProduction || !usesBrevo) throw new NotFoundException();
    return true;
  }
}
