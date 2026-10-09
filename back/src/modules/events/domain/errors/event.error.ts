export type EventErrorCode =
  | 'EVENT_NOT_FOUND'
  | 'EVENT_REVISION_CONFLICT'
  | 'EVENT_NOT_READY'
  | 'INVALID_EVENT_CONTENT'
  | 'INVALID_LOCATION'
  | 'INVALID_DATE_TIME'
  | 'INACTIVE_ACTIVITY_TYPE'
  | 'HOST_NOT_ELIGIBLE'
  | 'EVENT_LIMIT_REACHED'
  | 'RESIDENTIAL_VENUE_FORBIDDEN'
  | 'LOCATION_PROTECTION_UNAVAILABLE';

export type EventErrorReason =
  | 'event_not_ready'
  | 'invalid_event_content'
  | 'invalid_location'
  | 'invalid_date_time'
  | 'inactive_activity_type'
  | 'event_limit_reached'
  | 'residential_venue_forbidden';

export class EventError extends Error {
  constructor(readonly code: EventErrorCode, readonly reason?: EventErrorReason) {
    super(code);
    this.name = 'EventError';
  }
}
