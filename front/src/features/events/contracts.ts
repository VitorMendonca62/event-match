import { z } from 'zod';
import { ufCodeSchema } from '@/features/location/contracts';

export const eventActivityTypeSchema = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_]{1,59}$/u),
  label: z.string().trim().min(1).max(100),
}).strict();

export const eventActivityTypeListDataSchema = z.object({
  eventActivityTypes: z.array(eventActivityTypeSchema).max(100),
}).strict();

const eventVenueTypeSchema = z.enum(['public_place', 'identifiable_establishment']);
const eventAdmissionModeSchema = z.enum(['manual_approval', 'automatic_entry']);
const eventStatusSchema = z.enum(['draft', 'published_open', 'full', 'cancelled', 'completed', 'not_held']);
const localDateTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/u);
const exactLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}).strict();

const eventDraftFieldsSchema = z.object({
  activityTypeCode: eventActivityTypeSchema.shape.code.nullable().optional(),
  title: z.string().trim().min(1).max(120).nullable().optional(),
  description: z.string().trim().min(1).max(2_000).nullable().optional(),
  startsAtLocal: localDateTimeSchema.nullable().optional(),
  endsAtLocal: localDateTimeSchema.nullable().optional(),
  ufCode: ufCodeSchema.nullable().optional(),
  municipalityCode: z.string().regex(/^\d{7}$/u).nullable().optional(),
  venueType: eventVenueTypeSchema.nullable().optional(),
  nonResidentialHostDeclaration: z.boolean().nullable().optional(),
  exactLocation: exactLocationSchema.nullable().optional(),
  capacity: z.number().int().min(1).max(12).nullable().optional(),
  admissionMode: eventAdmissionModeSchema.optional(),
}).strict();

export const createEventDraftRequestSchema = eventDraftFieldsSchema;
export const updateEventDraftRequestSchema = eventDraftFieldsSchema.extend({ revision: z.number().int().positive() }).strict();
export const publishEventRequestSchema = z.object({ revision: z.number().int().positive().optional() }).strict();

const eventLocationOwnerSchema = z.object({
  ufCode: ufCodeSchema,
  municipalityCode: z.string().regex(/^\d{7}$/u),
  municipalityName: z.string().trim().min(1).max(120),
}).strict();

export const eventOwnerDraftSchema = z.object({
  id: z.uuid(),
  revision: z.number().int().positive(),
  status: eventStatusSchema,
  activityType: eventActivityTypeSchema.nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  startsAtLocal: localDateTimeSchema.nullable(),
  endsAtLocal: localDateTimeSchema.nullable(),
  startsAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
  timeZone: z.string().min(1).nullable(),
  location: eventLocationOwnerSchema.nullable(),
  venueType: eventVenueTypeSchema.nullable(),
  nonResidentialHostDeclaration: z.boolean().nullable(),
  exactLocation: exactLocationSchema.nullable(),
  capacity: z.number().int().min(1).max(12).nullable(),
  admissionMode: eventAdmissionModeSchema,
  official: z.literal(false),
}).strict();

const eventApproximateAreaSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(200).max(5_000),
}).strict();

const backendEventPreviewSchema = z.object({
  id: z.uuid(),
  activityType: eventActivityTypeSchema,
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2_000),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  timeZone: z.string().min(1),
  location: eventLocationOwnerSchema.extend({ approximateArea: eventApproximateAreaSchema }).strict(),
  capacity: z.number().int().min(1).max(12),
  admissionMode: eventAdmissionModeSchema,
  status: z.enum(['draft', 'published_open']),
}).strict();

/** Browser projection for preview: keeps only the backend's approximate area; the exact point is never included. */
export const eventPreviewSchema = z.object({
  id: z.uuid(),
  activityType: eventActivityTypeSchema,
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2_000),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  timeZone: z.string().min(1),
  location: eventLocationOwnerSchema.extend({ approximateArea: eventApproximateAreaSchema }).strict(),
  capacity: z.number().int().min(1).max(12),
  admissionMode: eventAdmissionModeSchema,
  status: z.enum(['draft', 'published_open']),
}).strict();

export function redactEventPreview(value: unknown) {
  const parsed = backendEventPreviewSchema.safeParse(value);
  if (!parsed.success) return undefined;
  return eventPreviewSchema.parse(parsed.data);
}

export const eventLocationSearchRequestSchema = z.object({
  query: z.string().trim().max(80).regex(/^[\p{L}\p{N} .,'’()-]*$/u).optional(),
}).strict();

export const eventLocationSearchResponseSchema = z.object({
  results: z.array(z.object({
    kind: z.enum(['municipality', 'place']),
    label: z.string().min(1).max(240),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).strict()).max(5),
}).strict();

export type EventLocationSearchResult = z.infer<typeof eventLocationSearchResponseSchema>['results'][number];

export type EventActivityType = z.infer<typeof eventActivityTypeSchema>;
export type EventOwnerDraft = z.infer<typeof eventOwnerDraftSchema>;
export type EventPreview = z.infer<typeof eventPreviewSchema>;
