import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { readContinuation } from './registration-headers';

/**
 * Rejects a missing or malformed continuation with 401 before body validation or any use case
 * runs; the use case then resolves and locks the session by the token digest (ADR-021).
 */
@Injectable()
export class ContinuationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    readContinuation(context.switchToHttp().getRequest<Request>());
    return true;
  }
}
