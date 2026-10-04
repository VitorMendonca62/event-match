import { createHash } from 'node:crypto';
import { describe, expect, mock, test } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { CloudinaryProfileImageStoreAdapter, createSignedCloudinaryDeliveryUrl } from '../../../src/modules/profiles/infrastructure/media/cloudinary-profile-image-store.adapter';
import { FakeProfileImageStoreAdapter } from '../../../src/modules/profiles/infrastructure/media/fake-profile-image-store.adapter';
import { ProfileInvitationSubjectAdapter } from '../../../src/modules/profiles/infrastructure/security/profile-invitation-subject.adapter';
import { ProfileMediaSubjectAdapter } from '../../../src/modules/profiles/infrastructure/security/profile-media-subject.adapter';

const SECRET = 'provider-secret';
const config = new ConfigService({ CLOUDINARY_CLOUD_NAME: 'eventmatch-test', CLOUDINARY_API_KEY: 'public-key', CLOUDINARY_API_SECRET: SECRET, CLOUDINARY_PROFILE_UPLOAD_PRESET: 'profile-signed', PROFILE_PHOTO_MAX_BYTES: 5_242_880 });

describe('profile media adapters (ADR-039)', () => {
  test('fake adapter accepts only the deterministic signed response and delivers no provider secret', async () => {
    const store = new FakeProfileImageStoreAdapter();
    const pending = { id: 'upload', accountId: 'account', publicId: 'profiles/photo', expiresAt: new Date(Date.now() + 60_000) };
    expect(() => store.verifyUploaded({ pending, providerResponse: { public_id: 'wrong', signature: 'fixture-response-signature' } })).toThrow('PHOTO_REJECTED');
    const verified = await store.verifyUploaded({ pending, providerResponse: { public_id: pending.publicId, signature: 'fixture-response-signature' } });
    expect(verified).toMatchObject({ publicId: pending.publicId, format: 'webp', width: 512, height: 512 });
    expect(JSON.stringify(await store.createSignedUpload({ uploadId: pending.id, publicId: pending.publicId, expiresAt: pending.expiresAt }))).not.toContain(SECRET);
  });

  test('Cloudinary rechecks an allowlisted signed response against its authoritative API', async () => {
    const store = new CloudinaryProfileImageStoreAdapter(config as never);
    const pending = { id: 'upload', accountId: 'account', publicId: 'profiles/photo', expiresAt: new Date(Date.now() + 60_000) };
    const response = { asset_id: 'asset', public_id: pending.publicId, version: 7, signature: createHash('sha1').update(`public_id=${pending.publicId}&version=7${SECRET}`).digest('hex'), format: 'jpg', bytes: 2048, width: 800, height: 600 };
    const original = globalThis.fetch;
    const fetchMock = mock(async (...args: Parameters<typeof fetch>) => { void args; return new Response(JSON.stringify({ ...response, type: 'authenticated' }), { status: 200 }); });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try { expect(await store.verifyUploaded({ pending, providerResponse: response })).toMatchObject({ providerAssetId: 'asset', publicId: pending.publicId, version: 7 }); }
    finally { globalThis.fetch = original; }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const authorization = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(authorization.authorization).toStartWith('Basic ');
  });

  test('Cloudinary rejects provider drift and never accepts oversized files', async () => {
    const store = new CloudinaryProfileImageStoreAdapter(config as never);
    const pending = { id: 'upload', accountId: 'account', publicId: 'profiles/photo', expiresAt: new Date(Date.now() + 60_000) };
    const signed = { asset_id: 'asset', public_id: pending.publicId, version: 1, signature: createHash('sha1').update(`public_id=${pending.publicId}&version=1${SECRET}`).digest('hex'), format: 'webp', bytes: 5_242_881, width: 512, height: 512 };
    await expect(store.verifyUploaded({ pending, providerResponse: signed })).rejects.toMatchObject({ code: 'PHOTO_REJECTED' });
  });

  test('Cloudinary rejects animated assets and forces a single frame on delivery', async () => {
    const store = new CloudinaryProfileImageStoreAdapter(config as never);
    const pending = { id: 'upload', accountId: 'account', publicId: 'profiles/photo', expiresAt: new Date(Date.now() + 60_000) };
    const response = { asset_id: 'animated-asset', public_id: pending.publicId, version: 3, signature: createHash('sha1').update(`public_id=${pending.publicId}&version=3${SECRET}`).digest('hex'), format: 'webp', bytes: 2048, width: 800, height: 600 };
    const original = globalThis.fetch;
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ ...response, type: 'authenticated', pages: 2 }), { status: 200 })) as unknown as typeof fetch;
    try { await expect(store.verifyUploaded({ pending, providerResponse: response })).rejects.toMatchObject({ code: 'PHOTO_REJECTED' }); }
    finally { globalThis.fetch = original; }

    expect(createSignedCloudinaryDeliveryUrl({ cloudName: 'eventmatch-test', secret: SECRET, publicId: pending.publicId, version: 3, size: 128 })).toContain('/pg_1/');
    expect((await store.createSignedDelivery({ id: 'active', publicId: pending.publicId, version: 3 })).url).toContain('/pg_1/');
  });

  test('security subjects are deterministic, domain separated and never contain their inputs', () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const invitation = new ProfileInvitationSubjectAdapter(new ConfigService({ PROFILE_INVITATION_KEY: key }) as never).digest('account-id');
    const media = new ProfileMediaSubjectAdapter(new ConfigService({ PROFILE_MEDIA_KEY: key }) as never);
    expect(invitation).toMatch(/^v1\.[A-Za-z0-9_-]{43}$/);
    expect(media.digest('account', 'same')).not.toEqual(media.digest('origin', 'same'));
    expect(invitation).not.toContain('account-id');
  });
});
