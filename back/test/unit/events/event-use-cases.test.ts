import { describe, expect, mock, test } from 'bun:test';
import { Test } from '@nestjs/testing';

import { UNIT_OF_WORK_PORT } from '../../../src/shared/application/ports/unit-of-work.port';
import { useCaseProvider } from '../../../src/shared/infrastructure/nest/use-case.provider';
import { MUNICIPALITY_CATALOG_READER_PORT } from '../../../src/modules/catalog/domain/ports/municipality-catalog-reader.port';
import { HOST_ELIGIBILITY_PORT } from '../../../src/modules/profiles/domain/ports/host-eligibility.port';
import { CreateEventDraft, PreviewEventDraft, PublishEvent } from '../../../src/modules/events/application/use-cases/event.use-cases';
import { APPROXIMATE_EVENT_AREA_PROJECTOR_PORT } from '../../../src/modules/events/domain/ports/approximate-event-area-projector.port';
import { EVENT_ACTIVITY_TYPE_CATALOG_PORT } from '../../../src/modules/events/domain/ports/event-activity-type-catalog.port';
import { EVENT_AUDIT_PORT } from '../../../src/modules/events/domain/ports/event-audit.port';
import { EVENT_REPOSITORY_PORT, type EventRepositoryPort } from '../../../src/modules/events/domain/ports/event-repository.port';
import { EVENT_TELEMETRY_PORT } from '../../../src/modules/events/domain/ports/event-telemetry.port';
import { EXACT_LOCATION_PROTECTOR_PORT } from '../../../src/modules/events/domain/ports/exact-location-protector.port';
import { HOST_EVENT_LIMIT_PORT } from '../../../src/modules/events/domain/ports/host-event-limit.port';

const DEPENDENCIES = [UNIT_OF_WORK_PORT, EVENT_REPOSITORY_PORT, HOST_ELIGIBILITY_PORT, HOST_EVENT_LIMIT_PORT, EVENT_ACTIVITY_TYPE_CATALOG_PORT, MUNICIPALITY_CATALOG_READER_PORT, EXACT_LOCATION_PROTECTOR_PORT, APPROXIMATE_EVENT_AREA_PROJECTOR_PORT, EVENT_AUDIT_PORT, EVENT_TELEMETRY_PORT];
const location = { ufCode: 'PE' as const, municipalityCode: '2611606', municipalityName: 'Recife', timeZone: 'America/Recife' };
const exact = { latitude: -8.0476, longitude: -34.877 };

function input() {
  const start = new Date(Date.now() + 48 * 60 * 60_000);
  const end = new Date(start.getTime() + 2 * 60 * 60_000);
  return {
    activityTypeCode: 'caminhada', title: 'Caminhada', description: 'Uma caminhada informal.',
    startsAtLocal: start.toISOString().slice(0, 16), endsAtLocal: end.toISOString().slice(0, 16),
    ufCode: 'PE', municipalityCode: '2611606', venueType: 'public_place' as const, nonResidentialHostDeclaration: true,
    exactLocation: exact, capacity: 8, admissionMode: 'manual_approval' as const,
  };
}

function repository(): EventRepositoryPort & { rows: Map<string, { event: import('../../../src/modules/events/domain/entities/event').Event; exactLocation: typeof exact | null }> } {
  const rows = new Map<string, { event: import('../../../src/modules/events/domain/entities/event').Event; exactLocation: typeof exact | null }>();
  return {
    rows,
    findByIdForOwner: mock(async (_context, id, host) => { const row = rows.get(id); return row?.event.snapshot().hostAccountId === host ? row : null; }),
    findByIdForOwnerWithoutExact: mock(async (_context, id, host) => { const row = rows.get(id); return row && row.event.snapshot().hostAccountId === host ? { event: row.event, exactLocation: null } : null; }),
    findByIdPublic: mock(async (_context, id) => rows.get(id) ?? null),
    insert: mock(async (_context, event, exactLocation) => { rows.set(event.snapshot().id, { event, exactLocation }); }),
    saveIfRevision: mock(async (_context, event, revision, exactLocation) => { const current = rows.get(event.snapshot().id); if (!current || current.event.snapshot().revision !== revision) return 'conflict' as const; rows.set(event.snapshot().id, { event, exactLocation }); return 'updated' as const; }),
  } as EventRepositoryPort & { rows: Map<string, { event: import('../../../src/modules/events/domain/entities/event').Event; exactLocation: typeof exact | null }> };
}

async function setup() {
  const events = repository();
  const uow = { execute: async <T>(work: (context: object) => Promise<T>) => work({}) };
  const eligibility = { isEligible: mock(async () => true) };
  const limits = { lockAndCount: mock(async () => ({ futureActive: false, publishedInWindow: 0 })) };
  const activities = { findByCode: mock(async (context: object, code: string) => ({ code, label: 'Caminhada', active: true })) };
  const municipalities = { findByCodeAndUf: mock(async () => ({ ...location, active: true })) };
  const protector = { protect: mock((value: typeof exact) => ({ ...value, ciphertext: Buffer.from('cipher'), iv: Buffer.from('iv'), authTag: Buffer.from('tag'), keyVersion: 1 })), reveal: mock((value: typeof exact) => value) };
  const areas = { project: mock(() => ({ latitude: -8.045, longitude: -34.875, radiusMeters: 500 })) };
  const audit = { record: mock(async () => undefined) };
  const telemetry = { record: mock(() => undefined) };
  const module = await Test.createTestingModule({ providers: [
    { provide: UNIT_OF_WORK_PORT, useValue: uow }, { provide: EVENT_REPOSITORY_PORT, useValue: events }, { provide: HOST_ELIGIBILITY_PORT, useValue: eligibility }, { provide: HOST_EVENT_LIMIT_PORT, useValue: limits }, { provide: EVENT_ACTIVITY_TYPE_CATALOG_PORT, useValue: activities }, { provide: MUNICIPALITY_CATALOG_READER_PORT, useValue: municipalities }, { provide: EXACT_LOCATION_PROTECTOR_PORT, useValue: protector }, { provide: APPROXIMATE_EVENT_AREA_PROJECTOR_PORT, useValue: areas }, { provide: EVENT_AUDIT_PORT, useValue: audit }, { provide: EVENT_TELEMETRY_PORT, useValue: telemetry },
    useCaseProvider(CreateEventDraft, DEPENDENCIES), useCaseProvider(PreviewEventDraft, DEPENDENCIES), useCaseProvider(PublishEvent, DEPENDENCIES),
  ] }).compile();
  return { module, events, eligibility, limits, audit, areas };
}

describe('event application use cases', () => {
  test('creates an owner draft through Test.createTestingModule and audits only field names', async () => {
    const { module, events, audit } = await setup();
    try {
      const result = await module.get(CreateEventDraft).execute({ hostAccountId: 'account-1', ...input() });
      expect(result.status).toBe('draft');
      expect(result.exactLocation).toEqual(exact);
      expect(audit.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'draft_created', changedFields: expect.arrayContaining(['description', 'exactLocation']) }));
      expect(JSON.stringify((audit.record.mock.calls as unknown[][])[0]?.[1])).not.toContain('8.0476');
      expect(events.rows.size).toBe(1);
    } finally { await module.close(); }
  });

  test('publishes with a stable approximate area and refuses an ineligible host', async () => {
    const { module, eligibility, areas } = await setup();
    try {
      const created = await module.get(CreateEventDraft).execute({ hostAccountId: 'account-1', ...input() });
      const published = await module.get(PublishEvent).execute({ hostAccountId: 'account-1', eventId: created.id, revision: created.revision });
      expect(published.status).toBe('published_open');
      expect(published.exactLocation).toEqual(exact);
      expect(areas.project).toHaveBeenCalledWith(created.id, exact);
      eligibility.isEligible.mockResolvedValueOnce(false);
      await expect(module.get(CreateEventDraft).execute({ hostAccountId: 'account-1', ...input() })).rejects.toMatchObject({ code: 'HOST_NOT_ELIGIBLE' });
    } finally { await module.close(); }
  });

  test('previews from the persisted approximate area without loading the exact location', async () => {
    const { module, events } = await setup();
    try {
      const created = await module.get(CreateEventDraft).execute({ hostAccountId: 'account-1', ...input() });
      const preview = await module.get(PreviewEventDraft).execute({ hostAccountId: 'account-1', eventId: created.id });
      expect(preview.location.approximateArea).toEqual({ latitude: -8.045, longitude: -34.875, radiusMeters: 500 });
      expect(preview).not.toHaveProperty('exactLocation');
      expect(events.findByIdForOwner).not.toHaveBeenCalled();
      expect(events.findByIdForOwnerWithoutExact).toHaveBeenCalledWith(expect.anything(), created.id, 'account-1');
    } finally { await module.close(); }
  });
});
