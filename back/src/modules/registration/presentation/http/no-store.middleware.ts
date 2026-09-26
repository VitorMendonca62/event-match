import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** Every registration response, success or error, is private and never cached (ADR-020). */
@Injectable()
export class NoStoreMiddleware implements NestMiddleware {
  use(_: Request, response: Response, next: NextFunction): void {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    next();
  }
}
