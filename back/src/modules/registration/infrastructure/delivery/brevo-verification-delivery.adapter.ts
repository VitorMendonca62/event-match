import { BrevoClient, BrevoError, BrevoTimeoutError } from '@getbrevo/brevo';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import {
  CONTACT_PROTECTOR_PORT,
  type ContactProtectorPort,
  type VerificationDeliveryPort,
  type VerificationDeliveryRequest,
} from '../../domain/ports/outbound/security.ports';
import { REGISTRATION_POLICY } from '../../domain/value-objects/verification-policy';
import {
  buildEmailLink,
  renderRecoveryNoticeEmail,
  renderVerificationEmail,
  type RenderedEmail,
} from './verification-email.template';

export const BREVO_DELIVERY_OPTIONS = Symbol('BREVO_DELIVERY_OPTIONS');

/** ADR-010/ADR-024/ADR-026 limits; overridable only so contract tests do not wait real seconds. */
export interface BrevoDeliveryOptions {
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly maxRetryAfterMs: number;
  readonly backoffMs: number;
  readonly sleep: (milliseconds: number) => Promise<void>;
  readonly fetch?: typeof fetch;
}

export const DEFAULT_BREVO_DELIVERY_OPTIONS: BrevoDeliveryOptions = Object.freeze({
  timeoutMs: 5_000,
  maxRetries: 2,
  maxRetryAfterMs: 5_000,
  backoffMs: 250,
  sleep: (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
});

type Attempt = { kind: 'accepted' } | { kind: 'definitive' } | { kind: 'transient'; retryAfterMs: number | null };
type BrevoSender = { readonly email: string; readonly name?: string };
const BREVO_IDEMPOTENCY_NAMESPACE = Buffer.from('0f014b5c995d5c3b8f9886b710d4f442', 'hex');

/**
 * Transactional e-mail delivery through the official Brevo SDK (ADR-026). The SDK is confined to
 * this infrastructure adapter. Automatic SDK retries are disabled so the application has one
 * auditable policy: a cancellable 5 s timeout and at most two retries for network failures, 408,
 * 429 and 5xx, always with the same provider `headers.idempotencyKey`. Other HTTP errors are
 * definitive.
 */
@Injectable()
export class BrevoVerificationDeliveryAdapter implements VerificationDeliveryPort {
  private readonly client: BrevoClient;
  private readonly sender: BrevoSender;
  private readonly frontendPublicUrl: string;
  private readonly options: BrevoDeliveryOptions;

  constructor(
    config: ConfigService<BackendEnv, true>,
    @Inject(CONTACT_PROTECTOR_PORT) private readonly contacts: ContactProtectorPort,
    @Optional() @Inject(BREVO_DELIVERY_OPTIONS) options?: Partial<BrevoDeliveryOptions>,
  ) {
    this.options = { ...DEFAULT_BREVO_DELIVERY_OPTIONS, ...options };
    this.client = new BrevoClient({
      apiKey: config.getOrThrow<string>('BREVO_API_KEY'),
      // baseUrl: config.getOrThrow<string>('BREVO_BASE_URL'),
      maxRetries: 0,
      timeoutInSeconds: this.options.timeoutMs / 1_000,
      ...(this.options.fetch ? { fetch: this.options.fetch } : {}),
    });
    this.sender = parseSender(config.getOrThrow<string>('EMAIL_FROM'));
    this.frontendPublicUrl = config.getOrThrow<string>('FRONTEND_PUBLIC_URL');
  }

  async send(request: VerificationDeliveryRequest): Promise<{ accepted: boolean }> {
    // WhatsApp is not published in this version (ADR-025); never pretend it was delivered.
    if (request.channel !== 'email') return { accepted: false };

    const to = this.contacts.open(request.channel, request.sealedContact).value;
    const email = this.render(request);
    for (let attempt = 0; ; attempt += 1) {
      const result = await this.attempt(to, email, request.idempotencyKey);
      if (result.kind === 'accepted') return { accepted: true };
      if (result.kind === 'definitive' || attempt >= this.options.maxRetries) return { accepted: false };
      await this.options.sleep(result.retryAfterMs ?? this.options.backoffMs * 2 ** attempt);
    }
  }

  private render(request: VerificationDeliveryRequest): RenderedEmail {
    if (request.kind === 'recovery_notice') return renderRecoveryNoticeEmail();
    return renderVerificationEmail({
      otp: request.otp,
      link: request.linkToken ? buildEmailLink(this.frontendPublicUrl, request.linkToken) : null,
      ttlMinutes: REGISTRATION_POLICY.otpTtlMs / 60_000,
    });
  }

  private async attempt(to: string, email: RenderedEmail, idempotencyKey: string): Promise<Attempt> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      await this.client.transactionalEmails.sendTransacEmail(
        {
          sender: this.sender,
          to: [{ email: to }],
          subject: email.subject,
          htmlContent: email.html,
          textContent: email.text,
          headers: { idempotencyKey: toBrevoIdempotencyKey(idempotencyKey) },
        },
        {
          abortSignal: controller.signal,
          maxRetries: 0,
          timeoutInSeconds: this.options.timeoutMs / 1_000,
        },
      );
      return { kind: 'accepted' };
    } catch (error) {
      if (controller.signal.aborted || error instanceof BrevoTimeoutError) {
        return { kind: 'transient', retryAfterMs: null };
      }
      if (!(error instanceof BrevoError)) return { kind: 'definitive' };

      const status = error.statusCode;
      if (status === 429) {
        return { kind: 'transient', retryAfterMs: this.retryAfter(error.rawResponse?.headers) };
      }
      if (status === undefined || status === 408 || status >= 500) {
        return { kind: 'transient', retryAfterMs: null };
      }
      return { kind: 'definitive' };
    } finally {
      clearTimeout(timer);
    }
  }

  /** `Retry-After` in seconds, capped so a provider cannot stall the request thread. */
  private retryAfter(headers: Headers | undefined): number | null {
    const seconds = Number(headers?.get('retry-after'));
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return Math.min(seconds * 1_000, this.options.maxRetryAfterMs);
  }
}

function parseSender(value: string): BrevoSender {
  const formatted = /^(.*?)\s*<([^<>]+)>$/.exec(value);
  if (!formatted) return { email: value };

  const [, rawName = '', email = ''] = formatted;
  const name = rawName.trim().replace(/^(["'])(.*)\1$/, '$2').trim();
  return name ? { email: email.trim(), name } : { email: email.trim() };
}

/** Brevo requires its idempotency value to be a UUID, while resend commands use composed keys. */
function toBrevoIdempotencyKey(value: string): string {
  const bytes = Buffer.from(
    createHash('sha1').update(BREVO_IDEMPOTENCY_NAMESPACE).update(value, 'utf8').digest().subarray(0, 16),
  );
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
