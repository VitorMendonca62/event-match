import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import { resolveExecutor } from '../../../../shared/infrastructure/persistence/resolve-executor';
import { Event, type EventState } from '../../domain/entities/event';
import type { EventRepositoryPort, EventRecord } from '../../domain/ports/event-repository.port';
import { EXACT_LOCATION_PROTECTOR_PORT, type ExactLocationProtectorPort } from '../../domain/ports/exact-location-protector.port';
import type { ExactLocation } from '../../domain/value-objects/event-location';
import { event, eventExactLocation } from './schema/events.schema';

function localDateTimeToDb(value: string | null): string | null {
  if (!value) return null;
  return `${value.length === 16 ? `${value}:00` : value}`.replace('T', ' ');
}

function dbToLocalDateTime(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(' ', 'T');
  return normalized.length >= 19 && normalized.slice(16, 19) === ':00' ? normalized.slice(0, 16) : normalized.slice(0, 19);
}

@Injectable()
export class DrizzleEventRepositoryAdapter implements EventRepositoryPort {
  constructor(@Inject(EXACT_LOCATION_PROTECTOR_PORT) private readonly protector: ExactLocationProtectorPort) {}

  async findByIdForOwner(context: TransactionContext, eventId: string, hostAccountId: string): Promise<EventRecord | null> {
    const [row] = await resolveExecutor(context).select().from(event).leftJoin(eventExactLocation, eq(eventExactLocation.eventId, event.id)).where(and(eq(event.id, eventId), eq(event.hostAccountId, hostAccountId))).limit(1);
    return row ? this.map(row.event, row.event_exact_location) : null;
  }

  async findByIdForOwnerWithoutExact(context: TransactionContext, eventId: string, hostAccountId: string): Promise<EventRecord | null> {
    const [row] = await resolveExecutor(context).select().from(event).where(and(eq(event.id, eventId), eq(event.hostAccountId, hostAccountId))).limit(1);
    return row ? this.map(row, null) : null;
  }

  async findByIdPublic(context: TransactionContext, eventId: string): Promise<EventRecord | null> {
    const [row] = await resolveExecutor(context).select().from(event).where(eq(event.id, eventId)).limit(1);
    return row ? this.map(row, null) : null;
  }

  async insert(context: TransactionContext, aggregate: Event, exactLocation: ExactLocation | null): Promise<void> {
    const database = resolveExecutor(context);
    const value = aggregate.snapshot();
    await database.insert(event).values(this.toRow(value));
    if (exactLocation) await database.insert(eventExactLocation).values(this.toExactRow(value.id, exactLocation));
  }

  async saveIfRevision(context: TransactionContext, aggregate: Event, expectedRevision: number, exactLocation: ExactLocation | null): Promise<'updated' | 'conflict'> {
    const database = resolveExecutor(context);
    const value = aggregate.snapshot();
    const changed = await database.update(event).set(this.toRow(value)).where(and(eq(event.id, value.id), eq(event.revision, expectedRevision))).returning({ id: event.id });
    if (changed.length === 0) return 'conflict';
    await database.delete(eventExactLocation).where(eq(eventExactLocation.eventId, value.id));
    if (exactLocation) await database.insert(eventExactLocation).values(this.toExactRow(value.id, exactLocation));
    return 'updated';
  }

  private toRow(value: ReturnType<Event['snapshot']>) {
    return {
      id: value.id, hostAccountId: value.hostAccountId, status: value.status, activityTypeCode: value.activityTypeCode,
      title: value.title, description: value.description, startsAtLocal: localDateTimeToDb(value.startsAtLocal), endsAtLocal: localDateTimeToDb(value.endsAtLocal),
      startsAt: value.startsAt, endsAt: value.endsAt, ufCode: value.location?.ufCode ?? null, municipalityCode: value.location?.municipalityCode ?? null,
      municipalityName: value.location?.municipalityName ?? null, timeZone: value.location?.timeZone ?? null, venueType: value.venueType,
      nonResidentialHostDeclaration: value.nonResidentialHostDeclaration, capacity: value.capacity, admissionMode: value.admissionMode,
      approximateLatitude: value.approximateArea?.latitude ?? null, approximateLongitude: value.approximateArea?.longitude ?? null,
      approximateRadiusMeters: value.approximateArea?.radiusMeters ?? null, official: false, revision: value.revision,
      publishedAt: value.publishedAt, updatedAt: value.updatedAt,
    };
  }

  private toExactRow(eventId: string, value: ExactLocation) {
    const protectedValue = this.protector.protect(value);
    return { eventId, ciphertext: protectedValue.ciphertext, iv: protectedValue.iv, authTag: protectedValue.authTag, keyVersion: protectedValue.keyVersion, updatedAt: new Date() };
  }

  private map(row: typeof event.$inferSelect, exact: typeof eventExactLocation.$inferSelect | null): EventRecord {
    const location = row.ufCode && row.municipalityCode && row.municipalityName && row.timeZone
      ? { ufCode: row.ufCode, municipalityCode: row.municipalityCode, municipalityName: row.municipalityName, timeZone: row.timeZone }
      : null;
    const aggregate = Event.restore({
      id: row.id, hostAccountId: row.hostAccountId, status: row.status as EventState['status'], revision: row.revision,
      activityTypeCode: row.activityTypeCode, title: row.title, description: row.description, startsAtLocal: dbToLocalDateTime(row.startsAtLocal), endsAtLocal: dbToLocalDateTime(row.endsAtLocal),
      startsAt: row.startsAt, endsAt: row.endsAt, location, venueType: row.venueType as EventState['venueType'],
      nonResidentialHostDeclaration: row.nonResidentialHostDeclaration, capacity: row.capacity, admissionMode: row.admissionMode as EventState['admissionMode'],
      approximateArea: row.approximateLatitude !== null && row.approximateLongitude !== null && row.approximateRadiusMeters !== null ? { latitude: row.approximateLatitude, longitude: row.approximateLongitude, radiusMeters: row.approximateRadiusMeters } : null,
      official: false, publishedAt: row.publishedAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
    });
    const exactLocation = exact ? this.protector.reveal({ ciphertext: exact.ciphertext, iv: exact.iv, authTag: exact.authTag, keyVersion: exact.keyVersion }) : null;
    return { event: aggregate, exactLocation };
  }
}
