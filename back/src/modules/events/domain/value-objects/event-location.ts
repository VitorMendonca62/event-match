export const EVENT_VENUE_TYPES = ['public_place', 'identifiable_establishment'] as const;
export type EventVenueType = (typeof EVENT_VENUE_TYPES)[number];

export const EVENT_ADMISSION_MODES = ['manual_approval', 'automatic_entry'] as const;
export type EventAdmissionMode = (typeof EVENT_ADMISSION_MODES)[number];

export type EventLocation = Readonly<{
  ufCode: string;
  municipalityCode: string;
  municipalityName: string;
  timeZone: string;
}>;

export type ExactLocation = Readonly<{ latitude: number; longitude: number }>;
export type ApproximateEventArea = Readonly<ExactLocation & { radiusMeters: number }>;

export function isExactLocation(value: ExactLocation): boolean {
  return Number.isFinite(value.latitude) && value.latitude >= -90 && value.latitude <= 90 &&
    Number.isFinite(value.longitude) && value.longitude >= -180 && value.longitude <= 180;
}
