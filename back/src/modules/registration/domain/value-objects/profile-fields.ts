import { RegistrationError } from '../errors/registration.error';

export class DisplayName {
  private constructor(readonly value: string) {}

  static create(value: string): DisplayName {
    const normalized = value.trim();
    if (normalized.length < 1 || normalized.length > 60) {
      throw new RegistrationError('INVALID_DISPLAY_NAME');
    }
    return new DisplayName(normalized);
  }
}

export class Region {
  private constructor(readonly value: string) {}

  static create(value: string): Region {
    const normalized = value.trim();
    if (normalized.length < 2 || normalized.length > 80) {
      throw new RegistrationError('INVALID_REGION');
    }
    return new Region(normalized);
  }
}

export const USAGE_INTENTS = ['friendship', 'activity_company', 'explore_city', 'networking'] as const;
export type UsageIntentValue = (typeof USAGE_INTENTS)[number];

export class UsageIntent {
  private constructor(readonly value: UsageIntentValue) {}

  static create(value: string): UsageIntent {
    if (!(USAGE_INTENTS as readonly string[]).includes(value)) {
      throw new RegistrationError('INVALID_USAGE_INTENTS');
    }
    return new UsageIntent(value as UsageIntentValue);
  }

  /** RF004: multiple choice, at least one, duplicates collapsed. */
  static createSelection(values: readonly string[]): UsageIntent[] {
    const unique = [...new Set(values)];
    if (unique.length === 0) throw new RegistrationError('INVALID_USAGE_INTENTS');
    return unique.map((value) => UsageIntent.create(value));
  }
}
