import { describe, expect, test } from 'bun:test';

import { Event } from '../../../src/modules/events/domain/entities/event';
import { EventError } from '../../../src/modules/events/domain/errors/event.error';
import { resolveLocalDateTime } from '../../../src/modules/events/domain/value-objects/local-date-time';

const LOCATION = { ufCode: 'PE', municipalityCode: '2611606', municipalityName: 'Recife', timeZone: 'America/Recife' } as const;
const AREA = { latitude: -8.045, longitude: -34.875, radiusMeters: 500 } as const;

function draft() {
  const event = Event.create('event-1', 'account-1', new Date('2026-10-08T12:00:00.000Z'));
  return event.updateDraft({
    activityTypeCode: 'caminhada', title: 'Caminhada', description: 'Uma caminhada informal.',
    startsAtLocal: '2026-10-10T10:00', startsAt: new Date('2026-10-10T13:00:00.000Z'),
    endsAtLocal: '2026-10-10T12:00', endsAt: new Date('2026-10-10T15:00:00.000Z'), location: LOCATION,
    venueType: 'public_place', nonResidentialHostDeclaration: true, capacity: 8, admissionMode: 'manual_approval',
  }, new Date('2026-10-08T12:00:00.000Z'));
}

describe('Event aggregate (ADR-054, ADR-055, ADR-060, ADR-061)', () => {
  test('allows an incomplete draft but requires all approved fields to publish', () => {
    const event = Event.create('event-1', 'account-1');
    expect(event.snapshot()).toMatchObject({ status: 'draft', revision: 1, official: false, admissionMode: 'manual_approval' });
    expect(() => event.publish(new Date(), AREA)).toThrow(new EventError('EVENT_NOT_READY', 'event_not_ready'));
  });

  test('rejects a residential declaration, contact content and capacity above the MVP ceiling', () => {
    expect(() => Event.create('event-1', 'account-1').updateDraft({ description: 'Fale comigo em ana@example.test' })).toThrow('INVALID_EVENT_CONTENT');
    expect(() => Event.create('event-1', 'account-1').updateDraft({ nonResidentialHostDeclaration: false })).toThrow('RESIDENTIAL_VENUE_FORBIDDEN');
    expect(() => Event.create('event-1', 'account-1').updateDraft({ capacity: 13 })).toThrow('INVALID_EVENT_CONTENT');
  });

  test('publishes only inside the 24-hour to 30-day window and keeps official immutable', () => {
    const published = draft().publish(new Date('2026-10-08T12:00:00.000Z'), AREA).snapshot();
    expect(published).toMatchObject({ status: 'published_open', official: false, approximateArea: AREA });
    expect(published.revision).toBe(3);
    expect(() => draft().publish(new Date('2026-10-09T14:00:00.000Z'), AREA)).toThrow('INVALID_DATE_TIME');
  });

  test('resolves a municipality local time to one normalized instant', () => {
    expect(resolveLocalDateTime('2026-10-10T10:00', 'America/Recife').toISOString()).toBe('2026-10-10T13:00:00.000Z');
  });
});
