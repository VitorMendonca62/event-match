import { z } from 'zod';

const STORAGE_KEY = 'eventmatch:event-draft-reference:v1';
const REFERENCE_TTL_MS = 30 * 60 * 1000;

const eventDraftReferenceSchema = z.strictObject({
  version: z.literal(1),
  eventId: z.uuid(),
  touchedAt: z.number().int().nonnegative(),
});

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function removeReference(storage: SessionStorageLike): void {
  try { storage.removeItem(STORAGE_KEY); } catch { /* Session storage is optional. */ }
}

/** Store only a versioned draft UUID in sessionStorage; event content and coordinates stay remote. */
export function saveEventDraftReference(storage: SessionStorageLike | undefined, eventId: string, now = Date.now()): boolean {
  if (!storage) return false;
  const reference = eventDraftReferenceSchema.safeParse({ version: 1, eventId, touchedAt: now });
  if (!reference.success) {
    removeReference(storage);
    return false;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(reference.data));
    return true;
  } catch {
    return false;
  }
}

/** Return a valid draft UUID and renew its sliding 30 minute session TTL. */
export function readEventDraftReference(storage: SessionStorageLike | undefined, now = Date.now()): string | undefined {
  if (!storage) return undefined;
  let raw: string | null;
  try { raw = storage.getItem(STORAGE_KEY); } catch { return undefined; }
  if (raw === null) return undefined;

  let value: unknown;
  try { value = JSON.parse(raw); } catch {
    removeReference(storage);
    return undefined;
  }
  const parsed = eventDraftReferenceSchema.safeParse(value);
  if (!parsed.success || parsed.data.touchedAt > now || now - parsed.data.touchedAt >= REFERENCE_TTL_MS) {
    removeReference(storage);
    return undefined;
  }

  saveEventDraftReference(storage, parsed.data.eventId, now);
  return parsed.data.eventId;
}

/** Pure snapshot for React subscriptions; unlike `read`, this never renews the sliding TTL. */
export function getEventDraftReference(storage: SessionStorageLike | undefined, now = Date.now()): string | undefined {
  if (!storage) return undefined;
  let raw: string | null;
  try { raw = storage.getItem(STORAGE_KEY); } catch { return undefined; }
  if (raw === null) return undefined;
  try {
    const parsed = eventDraftReferenceSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.touchedAt > now || now - parsed.data.touchedAt >= REFERENCE_TTL_MS) return undefined;
    return parsed.data.eventId;
  } catch {
    return undefined;
  }
}

export function clearEventDraftReference(storage: SessionStorageLike | undefined): void {
  if (storage) removeReference(storage);
}
