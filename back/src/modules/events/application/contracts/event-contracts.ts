import type { EventAdmissionMode, EventVenueType, ExactLocation, ApproximateEventArea } from '../../domain/value-objects/event-location';
import type { EventStatus } from '../../domain/entities/event';

export type EventDraftInput = Readonly<{
  revision?: number;
  activityTypeCode?: string;
  title?: string;
  description?: string;
  startsAtLocal?: string;
  endsAtLocal?: string | null;
  ufCode?: string;
  municipalityCode?: string;
  venueType?: EventVenueType;
  nonResidentialHostDeclaration?: boolean;
  exactLocation?: ExactLocation | null;
  capacity?: number;
  admissionMode?: EventAdmissionMode;
}>;

export type EventOwnerDraft = Readonly<{
  id: string;
  revision: number;
  status: EventStatus;
  activityType: Readonly<{ code: string; label: string }> | null;
  title: string | null;
  description: string | null;
  startsAtLocal: string | null;
  endsAtLocal: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string | null;
  location: Readonly<{ ufCode: string; municipalityCode: string; municipalityName: string }> | null;
  venueType: EventVenueType | null;
  nonResidentialHostDeclaration: boolean | null;
  exactLocation: ExactLocation | null;
  capacity: number | null;
  admissionMode: EventAdmissionMode;
  official: false;
}>;

export type PublicEventPreview = Readonly<{
  id: string;
  activityType: Readonly<{ code: string; label: string }>;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  timeZone: string;
  location: Readonly<{ ufCode: string; municipalityCode: string; municipalityName: string; approximateArea: ApproximateEventArea }>;
  capacity: number;
  admissionMode: EventAdmissionMode;
  status: 'draft' | 'published_open';
}>;
