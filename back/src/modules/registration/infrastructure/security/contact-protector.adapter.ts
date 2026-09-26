import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import type { ContactIdentifier } from '../../domain/value-objects/contact-identifier';
import { ContactIdentifier as Contact } from '../../domain/value-objects/contact-identifier';
import type { ContactProtectorPort, SealedContact } from '../../domain/ports/outbound/security.ports';

@Injectable()
export class ContactProtectorAdapter implements ContactProtectorPort {
  private readonly hashKey: Buffer;
  private readonly encryptionKey: Buffer;
  constructor(config: ConfigService<BackendEnv, true>) {
    this.hashKey = Buffer.from(config.getOrThrow<string>('CONTACT_HASH_KEY'), 'base64');
    this.encryptionKey = Buffer.from(config.getOrThrow<string>('CONTACT_ENCRYPTION_KEY'), 'base64');
  }
  blindIndex(contact: ContactIdentifier): Buffer {
    return createHmac('sha256', this.hashKey).update(`contact:${contact.channel}:${contact.value}`).digest();
  }
  seal(contact: ContactIdentifier): SealedContact {
    const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, nonce);
    const ciphertext = Buffer.concat([cipher.update(contact.value, 'utf8'), cipher.final()]);
    return { ciphertext: Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]), keyVersion: 1 };
  }
  open(channel: ContactIdentifier['channel'], sealed: SealedContact): ContactIdentifier {
    if (sealed.keyVersion !== 1 || sealed.ciphertext.length < 29) throw new Error('Unable to open protected contact.');
    const nonce = sealed.ciphertext.subarray(0, 12); const tag = sealed.ciphertext.subarray(12, 28);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, nonce); decipher.setAuthTag(tag);
    return Contact.create(channel, Buffer.concat([decipher.update(sealed.ciphertext.subarray(28)), decipher.final()]).toString('utf8'));
  }
}
