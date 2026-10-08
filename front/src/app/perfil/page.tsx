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
import { federativeUnitListDataSchema } from '@/features/location/contracts';
import { activityPreferenceListDataSchema, languageListDataSchema } from '@/features/profile/contracts';

export const metadata: Metadata = { title: 'Completar perfil · EventMatch', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const env = getBffEnv();
  const catalogPromise = callBackend({ method: 'GET', path: '/catalog/interests?locale=pt-BR', internal: false }, env);
  const languagesPromise = callBackend({ method: 'GET', path: '/catalog/languages?locale=pt-BR', internal: false }, env);
  const federativeUnitsPromise = callBackend({ method: 'GET', path: '/catalog/federative-units', internal: false }, env);
  const preferencesPromise = callBackend({ method: 'GET', path: '/catalog/activity-preferences?locale=pt-BR', internal: false }, env)
    .catch(() => ({ status: 503, body: null }));
  const [profile, catalogResponse, languagesResponse, federativeUnitsResponse, preferencesResponse] = await Promise.all([currentProfileView(), catalogPromise, languagesPromise, federativeUnitsPromise, preferencesPromise]);
  if (profile.kind === 'disabled') notFound();
  if (profile.kind === 'anonymous' || profile.kind === 401) redirect('/entrar');
  const safeProfile = profile.kind === 'ok' ? (({ invitationSubject: _, ...safe }) => safe)(profile.value) : null;
  const catalogEnvelope = envelopeSchema.safeParse(catalogResponse.body);
  const catalog = catalogResponse.status === 200 && catalogEnvelope.success ? interestListDataSchema.safeParse(catalogEnvelope.data.data) : null;
  const languagesEnvelope = envelopeSchema.safeParse(languagesResponse.body);
  const languages = languagesResponse.status === 200 && languagesEnvelope.success ? languageListDataSchema.safeParse(languagesEnvelope.data.data) : null;
  const preferencesEnvelope = envelopeSchema.safeParse(preferencesResponse.body);
  const preferences = preferencesResponse.status === 200 && preferencesEnvelope.success ? activityPreferenceListDataSchema.safeParse(preferencesEnvelope.data.data) : null;
  const federativeUnitsEnvelope = envelopeSchema.safeParse(federativeUnitsResponse.body);
  const federativeUnits = federativeUnitsResponse.status === 200 && federativeUnitsEnvelope.success ? federativeUnitListDataSchema.safeParse(federativeUnitsEnvelope.data.data) : null;
  // A failing preference catalog degrades only its own section (SDD-017).
  const activityPreferenceOptions = preferences?.success ? preferences.data.activityPreferences : null;
  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-5 pb-32 sm:px-8 lg:px-10 lg:pb-24">
      <header className="flex items-center justify-between gap-4 py-6"><BrandMark size="sm" href="/inicio" /><ButtonLink href="/inicio" variant="quiet">Voltar ao início</ButtonLink></header>
      <main className="pt-4 lg:pt-8">
        <div className="mb-6 space-y-3 lg:mb-14 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-end lg:gap-16 lg:space-y-0"><h1 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-[-0.02em] poster-stretch sm:text-5xl">Complete seu <span className="text-primary">perfil.</span></h1><p className="max-w-[56ch] text-lg leading-relaxed text-muted-foreground">Prepare uma apresentação para atividades em grupo. Tudo começa privado: você decide o que compartilhar, item por item, e pode voltar quando quiser.</p></div>
        {safeProfile && catalog?.success && languages?.success && federativeUnits?.success ? <ProfileForm initial={safeProfile} interestOptions={catalog.data.interests} languageOptions={languages.data.languages} federativeUnits={federativeUnits.data.federativeUnits} activityPreferenceOptions={activityPreferenceOptions} /> : <Notice tone="warning" title="Perfil temporariamente indisponível.">Volte ao início e tente novamente em instantes.</Notice>}
      </main>
    </div>
  );
}
