import { useRef, useState } from 'react';
import type { z } from 'zod';

import { type ApiCall, type ApiResult, callRegistrationApi, newIdempotencyKey } from './api-client';

type Attempt = { key: string; fingerprint: string };

/** Digest of the logical attempt, so a retained fingerprint never holds a password in clear. */
async function fingerprintOf(call: Omit<ApiCall, 'idempotencyKey'>): Promise<string> {
  const text = `${call.method} ${call.path} ${JSON.stringify(call.body ?? null)}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * One logical mutation: blocks double submit, never retries by itself, and reuses the idempotency
 * key (memory only) solely while the previous outcome is unknown and the payload is unchanged.
 */
export function useCommand() {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const uncertain = useRef<Attempt | null>(null);

  async function run<T>(call: Omit<ApiCall, 'idempotencyKey'>, schema: z.ZodType<T>): Promise<ApiResult<T> | null> {
    if (inFlight.current) return null;
    inFlight.current = true;
    setPending(true);
    try {
      const fingerprint = await fingerprintOf(call);
      const key = uncertain.current?.fingerprint === fingerprint ? uncertain.current.key : newIdempotencyKey();
      const result = await callRegistrationApi({ ...call, idempotencyKey: key }, schema);
      uncertain.current = result.kind === 'failed' ? { key, fingerprint } : null;
      return result;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return { pending, run };
}
