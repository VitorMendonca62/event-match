import { z } from 'zod';

import { DISPLAY_NAME_MAX, USAGE_INTENTS } from './contracts';
import { STEPS } from './flow-machine';

/**
 * Minimal local progress (ADR-011, `client-localstorage-schema`): versioned, parsed with Zod,
 * allowlisted and expiring after 30 minutes of inactivity. Contact, OTP, passwords, birth date,
 * tokens, document ids, idempotency keys and backend responses are never written.
 */
export const DRAFT_STORAGE_KEY = 'eventmatch.registration';
export const DRAFT_TTL_MS = 30 * 60 * 1000;

const LOCAL_STEPS = ['intro', ...STEPS] as const;

export const registrationDraftSchema = z.strictObject({
  schemaVersion: z.literal(1),
  touchedAt: z.iso.datetime(),
  localStep: z.enum(LOCAL_STEPS),
  displayName: z.string().max(DISPLAY_NAME_MAX).optional(),
  ufCode: z.string().max(2).optional(),
  municipalityCode: z.string().max(7).optional(),
  municipalityName: z.string().max(120).optional(),
  usageIntents: z.array(z.enum(USAGE_INTENTS)).max(USAGE_INTENTS.length).optional(),
  interestIds: z.array(z.uuid()).max(50).optional(),
});

export type RegistrationDraft = z.infer<typeof registrationDraftSchema>;
export type DraftPatch = Partial<Omit<RegistrationDraft, 'schemaVersion' | 'touchedAt'>>;

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function clearDraft(storage: DraftStorage | undefined): void {
  try {
    storage?.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private mode, quota); progress simply is not kept.
  }
}

export function readDraft(storage: DraftStorage | undefined, now: Date): RegistrationDraft | undefined {
  let raw: string | null | undefined;
  try {
    raw = storage?.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (!raw) return undefined;

  let parsed: ReturnType<typeof registrationDraftSchema.safeParse>;
  try {
    parsed = registrationDraftSchema.safeParse(JSON.parse(raw));
  } catch {
    clearDraft(storage);
    return undefined;
  }
  if (!parsed.success || now.getTime() - Date.parse(parsed.data.touchedAt) > DRAFT_TTL_MS) {
    clearDraft(storage);
    return undefined;
  }
  return parsed.data;
}

/** Merges an allowlisted patch and renews `touchedAt` (sliding TTL). Unknown keys are dropped. */
export function writeDraft(storage: DraftStorage | undefined, patch: DraftPatch, now: Date): RegistrationDraft | undefined {
  const current = readDraft(storage, now);
  const candidate = registrationDraftSchema.safeParse({
    localStep: current?.localStep ?? 'intro',
    ...(current ? pickAllowed(current) : {}),
    ...pickAllowed(patch),
    schemaVersion: 1,
    touchedAt: now.toISOString(),
  });
  if (!candidate.success) return current;
  try {
    storage?.setItem(DRAFT_STORAGE_KEY, JSON.stringify(candidate.data));
  } catch {
    return current;
  }
  return candidate.data;
}

function pickAllowed(source: DraftPatch): DraftPatch {
  const allowed: DraftPatch = {};
  if (source.localStep !== undefined) allowed.localStep = source.localStep;
  if (source.displayName !== undefined) allowed.displayName = source.displayName;
  if (source.ufCode !== undefined) allowed.ufCode = source.ufCode;
  if (source.municipalityCode !== undefined) allowed.municipalityCode = source.municipalityCode;
  if (source.municipalityName !== undefined) allowed.municipalityName = source.municipalityName;
  if (source.usageIntents !== undefined) allowed.usageIntents = source.usageIntents;
  if (source.interestIds !== undefined) allowed.interestIds = source.interestIds;
  return allowed;
}

export function browserSessionStorage(): DraftStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}
