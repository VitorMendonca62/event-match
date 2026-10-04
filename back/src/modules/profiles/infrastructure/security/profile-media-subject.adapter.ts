import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import type { ProfileMediaSubjectPort } from '../../domain/ports/outbound/profile-security.port';

@Injectable()
export class ProfileMediaSubjectAdapter implements ProfileMediaSubjectPort {
  private readonly key: Buffer;
  constructor(config: ConfigService<BackendEnv, true>) { const value = config.get<string>('PROFILE_MEDIA_KEY'); this.key = value ? Buffer.from(value, 'base64') : Buffer.alloc(32); }
  digest(scope: 'account' | 'origin', value: string): Buffer { return createHmac('sha256', this.key).update(`profile-media:${scope}:${value}`).digest(); }
}
