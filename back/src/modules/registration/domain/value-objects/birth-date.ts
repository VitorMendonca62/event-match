import { RegistrationError } from '../errors/registration.error';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ADULT_AGE = 18;

/** Calendar date (YYYY-MM-DD) compared in UTC; rejects dates that do not exist. */
export class BirthDate {
  private constructor(readonly value: string) {}

  static create(value: string): BirthDate {
    const match = ISO_DATE_PATTERN.exec(value);
    if (!match) throw new RegistrationError('INVALID_BIRTH_DATE');

    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(Date.UTC(year, month - 1, day));
    const exists =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
    if (!exists) throw new RegistrationError('INVALID_BIRTH_DATE');

    return new BirthDate(value);
  }

  isAdultAt(now: Date): boolean {
    const birth = new Date(`${this.value}T00:00:00.000Z`);
    const cutoff = new Date(
      Date.UTC(now.getUTCFullYear() - ADULT_AGE, now.getUTCMonth(), now.getUTCDate()),
    );
    return birth <= cutoff;
  }
}
