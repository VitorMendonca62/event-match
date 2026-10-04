import { getBffEnv } from '@/shared/config/bff-env.server';
import { proxyPhotoMutation } from '@/shared/server/profile-bff';
export async function POST(request: Request, context: { params: Promise<{ uploadId: string }> }) { const { uploadId } = await context.params; return proxyPhotoMutation(request, 'finalize', uploadId, { env: getBffEnv() }); }
