/** @format */

'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/client/ui/dialog';
import { Button } from '@/components/server/ui/button';
import { Choice } from '@/components/server/ui/choice';
import { Notice } from '@/components/server/ui/notice';
import { TextField } from '@/components/server/ui/text-field';
import { ownProfileSchema, updateProfileSchema, type OwnProfile } from '../contracts';
import { USAGE_INTENT_LABELS } from '../messages';
import { profileScrollBehavior } from '../profile-motion';
import { ProfilePhotoEditor } from './profile-photo-editor';
import { ProfileVisibilityToggle } from './profile-visibility-toggle';

export function ProfileForm({
  initial,
  interestOptions,
}: Readonly<{ initial: OwnProfile; interestOptions: OwnProfile['interests'] }>) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [presentation, setPresentation] = useState(initial.presentation ?? '');
  const [pending, setPending] = useState(false);
  const [refreshingRevision, setRefreshingRevision] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [previewWarningOpen, setPreviewWarningOpen] = useState(false);
  const [status, setStatus] = useState<{
    tone: 'info' | 'success' | 'error' | 'warning';
    text: string;
  }>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const summary = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const previewAfterSave = useRef(false);
  const selectedInterests = useMemo(
    () => new Set(profile.interests.map((item) => item.id)),
    [profile.interests],
  );
  async function submit(form: FormData) {
    const goToPreview = previewAfterSave.current;
    previewAfterSave.current = false;
    setPending(true);
    setHasConflict(false);
    setStatus(undefined);
    setErrors({});
    const body = {
      revision: profile.revision,
      displayName: String(form.get('displayName') ?? ''),
      region: String(form.get('region') ?? ''),
      usageIntents: form.getAll('usageIntents'),
      interestIds: form.getAll('interestIds'),
      presentation: presentation.trim() || null,
      photoVisibility: form.get('photoVisibility'),
      presentationVisibility: form.get('presentationVisibility'),
    };
    const validated = updateProfileSchema.safeParse(body);
    if (!validated.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of validated.error.issues)
        if (issue.path[0] && !nextErrors[String(issue.path[0])])
          nextErrors[String(issue.path[0])] =
            issue.path[0] === 'interestIds'
              ? 'Escolha pelo menos três interesses.'
              : issue.path[0] === 'usageIntents'
                ? 'Escolha ao menos um objetivo.'
                : 'Revise este campo.';
      setErrors(nextErrors);
      setPending(false);
      setStatus({ tone: 'error', text: 'Revise os campos indicados antes de salvar.' });
      queueMicrotask(() => summary.current?.focus());
      return;
    }
    try {
      const result = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validated.data),
      });
      if (result.status === 401) { router.push('/entrar'); return; }
      if (result.ok) {
        const envelope = await result.json();
        setProfile(envelope.data);
        setDirty(false);
        setStatus({ tone: 'success', text: 'Perfil salvo.' });
        if (goToPreview) {
          router.push('/perfil/previa');
          return;
        }
        window.scrollTo({
          top: 0,
          behavior: profileScrollBehavior(
            window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          ),
        });
      } else if (result.status === 409) {
        setHasConflict(true);
        setStatus({
          tone: 'warning',
          text: 'Seu perfil mudou em outra aba.',
        });
      } else
        setStatus({
          tone: 'error',
          text: 'Não foi possível salvar. Revise os campos e tente novamente.',
        });
    } catch {
      setStatus({ tone: 'error', text: 'Não foi possível salvar. Verifique sua conexão e tente novamente.' });
    } finally {
      setPending(false);
      queueMicrotask(() => summary.current?.focus());
    }
  }
  async function refreshRevision() {
    setRefreshingRevision(true);
    try {
      const result = await fetch('/api/profile', { cache: 'no-store' });
      if (result.status === 401) {
        router.push('/entrar');
        return;
      }
      const envelope = await result.json().catch(() => null) as { data?: unknown } | null;
      const current = ownProfileSchema.safeParse(envelope?.data);
      if (!result.ok || !current.success) throw new Error('invalid profile revision');
      setProfile((previous) => ({ ...previous, revision: current.data.revision }));
      setHasConflict(false);
      setStatus({
        tone: 'info',
        text: 'Versão atual carregada. Seu rascunho foi mantido; salve novamente para aplicá-lo.',
      });
    } catch {
      setStatus({
        tone: 'error',
        text: 'Não foi possível carregar a versão atual. Verifique sua conexão e tente novamente.',
      });
    } finally {
      setRefreshingRevision(false);
      queueMicrotask(() => summary.current?.focus());
    }
  }
  function openPreview() {
    if (dirty) setPreviewWarningOpen(true);
    else router.push('/perfil/previa');
  }
  function saveAndPreview() {
    setPreviewWarningOpen(false);
    previewAfterSave.current = true;
    formRef.current?.requestSubmit();
  }
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
      onInput={() => setDirty(true)}
      className="space-y-10"
    >
      {status ? (
        <Notice
          ref={summary}
          role={status.tone === 'error' ? 'alert' : 'status'}
          tone={status.tone}
          title={status.text}
        >
          {hasConflict ? (
            <div className="space-y-3">
              <p>Seu rascunho continua neste formulário. Carregue a revisão atual antes de salvar novamente.</p>
              <Button
                variant="secondary"
                pending={refreshingRevision}
                pendingLabel="Carregando versão…"
                onClick={refreshRevision}
              >
                Carregar versão atual
              </Button>
            </div>
          ) : null}
        </Notice>
      ) : null}
      <ProfilePhotoEditor profile={profile} onProfile={setProfile} />
      <section
        aria-labelledby="profile-basic"
        className="space-y-5 border-b border-border pb-10"
      >
        <h2 id="profile-basic" className="text-xl font-bold">
          Dados básicos
        </h2>
        <TextField
          name="displayName"
          label="Nome de exibição"
          maxLength={60}
          defaultValue={profile.displayName}
          required
          error={errors.displayName}
        />
        <TextField
          name="region"
          label="Região aproximada"
          maxLength={80}
          defaultValue={profile.region}
          required
          error={errors.region}
        />
      </section>
      <section
        aria-labelledby="profile-presentation"
        className="space-y-5 border-b border-border pb-10"
      >
        <div>
          <h2 id="profile-presentation" className="text-xl font-bold">
            Sua apresentação
          </h2>
          <p className="mt-1 max-w-[65ch] text-muted-foreground">
            Conte algo útil para uma atividade em grupo. Não inclua telefone, e-mail ou
            links.
          </p>
        </div>
        <label className="block space-y-2">
          <span className="font-semibold">Apresentação</span>
          <textarea
            name="presentation"
            rows={6}
            maxLength={500}
            value={presentation}
            onChange={(event) => setPresentation(event.target.value)}
            className={`block w-full rounded-xl border-2 bg-surface p-4 text-foreground hover:border-muted-foreground focus-visible:border-foreground ${errors.presentation ? 'border-error' : 'border-border'}`}
            aria-invalid={errors.presentation ? true : undefined}
            aria-describedby={`presentation-count${errors.presentation ? ' presentation-error' : ''}`}
          />
          <span
            id="presentation-count"
            className="block text-right text-sm tabular text-muted-foreground"
          >
            {presentation.length}/500
          </span>
          {errors.presentation ? (
            <span id="presentation-error" className="block text-sm font-semibold text-error">
              {errors.presentation}
            </span>
          ) : null}
        </label>
        <ProfileVisibilityToggle
          name="presentationVisibility"
          question="Quem poderá ver a apresentação futuramente?"
          description="Ative para permitir que pessoas no EventMatch vejam sua apresentação quando esse recurso estiver disponível."
          defaultChecked={profile.presentationVisibility === 'authenticated'}
        />
      </section>
      <section
        aria-labelledby="profile-intents"
        aria-describedby={errors.usageIntents ? 'usage-intents-error' : undefined}
        className="space-y-5 border-b border-border pb-10"
      >
        <h2 id="profile-intents" className="text-xl font-bold">
          O que você busca
        </h2>
        {errors.usageIntents ? (
          <p id="usage-intents-error" className="font-semibold text-error">
            {errors.usageIntents}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(USAGE_INTENT_LABELS).map(([value, label]) => (
            <Choice
              key={value}
              type="checkbox"
              name="usageIntents"
              value={value}
              defaultChecked={profile.usageIntents.includes(
                value as keyof typeof USAGE_INTENT_LABELS,
              )}
              label={label}
            />
          ))}
        </div>
      </section>
      <section
        aria-labelledby="profile-interests"
        aria-describedby={errors.interestIds ? 'interest-ids-error' : undefined}
        className="space-y-5"
      >
        <div>
          <h2 id="profile-interests" className="text-xl font-bold">
            Seus interesses
          </h2>
          <p className="text-muted-foreground">
            Mantenha pelo menos três interesses ativos.
          </p>
          {errors.interestIds ? (
            <p id="interest-ids-error" className="mt-2 font-semibold text-error">
              {errors.interestIds}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          {interestOptions.map((item) => (
            <Choice
              key={item.id}
              appearance="chip"
              type="checkbox"
              name="interestIds"
              value={item.id}
              defaultChecked={selectedInterests.has(item.id)}
              label={item.label}
            />
          ))}
        </div>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" pending={pending} pendingLabel="Salvando…">
          Salvar perfil
        </Button>
        <Button
          data-preview-button
          variant="secondary"
          onClick={openPreview}
          className="inline-flex min-h-12 items-center rounded-full border-2 border-border px-6 font-bold hover:border-muted-foreground"
        >
          Ver prévia
        </Button>
      </div>
      <Dialog
        open={previewWarningOpen}
        onClose={() => setPreviewWarningOpen(false)}
        labelledBy="profile-preview-warning-title"
        describedBy="profile-preview-warning-description"
        role="alertdialog"
        returnFocus={() =>
          formRef.current?.querySelector<HTMLButtonElement>('[data-preview-button]') ?? null
        }
        className="max-w-lg"
      >
        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 id="profile-preview-warning-title" className="text-xl font-bold">
              Você tem alterações não salvas
            </h2>
            <p id="profile-preview-warning-description" className="mt-2 text-muted-foreground">
              A prévia mostra somente as informações que já estão salvas. Se continuar sem
              salvar, as alterações feitas nesta página serão perdidas.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setPreviewWarningOpen(false);
                router.push('/perfil/previa');
              }}
            >
              Ir mesmo assim
            </Button>
            <Button autoFocus pending={pending} pendingLabel="Salvando…" onClick={saveAndPreview}>
              Salvar e ver prévia
            </Button>
          </div>
        </div>
      </Dialog>
    </form>
  );
}
