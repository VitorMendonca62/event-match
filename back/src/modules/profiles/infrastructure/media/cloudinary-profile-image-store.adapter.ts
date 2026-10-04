import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import { ProfileError } from '../../domain/errors/profile.error';
import type { ActivePhoto, PendingPhoto, ProfileImageStorePort, SignedUploadGrant, VerifiedProfileImage } from '../../domain/ports/outbound/profile-media.ports';

const ALLOWED_FORMATS = new Set(['jpg', 'png', 'webp']);
const sign = (params: Record<string, string | number>, secret: string) => createHash('sha1').update(`${Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&')}${secret}`).digest('hex');

export function createSignedCloudinaryDeliveryUrl(input: {
  cloudName: string;
  secret: string;
  publicId: string;
  version: number;
  size: 128 | 512;
}): string {
  const transformation = `c_fill,g_auto,h_${input.size},w_${input.size}/pg_1/f_webp,q_auto/fl_force_strip`;
  const signature = createHash('sha1')
    .update(`${transformation}/v${input.version}/${input.publicId}.webp${input.secret}`)
    .digest('base64url')
    .slice(0, 8);
  return `https://res.cloudinary.com/${input.cloudName}/image/authenticated/s--${signature}--/${transformation}/v${input.version}/${input.publicId}.webp`;
}

@Injectable()
export class CloudinaryProfileImageStoreAdapter implements ProfileImageStorePort {
  readonly provider = 'cloudinary' as const;
  private readonly cloudName: string; private readonly apiKey: string; private readonly secret: string; private readonly preset: string; private readonly maxBytes: number;
  constructor(config: ConfigService<BackendEnv, true>) {
    this.cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME') ?? '';
    this.apiKey = config.get<string>('CLOUDINARY_API_KEY') ?? '';
    this.secret = config.get<string>('CLOUDINARY_API_SECRET') ?? '';
    this.preset = config.get<string>('CLOUDINARY_PROFILE_UPLOAD_PRESET') ?? '';
    this.maxBytes = config.getOrThrow<number>('PROFILE_PHOTO_MAX_BYTES');
  }
  async createSignedUpload(input: { uploadId: string; publicId: string; expiresAt: Date }): Promise<SignedUploadGrant> {
    this.assertConfigured();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = sign({ public_id: input.publicId, timestamp, type: 'authenticated', upload_preset: this.preset }, this.secret);
    return { uploadId: input.uploadId, uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`, cloudName: this.cloudName, apiKey: this.apiKey, publicId: input.publicId, timestamp, expiresAt: input.expiresAt, uploadPreset: this.preset, signature };
  }
  async verifyUploaded(input: { pending: PendingPhoto; providerResponse: Record<string, unknown> }): Promise<VerifiedProfileImage> {
    this.assertConfigured();
    const response = input.providerResponse;
    const publicId = typeof response.public_id === 'string' ? response.public_id : '';
    const providerSignature = typeof response.signature === 'string' ? response.signature : '';
    const version = typeof response.version === 'number' ? response.version : 0;
    const expected = createHash('sha1').update(`public_id=${publicId}&version=${version}${this.secret}`).digest('hex');
    const actualBuffer = Buffer.from(providerSignature); const expectedBuffer = Buffer.from(expected);
    if (publicId !== input.pending.publicId || actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) throw new ProfileError('PHOTO_REJECTED');
    const format = response.format; const bytes = response.bytes; const width = response.width; const height = response.height; const assetId = response.asset_id;
    if (typeof format !== 'string' || !ALLOWED_FORMATS.has(format) || typeof bytes !== 'number' || bytes > this.maxBytes || typeof width !== 'number' || typeof height !== 'number' || width < 320 || height < 320 || typeof assetId !== 'string') throw new ProfileError('PHOTO_REJECTED');
    const authoritative = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/resources/${encodeURIComponent(assetId)}`, { headers: { authorization: `Basic ${Buffer.from(`${this.apiKey}:${this.secret}`).toString('base64')}` }, signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (!authoritative?.ok) throw new ProfileError('MEDIA_UNAVAILABLE');
    const resource = await authoritative.json() as Record<string, unknown>;
    const pages = resource.pages;
    if (resource.public_id !== publicId || resource.asset_id !== assetId || resource.version !== version || resource.format !== format || resource.bytes !== bytes || resource.width !== width || resource.height !== height || resource.type !== 'authenticated' || (pages !== undefined && pages !== 1)) throw new ProfileError('PHOTO_REJECTED');
    return { providerAssetId: assetId, publicId, version, format: format as VerifiedProfileImage['format'], bytes, width, height };
  }
  async createSignedDelivery(input: ActivePhoto): Promise<{ url: string }> {
    this.assertConfigured();
    return {
      url: createSignedCloudinaryDeliveryUrl({
        cloudName: this.cloudName,
        secret: this.secret,
        publicId: input.publicId,
        version: input.version,
        size: 512,
      }),
    };
  }
  async delete(publicId: string): Promise<'deleted' | 'already_absent'> {
    this.assertConfigured();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = sign({ public_id: publicId, timestamp, type: 'authenticated' }, this.secret);
    const body = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), type: 'authenticated', api_key: this.apiKey, signature });
    const result = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`, { method: 'POST', body, signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (!result?.ok) throw new ProfileError('MEDIA_UNAVAILABLE');
    const value = await result.json() as { result?: string };
    return value.result === 'not found' ? 'already_absent' : 'deleted';
  }
  private assertConfigured(): void { if (!this.cloudName || !this.apiKey || !this.secret || !this.preset) throw new ProfileError('MEDIA_UNAVAILABLE'); }
}
