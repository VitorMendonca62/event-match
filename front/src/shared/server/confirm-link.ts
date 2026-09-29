import { confirmLinkTokenSchema, envelopeSchema, verifiedDataSchema } from '../../features/registration/contracts';
import type { BffEnv } from '../config/bff-env.server';
import { logBffEvent } from './bff-logger';
import { callBackend } from './backend-client';
import { serializeContinuationCookie } from './continuation-cookie';

export const LINK_RESULT_PARAM = 'email-verificado';

type LinkDeps = Readonly<{ env: BffEnv; fetchImpl?: typeof fetch; now?: () => Date; log?: (line: string) => void }>;

/**
 * E-mail link callback (ADR-024): consumes the single-use token on the backend and always answers
 * `303` to a clean URL, so the token leaves the address bar and history. The cookie is written only
 * on `verified: true`; a failed or consumed link never touches an existing continuation.
 */
export async function confirmEmailLink(request: Request, deps: LinkDeps): Promise<Response> {
  const started = performance.now();
  const token = new URL(request.url).searchParams.get('token');
  const parsedToken = confirmLinkTokenSchema.safeParse(token);

  let verified = false;
  let cookie: string | undefined;
  let status = 400;
  if (parsedToken.success) {
    const upstream = await callBackend(
      {
        method: 'POST',
        path: '/registration/contact-verification/confirm-link',
        body: { token: parsedToken.data },
        internal: true,
      },
      deps.env,
      deps.fetchImpl,
    );
    status = upstream.status;
    const envelope = envelopeSchema.safeParse(upstream.body);
    const data = envelope.success ? verifiedDataSchema.safeParse(envelope.data.data) : undefined;
    verified = upstream.status === 200 && data?.success === true && data.data.verified;
    if (verified && upstream.continuation) {
      cookie = serializeContinuationCookie(upstream.continuation, undefined, deps.env, deps.now?.());
    } else {
      verified = false;
    }
  }

  logBffEvent(
    {
      operation: 'registration.contact-verification.confirm-link',
      status,
      durationMs: performance.now() - started,
      correlationId: crypto.randomUUID(),
    },
    deps.log,
  );

  const location = `${deps.env.FRONTEND_PUBLIC_URL}/cadastro?${LINK_RESULT_PARAM}=${verified ? '1' : '0'}`;
  const headers = new Headers({
    location,
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  });
  if (cookie) headers.append('set-cookie', cookie);
  return new Response(null, { status: 303, headers });
}
