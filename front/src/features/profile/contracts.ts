import { z } from 'zod';

export const usageIntentSchema = z.enum(['friendship', 'activity_company', 'explore_city', 'networking']);
export const visibilitySchema = z.enum(['private', 'authenticated']);
export const interestSchema = z.object({ id: z.uuid(), slug: z.string().min(1), label: z.string().min(1) }).strict();
export const completionSchema = z.object({
  complete: z.boolean(), completedCount: z.number().int().min(0).max(6), totalCount: z.literal(6),
  missing: z.array(z.enum(['display_name', 'region', 'usage_intents', 'interests', 'photo', 'presentation'])),
}).strict();
export const profilePhotoSchema = z.object({ deliveryUrl: z.url(), width: z.literal(512), height: z.literal(512) }).strict();
export const ownProfileSchema = z.object({
  revision: z.number().int().positive(), displayName: z.string(), region: z.string(),
  usageIntents: z.array(usageIntentSchema), interests: z.array(interestSchema),
  presentation: z.string().nullable(), photoVisibility: z.enum(['private', 'authenticated', 'public']),
  presentationVisibility: z.enum(['private', 'authenticated', 'public']), photo: profilePhotoSchema.nullable(),
  completion: completionSchema,
}).strict();
export type OwnProfile = z.infer<typeof ownProfileSchema>;
export const internalOwnProfileSchema = ownProfileSchema.extend({ invitationSubject: z.string().regex(/^v1\.[A-Za-z0-9_-]{43}$/) }).strict();
export const updateProfileSchema = z.object({
  revision: z.number().int().positive(), displayName: z.string().trim().min(1).max(60), region: z.string().trim().min(2).max(80),
  usageIntents: z.array(usageIntentSchema).min(1).refine((items) => new Set(items).size === items.length),
  interestIds: z.array(z.uuid()).min(3).refine((items) => new Set(items).size === items.length),
  presentation: z.string().trim().min(1).max(500).nullable(), photoVisibility: visibilitySchema, presentationVisibility: visibilitySchema,
}).strict();
export const profilePreviewSchema = z.object({
  displayName: z.string(), region: z.string(), usageIntents: z.array(usageIntentSchema), interests: z.array(interestSchema),
  presentation: z.string().optional(), photo: profilePhotoSchema.optional(),
}).strict();
export type ProfilePreview = z.infer<typeof profilePreviewSchema>;
export const signedUploadGrantSchema = z.object({
  uploadId: z.uuid(), uploadUrl: z.url(), cloudName: z.string(), apiKey: z.string(), publicId: z.string(),
  timestamp: z.number().int(), expiresAt: z.iso.datetime(), uploadPreset: z.string(), signature: z.string(),
}).strict();
