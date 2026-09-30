import { z } from 'zod';

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** Mirrors the backend `base64SecretSchema({ min: 32 })` so both sides reject the same secrets. */
const secretSchema = z
  .string()
  .trim()
  .regex(BASE64_PATTERN, 'must be standard base64')
  .refine((value) => Buffer.from(value, 'base64').length >= 32, 'must decode to at least 32 bytes');

const httpUrlSchema = z
  .url({ protocol: /^https?$/ })
  .transform((value) => value.replace(/\/+$/, ''));

/**
 * Server-only configuration of the registration BFF (ADR-022, ADR-023). Never prefixed with
 * `NEXT_PUBLIC_`, so none of it reaches the browser bundle.
 */
export const bffEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    BACKEND_INTERNAL_URL: httpUrlSchema,
    FRONTEND_PUBLIC_URL: httpUrlSchema,
    BFF_INTERNAL_TOKEN: secretSchema,
    ORIGIN_FINGERPRINT_KEY: secretSchema,
    EDGE_PROVIDER: z.enum(['vercel', 'fixture']),
    BACKEND_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(8_000),
    // SDD-013 rollout (ADR-034): `/entrar`, `/inicio` and `/api/auth/**` stay hidden until enabled.
    AUTH_UI_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production') return;
    if (env.EDGE_PROVIDER !== 'vercel') {
      context.addIssue({ code: 'custom', path: ['EDGE_PROVIDER'], message: 'must be vercel in production' });
    }
    if (!env.FRONTEND_PUBLIC_URL.startsWith('https://')) {
      context.addIssue({ code: 'custom', path: ['FRONTEND_PUBLIC_URL'], message: 'must use https in production' });
    }
  });

export type BffEnv = z.infer<typeof bffEnvSchema>;

export function parseBffEnv(input: Record<string, string | undefined>): BffEnv {
  return bffEnvSchema.parse(input);
}

let cached: { source: NodeJS.ProcessEnv; env: BffEnv } | undefined;

/**
 * Process-wide, immutable configuration: it is read once per environment object and never holds
 * request data (`server-no-shared-module-state` concerns request state, not static config).
 */
export function getBffEnv(): BffEnv {
  if (cached?.source !== process.env) cached = { source: process.env, env: parseBffEnv(process.env) };
  return cached.env;
}
