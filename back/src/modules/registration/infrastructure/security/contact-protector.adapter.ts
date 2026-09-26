import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import type { ContactProtectorPort, SealedContact } from '../../domain/ports/outbound/security.ports';
import { ContactIdentifier, type ContactChannel } from '../../domain/value-objects/contact-identifier';

const CURRENT_KEY_VERSION = 1;
const AES_KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

/** ADR-014: HMAC-SHA-256 blind index and AES-256-GCM as `nonce || tag || ciphertext`. */
@Injectable()
export class ContactProtectorAdapter implements ContactProtectorPort {
  private readonly hashKey: Buffer;
  private readonly encryptionKey: Buffer;

  constructor(config: ConfigService<BackendEnv, true>) {
    this.hashKey = Buffer.from(config.getOrThrow<string>('CONTACT_HASH_KEY'), 'base64');
    this.encryptionKey = Buffer.from(config.getOrThrow<string>('CONTACT_ENCRYPTION_KEY'), 'base64');
    if (this.encryptionKey.length !== AES_KEY_BYTES) {
      throw new Error('CONTACT_ENCRYPTION_KEY must decode to exactly 32 bytes.');
    }
  }

  blindIndex(contact: ContactIdentifier): Buffer {
    return this.hmac(`contact:${contact.channel}:${contact.value}`);
  }

  rateLimitSubject(contact: ContactIdentifier): Buffer {
    return this.hmac(`rate:contact:${contact.channel}:${contact.value}`);
  }

  seal(contact: ContactIdentifier): SealedContact {
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, nonce);
    const ciphertext = Buffer.concat([cipher.update(contact.value, 'utf8'), cipher.final()]);
    return {
      ciphertext: Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]),
      keyVersion: CURRENT_KEY_VERSION,
    };
  }

  open(channel: ContactChannel, sealed: SealedContact): ContactIdentifier {
    if (sealed.keyVersion !== CURRENT_KEY_VERSION || sealed.ciphertext.length <= NONCE_BYTES + TAG_BYTES) {
      throw new Error('Unable to open protected contact.');
    }
    const nonce = sealed.ciphertext.subarray(0, NONCE_BYTES);
    const tag = sealed.ciphertext.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, nonce);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([
      decipher.update(sealed.ciphertext.subarray(NONCE_BYTES + TAG_BYTES)),
      decipher.final(),
    ]);
    return ContactIdentifier.create(channel, plain.toString('utf8'));
  }

  private hmac(value: string): Buffer {
    return createHmac('sha256', this.hashKey).update(value).digest();
  }
}
