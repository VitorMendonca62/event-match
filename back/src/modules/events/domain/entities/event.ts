import { EventError } from '../errors/event.error';
import { normalizeLocalDateTime } from '../value-objects/local-date-time';
import { EVENT_ADMISSION_MODES, EVENT_VENUE_TYPES, isExactLocation, type ApproximateEventArea, type EventAdmissionMode, type EventLocation, type EventVenueType } from '../value-objects/event-location';

export const EVENT_STATUSES = ['draft', 'published_open', 'full', 'cancelled', 'completed', 'not_held'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export type EventState = Readonly<{
  id: string;
  hostAccountId: string;
  status: EventStatus;
  revision: number;
  activityTypeCode: string | null;
  title: string | null;
  description: string | null;
  startsAtLocal: string | null;
  endsAtLocal: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  location: EventLocation | null;
  venueType: EventVenueType | null;
  nonResidentialHostDeclaration: boolean | null;
  capacity: number | null;
  admissionMode: EventAdmissionMode;
  approximateArea: ApproximateEventArea | null;
  official: false;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type EventDraftPatch = Readonly<{
  activityTypeCode?: string | null;
  title?: string | null;
  description?: string | null;
  startsAtLocal?: string | null;
  endsAtLocal?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  location?: EventLocation | null;
  venueType?: EventVenueType | null;
  nonResidentialHostDeclaration?: boolean | null;
  capacity?: number | null;
  admissionMode?: EventAdmissionMode;
  approximateArea?: ApproximateEventArea | null;
}>;

const CONTACT_PATTERN = /(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4})/iu;

function normalizeText(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (normalized.length === 0) return null;
  if ([...normalized].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || CONTACT_PATTERN.test(normalized)) {
    throw new EventError('INVALID_EVENT_CONTENT', 'invalid_event_content');
  }
  return normalized;
}

function cloneDate(value: Date | null): Date | null { return value ? new Date(value) : null; }

function validateDraft(state: EventState): void {
  if (state.activityTypeCode !== null && !/^[a-z][a-z0-9_]{1,59}$/u.test(state.activityTypeCode)) throw new EventError('INVALID_EVENT_CONTENT', 'invalid_event_content');
  if (state.startsAtLocal && !state.location) throw new EventError('INVALID_LOCATION', 'invalid_location');
  if (state.endsAtLocal && !state.startsAtLocal) throw new EventError('INVALID_DATE_TIME', 'invalid_date_time');
  if (state.location && (!state.location.ufCode || !state.location.municipalityCode || !state.location.timeZone)) throw new EventError('INVALID_LOCATION', 'invalid_location');
  if (state.venueType !== null && !EVENT_VENUE_TYPES.includes(state.venueType)) throw new EventError('INVALID_EVENT_CONTENT', 'invalid_event_content');
  if (state.nonResidentialHostDeclaration === false) throw new EventError('RESIDENTIAL_VENUE_FORBIDDEN', 'residential_venue_forbidden');
  if (state.capacity !== null && (!Number.isInteger(state.capacity) || state.capacity < 1 || state.capacity > 12)) throw new EventError('INVALID_EVENT_CONTENT', 'invalid_event_content');
  if (!EVENT_ADMISSION_MODES.includes(state.admissionMode)) throw new EventError('INVALID_EVENT_CONTENT', 'invalid_event_content');
  if (state.approximateArea && (!isExactLocation(state.approximateArea) || !Number.isInteger(state.approximateArea.radiusMeters) || state.approximateArea.radiusMeters < 200 || state.approximateArea.radiusMeters > 5000)) throw new EventError('INVALID_LOCATION', 'invalid_location');
}

export class Event {
  private constructor(private readonly state: EventState) {}

  static create(id: string, hostAccountId: string, now = new Date()): Event {
    return new Event({
      id, hostAccountId, status: 'draft', revision: 1, activityTypeCode: null, title: null, description: null,
      startsAtLocal: null, endsAtLocal: null, startsAt: null, endsAt: null, location: null, venueType: null,
      nonResidentialHostDeclaration: null, capacity: null, admissionMode: 'manual_approval', approximateArea: null,
      official: false, publishedAt: null, createdAt: new Date(now), updatedAt: new Date(now),
    });
  }

  static restore(state: EventState): Event {
    if (!Number.isInteger(state.revision) || state.revision < 1 || state.official !== false) throw new EventError('INVALID_EVENT_CONTENT', 'invalid_event_content');
    validateDraft(state);
    return new Event({ ...state, startsAt: cloneDate(state.startsAt), endsAt: cloneDate(state.endsAt), publishedAt: cloneDate(state.publishedAt), createdAt: new Date(state.createdAt), updatedAt: new Date(state.updatedAt) });
  }

  updateDraft(patch: EventDraftPatch, now = new Date()): Event {
    if (this.state.status !== 'draft') throw new EventError('INVALID_EVENT_CONTENT', 'invalid_event_content');
    const next: EventState = {
      ...this.state,
      activityTypeCode: patch.activityTypeCode === undefined ? this.state.activityTypeCode : patch.activityTypeCode,
      title: patch.title === undefined ? this.state.title : normalizeText(patch.title),
      description: patch.description === undefined ? this.state.description : normalizeText(patch.description),
      startsAtLocal: patch.startsAtLocal === undefined ? this.state.startsAtLocal : patch.startsAtLocal === null ? null : normalizeLocalDateTime(patch.startsAtLocal),
      endsAtLocal: patch.endsAtLocal === undefined ? this.state.endsAtLocal : patch.endsAtLocal === null ? null : normalizeLocalDateTime(patch.endsAtLocal),
      startsAt: patch.startsAt === undefined ? this.state.startsAt : cloneDate(patch.startsAt),
      endsAt: patch.endsAt === undefined ? this.state.endsAt : cloneDate(patch.endsAt),
      location: patch.location === undefined ? this.state.location : patch.location,
      venueType: patch.venueType === undefined ? this.state.venueType : patch.venueType,
      nonResidentialHostDeclaration: patch.nonResidentialHostDeclaration === undefined ? this.state.nonResidentialHostDeclaration : patch.nonResidentialHostDeclaration,
      capacity: patch.capacity === undefined ? this.state.capacity : patch.capacity,
      admissionMode: patch.admissionMode ?? this.state.admissionMode,
      approximateArea: patch.approximateArea === undefined ? this.state.approximateArea : patch.approximateArea,
      revision: this.state.revision + 1,
      updatedAt: new Date(now),
    };
    validateDraft(next);
    return new Event(next);
  }

  publish(now: Date, approximateArea: ApproximateEventArea): Event {
    if (this.state.status !== 'draft') throw new EventError('INVALID_EVENT_CONTENT', 'invalid_event_content');
    this.validateForPublication(now);
    if (!isExactLocation(approximateArea) || approximateArea.radiusMeters < 200 || approximateArea.radiusMeters > 5000) throw new EventError('INVALID_LOCATION', 'invalid_location');
    return new Event({ ...this.state, status: 'published_open', revision: this.state.revision + 1, approximateArea, official: false, publishedAt: new Date(now), updatedAt: new Date(now) });
  }

  validateForPublication(now: Date): void {
    if (!this.state.activityTypeCode || !this.state.title || !this.state.description || !this.state.startsAt || !this.state.location || !this.state.venueType || this.state.nonResidentialHostDeclaration !== true || !this.state.capacity || !this.state.startsAtLocal || !this.state.location.timeZone) {
      throw new EventError('EVENT_NOT_READY', 'event_not_ready');
    }
    if (!this.state.startsAt || this.state.startsAt.getTime() < now.getTime() + 24 * 60 * 60_000 || this.state.startsAt.getTime() > now.getTime() + 30 * 24 * 60 * 60_000) throw new EventError('INVALID_DATE_TIME', 'invalid_date_time');
    if (this.state.endsAt && (this.state.endsAt.getTime() <= this.state.startsAt.getTime() || this.state.endsAt.getTime() - this.state.startsAt.getTime() > 8 * 60 * 60_000)) throw new EventError('INVALID_DATE_TIME', 'invalid_date_time');
  }

  snapshot(): EventState { return { ...this.state, startsAt: cloneDate(this.state.startsAt), endsAt: cloneDate(this.state.endsAt), publishedAt: cloneDate(this.state.publishedAt), createdAt: new Date(this.state.createdAt), updatedAt: new Date(this.state.updatedAt) }; }
}
