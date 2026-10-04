import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ResolveAuthenticatedSession } from '../../../identity-access/application/use-cases/resolve-authenticated-session.use-case';
import { bffInternalGuardFor } from '../../../../shared/presentation/http/bff-internal.guard';

@Injectable()
export class ProfileBffGuard extends bffInternalGuardFor('PROFILE_HTTP_ENABLED') {}
@Injectable()
export class ProfileMediaGuard extends bffInternalGuardFor('PROFILE_MEDIA_ENABLED') {}

export type ProfileRequest = Request & { profilePrincipal?: { accountId: string } };

abstract class ProfileCapabilityGuard implements CanActivate {
  protected constructor(
    private readonly sessions: ResolveAuthenticatedSession,
    private readonly capability: 'profile_read' | 'profile_write',
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ProfileRequest>();
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/u.exec(request.header('authorization') ?? '');
    if (!match?.[1]) throw new UnauthorizedException();
    const resolved = await this.sessions.execute({ token: match[1], capability: this.capability, allowRotation: false });
    request.profilePrincipal = { accountId: resolved.accountId };
    return true;
  }
}

@Injectable()
export class ProfileReadGuard extends ProfileCapabilityGuard {
  constructor(sessions: ResolveAuthenticatedSession) { super(sessions, 'profile_read'); }
}

@Injectable()
export class ProfileWriteGuard extends ProfileCapabilityGuard {
  constructor(sessions: ResolveAuthenticatedSession) { super(sessions, 'profile_write'); }
}
