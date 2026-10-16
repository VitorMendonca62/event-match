import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyEventDraft } from '@/shared/server/events-bff';

export const dynamic = 'force-dynamic';

type RouteContext = Readonly<{ params: Promise<{ eventId: string }> }>;

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const { eventId } = await params;
  return proxyEventDraft(request, eventId, { env: getBffEnv() });
}

export async function PUT(request: Request, { params }: RouteContext): Promise<Response> {
  const { eventId } = await params;
  return proxyEventDraft(request, eventId, { env: getBffEnv() });
}
