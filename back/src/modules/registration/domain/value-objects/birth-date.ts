export class BirthDate {
  private constructor(readonly value: string) {}
  static create(value: string): BirthDate {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) throw new Error('Invalid birth date.');
    return new BirthDate(value);
  }
  isAdultAt(now: Date): boolean {
    const birth = new Date(`${this.value}T00:00:00.000Z`);
    const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
    return birth <= cutoff;
  }
}
