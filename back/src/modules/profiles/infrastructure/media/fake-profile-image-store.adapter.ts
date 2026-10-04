import { Injectable } from '@nestjs/common';
import { ProfileError } from '../../domain/errors/profile.error';
import type { ActivePhoto, PendingPhoto, ProfileImageStorePort, SignedUploadGrant, VerifiedProfileImage } from '../../domain/ports/outbound/profile-media.ports';

/** Deterministic test adapter. Composition refuses it outside NODE_ENV=test. */
@Injectable()
export class FakeProfileImageStoreAdapter implements ProfileImageStorePort {
  readonly provider = 'fake' as const;
  createSignedUpload(input: { uploadId: string; publicId: string; expiresAt: Date }): Promise<SignedUploadGrant> {
    return Promise.resolve({ uploadId: input.uploadId, uploadUrl: 'https://api.cloudinary.com/v1_1/fixture/image/upload', cloudName: 'fixture', apiKey: 'fixture-public-key', publicId: input.publicId, timestamp: 1_700_000_000, expiresAt: input.expiresAt, uploadPreset: 'fixture-signed', signature: 'fixture-signature' });
  }
  verifyUploaded(input: { pending: PendingPhoto; providerResponse: Record<string, unknown> }): Promise<VerifiedProfileImage> {
    if (input.providerResponse.public_id !== input.pending.publicId || input.providerResponse.signature !== 'fixture-response-signature') throw new ProfileError('PHOTO_REJECTED');
    return Promise.resolve({ providerAssetId: `fixture-${input.pending.id}`, publicId: input.pending.publicId, version: 1, format: 'webp', bytes: 1024, width: 512, height: 512 });
  }
  createSignedDelivery(input: ActivePhoto) { return Promise.resolve({ url: `https://media.example.test/${encodeURIComponent(input.publicId)}.webp` }); }
  delete(publicId: string): Promise<'deleted'> { void publicId; return Promise.resolve('deleted'); }
}
