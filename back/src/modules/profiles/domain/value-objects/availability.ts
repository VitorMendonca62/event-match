export const AVAILABILITY_WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type AvailabilityWeekday = (typeof AVAILABILITY_WEEKDAYS)[number];

export const AVAILABILITY_PERIODS = ['early_hours', 'morning', 'afternoon', 'evening'] as const;
export type AvailabilityPeriod = (typeof AVAILABILITY_PERIODS)[number];

export type AvailabilitySlot = `${AvailabilityWeekday}_${AvailabilityPeriod}`;

export const AVAILABILITY_SLOTS: readonly AvailabilitySlot[] = AVAILABILITY_WEEKDAYS.flatMap((weekday) =>
  AVAILABILITY_PERIODS.map((period) => `${weekday}_${period}` as AvailabilitySlot),
);

export const PREFERRED_DISTANCES = ['up_to_2km', 'up_to_5km', 'up_to_10km', 'up_to_25km', 'same_city'] as const;
export type PreferredDistance = (typeof PREFERRED_DISTANCES)[number];

const AVAILABILITY_ORDER = new Map(AVAILABILITY_SLOTS.map((slot, index) => [slot, index]));

export function toCanonicalOrder(slots: readonly AvailabilitySlot[]): AvailabilitySlot[] {
  return [...slots].sort((left, right) => (AVAILABILITY_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) - (AVAILABILITY_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER));
}
