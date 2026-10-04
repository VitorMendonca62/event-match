import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../../app.module';
import { CleanupProfileMedia } from '../../application/use-cases/profile-media.use-cases';

async function main(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const result = await application.get(CleanupProfileMedia).execute(100);
    console.info(JSON.stringify({ scope: 'profile.media.cleanup', ...result }));
    if (result.failed > 0) process.exitCode = 1;
  } finally {
    await application.close();
  }
}
void main().catch(() => { console.error('Profile media cleanup failed.'); process.exitCode = 1; });
