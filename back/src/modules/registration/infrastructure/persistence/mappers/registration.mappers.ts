import { Account, type AccountStatus } from '../../../domain/entities/account';
import {
  ContactVerification,
  type ContactVerificationStatus,
} from '../../../domain/entities/contact-verification';
import { Registration, type RegistrationStatus } from '../../../domain/entities/registration';
import { BirthDate } from '../../../domain/value-objects/birth-date';
import type { ContactChannel } from '../../../domain/value-objects/contact-identifier';
import type { account, contactVerification, registration } from '../schema/registration.schema';

export type ContactVerificationRow = typeof contactVerification.$inferSelect;
export type RegistrationRow = typeof registration.$inferSelect;
export type AccountRow = typeof account.$inferSelect;

/** Row types stay inside infrastructure; only domain objects leave the adapters. */
export const verificationMapper = {
  toDomain(row: ContactVerificationRow): ContactVerification {
    return ContactVerification.restore({
      id: row.id,
      channel: row.channel as ContactChannel,
      contactHash: row.contactHash,
      contactCiphertext: row.contactCiphertext,
      keyVersion: row.keyVersion,
      otpDigest: row.otpDigest,
      expiresAt: row.expiresAt,
      deliveryIdempotencyKey: row.deliveryIdempotencyKey,
      lastSentAt: row.lastSentAt,
      whatsappConsentAt: row.whatsappConsentAt,
      status: row.status as ContactVerificationStatus,
      failedAttempts: row.failedAttempts,
      resendCount: row.resendCount,
      lockedUntil: row.lockedUntil,
      consumedAt: row.consumedAt,
    });
  },

  toRow(value: ContactVerification): Omit<ContactVerificationRow, 'createdAt' | 'updatedAt'> {
    return {
      id: value.id,
      purpose: 'registration',
      channel: value.channel,
      contactHash: value.contactHash,
      contactCiphertext: value.contactCiphertext,
      keyVersion: value.keyVersion,
      otpDigest: value.otpDigest,
      linkTokenDigest: null,
      expiresAt: value.expiresAt,
      failedAttempts: value.failedAttempts,
      lockedUntil: value.lockedUntil,
      resendCount: value.resendCount,
      lastSentAt: value.lastSentAt,
      deliveryIdempotencyKey: value.deliveryIdempotencyKey,
      whatsappConsentAt: value.whatsappConsentAt,
      consumedAt: value.consumedAt,
      status: value.status,
    };
  },
};

export const registrationMapper = {
  toDomain(row: RegistrationRow): Registration {
    const retained =
      row.contactHash && row.contactCiphertext && row.keyVersion !== null && row.passwordHash
        ? {
            contactHash: row.contactHash,
            contactCiphertext: row.contactCiphertext,
            keyVersion: row.keyVersion,
            passwordHash: row.passwordHash,
          }
        : null;
    return Registration.restore({
      id: row.id,
      verificationId: row.verificationId,
      channel: row.channel as ContactChannel,
      status: row.status as RegistrationStatus,
      retained,
      lastUpdatedAt: row.lastUpdatedAt,
      expiresAt: row.expiresAt,
      expiredAt: row.expiredAt,
    });
  },

  toRow(value: Registration): RegistrationRow {
    return {
      id: value.id,
      verificationId: value.verificationId,
      channel: value.channel,
      contactHash: value.retained?.contactHash ?? null,
      contactCiphertext: value.retained?.contactCiphertext ?? null,
      keyVersion: value.retained?.keyVersion ?? null,
      passwordHash: value.retained?.passwordHash ?? null,
      status: value.status,
      lastUpdatedAt: value.lastUpdatedAt,
      expiresAt: value.expiresAt,
      expiredAt: value.expiredAt,
    };
  },
};

export const accountMapper = {
  toDomain(row: AccountRow): Account {
    return Account.restore({
      id: row.id,
      registrationId: row.registrationId,
      status: row.status as AccountStatus,
      birthDate: row.birthDate ? BirthDate.create(row.birthDate) : null,
      lastUpdatedAt: row.lastUpdatedAt,
      activatedAt: row.activatedAt,
      expiredAt: row.expiredAt,
    });
  },

  toRow(value: Account): AccountRow {
    return {
      id: value.id,
      registrationId: value.registrationId,
      status: value.status,
      birthDate: value.birthDate?.value ?? null,
      lastUpdatedAt: value.lastUpdatedAt,
      activatedAt: value.activatedAt,
      expiredAt: value.expiredAt,
    };
  },
};
