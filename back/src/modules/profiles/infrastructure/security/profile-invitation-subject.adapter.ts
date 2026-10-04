import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import type { ProfileInvitationSubjectPort } from '../../domain/ports/outbound/profile-security.port';

@Injectable()
export class ProfileInvitationSubjectAdapter implements ProfileInvitationSubjectPort {
  private readonly key: Buffer;
  constructor(config: ConfigService<BackendEnv, true>) {
    const encoded = config.get<string | undefined>('PROFILE_INVITATION_KEY');
    this.key = encoded ? Buffer.from(encoded, 'base64') : Buffer.alloc(32);
  }
  digest(accountId: string): string {
    return `v1.${createHmac('sha256', this.key).update(`profile-invite:${accountId}`).digest('base64url')}`;
  }
}
