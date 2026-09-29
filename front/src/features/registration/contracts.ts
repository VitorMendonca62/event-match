import { z } from 'zod';

/**
 * Transport schemas of the registration contract v1 (SDD-009 OpenAPI, ADR-020). They reproduce
 * only public shapes and limits for early feedback; every business rule stays in NestJS.
 */

export const FLOW_STAGES = [
  'age_eligible',
  'verification_pending',
  'contact_verified',
  'registration_in_progress',
  'account_incomplete',
  'completed',
] as const;
export type FlowStage = (typeof FLOW_STAGES)[number];

export const USAGE_INTENTS = ['friendship', 'activity_company', 'explore_city', 'networking'] as const;
export type UsageIntent = (typeof USAGE_INTENTS)[number];

export const LEGAL_DOCUMENT_KINDS = ['terms', 'privacy', 'community_rules'] as const;
export type LegalDocumentKind = (typeof LEGAL_DOCUMENT_KINDS)[number];

export const PUBLIC_ERROR_REASONS = [
  'invalid_contact',
  'invalid_password',
  'weak_password',
  'invalid_birth_date',
  'invalid_display_name',
  'invalid_region',
  'invalid_usage_intents',
  'activation_unavailable',
] as const;
export type PublicErrorReason = (typeof PUBLIC_ERROR_REASONS)[number];

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 256;
export const DISPLAY_NAME_MAX = 60;
export const REGION_MAX = 80;
export const CONTACT_MAX = 254;
export const MIN_INTERESTS = 3;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTime = z.iso.datetime({ offset: true });

/** Calendar check only: `2023-02-30` is refused, age is decided by the backend. */
export const birthDateSchema = isoDate.refine((value) => {
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
});

// Requests (browser → BFF → NestJS). `strict` refuses properties outside the contract.
export const eligibilityRequestSchema = z.strictObject({ birthDate: birthDateSchema });
export const contactVerificationRequestSchema = z.strictObject({
  channel: z.literal('email'),
  contact: z.email().max(CONTACT_MAX),
});
export const emptyRequestSchema = z.strictObject({});
export const confirmContactRequestSchema = z.strictObject({ otp: z.string().regex(/^\d{6}$/) });
export const confirmLinkTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const passwordRequestSchema = z
  .strictObject({
    password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
    passwordConfirmation: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
  })
  .refine((body) => body.password === body.passwordConfirmation);
export const requiredDataRequestSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX),
  region: z.string().trim().min(1).max(REGION_MAX),
  usageIntents: z
    .array(z.enum(USAGE_INTENTS))
    .min(1)
    .max(USAGE_INTENTS.length)
    .refine((values) => new Set(values).size === values.length),
});
const uniqueUuids = (max: number) =>
  z
    .array(z.uuid())
    .min(1)
    .max(max)
    .refine((values) => new Set(values).size === values.length);
export const completeRequestSchema = z.strictObject({
  birthDate: birthDateSchema,
  documentIds: uniqueUuids(10),
  interestIds: uniqueUuids(50),
});

// Response data (inside the `{ data, message, statusCode }` envelope).
export const eligibilityDataSchema = z.object({ eligible: z.boolean() });
export const verificationWindowDataSchema = z.object({
  expiresAt: isoDateTime,
  nextResendAt: isoDateTime,
});
export const verifiedDataSchema = z.object({ verified: z.boolean() });
export const stageDataSchema = z.object({ stage: z.enum(FLOW_STAGES), expiresAt: isoDateTime });
export const snapshotDataSchema = stageDataSchema.extend({ nextResendAt: isoDateTime.optional() });
export const legalDocumentSchema = z.object({
  id: z.uuid(),
  kind: z.enum(LEGAL_DOCUMENT_KINDS),
  version: z.string().min(1),
  locale: z.string().min(1),
  effectiveAt: isoDateTime,
  /** Markdown without frontmatter (ADR-028). */
  content: z.string().min(1),
});
export const legalDocumentListDataSchema = z.object({ documents: z.array(legalDocumentSchema) });
export const interestSchema = z.object({ id: z.uuid(), slug: z.string().min(1), label: z.string().min(1) });
export const interestListDataSchema = z.object({ interests: z.array(interestSchema) });
export const activatedDataSchema = z.object({ status: z.literal('active') });
export const errorReasonDataSchema = z.object({ reason: z.enum(PUBLIC_ERROR_REASONS).optional() });

export const envelopeSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  message: z.string(),
  statusCode: z.number().int(),
});

export type Snapshot = z.infer<typeof snapshotDataSchema>;
export type LegalDocument = z.infer<typeof legalDocumentSchema>;
export type Interest = z.infer<typeof interestSchema>;
export type VerificationWindow = z.infer<typeof verificationWindowDataSchema>;
export type StageData = z.infer<typeof stageDataSchema>;
export type RequiredDataRequest = z.infer<typeof requiredDataRequestSchema>;
