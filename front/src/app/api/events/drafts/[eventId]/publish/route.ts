import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyPublishEvent } from '@/shared/server/events-bff';

export const dynamic = 'force-dynamic';

type RouteContext = Readonly<{ params: Promise<{ eventId: string }> }>;

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const { eventId } = await params;
  return proxyPublishEvent(request, eventId, { env: getBffEnv() });
}
