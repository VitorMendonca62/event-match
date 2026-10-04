/** @format */

import type { TransactionContext } from '../../../../../shared/application/ports/unit-of-work.port';

export const PROFILE_IMAGE_STORE_PORT = Symbol('PROFILE_IMAGE_STORE_PORT');
export const PROFILE_MEDIA_REPOSITORY_PORT = Symbol('PROFILE_MEDIA_REPOSITORY_PORT');

export type PendingPhoto = Readonly<{
  id: string;
  accountId: string;
  publicId: string;
  expiresAt: Date;
}>;
export type ActivePhoto = Readonly<{ id: string; publicId: string; version: number }>;
export type VerifiedProfileImage = Readonly<{
  providerAssetId: string;
  publicId: string;
  version: number;
  format: 'jpg' | 'png' | 'webp';
  bytes: number;
  width: number;
  height: number;
}>;
export type SignedUploadGrant = Readonly<{
  uploadId: string;
  uploadUrl: string;
  cloudName: string;
  apiKey: string;
  publicId: string;
  timestamp: number;
  expiresAt: Date;
  uploadPreset: string;
  signature: string;
}>;

export interface ProfileImageStorePort {
  readonly provider: 'cloudinary' | 'fake';
  createSignedUpload(input: {
    uploadId: string;
    publicId: string;
    expiresAt: Date;
  }): Promise<SignedUploadGrant>;
  verifyUploaded(input: {
    pending: PendingPhoto;
    providerResponse: Record<string, unknown>;
  }): Promise<VerifiedProfileImage>;
  createSignedDelivery(input: ActivePhoto): Promise<{ url: string }>;
  delete(publicId: string): Promise<'deleted' | 'already_absent'>;
}

export interface ProfileMediaRepositoryPort {
  consumeLimit(
    context: TransactionContext,
    input: {
      accountSubject: Buffer;
      originSubject: Buffer;
      now: Date;
      accountLimit: number;
      originLimit: number;
    },
  ): Promise<'allowed' | 'account_limited' | 'origin_limited'>;
  createPending(context: TransactionContext, input: PendingPhoto): Promise<void>;
  findPending(
    context: TransactionContext,
    accountId: string,
    uploadId: string,
  ): Promise<PendingPhoto | null>;
  findActive(context: TransactionContext, accountId: string): Promise<ActivePhoto | null>;
  activate(
    context: TransactionContext,
    input: {
      accountId: string;
      uploadId: string;
      expectedRevision: number;
      image: VerifiedProfileImage;
      now: Date;
    },
  ): Promise<'activated' | 'conflict' | 'expired'>;
  removeActive(
    context: TransactionContext,
    accountId: string,
    expectedRevision: number,
    now: Date,
  ): Promise<'marked' | 'absent' | 'conflict'>;
  listCleanup(
    context: TransactionContext,
    now: Date,
    limit: number,
  ): Promise<readonly { id: string; publicId: string }[]>;
  cleanupSucceeded(context: TransactionContext, id: string): Promise<void>;
  cleanupFailed(context: TransactionContext, id: string, now: Date): Promise<void>;
}
