import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GetOwnProfile, PreviewOwnProfile, UpdateOwnProfile } from '../../../src/modules/profiles/application/use-cases/profile.use-cases';
import { CreateProfilePhotoUpload, FinalizeProfilePhotoUpload, RemoveProfilePhoto } from '../../../src/modules/profiles/application/use-cases/profile-media.use-cases';
import { ProfileError } from '../../../src/modules/profiles/domain/errors/profile.error';
import { ProfilesModule } from '../../../src/modules/profiles/profiles.module';
import { ResolveAuthenticatedSession } from '../../../src/modules/identity-access/application/use-cases/resolve-authenticated-session.use-case';
import { configureApplication } from '../../../src/main';
import { validateEnv } from '../../../src/shared/infrastructure/config/env';

const TOKEN = 'B'.repeat(43);
const BFF = { 'X-EventMatch-BFF-Token': process.env.BFF_INTERNAL_TOKEN!, Authorization: `Bearer ${TOKEN}` };
const ORIGIN = Buffer.alloc(32, 9).toString('base64url');
const INTERESTS = [1, 2, 3].map((number) => ({ id: `00000000-0000-7000-8000-00000000000${number}`, slug: `interest-${number}`, label: `Interest ${number}` }));
const PROFILE = { revision: 1, displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interests: INTERESTS, presentation: null, photoVisibility: 'private', presentationVisibility: 'private', photo: null, pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languages: [], languagesVisibility: 'private', activityPreferences: [], activityPreferencesVisibility: 'private', completion: { complete: false, completedCount: 4, totalCount: 6, missing: ['photo', 'presentation'] }, invitationSubject: `v1.${'A'.repeat(43)}` };
const getOwn = { execute: mock(async () => PROFILE) };
const updateOwn = { execute: mock(async () => ({ ...PROFILE, revision: 2 })) };
const previewOwn = { execute: mock(async () => ({ displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interests: INTERESTS })) };
const grant = { execute: mock(async () => ({ uploadId: crypto.randomUUID(), uploadUrl: 'https://api.cloudinary.com/upload', cloudName: 'fixture', apiKey: 'public', publicId: 'profiles/photo', timestamp: 1, expiresAt: new Date('2026-10-01T12:05:00Z'), uploadPreset: 'profile', signature: 'signed' })) };
const finalize = { execute: mock(async () => ({ activated: true })) };
const remove = { execute: mock(async () => ({ removed: true })) };
const sessions = { execute: mock(async () => ({ accountId: '00000000-0000-7000-8000-000000000099' })) };

async function createApp(overrides: Record<string, string> = {}): Promise<INestApplication> {
  const module = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true, validate: (environment) => validateEnv({ ...environment, PROFILE_HTTP_ENABLED: 'true', PROFILE_MEDIA_ENABLED: 'true', PROFILE_MEDIA_PROVIDER: 'fake', PROFILE_INVITATION_KEY: Buffer.alloc(32, 10).toString('base64'), PROFILE_MEDIA_KEY: Buffer.alloc(32, 11).toString('base64'), ...overrides }) }), ProfilesModule] })
    .overrideProvider(GetOwnProfile).useValue(getOwn)
    .overrideProvider(UpdateOwnProfile).useValue(updateOwn)
    .overrideProvider(PreviewOwnProfile).useValue(previewOwn)
    .overrideProvider(CreateProfilePhotoUpload).useValue(grant)
    .overrideProvider(FinalizeProfilePhotoUpload).useValue(finalize)
    .overrideProvider(RemoveProfilePhoto).useValue(remove)
    .overrideProvider(ResolveAuthenticatedSession).useValue(sessions)
    .compile();
  const app = module.createNestApplication(); configureApplication(app); await app.init(); return app;
}

describe('profile HTTP contract v1 (SDD-015)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => { app = await createApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(() => { for (const value of [getOwn, updateOwn, previewOwn, grant, finalize, remove, sessions]) value.execute.mockClear(); });

  test('requires the BFF token before resolving the session and always disables caching', async () => {
    const response = await http().get('/api/v1/profiles/me').set({ Authorization: `Bearer ${TOKEN}` }).expect(401);
    expect(response.headers['cache-control']).toBe('no-store'); expect(sessions.execute).not.toHaveBeenCalled();
  });

  test('reads the own profile through profile_read without exposing a session', async () => {
    const response = await http().get('/api/v1/profiles/me').set(BFF).expect(200);
    expect(response.body.data).toEqual({ ...PROFILE, completion: PROFILE.completion });
    expect(sessions.execute).toHaveBeenCalledWith({ token: TOKEN, capability: 'profile_read', allowRotation: false });
    expect(JSON.stringify(response.body)).not.toContain(TOKEN);
  });

  test('validates updates, accepts UUIDv7 interests and rejects unknown properties', async () => {
    const body = { revision: 1, displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interestIds: INTERESTS.map(({ id }) => id), presentation: null, photoVisibility: 'private', presentationVisibility: 'authenticated', pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: [], languagesVisibility: 'private', activityPreferenceCodes: ['small_group'], activityPreferencesVisibility: 'authenticated' };
    await http().put('/api/v1/profiles/me').set(BFF).send(body).expect(200);
    expect(sessions.execute).toHaveBeenLastCalledWith({ token: TOKEN, capability: 'profile_write', allowRotation: false });
    expect(updateOwn.execute).toHaveBeenCalledWith({ accountId: '00000000-0000-7000-8000-000000000099', ...body });
    await http().put('/api/v1/profiles/me').set(BFF).send({ ...body, accountId: 'forged' }).expect(400);
    await http().put('/api/v1/profiles/me').set(BFF).send({ ...body, profession: undefined }).expect(400);
    await http().put('/api/v1/profiles/me').set(BFF).send({ ...body, activityPreferenceCodes: undefined }).expect(400);
    await http().put('/api/v1/profiles/me').set(BFF).send({ ...body, activityPreferencesVisibility: undefined }).expect(400);
    await http().put('/api/v1/profiles/me').set(BFF).send({ ...body, activityPreferencesVisibility: 'public' }).expect(400);
  });

  test('maps language errors to 422 with only the allowlisted reason', async () => {
    const body = { revision: 1, displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interestIds: INTERESTS.map(({ id }) => id), presentation: null, photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: 'Produtora', professionVisibility: 'private', languageCodes: ['pt', 'eo'], languagesVisibility: 'private', activityPreferenceCodes: [], activityPreferencesVisibility: 'private' };
    for (const [code, reason] of [['UNKNOWN_LANGUAGE', 'unknown_language'], ['INACTIVE_LANGUAGE', 'inactive_language']] as const) {
      updateOwn.execute.mockImplementationOnce(async () => { throw new ProfileError(code, reason); });
      const response = await http().put('/api/v1/profiles/me').set(BFF).send(body).expect(422);
      expect(response.body).toEqual({ data: { reason }, message: expect.any(String), statusCode: 422 });
      expect(JSON.stringify(response.body)).not.toMatch(/Produtora|eo/);
    }
    await http().put('/api/v1/profiles/me').set(BFF).send({ ...body, languageCodes: ['pt', 'en', 'es', 'bzs', 'fr', 'it'] }).expect(400);
    await http().put('/api/v1/profiles/me').set(BFF).send({ ...body, languageCodes: ['pt', 'pt'] }).expect(400);
    await http().put('/api/v1/profiles/me').set(BFF).send({ ...body, languageCodes: ['PT'] }).expect(400);
  });

  test('maps activity preference errors to 422 and validates the selection shape (ADR-044)', async () => {
    const body = { revision: 1, displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interestIds: INTERESTS.map(({ id }) => id), presentation: null, photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: [], languagesVisibility: 'private', activityPreferenceCodes: ['small_group', 'retired_option'], activityPreferencesVisibility: 'authenticated' };
    for (const [code, reason] of [['UNKNOWN_ACTIVITY_PREFERENCE', 'unknown_activity_preference'], ['INACTIVE_ACTIVITY_PREFERENCE', 'inactive_activity_preference']] as const) {
      updateOwn.execute.mockImplementationOnce(async () => { throw new ProfileError(code, reason); });
      const response = await http().put('/api/v1/profiles/me').set(BFF).send(body).expect(422);
      expect(response.body).toEqual({ data: { reason }, message: expect.any(String), statusCode: 422 });
      expect(JSON.stringify(response.body)).not.toMatch(/small_group|retired_option/);
    }
    const six = ['outdoor', 'indoor', 'quiet_setting', 'lively_setting', 'small_group', 'medium_group'];
    await http().put('/api/v1/profiles/me').set(BFF).send({ ...body, activityPreferenceCodes: six }).expect(400);
    await http().put('/api/v1/profiles/me').set(BFF).send({ ...body, activityPreferenceCodes: ['outdoor', 'outdoor'] }).expect(400);
    await http().put('/api/v1/profiles/me').set(BFF).send({ ...body, activityPreferenceCodes: ['Small-Group'] }).expect(400);
  });

  test('projects the preview and protects media with its own flag', async () => {
    await http().get('/api/v1/profiles/me/preview').set(BFF).expect(200);
    const disabled = await createApp({ PROFILE_MEDIA_ENABLED: 'false' });
    try { await request(disabled.getHttpServer()).post('/api/v1/profiles/me/photo/uploads').set({ ...BFF, 'X-EventMatch-Origin-Fingerprint': ORIGIN }).send({ revision: 1 }).expect(404); }
    finally { await disabled.close(); }
  });

  test('creates a grant only with a trusted fingerprint and validates finalize ids', async () => {
    await http().post('/api/v1/profiles/me/photo/uploads').set(BFF).send({ revision: 1 }).expect(400);
    const response = await http().post('/api/v1/profiles/me/photo/uploads').set({ ...BFF, 'X-EventMatch-Origin-Fingerprint': ORIGIN }).send({ revision: 1 }).expect(201);
    expect(response.body).toMatchObject({ statusCode: 201, message: 'Photo upload granted.' });
    expect(sessions.execute).toHaveBeenLastCalledWith({ token: TOKEN, capability: 'profile_write', allowRotation: false });
    expect(grant.execute).toHaveBeenCalledWith({ accountId: '00000000-0000-7000-8000-000000000099', originSubject: ORIGIN, revision: 1 });
    await http().post('/api/v1/profiles/me/photo/uploads/not-a-uuid/finalize').set(BFF).send({ revision: 1, providerResponse: {} }).expect(400);
    await http().post(`/api/v1/profiles/me/photo/uploads/${crypto.randomUUID()}/finalize`).set(BFF).send({ revision: 1, providerResponse: { asset_id: 'asset', public_id: 'profiles/photo', version: 1, signature: 'signed', format: 'webp', bytes: 1024, width: 512, height: 512, api_secret: 'forged' } }).expect(400);
  });

  test('publishes every profile path and the additive API version', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('EventMatch API').setVersion('0.14.0').build());
    expect(document.info.version).toBe('0.14.0');
    for (const path of ['/api/v1/profiles/me', '/api/v1/profiles/me/preview', '/api/v1/profiles/me/photo/uploads', '/api/v1/profiles/me/photo/uploads/{uploadId}/finalize', '/api/v1/profiles/me/photo']) expect(document.paths[path]).toBeDefined();
    const schemas = document.components?.schemas ?? {};
    const responseSchema = (path: string, method: 'get' | 'put' | 'post' | 'delete', status: string) => {
      const response = document.paths[path]?.[method]?.responses?.[status];
      return response && !('$ref' in response) ? response.content?.['application/json']?.schema : undefined;
    };
    expect(responseSchema('/api/v1/profiles/me', 'get', '200')).toEqual({ $ref: '#/components/schemas/InternalOwnProfileEnvelopeDto' });
    expect(responseSchema('/api/v1/profiles/me', 'put', '200')).toEqual({ $ref: '#/components/schemas/OwnProfileEnvelopeDto' });
    expect(responseSchema('/api/v1/profiles/me/preview', 'get', '200')).toEqual({ $ref: '#/components/schemas/ProfilePreviewEnvelopeDto' });
    expect(responseSchema('/api/v1/profiles/me/photo/uploads', 'post', '201')).toEqual({ $ref: '#/components/schemas/SignedProfilePhotoUploadGrantEnvelopeDto' });
    expect(responseSchema('/api/v1/profiles/me/photo/uploads/{uploadId}/finalize', 'post', '200')).toEqual({ $ref: '#/components/schemas/InternalOwnProfileEnvelopeDto' });
    expect(responseSchema('/api/v1/profiles/me/photo', 'delete', '200')).toEqual({ $ref: '#/components/schemas/InternalOwnProfileEnvelopeDto' });
    expect(schemas.InternalOwnProfileEnvelopeDto).toMatchObject({ required: ['data', 'message', 'statusCode'] });
    expect(schemas.SignedProfilePhotoUploadGrantEnvelopeDto).toMatchObject({ required: ['data', 'message', 'statusCode'] });
    expect(schemas.InternalOwnProfileResponseDto).toMatchObject({ required: expect.arrayContaining(['invitationSubject']) });
    expect(schemas.CloudinaryUploadResponseDto).toMatchObject({ type: 'object', required: ['asset_id', 'public_id', 'version', 'signature', 'format', 'bytes', 'width', 'height'] });
    expect(schemas.SignedProfilePhotoUploadGrantDto).toBeDefined();
    expect(schemas.ProfilePhotoResponseDto).toMatchObject({ required: ['deliveryUrl', 'width', 'height'] });
    expect(JSON.stringify(schemas.ProfilePhotoResponseDto)).not.toContain('expiresAt');
    expect(JSON.stringify(schemas)).not.toContain('api_secret');
  });
});
