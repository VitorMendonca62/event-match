import { z } from 'zod';

export const usageIntentSchema = z.enum(['friendship', 'activity_company', 'explore_city', 'networking']);
export const visibilitySchema = z.enum(['private', 'authenticated']);
export const pronounSelectionSchema = z.enum(['ela_dela', 'ele_dele', 'elu_delu', 'other', 'prefer_not_to_say']);
export const languageSchema = z.object({ code: z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/), label: z.string().min(1) }).strict();
export const ownLanguageSchema = languageSchema.extend({ active: z.boolean() }).strict();
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
  pronounSelection: pronounSelectionSchema.nullable(), customPronouns: z.string().nullable(),
  pronounsVisibility: z.enum(['private', 'authenticated', 'public']), profession: z.string().nullable(),
  professionVisibility: z.enum(['private', 'authenticated', 'public']), languages: z.array(ownLanguageSchema).max(5),
  languagesVisibility: z.enum(['private', 'authenticated', 'public']),
}).strict();
export type OwnProfile = z.infer<typeof ownProfileSchema>;
export const internalOwnProfileSchema = ownProfileSchema.extend({ invitationSubject: z.string().regex(/^v1\.[A-Za-z0-9_-]{43}$/) }).strict();
export const updateProfileSchema = z.object({
  revision: z.number().int().positive(), displayName: z.string().trim().min(1).max(60), region: z.string().trim().min(2).max(80),
  usageIntents: z.array(usageIntentSchema).min(1).refine((items) => new Set(items).size === items.length),
  interestIds: z.array(z.uuid()).min(3).refine((items) => new Set(items).size === items.length),
  presentation: z.string().trim().min(1).max(500).nullable(), photoVisibility: visibilitySchema, presentationVisibility: visibilitySchema,
  pronounSelection: pronounSelectionSchema.nullable(), customPronouns: z.string().trim().min(1).max(40).nullable(),
  pronounsVisibility: visibilitySchema, profession: z.string().trim().min(1).max(80).nullable(),
  professionVisibility: visibilitySchema, languageCodes: z.array(languageSchema.shape.code).max(5).refine((items) => new Set(items).size === items.length),
  languagesVisibility: visibilitySchema,
}).strict().superRefine((value, context) => {
  if (value.pronounSelection === 'other' && !value.customPronouns) context.addIssue({ code: 'custom', path: ['customPronouns'], message: 'Informe seus pronomes.' });
  if (value.pronounSelection !== 'other' && value.customPronouns !== null) context.addIssue({ code: 'custom', path: ['customPronouns'], message: 'Remova o texto personalizado.' });
  if (value.pronounSelection === 'prefer_not_to_say' && value.pronounsVisibility !== 'private') context.addIssue({ code: 'custom', path: ['pronounsVisibility'], message: 'Esta escolha deve permanecer privada.' });
});
export const profilePreviewSchema = z.object({
  displayName: z.string(), region: z.string(), usageIntents: z.array(usageIntentSchema), interests: z.array(interestSchema),
  presentation: z.string().optional(), photo: profilePhotoSchema.optional(),
  pronouns: z.string().optional(), profession: z.string().optional(), languages: z.array(languageSchema).optional(),
}).strict();
export type ProfilePreview = z.infer<typeof profilePreviewSchema>;
export const signedUploadGrantSchema = z.object({
  uploadId: z.uuid(), uploadUrl: z.url(), cloudName: z.string(), apiKey: z.string(), publicId: z.string(),
  timestamp: z.number().int(), expiresAt: z.iso.datetime(), uploadPreset: z.string(), signature: z.string(),
}).strict();
export const languageListDataSchema = z.object({ languages: z.array(languageSchema) }).strict();
export type LanguageOption = z.infer<typeof languageSchema>;
