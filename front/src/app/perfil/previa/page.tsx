import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { BrandMark } from '@/components/server/ui/brand-mark';
import { ButtonLink } from '@/components/server/ui/button';
import { Notice } from '@/components/server/ui/notice';
import { profilePreviewSchema } from '@/features/profile/contracts';
import { envelopeSchema } from '@/features/registration/contracts';
import { getBffEnv } from '@/shared/config/bff-env.server';
import { isSessionToken, sessionCookieName } from '@/shared/server/authentication-cookie';
import { callBackend } from '@/shared/server/backend-client';
import { USAGE_INTENT_LABELS } from '@/features/profile/messages';
import Image from 'next/image';

export const metadata: Metadata = { title: 'Prévia do perfil · EventMatch', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

export default async function ProfilePreviewPage() {
  const store = await cookies();
  const env = getBffEnv();
  if (!env.PROFILE_UI_ENABLED) notFound();
  const token = store.get(sessionCookieName(env))?.value;
  if (!isSessionToken(token)) redirect('/entrar');
  const upstream = await callBackend({ method: 'GET', path: '/profiles/me/preview', internal: true, session: token }, env);
  if (upstream.status === 401) redirect('/entrar');
  const envelope = envelopeSchema.safeParse(upstream.body);
  const preview = envelope.success ? profilePreviewSchema.safeParse(envelope.data.data) : null;
  return (
    <div className="mx-auto min-h-dvh max-w-4xl px-5 pb-20 sm:px-8 lg:px-10"><header className="flex items-center justify-between gap-4 py-6"><BrandMark size="sm" href="/inicio" /><ButtonLink href="/perfil" variant="quiet">Voltar à edição</ButtonLink></header><main className="pt-8"><div className="mb-8 space-y-3"><h1 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-[-0.02em] poster-stretch sm:text-5xl">Prévia do <span className="text-primary">perfil.</span></h1><p className="text-muted-foreground">Somente você vê esta projeção. Campos privados aparecem como ausentes.</p></div>{preview?.success ? <article className="space-y-8 rounded-2xl border-2 border-border bg-surface p-6 sm:p-8"><div className="flex flex-wrap items-center gap-5">{preview.data.photo ? <Image unoptimized width={128} height={128} src={preview.data.photo.deliveryUrl} alt="Foto principal" referrerPolicy="no-referrer" className="size-32 rounded-2xl border-2 border-border object-cover" /> : <div className="grid size-32 place-items-center rounded-2xl border-2 border-dashed border-border text-center text-sm text-muted-foreground">Foto privada ou ausente</div>}<div><h2 className="text-2xl font-bold">{preview.data.displayName}</h2><p className="text-muted-foreground">{preview.data.region}</p></div></div>{preview.data.pronouns || preview.data.profession || preview.data.languages?.length ? <section className="space-y-3 border-y border-border py-6"><h3 className="font-bold">Identidade e comunicação</h3>{preview.data.pronouns ? <p><span className="text-muted-foreground">Pronomes:</span> {preview.data.pronouns}</p> : null}{preview.data.profession ? <p><span className="text-muted-foreground">Profissão:</span> {preview.data.profession}</p> : null}{preview.data.languages?.length ? <ul className="flex flex-wrap gap-2" aria-label="Idiomas">{preview.data.languages.map((item) => <li key={item.code} className="rounded-full border-2 border-border px-4 py-2">{item.label}</li>)}</ul> : null}</section> : null}{preview.data.presentation ? <p className="max-w-[65ch] whitespace-pre-wrap text-lg leading-relaxed">{preview.data.presentation}</p> : <Notice tone="info" title="Apresentação privada ou ainda não preenchida." />}<section><h3 className="mb-3 font-bold">Interesses</h3><ul className="flex flex-wrap gap-2">{preview.data.interests.map((item) => <li key={item.id} className="rounded-full border-2 border-border px-4 py-2">{item.label}</li>)}</ul></section>{preview.data.activityPreferences?.length ? <section><h3 className="mb-3 font-bold">Como gosta dos encontros</h3><ul className="flex flex-wrap gap-2" aria-label="Preferências de atividades">{preview.data.activityPreferences.map((item) => <li key={item.code} className="rounded-full border-2 border-border px-4 py-2">{item.label}</li>)}</ul></section> : null}<section><h3 className="mb-3 font-bold">Busca no EventMatch</h3><ul className="space-y-1 text-muted-foreground">{preview.data.usageIntents.map((item) => <li key={item}>{USAGE_INTENT_LABELS[item]}</li>)}</ul></section></article> : <Notice tone="warning" title="Não conseguimos montar a prévia.">Volte à edição e tente novamente.</Notice>}</main></div>
  );
}
