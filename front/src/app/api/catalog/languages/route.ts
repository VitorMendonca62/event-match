import { envelopeSchema } from '@/features/registration/contracts';
import { languageListDataSchema } from '@/features/profile/contracts';
import { getBffEnv } from '@/shared/config/bff-env.server';
import { callBackend } from '@/shared/server/backend-client';
import { jsonResponse } from '@/shared/server/bff-proxy';

export async function GET(): Promise<Response> {
  const upstream = await callBackend({ method: 'GET', path: '/catalog/languages?locale=pt-BR', internal: false }, getBffEnv());
  const envelope = envelopeSchema.safeParse(upstream.body);
  const data = envelope.success ? languageListDataSchema.safeParse(envelope.data.data) : null;
  if (upstream.status === 200 && data?.success) return jsonResponse({ data: data.data, message: 'Idiomas disponíveis.', statusCode: 200 });
  return jsonResponse({ data: {}, message: 'Catálogo indisponível.', statusCode: upstream.status === 400 ? 400 : 503 });
}
