import { readFileSync } from 'node:fs';
import { Injectable } from '@nestjs/common';
import type { CommonPasswordCheckerPort } from '../../domain/ports/outbound/security.ports';
import type { Password } from '../../domain/value-objects/password';

@Injectable()
export class CommonPasswordCheckerAdapter implements CommonPasswordCheckerPort {
  private readonly passwords = new Set(
    readFileSync(`${__dirname}/data/common-passwords.txt`, 'utf8').split(/\r?\n/).map((line) => line.trim().toLowerCase()).filter((line) => line.length > 0 && !line.startsWith('#')),
  );
  isCommon(password: Password): boolean { return this.passwords.has(password.value.toLowerCase()); }
}
