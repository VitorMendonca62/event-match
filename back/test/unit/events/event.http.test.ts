import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { configureApplication } from '../../../src/main';
import { ResolveAuthenticatedSession } from '../../../src/modules/identity-access/application/use-cases/resolve-authenticated-session.use-case';
import { CreateEventDraft, GetEventDraft, PreviewEventDraft, PublishEvent, UpdateEventDraft } from '../../../src/modules/events/application/use-cases/event.use-cases';
import { SearchEventLocations } from '../../../src/modules/events/application/use-cases/search-event-locations.use-case';
import { EventError } from '../../../src/modules/events/domain/errors/event.error';
import type { PlaceSearchResult } from '../../../src/modules/events/domain/ports/place-search.port';
import { ListActiveEventActivityTypes } from '../../../src/modules/events/application/use-cases/list-active-event-activity-types.use-case';
import { EventsBffGuard, EventsCapabilityGuard } from '../../../src/modules/events/presentation/http/events-auth.guard';
import { EventsController } from '../../../src/modules/events/presentation/http/controllers/events.controller';
import { EventActivityTypesController } from '../../../src/modules/events/presentation/http/controllers/event-activity-types.controller';
import { NoStoreMiddleware } from '../../../src/shared/presentation/http/no-store.middleware';
import { validateEnv } from '../../../src/shared/infrastructure/config/env';

const TOKEN = 'B'.repeat(43);
const BFF = { 'X-EventMatch-BFF-Token': process.env.BFF_INTERNAL_TOKEN!, Authorization: `Bearer ${TOKEN}` };
const EVENT_ID = '00000000-0000-7000-8000-000000000001';
const OWNER_DRAFT = { id: EVENT_ID, revision: 1, status: 'draft', activityType: { code: 'caminhada', label: 'Caminhada' }, title: 'Caminhada', description: 'Uma caminhada informal.', startsAtLocal: '2026-11-15T09:00', endsAtLocal: null, startsAt: '2026-11-15T12:00:00.000Z', endsAt: null, timeZone: 'America/Recife', location: { ufCode: 'PE', municipalityCode: '2611606', municipalityName: 'Recife' }, venueType: 'public_place', nonResidentialHostDeclaration: true, exactLocation: { latitude: -8.0476, longitude: -34.877 }, capacity: 8, admissionMode: 'manual_approval', official: false };
const PREVIEW = { id: EVENT_ID, activityType: { code: 'caminhada', label: 'Caminhada' }, title: 'Caminhada', description: 'Uma caminhada informal.', startsAt: '2026-11-15T12:00:00.000Z', endsAt: null, timeZone: 'America/Recife', location: { ufCode: 'PE', municipalityCode: '2611606', municipalityName: 'Recife', approximateArea: { latitude: -8.045, longitude: -34.875, radiusMeters: 500 } }, capacity: 8, admissionMode: 'manual_approval', status: 'draft' };

const create = { execute: mock(async () => OWNER_DRAFT) };
const get = { execute: mock(async () => OWNER_DRAFT) };
const update = { execute: mock(async () => ({ ...OWNER_DRAFT, revision: 2 })) };
const preview = { execute: mock(async () => PREVIEW) };
const publish = { execute: mock(async () => ({ ...OWNER_DRAFT, status: 'published_open' })) };
const searchLocations = { execute: mock(async (): Promise<{ results: readonly PlaceSearchResult[] }> => ({ results: [] })) };
const listActivityTypes = { execute: mock(async () => [{ code: 'caminhada', label: 'Caminhada', active: true }]) };
const sessions = { execute: mock(async () => ({ accountId: '00000000-0000-7000-8000-000000000099' })) };

async function createApp(eventsEnabled = true): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true, validate: (environment) => validateEnv({ ...environment, EVENTS_HTTP_ENABLED: String(eventsEnabled), EVENT_EXACT_LOCATION_KEY: Buffer.alloc(32, 9).toString('base64'), EVENT_LOCATION_SEARCH_URL: 'https://nominatim.openstreetmap.org/search', EVENT_LOCATION_SEARCH_USER_AGENT: 'EventMatch/test' }) })],
    controllers: [EventsController, EventActivityTypesController],
    providers: [EventsBffGuard, EventsCapabilityGuard, { provide: ResolveAuthenticatedSession, useValue: sessions }, { provide: CreateEventDraft, useValue: create }, { provide: GetEventDraft, useValue: get }, { provide: UpdateEventDraft, useValue: update }, { provide: PreviewEventDraft, useValue: preview }, { provide: PublishEvent, useValue: publish }, { provide: SearchEventLocations, useValue: searchLocations }, { provide: ListActiveEventActivityTypes, useValue: listActivityTypes }],
  }).compile();
  const app = module.createNestApplication();
  const noStore = new NoStoreMiddleware();
  app.use(noStore.use.bind(noStore));
  configureApplication(app);
  await app.init();
  return app;
}

describe('events HTTP contract v1 (SDD-025, ADR-058)', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await createApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(() => { for (const value of [create, get, update, preview, publish, searchLocations, listActivityTypes, sessions]) value.execute.mockClear(); });

  test('lists the active event activity catalog publicly, in a no-store response', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/catalog/event-activity-types?locale=pt-BR').expect(200);
    expect(response.body.data).toEqual({ eventActivityTypes: [{ code: 'caminhada', label: 'Caminhada' }] });
    expect(response.headers['cache-control']).toContain('no-store');
    expect(listActivityTypes.execute).toHaveBeenCalledWith('pt-BR');
    expect(sessions.execute).not.toHaveBeenCalled();
  });

  test('rejects unsupported locales and extra catalog query fields', async () => {
    await request(app.getHttpServer()).get('/api/v1/catalog/event-activity-types?locale=en-US').expect(400);
    await request(app.getHttpServer()).get('/api/v1/catalog/event-activity-types?unexpected=value').expect(400);
    expect(listActivityTypes.execute).not.toHaveBeenCalled();
  });

  test('requires the internal BFF and session before invoking event use cases', async () => {
    await request(app.getHttpServer()).post('/api/v1/events/drafts').send({}).expect(401);
    expect(sessions.execute).not.toHaveBeenCalled();
    expect(create.execute).not.toHaveBeenCalled();
  });

  test('validates the DTO, resolves the session capability and keeps exact location out of public preview', async () => {
    const body = { activityTypeCode: 'caminhada', title: 'Caminhada', description: 'Uma caminhada informal.', startsAtLocal: '2026-11-15T09:00', ufCode: 'PE', municipalityCode: '2611606', venueType: 'public_place', nonResidentialHostDeclaration: true, exactLocation: { latitude: -8.0476, longitude: -34.877 }, capacity: 8, admissionMode: 'manual_approval' };
    await request(app.getHttpServer()).post('/api/v1/events/drafts').set(BFF).send(body).expect(201);
    expect(sessions.execute).toHaveBeenCalledWith({ token: TOKEN, capability: 'events_write', allowRotation: false });
    expect(create.execute).toHaveBeenCalledWith(expect.objectContaining({ hostAccountId: '00000000-0000-7000-8000-000000000099', activityTypeCode: 'caminhada', title: 'Caminhada', municipalityCode: '2611606' }));
    await request(app.getHttpServer()).post('/api/v1/events/drafts').set(BFF).send({ ...body, official: true }).expect(400);
    const response = await request(app.getHttpServer()).get(`/api/v1/events/drafts/${EVENT_ID}/preview`).set(BFF).expect(200);
    expect(response.body.data).toEqual(PREVIEW);
    expect(JSON.stringify(response.body)).not.toContain('-8.0476');
  });

  test('searches only for the authenticated host and returns a no-store result or a neutral rate limit', async () => {
    const place = { kind: 'place' as const, label: 'Praça do Arsenal, Recife, Pernambuco', latitude: -8.0631, longitude: -34.8711 };
    searchLocations.execute.mockImplementationOnce(async () => ({ results: [place] }));
    const response = await request(app.getHttpServer())
      .post(`/api/v1/events/drafts/${EVENT_ID}/location-search`)
      .set(BFF)
      .send({ query: 'Praça do Arsenal' })
      .expect(200);

    expect(response.body.data.results).toEqual([place]);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(sessions.execute).toHaveBeenCalledWith({ token: TOKEN, capability: 'events_write', allowRotation: false });
    expect(searchLocations.execute).toHaveBeenCalledWith({ hostAccountId: '00000000-0000-7000-8000-000000000099', eventId: EVENT_ID, query: 'Praça do Arsenal' });

    searchLocations.execute.mockImplementationOnce(async () => { throw new EventError('LOCATION_SEARCH_RATE_LIMITED'); });
    const limited = await request(app.getHttpServer())
      .post(`/api/v1/events/drafts/${EVENT_ID}/location-search`)
      .set(BFF)
      .send({ query: 'Praça do Arsenal' })
      .expect(429);
    expect(limited.headers['cache-control']).toContain('no-store');
    expect(limited.body.message).toBe('Location search is temporarily rate limited.');
    expect(JSON.stringify(limited.body)).not.toContain('Praça do Arsenal');
  });

  test('protects location search with the BFF guard and strict request DTO', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/events/drafts/${EVENT_ID}/location-search`)
      .send({ query: 'Recife' })
      .expect(401);
    expect(sessions.execute).not.toHaveBeenCalled();
    expect(searchLocations.execute).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .post(`/api/v1/events/drafts/${EVENT_ID}/location-search`)
      .set(BFF)
      .send({ query: 'Recife', unexpected: true })
      .expect(400);
    expect(searchLocations.execute).not.toHaveBeenCalled();
  });

  test('accepts explicit nulls to clear optional draft fields', async () => {
    await request(app.getHttpServer()).put(`/api/v1/events/drafts/${EVENT_ID}`).set(BFF).send({ revision: 1, title: null, description: null, capacity: null, exactLocation: null }).expect(200);
    expect(update.execute).toHaveBeenCalledWith(expect.objectContaining({ eventId: EVENT_ID, revision: 1, title: null, description: null, capacity: null, exactLocation: null }));
  });

  test('answers 404 while the rollout flag is disabled', async () => {
    const disabled = await createApp(false);
    try {
      await request(disabled.getHttpServer()).post('/api/v1/events/drafts').set(BFF).send({}).expect(404);
      await request(disabled.getHttpServer()).get('/api/v1/catalog/event-activity-types?locale=pt-BR').expect(200);
    }
    finally { await disabled.close(); }
  });
});
