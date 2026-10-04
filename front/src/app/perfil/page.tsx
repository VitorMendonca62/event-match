import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { BrandMark } from '@/components/server/ui/brand-mark';
import { ButtonLink } from '@/components/server/ui/button';
import { Notice } from '@/components/server/ui/notice';
import { ProfileForm } from '@/features/profile/components/profile-form';
import { currentProfileView } from '@/shared/server/profile-view';
import { callBackend } from '@/shared/server/backend-client';
import { getBffEnv } from '@/shared/config/bff-env.server';
import { envelopeSchema, interestListDataSchema } from '@/features/registration/contracts';

export const metadata: Metadata = { title: 'Completar perfil · EventMatch', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const catalogPromise = callBackend({ method: 'GET', path: '/catalog/interests?locale=pt-BR', internal: false }, getBffEnv());
  const [profile, catalogResponse] = await Promise.all([currentProfileView(), catalogPromise]);
  if (profile.kind === 'disabled') notFound();
  if (profile.kind === 'anonymous' || profile.kind === 401) redirect('/entrar');
  const safeProfile = profile.kind === 'ok' ? (({ invitationSubject: _, ...safe }) => safe)(profile.value) : null;
  const catalogEnvelope = envelopeSchema.safeParse(catalogResponse.body);
  const catalog = catalogResponse.status === 200 && catalogEnvelope.success ? interestListDataSchema.safeParse(catalogEnvelope.data.data) : null;
  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-5 pb-20 sm:px-8 lg:px-10">
      <header className="flex items-center justify-between gap-4 py-6"><BrandMark size="sm" href="/inicio" /><ButtonLink href="/inicio" variant="quiet">Voltar ao início</ButtonLink></header>
      <main className="grid gap-10 pt-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16 lg:pt-12">
        <div className="space-y-4"><h1 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-[-0.02em] poster-stretch sm:text-5xl">Complete seu <span className="text-primary">perfil.</span></h1><p className="max-w-[48ch] text-lg leading-relaxed text-muted-foreground">Prepare uma apresentação para atividades em grupo. Você pode voltar e editar quando quiser.</p></div>
        <div className="min-w-0">{safeProfile && catalog?.success ? <ProfileForm initial={safeProfile} interestOptions={catalog.data.interests} /> : <Notice tone="warning" title="Perfil temporariamente indisponível.">Volte ao início e tente novamente em instantes.</Notice>}</div>
      </main>
    </div>
  );
}
