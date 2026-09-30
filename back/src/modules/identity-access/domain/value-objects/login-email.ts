const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * E-mail presented at login, normalized exactly like the registration contact (ADR-014: trim and
 * lowercase) so both contexts derive the same blind index. A value that cannot be normalized is
 * `null`: the use case treats it as an unknown contact, never as a distinct error.
 */
export class LoginEmail {
  private constructor(readonly value: string) {}

  static normalize(raw: string): LoginEmail | null {
    const value = raw.trim().toLowerCase();
    return EMAIL_PATTERN.test(value) ? new LoginEmail(value) : null;
  }
}
