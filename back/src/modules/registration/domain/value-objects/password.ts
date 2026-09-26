export class Password {
  private constructor(readonly value: string) {}

  static create(value: string): Password {
    if (value.length < 8 || value.trim().length === 0) throw new Error('Invalid password.');
    return new Password(value);
  }
}
