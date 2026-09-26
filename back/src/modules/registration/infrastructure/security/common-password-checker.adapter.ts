import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';

import type { CommonPasswordCheckerPort } from '../../domain/ports/outbound/security.ports';
import type { Password } from '../../domain/value-objects/password';

/** Copied next to the compiled adapter by `build:assets` (ADR-018). */
export const COMMON_PASSWORDS_FILE = join(__dirname, 'data', 'common-passwords.txt');

export function parseCommonPasswords(content: string): ReadonlySet<string> {
  return new Set(
    content
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length > 0),
  );
}

/** Loads the versioned list once at startup and compares case-insensitively (ADR-014). */
@Injectable()
export class CommonPasswordCheckerAdapter implements CommonPasswordCheckerPort {
  private readonly passwords = parseCommonPasswords(readFileSync(COMMON_PASSWORDS_FILE, 'utf8'));

  isCommon(password: Password): boolean {
    return this.passwords.has(password.value.toLowerCase());
  }
}
