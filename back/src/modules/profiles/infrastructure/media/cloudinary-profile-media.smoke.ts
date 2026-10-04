import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../../../../app.module';
import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import { PROFILE_IMAGE_STORE_PORT, type ProfileImageStorePort } from '../../domain/ports/outbound/profile-media.ports';
import { createSignedCloudinaryDeliveryUrl } from './cloudinary-profile-image-store.adapter';
import { inspectNormalizedWebp, jpegContainsExifGps } from './cloudinary-profile-media-smoke-support';

type UploadedAsset = Readonly<{
  asset_id: string;
  public_id: string;
  version: number;
  signature: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
}>;

async function fetchVariant(url: string, expectedSize: 128 | 512): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Cloudinary ${expectedSize}px variant was unavailable.`);
  const inspected = inspectNormalizedWebp(new Uint8Array(await response.arrayBuffer()));
  if (inspected.width !== expectedSize || inspected.height !== expectedSize) throw new Error(`Cloudinary ${expectedSize}px variant has unexpected dimensions.`);
  if (inspected.metadataChunks.length > 0) throw new Error(`Cloudinary ${expectedSize}px variant retained metadata.`);
  if (inspected.animated) throw new Error(`Cloudinary ${expectedSize}px variant is animated.`);
}

async function main(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule, { logger: false });
  let publicId: string | undefined;
  try {
    const config = application.get(ConfigService<BackendEnv, true>);
    if (!config.getOrThrow<boolean>('PROFILE_MEDIA_SMOKE_ENABLED')) throw new Error('Set PROFILE_MEDIA_SMOKE_ENABLED=true to run the Cloudinary smoke test.');
    const fixturePath = config.getOrThrow<string>('PROFILE_MEDIA_SMOKE_FIXTURE');
    const fixture = new Uint8Array(await readFile(fixturePath));
    if (!jpegContainsExifGps(fixture)) throw new Error('PROFILE_MEDIA_SMOKE_FIXTURE must be a JPEG containing EXIF GPS metadata.');
    const store = application.get<ProfileImageStorePort>(PROFILE_IMAGE_STORE_PORT);
    if (store.provider !== 'cloudinary') throw new Error('Cloudinary smoke test requires PROFILE_MEDIA_PROVIDER=cloudinary.');
    const uploadId = crypto.randomUUID();
    publicId = `profile-smoke/${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 300_000);
    const grant = await store.createSignedUpload({ uploadId, publicId, expiresAt });
    const form = new FormData();
    form.set('file', new Blob([fixture], { type: 'image/jpeg' }), basename(fixturePath));
    form.set('public_id', grant.publicId);
    form.set('timestamp', String(grant.timestamp));
    form.set('type', 'authenticated');
    form.set('upload_preset', grant.uploadPreset);
    form.set('api_key', grant.apiKey);
    form.set('signature', grant.signature);
    const upload = await fetch(grant.uploadUrl, { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) });
    if (!upload.ok) throw new Error('Cloudinary smoke upload failed.');
    const providerResponse = await upload.json() as UploadedAsset;
    const verified = await store.verifyUploaded({ pending: { id: uploadId, accountId: 'smoke', publicId, expiresAt }, providerResponse });
    const cloudName = config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME');
    const secret = config.getOrThrow<string>('CLOUDINARY_API_SECRET');
    await Promise.all(([128, 512] as const).map((size) => fetchVariant(createSignedCloudinaryDeliveryUrl({ cloudName, secret, publicId: verified.publicId, version: verified.version, size }), size)));
    console.info(JSON.stringify({ scope: 'profile.media.smoke', variants: [128, 512], metadataStripped: true, authenticatedDelivery: true }));
  } finally {
    if (publicId) await application.get<ProfileImageStorePort>(PROFILE_IMAGE_STORE_PORT).delete(publicId);
    await application.close();
  }
}

void main().catch(() => {
  console.error('Cloudinary profile media smoke failed.');
  process.exitCode = 1;
});
