import type { TransactionContext } from '../../../../shared/application/ports/unit-of-work.port';
import type { Event } from '../entities/event';
import type { ExactLocation } from '../value-objects/event-location';

export const EVENT_REPOSITORY_PORT = Symbol('EVENT_REPOSITORY_PORT');

export type EventRecord = Readonly<{ event: Event; exactLocation: ExactLocation | null }>;

export interface EventRepositoryPort {
  findByIdForOwner(context: TransactionContext, eventId: string, hostAccountId: string): Promise<EventRecord | null>;
  findByIdForOwnerWithoutExact(context: TransactionContext, eventId: string, hostAccountId: string): Promise<EventRecord | null>;
  findByIdPublic(context: TransactionContext, eventId: string): Promise<EventRecord | null>;
  insert(context: TransactionContext, event: Event, exactLocation: ExactLocation | null): Promise<void>;
  saveIfRevision(context: TransactionContext, event: Event, expectedRevision: number, exactLocation: ExactLocation | null): Promise<'updated' | 'conflict'>;
}
