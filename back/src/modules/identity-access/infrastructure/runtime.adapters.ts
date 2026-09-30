import { Injectable } from '@nestjs/common';

import type { ClockPort, IdGeneratorPort } from '../domain/ports/outbound/runtime.ports';

@Injectable()
export class IdentitySystemClockAdapter implements ClockPort {
  now(): Date {
    return new Date();
  }
}

@Injectable()
export class IdentityUuidV7GeneratorAdapter implements IdGeneratorPort {
  next(): string {
    return Bun.randomUUIDv7();
  }
}
