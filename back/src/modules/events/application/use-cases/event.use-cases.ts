import type { TransactionContext, UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import type { MunicipalityCatalogReaderPort } from '../../../catalog/domain/ports/municipality-catalog-reader.port';
import { isUfCode, type UfCode } from '../../../catalog/domain/value-objects/location';
import type { HostEligibilityPort } from '../../../profiles/domain/ports/host-eligibility.port';
import { Event, type EventDraftPatch, type EventState } from '../../domain/entities/event';
import { EventError } from '../../domain/errors/event.error';
import type { ApproximateEventAreaProjectorPort } from '../../domain/ports/approximate-event-area-projector.port';
import type { EventActivityTypeCatalogPort, EventActivityTypeSummary } from '../../domain/ports/event-activity-type-catalog.port';
import type { EventAuditPort } from '../../domain/ports/event-audit.port';
import type { EventRepositoryPort, EventRecord } from '../../domain/ports/event-repository.port';
import type { EventTelemetryPort } from '../../domain/ports/event-telemetry.port';
import type { ExactLocationProtectorPort } from '../../domain/ports/exact-location-protector.port';
import type { HostEventLimitPort } from '../../domain/ports/host-event-limit.port';
import { isExactLocation, type ExactLocation, type EventLocation } from '../../domain/value-objects/event-location';
import type { EventDraftInput, EventOwnerDraft, PublicEventPreview } from '../contracts/event-contracts';
import { resolveLocalDateTime } from '../../domain/value-objects/local-date-time';

type EventDependencies = Readonly<{
  uow: UnitOfWorkPort;
  events: EventRepositoryPort;
  eligibility: HostEligibilityPort;
  limits: HostEventLimitPort;
  activities: EventActivityTypeCatalogPort;
  municipalities: MunicipalityCatalogReaderPort;
  exactLocations: ExactLocationProtectorPort;
  areas: ApproximateEventAreaProjectorPort;
  audit: EventAuditPort;
  telemetry: EventTelemetryPort;
}>;

function now(): Date { return new Date(); }

function changedFields(input: EventDraftInput): string[] {
  const allowlist = new Set(['activityTypeCode', 'title', 'description', 'startsAtLocal', 'endsAtLocal', 'ufCode', 'municipalityCode', 'venueType', 'nonResidentialHostDeclaration', 'exactLocation', 'capacity', 'admissionMode']);
  return Object.keys(input).filter((field) => allowlist.has(field)).sort();
}

async function activityFor(context: TransactionContext, activities: EventActivityTypeCatalogPort, code: string | null, requireActive = true): Promise<EventActivityTypeSummary | null> {
  if (!code) return null;
  const found = await activities.findByCode(context, code);
  if (!found || (requireActive && !found.active)) throw new EventError('INACTIVE_ACTIVITY_TYPE', 'inactive_activity_type');
  return found;
}

function exactFromInput(input: EventDraftInput, current: ExactLocation | null): ExactLocation | null {
  if (input.exactLocation === undefined) return current;
  if (input.exactLocation === null) return null;
  if (!isExactLocation(input.exactLocation)) throw new EventError('INVALID_LOCATION', 'invalid_location');
  return input.exactLocation;
}

async function resolveLocation(
  context: TransactionContext,
  municipalities: MunicipalityCatalogReaderPort,
  current: EventState['location'],
  input: EventDraftInput,
): Promise<{ location: EventLocation | null; changed: boolean }> {
  const touched = input.ufCode !== undefined || input.municipalityCode !== undefined;
  if (!touched) return { location: current, changed: false };
  if (!input.ufCode || !input.municipalityCode || !isUfCode(input.ufCode)) throw new EventError('INVALID_LOCATION', 'invalid_location');
  const found = await municipalities.findByCodeAndUf(context, { ufCode: input.ufCode as UfCode, municipalityCode: input.municipalityCode });
  if (!found || !found.timeZone || !found.active) throw new EventError('INVALID_LOCATION', 'invalid_location');
  return {
    changed: true,
    location: { ufCode: found.ufCode, municipalityCode: found.municipalityCode, municipalityName: found.municipalityName, timeZone: found.timeZone },
  };
}

async function patchFor(
  context: Parameters<UnitOfWorkPort['execute']>[0] extends (context: infer T) => Promise<unknown> ? T : never,
  dependencies: Pick<EventDependencies, 'activities' | 'municipalities'>,
  current: EventState,
  input: EventDraftInput,
): Promise<{ patch: EventDraftPatch; activity: EventActivityTypeSummary | null }> {
  const { location, changed: locationChanged } = await resolveLocation(context, dependencies.municipalities, current.location, input);
  const effectiveLocation = location;
  const startsAtLocal = input.startsAtLocal === undefined ? current.startsAtLocal : input.startsAtLocal;
  const endsAtLocal = input.endsAtLocal === undefined ? current.endsAtLocal : input.endsAtLocal;
  let startsAt = current.startsAt;
  let endsAt = current.endsAt;

  if (startsAtLocal !== null && startsAtLocal !== undefined) {
    if (!effectiveLocation?.timeZone) throw new EventError('INVALID_LOCATION', 'invalid_location');
    startsAt = resolveLocalDateTime(startsAtLocal, effectiveLocation.timeZone);
  } else {
    startsAt = null;
  }
  if (endsAtLocal !== null && endsAtLocal !== undefined) {
    if (!effectiveLocation?.timeZone) throw new EventError('INVALID_LOCATION', 'invalid_location');
    endsAt = resolveLocalDateTime(endsAtLocal, effectiveLocation.timeZone);
  } else {
    endsAt = null;
  }

  const activityCode = input.activityTypeCode === undefined ? current.activityTypeCode : input.activityTypeCode;
  const activityChange = input.activityTypeCode !== undefined && input.activityTypeCode !== current.activityTypeCode;
  const activity = await activityFor(context, dependencies.activities, activityCode ?? null, current.activityTypeCode === null || activityChange);
  const patch: EventDraftPatch = {
    ...(input.activityTypeCode !== undefined ? { activityTypeCode: input.activityTypeCode } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.startsAtLocal !== undefined || locationChanged ? { startsAtLocal: startsAtLocal ?? null, startsAt } : {}),
    ...(input.endsAtLocal !== undefined || locationChanged || input.startsAtLocal !== undefined ? { endsAtLocal: endsAtLocal ?? null, endsAt } : {}),
    ...(locationChanged ? { location } : {}),
    ...(input.venueType !== undefined ? { venueType: input.venueType } : {}),
    ...(input.nonResidentialHostDeclaration !== undefined ? { nonResidentialHostDeclaration: input.nonResidentialHostDeclaration } : {}),
    ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
    ...(input.admissionMode !== undefined ? { admissionMode: input.admissionMode } : {}),
  };
  return { patch, activity };
}

function ownerProjection(record: EventRecord, activity: EventActivityTypeSummary | null): EventOwnerDraft {
  const state = record.event.snapshot();
  return {
    id: state.id, revision: state.revision, status: state.status,
    activityType: activity ? { code: activity.code, label: activity.label } : null,
    title: state.title, description: state.description, startsAtLocal: state.startsAtLocal, endsAtLocal: state.endsAtLocal,
    startsAt: state.startsAt?.toISOString() ?? null, endsAt: state.endsAt?.toISOString() ?? null, timeZone: state.location?.timeZone ?? null,
    location: state.location ? { ufCode: state.location.ufCode, municipalityCode: state.location.municipalityCode, municipalityName: state.location.municipalityName } : null,
    venueType: state.venueType, nonResidentialHostDeclaration: state.nonResidentialHostDeclaration, exactLocation: record.exactLocation,
    capacity: state.capacity, admissionMode: state.admissionMode, official: false,
  };
}

function publicProjection(record: EventRecord, activity: EventActivityTypeSummary, area: Readonly<{ latitude: number; longitude: number; radiusMeters: number }>): PublicEventPreview {
  const state = record.event.snapshot();
  if (!state.location || !state.title || !state.description || !state.startsAt || !state.capacity || !state.startsAtLocal) throw new EventError('EVENT_NOT_READY', 'event_not_ready');
  if (state.status !== 'draft' && state.status !== 'published_open') throw new EventError('EVENT_NOT_READY', 'event_not_ready');
  return {
    id: state.id, activityType: { code: activity.code, label: activity.label }, title: state.title, description: state.description,
    startsAt: state.startsAt.toISOString(), endsAt: state.endsAt?.toISOString() ?? null, timeZone: state.location.timeZone,
    location: { ufCode: state.location.ufCode, municipalityCode: state.location.municipalityCode, municipalityName: state.location.municipalityName, approximateArea: area },
    capacity: state.capacity, admissionMode: state.admissionMode, status: state.status,
  };
}

function recordError(telemetry: EventTelemetryPort, name: 'draft.create' | 'draft.read' | 'draft.update' | 'draft.preview' | 'event.publish', error: unknown): void {
  telemetry.record({ name, outcome: error instanceof EventError && (error.code === 'EVENT_REVISION_CONFLICT' || error.code === 'EVENT_LIMIT_REACHED') ? 'conflict' : 'rejected', correlationId: crypto.randomUUID() });
}

export class CreateEventDraft {
  private readonly dependencies: EventDependencies;
  constructor(uow: UnitOfWorkPort, events: EventRepositoryPort, eligibility: HostEligibilityPort, limits: HostEventLimitPort, activities: EventActivityTypeCatalogPort, municipalities: MunicipalityCatalogReaderPort, exactLocations: ExactLocationProtectorPort, areas: ApproximateEventAreaProjectorPort, audit: EventAuditPort, telemetry: EventTelemetryPort) {
    this.dependencies = { uow, events, eligibility, limits, activities, municipalities, exactLocations, areas, audit, telemetry };
  }

  async execute(input: Readonly<{ hostAccountId: string } & EventDraftInput>): Promise<EventOwnerDraft> {
    try {
      const result = await this.dependencies.uow.execute(async (context) => {
        if (!(await this.dependencies.eligibility.isEligible(context, input.hostAccountId))) throw new EventError('HOST_NOT_ELIGIBLE');
        const limit = await this.dependencies.limits.lockAndCount(context, { hostAccountId: input.hostAccountId, now: now() });
        if (limit.futureActive) throw new EventError('EVENT_LIMIT_REACHED', 'event_limit_reached');
        const event = Event.create(crypto.randomUUID(), input.hostAccountId, now());
        const resolved = await patchFor(context, this.dependencies, event.snapshot(), input);
        const exact = input.exactLocation === undefined ? null : exactFromInput(input, null);
        const updated = event.updateDraft({ ...resolved.patch, approximateArea: exact ? this.dependencies.areas.project(event.snapshot().id, exact) : null }, now());
        await this.dependencies.events.insert(context, updated, exact);
        await this.dependencies.audit.record(context, { eventId: updated.snapshot().id, actorAccountId: input.hostAccountId, action: 'draft_created', changedFields: changedFields(input), correlationId: crypto.randomUUID() });
        const record: EventRecord = { event: updated, exactLocation: exact };
        return { record, activity: resolved.activity };
      });
      this.dependencies.telemetry.record({ name: 'draft.create', outcome: 'success', correlationId: crypto.randomUUID() });
      return ownerProjection(result.record, result.activity);
    } catch (error) { recordError(this.dependencies.telemetry, 'draft.create', error); throw error; }
  }
}

export class GetEventDraft {
  private readonly dependencies: EventDependencies;
  constructor(uow: UnitOfWorkPort, events: EventRepositoryPort, eligibility: HostEligibilityPort, limits: HostEventLimitPort, activities: EventActivityTypeCatalogPort, municipalities: MunicipalityCatalogReaderPort, exactLocations: ExactLocationProtectorPort, areas: ApproximateEventAreaProjectorPort, audit: EventAuditPort, telemetry: EventTelemetryPort) {
    this.dependencies = { uow, events, eligibility, limits, activities, municipalities, exactLocations, areas, audit, telemetry };
  }

  async execute(input: Readonly<{ hostAccountId: string; eventId: string }>): Promise<EventOwnerDraft> {
    try {
      const result = await this.dependencies.uow.execute(async (context) => {
        const record = await this.dependencies.events.findByIdForOwner(context, input.eventId, input.hostAccountId);
        if (!record) throw new EventError('EVENT_NOT_FOUND');
        return { record, activity: await activityFor(context, this.dependencies.activities, record.event.snapshot().activityTypeCode, false) };
      });
      this.dependencies.telemetry.record({ name: 'draft.read', outcome: 'success', correlationId: crypto.randomUUID() });
      return ownerProjection(result.record, result.activity);
    } catch (error) { recordError(this.dependencies.telemetry, 'draft.read', error); throw error; }
  }
}

export class UpdateEventDraft {
  private readonly dependencies: EventDependencies;
  constructor(uow: UnitOfWorkPort, events: EventRepositoryPort, eligibility: HostEligibilityPort, limits: HostEventLimitPort, activities: EventActivityTypeCatalogPort, municipalities: MunicipalityCatalogReaderPort, exactLocations: ExactLocationProtectorPort, areas: ApproximateEventAreaProjectorPort, audit: EventAuditPort, telemetry: EventTelemetryPort) {
    this.dependencies = { uow, events, eligibility, limits, activities, municipalities, exactLocations, areas, audit, telemetry };
  }

  async execute(input: Readonly<{ hostAccountId: string; eventId: string } & EventDraftInput & { revision: number }>): Promise<EventOwnerDraft> {
    try {
      const result = await this.dependencies.uow.execute(async (context) => {
        if (!(await this.dependencies.eligibility.isEligible(context, input.hostAccountId))) throw new EventError('HOST_NOT_ELIGIBLE');
        const current = await this.dependencies.events.findByIdForOwner(context, input.eventId, input.hostAccountId);
        if (!current) throw new EventError('EVENT_NOT_FOUND');
        const currentState = current.event.snapshot();
        if (currentState.revision !== input.revision) throw new EventError('EVENT_REVISION_CONFLICT');
        const resolved = await patchFor(context, this.dependencies, currentState, input);
        const limit = await this.dependencies.limits.lockAndCount(context, { hostAccountId: input.hostAccountId, now: now(), excludeEventId: input.eventId });
        const exact = input.exactLocation === undefined ? current.exactLocation : exactFromInput(input, current.exactLocation);
        if (input.exactLocation !== undefined && input.exactLocation !== null && !isExactLocation(input.exactLocation)) throw new EventError('INVALID_LOCATION', 'invalid_location');
        const updated = current.event.updateDraft({ ...resolved.patch, ...(input.exactLocation !== undefined ? { approximateArea: exact ? this.dependencies.areas.project(input.eventId, exact) : null } : {}) }, now());
        if (updated.snapshot().startsAt && limit.futureActive) throw new EventError('EVENT_LIMIT_REACHED', 'event_limit_reached');
        if (await this.dependencies.events.saveIfRevision(context, updated, input.revision, exact) === 'conflict') throw new EventError('EVENT_REVISION_CONFLICT');
        await this.dependencies.audit.record(context, { eventId: input.eventId, actorAccountId: input.hostAccountId, action: 'draft_updated', changedFields: changedFields(input), correlationId: crypto.randomUUID() });
        return { record: { event: updated, exactLocation: exact }, activity: resolved.activity };
      });
      this.dependencies.telemetry.record({ name: 'draft.update', outcome: 'success', correlationId: crypto.randomUUID() });
      return ownerProjection(result.record, result.activity);
    } catch (error) { recordError(this.dependencies.telemetry, 'draft.update', error); throw error; }
  }
}

export class PreviewEventDraft {
  private readonly dependencies: EventDependencies;
  constructor(uow: UnitOfWorkPort, events: EventRepositoryPort, eligibility: HostEligibilityPort, limits: HostEventLimitPort, activities: EventActivityTypeCatalogPort, municipalities: MunicipalityCatalogReaderPort, exactLocations: ExactLocationProtectorPort, areas: ApproximateEventAreaProjectorPort, audit: EventAuditPort, telemetry: EventTelemetryPort) {
    this.dependencies = { uow, events, eligibility, limits, activities, municipalities, exactLocations, areas, audit, telemetry };
  }

  async execute(input: Readonly<{ hostAccountId: string; eventId: string }>): Promise<PublicEventPreview> {
    try {
      const result = await this.dependencies.uow.execute(async (context) => {
        const record = await this.dependencies.events.findByIdForOwnerWithoutExact(context, input.eventId, input.hostAccountId);
        if (!record) throw new EventError('EVENT_NOT_FOUND');
        const activity = await activityFor(context, this.dependencies.activities, record.event.snapshot().activityTypeCode, false);
        const state = record.event.snapshot();
        if (!activity || !state.approximateArea) throw new EventError('EVENT_NOT_READY', 'event_not_ready');
        return publicProjection(record, activity, state.approximateArea);
      });
      this.dependencies.telemetry.record({ name: 'draft.preview', outcome: 'success', correlationId: crypto.randomUUID() });
      return result;
    } catch (error) { recordError(this.dependencies.telemetry, 'draft.preview', error); throw error; }
  }
}

export class PublishEvent {
  private readonly dependencies: EventDependencies;
  constructor(uow: UnitOfWorkPort, events: EventRepositoryPort, eligibility: HostEligibilityPort, limits: HostEventLimitPort, activities: EventActivityTypeCatalogPort, municipalities: MunicipalityCatalogReaderPort, exactLocations: ExactLocationProtectorPort, areas: ApproximateEventAreaProjectorPort, audit: EventAuditPort, telemetry: EventTelemetryPort) {
    this.dependencies = { uow, events, eligibility, limits, activities, municipalities, exactLocations, areas, audit, telemetry };
  }

  async execute(input: Readonly<{ hostAccountId: string; eventId: string; revision?: number }>): Promise<EventOwnerDraft> {
    try {
      const result = await this.dependencies.uow.execute(async (context) => {
        if (!(await this.dependencies.eligibility.isEligible(context, input.hostAccountId))) throw new EventError('HOST_NOT_ELIGIBLE');
        const current = await this.dependencies.events.findByIdForOwner(context, input.eventId, input.hostAccountId);
        if (!current) throw new EventError('EVENT_NOT_FOUND');
        const state = current.event.snapshot();
        if (input.revision !== undefined && input.revision !== state.revision) throw new EventError('EVENT_REVISION_CONFLICT');
        const exact = current.exactLocation;
        if (!exact) throw new EventError('INVALID_LOCATION', 'invalid_location');
        const limits = await this.dependencies.limits.lockAndCount(context, { hostAccountId: input.hostAccountId, now: now(), excludeEventId: input.eventId });
        if (limits.futureActive || limits.publishedInWindow >= 2) throw new EventError('EVENT_LIMIT_REACHED', 'event_limit_reached');
        const area = this.dependencies.areas.project(input.eventId, exact);
        const published = current.event.publish(now(), area);
        if (await this.dependencies.events.saveIfRevision(context, published, state.revision, exact) === 'conflict') throw new EventError('EVENT_REVISION_CONFLICT');
        await this.dependencies.audit.record(context, { eventId: input.eventId, actorAccountId: input.hostAccountId, action: 'published', changedFields: ['status', 'publishedAt', 'approximateArea'], correlationId: crypto.randomUUID() });
        return { record: { event: published, exactLocation: exact }, activity: await activityFor(context, this.dependencies.activities, published.snapshot().activityTypeCode) };
      });
      this.dependencies.telemetry.record({ name: 'event.publish', outcome: 'success', correlationId: crypto.randomUUID() });
      return ownerProjection(result.record, result.activity);
    } catch (error) { recordError(this.dependencies.telemetry, 'event.publish', error); throw error; }
  }
}
