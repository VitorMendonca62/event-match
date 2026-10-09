import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { configureApplication } from '../../../src/main';
import { ResolveAuthenticatedSession } from '../../../src/modules/identity-access/application/use-cases/resolve-authenticated-session.use-case';
import { CreateEventDraft, GetEventDraft, PreviewEventDraft, PublishEvent, UpdateEventDraft } from '../../../src/modules/events/application/use-cases/event.use-cases';
import { EventsBffGuard, EventsCapabilityGuard } from '../../../src/modules/events/presentation/http/events-auth.guard';
import { EventsController } from '../../../src/modules/events/presentation/http/controllers/events.controller';
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
const sessions = { execute: mock(async () => ({ accountId: '00000000-0000-7000-8000-000000000099' })) };

async function createApp(eventsEnabled = true): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true, validate: (environment) => validateEnv({ ...environment, EVENTS_HTTP_ENABLED: String(eventsEnabled), EVENT_EXACT_LOCATION_KEY: Buffer.alloc(32, 9).toString('base64') }) })],
    controllers: [EventsController],
    providers: [EventsBffGuard, EventsCapabilityGuard, { provide: ResolveAuthenticatedSession, useValue: sessions }, { provide: CreateEventDraft, useValue: create }, { provide: GetEventDraft, useValue: get }, { provide: UpdateEventDraft, useValue: update }, { provide: PreviewEventDraft, useValue: preview }, { provide: PublishEvent, useValue: publish }],
  }).compile();
  const app = module.createNestApplication();
  configureApplication(app);
  await app.init();
  return app;
}

describe('events HTTP contract v1 (SDD-025, ADR-058)', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await createApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(() => { for (const value of [create, get, update, preview, publish, sessions]) value.execute.mockClear(); });

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

  test('answers 404 while the rollout flag is disabled', async () => {
    const disabled = await createApp(false);
    try { await request(disabled.getHttpServer()).post('/api/v1/events/drafts').set(BFF).send({}).expect(404); }
    finally { await disabled.close(); }
  });
});
