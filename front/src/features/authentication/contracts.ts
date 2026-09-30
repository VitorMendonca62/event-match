import { z } from 'zod';

/**
 * Transport schemas of the auth contract v1 (SDD-013 §4.3). They reproduce only public shapes and
 * limits; account state, limits and deadlines stay in NestJS.
 */
export const EMAIL_MAX = 320;
export const LOGIN_PASSWORD_MAX = 256;

export const loginRequestSchema = z.strictObject({
  email: z.string().trim().min(3).max(EMAIL_MAX),
  password: z.string().min(1).max(LOGIN_PASSWORD_MAX),
  rememberMe: z.boolean(),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Backend deadlines; the BFF uses them for the cookie and never forwards them to the browser. */
export const sessionDeadlinesSchema = z.object({
  authenticated: z.literal(true),
  expiresAt: z.iso.datetime(),
  idleExpiresAt: z.iso.datetime(),
  remembered: z.boolean(),
});
export type SessionDeadlines = z.infer<typeof sessionDeadlinesSchema>;

export const sessionStateSchema = sessionDeadlinesSchema.extend({ rotationDue: z.boolean() });

export const loggedOutSchema = z.object({ loggedOut: z.literal(true) });

/** What the browser receives: no token, no deadline, no account data (`server-serialization`). */
export const authenticatedDataSchema = z.object({ authenticated: z.literal(true) });
