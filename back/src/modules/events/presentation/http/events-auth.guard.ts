import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { ResolveAuthenticatedSession } from '../../../identity-access/application/use-cases/resolve-authenticated-session.use-case';
import { bffInternalGuardFor } from '../../../../shared/presentation/http/bff-internal.guard';

@Injectable()
export class EventsBffGuard extends bffInternalGuardFor('EVENTS_HTTP_ENABLED') {}

export type EventsRequest = Request & { eventsPrincipal?: { accountId: string } };

@Injectable()
export class EventsCapabilityGuard implements CanActivate {
  constructor(private readonly sessions: ResolveAuthenticatedSession) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<EventsRequest>();
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/u.exec(request.header('authorization') ?? '');
    if (!match?.[1]) throw new UnauthorizedException();
    const resolved = await this.sessions.execute({ token: match[1], capability: 'events_write', allowRotation: false });
    request.eventsPrincipal = { accountId: resolved.accountId };
    return true;
  }
}
