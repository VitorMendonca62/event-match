import 'server-only';

import { envelopeSchema } from '@/features/registration/contracts';
import { internalOwnProfileSchema, ownProfileSchema, profilePreviewSchema, signedUploadGrantSchema, updateProfileSchema } from '@/features/profile/contracts';
import { z } from 'zod';
import { resolveOriginFingerprint } from './origin-fingerprint';
import type { BffEnv } from '@/shared/config/bff-env.server';
import { callBackend } from './backend-client';
import { expiredSessionCookie, readSessionCookie } from './authentication-cookie';
import { jsonResponse } from './bff-proxy';
import { hasJsonContentType, hasTrustedOrigin } from './same-origin';

type Deps = Readonly<{ env: BffEnv; fetchImpl?: typeof fetch }>;
const response = (statusCode: number, data: Record<string, unknown> = {}, cookies: readonly string[] = []) =>
  jsonResponse({ data, message: statusCode === 200 ? 'Request completed successfully.' : 'Request failed.', statusCode }, cookies);
const dataOf = (body: unknown): unknown => { const value = envelopeSchema.safeParse(body); return value.success ? value.data.data : undefined; };

async function bodyOf(request: Request): Promise<unknown> {
  const text = await request.text().catch(() => '');
  if (Buffer.byteLength(text, 'utf8') > 8 * 1024) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

export async function readOwnProfile(session: string, deps: Deps) {
  const upstream = await callBackend({ method: 'GET', path: '/profiles/me', internal: true, session }, deps.env, deps.fetchImpl);
  const parsed = internalOwnProfileSchema.safeParse(dataOf(upstream.body));
  return upstream.status === 200 && parsed.success ? { kind: 'ok' as const, value: parsed.data } : { kind: upstream.status as number };
}

export async function proxyProfile(request: Request, deps: Deps): Promise<Response> {
  if (!deps.env.PROFILE_UI_ENABLED) return response(404);
  const session = readSessionCookie(request.headers.get('cookie'), deps.env);
  if (!session) return response(401, {}, [expiredSessionCookie(deps.env)]);
  if (request.method === 'GET') {
    const result = await readOwnProfile(session, deps);
    if (result.kind === 'ok') {
      const { invitationSubject: _, ...safe } = result.value;
      return response(200, ownProfileSchema.parse(safe));
    }
    return result.kind === 401 ? response(401, {}, [expiredSessionCookie(deps.env)]) : response(result.kind === 403 ? 403 : 503);
  }
  if (!hasTrustedOrigin(request, deps.env) || !hasJsonContentType(request)) return response(403);
  const parsed = updateProfileSchema.safeParse(await bodyOf(request));
  if (!parsed.success) return response(400);
  const upstream = await callBackend({ method: 'PUT', path: '/profiles/me', internal: true, session, body: parsed.data }, deps.env, deps.fetchImpl);
  const profile = ownProfileSchema.safeParse(dataOf(upstream.body));
  if (upstream.status === 200 && profile.success) return response(200, profile.data);
  if (upstream.status === 401) return response(401, {}, [expiredSessionCookie(deps.env)]);
  if (upstream.status === 422) {
    const reason = z.object({ reason: z.enum(['unknown_language', 'inactive_language', 'unknown_activity_preference', 'inactive_activity_preference']) }).strict().safeParse(dataOf(upstream.body));
    return response(422, reason.success ? reason.data : {});
  }
  if (upstream.status === 400) {
    const reason = z.object({ reason: z.literal('invalid_location') }).strict().safeParse(dataOf(upstream.body));
    return response(400, reason.success ? reason.data : {});
  }
  if ([403, 409].includes(upstream.status)) return response(upstream.status);
  return response(503);
}

export async function proxyProfilePreview(request: Request, deps: Deps): Promise<Response> {
  if (!deps.env.PROFILE_UI_ENABLED) return response(404);
  const session = readSessionCookie(request.headers.get('cookie'), deps.env);
  if (!session) return response(401, {}, [expiredSessionCookie(deps.env)]);
  const upstream = await callBackend({ method: 'GET', path: '/profiles/me/preview', internal: true, session }, deps.env, deps.fetchImpl);
  const preview = profilePreviewSchema.safeParse(dataOf(upstream.body));
  if (upstream.status === 200 && preview.success) return response(200, preview.data);
  if (upstream.status === 401) return response(401, {}, [expiredSessionCookie(deps.env)]);
  return response(upstream.status === 403 ? 403 : 503);
}

const revisionSchema = z.object({ revision: z.number().int().positive() }).strict();
const providerResponseSchema = z.object({
  asset_id: z.string().min(1), public_id: z.string().min(1), version: z.number().int().positive(),
  signature: z.string().min(1), format: z.enum(['jpg', 'png', 'webp']), bytes: z.number().int().positive(),
  width: z.number().int().positive(), height: z.number().int().positive(),
}).strict();

export async function proxyPhotoMutation(request: Request, kind: 'grant' | 'finalize' | 'remove', uploadId: string | undefined, deps: Deps): Promise<Response> {
  if (!deps.env.PROFILE_UI_ENABLED) return response(404);
  if (!hasTrustedOrigin(request, deps.env) || !hasJsonContentType(request)) return response(403);
  const session = readSessionCookie(request.headers.get('cookie'), deps.env);
  if (!session) return response(401, {}, [expiredSessionCookie(deps.env)]);
  const raw = await bodyOf(request);
  const body = kind === 'finalize' ? z.object({ revision: z.number().int().positive(), providerResponse: providerResponseSchema }).strict().safeParse(raw) : revisionSchema.safeParse(raw);
  if (!body.success || (kind === 'finalize' && (!uploadId || !z.uuid().safeParse(uploadId).success))) return response(400);
  const originFingerprint = kind === 'grant' ? resolveOriginFingerprint(request, deps.env) : undefined;
  if (kind === 'grant' && !originFingerprint) return response(400);
  const path = kind === 'grant' ? '/profiles/me/photo/uploads' : kind === 'finalize' ? `/profiles/me/photo/uploads/${uploadId}/finalize` : '/profiles/me/photo';
  const upstream = await callBackend({ method: kind === 'remove' ? 'DELETE' : 'POST', path, internal: true, session, body: body.data, ...(originFingerprint ? { originFingerprint } : {}) }, deps.env, deps.fetchImpl);
  const data = dataOf(upstream.body);
  if (kind === 'grant') { const grant = signedUploadGrantSchema.safeParse(data); if (upstream.status === 201 && grant.success) return response(200, grant.data); }
  else { const profile = internalOwnProfileSchema.safeParse(data); if (upstream.status === 200 && profile.success) { const { invitationSubject: _, ...safe } = profile.data; return response(200, ownProfileSchema.parse(safe)); } }
  if (upstream.status === 401) return response(401, {}, [expiredSessionCookie(deps.env)]);
  if ([400, 403, 404, 409, 410, 422, 429].includes(upstream.status)) return response(upstream.status);
  return response(503);
}
