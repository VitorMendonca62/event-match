import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyCreateEventDraft } from '@/shared/server/events-bff';

export const dynamic = 'force-dynamic';
export const POST = (request: Request) => proxyCreateEventDraft(request, { env: getBffEnv() });
