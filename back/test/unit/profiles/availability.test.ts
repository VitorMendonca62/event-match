import { describe, expect, test } from 'bun:test';
import { AVAILABILITY_SLOTS, PREFERRED_DISTANCES, toCanonicalOrder } from '../../../src/modules/profiles/domain/value-objects/availability';

describe('profile availability value objects (ADR-045)', () => {
  test('exposes the 28 slots in weekday and clock order', () => {
    expect(AVAILABILITY_SLOTS).toHaveLength(28);
    expect(AVAILABILITY_SLOTS.slice(0, 4)).toEqual(['mon_early_hours', 'mon_morning', 'mon_afternoon', 'mon_evening']);
    expect(AVAILABILITY_SLOTS).toContain('fri_early_hours');
    expect(toCanonicalOrder(['sun_evening', 'fri_early_hours', 'mon_morning'])).toEqual(['mon_morning', 'fri_early_hours', 'sun_evening']);
  });

  test('keeps the preferred distance scale closed', () => {
    expect(PREFERRED_DISTANCES).toEqual(['up_to_2km', 'up_to_5km', 'up_to_10km', 'up_to_25km', 'same_city']);
  });
});
