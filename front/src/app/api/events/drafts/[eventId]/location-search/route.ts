import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxySearchEventLocations } from '@/shared/server/events-bff';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: Readonly<{ params: Promise<{ eventId: string }> }>) {
  const { eventId } = await context.params;
  return proxySearchEventLocations(request, eventId, { env: getBffEnv() });
}
