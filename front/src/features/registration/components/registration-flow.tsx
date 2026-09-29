'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { flushSync } from 'react-dom';

import { BrandMark } from '@/components/server/ui/brand-mark';
import { Button } from '@/components/server/ui/button';
import { Notice } from '@/components/server/ui/notice';

import { callRegistrationApi, cancelRegistration } from '../api-client';
import { type FlowStage, type RequiredDataRequest, snapshotDataSchema, type VerificationWindow } from '../contracts';
import { browserSessionStorage, clearDraft, type DraftPatch, readDraft, writeDraft } from '../draft-storage';
import { nextLocalStep, previousStep, reconcileStep, type Step, stepForStage } from '../flow-machine';
import { MESSAGES, messageForFailure } from '../messages';
import type { Catalog, InterestOption, LegalDocumentView } from '../view-models';
import { ProgressRail } from './progress-rail';
import { BirthStep } from './steps/birth-step';
import { ContactStep } from './steps/contact-step';
import { InterestsStep } from './steps/interests-step';
import { OtpStep } from './steps/otp-step';
import { PasswordStep } from './steps/password-step';
import { RequiredDataStep } from './steps/required-data-step';
import { ReviewStep } from './steps/review-step';
import type { Failure } from './steps/step-types';

export type FlowNotice = 'email-verified' | 'link-failed' | 'expired' | null;

export type RegistrationFlowProps = Readonly<{
  stage: FlowStage | null;
  expiresAt?: string;
  nextResendAt?: string;
  notice: FlowNotice;
  documents: Catalog<LegalDocumentView>;
  interests: Catalog<InterestOption>;
}>;

type Banner = Readonly<{ tone: 'success' | 'error' | 'warning'; title: string; text: string; restart?: boolean }>;

function subscribeNever() {
  return () => {};
}

const INITIAL_BANNERS: Record<Exclude<FlowNotice, null>, Banner> = {
  'email-verified': { tone: 'success', title: 'E-mail confirmado', text: MESSAGES.emailVerified },
  'link-failed': { tone: 'error', title: 'Link não confirmado', text: MESSAGES.linkFailed },
  expired: { tone: 'warning', title: 'Sessão expirada', text: MESSAGES.expired },
};

/**
 * Client island of `/cadastro`: holds the step machine, the in-memory acceptances and the allowed
 * local draft. The remote stage from the backend is authoritative on load, `409` and `401`.
 */
export function RegistrationFlow({ stage: initialStage, expiresAt, nextResendAt, notice, documents, interests }: RegistrationFlowProps) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [refreshing, startRefresh] = useTransition();
  const [stage, setStage] = useState<FlowStage | null>(initialStage);
  const [step, setStep] = useState<Step>(() => stepForStage(initialStage) ?? 'birth');
  const [verification, setVerification] = useState<Partial<VerificationWindow>>(
    initialStage === 'verification_pending' ? { expiresAt, nextResendAt } : {},
  );
  const [banner, setBanner] = useState<Banner | null>(notice ? INITIAL_BANNERS[notice] : null);
  // `null` until the person edits; before that the values come from the restored draft.
  const [editedProfile, setProfile] = useState<Partial<RequiredDataRequest> | null>(null);
  const [editedInterests, setInterestIds] = useState<string[] | null>(null);
  // Acceptances live only in memory until the final submit (plan §4.5).
  const [acceptedDocuments, setAcceptedDocuments] = useState<string[]>([]);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const isClient = useSyncExternalStore(subscribeNever, () => true, () => false);

  // Session storage is browser-only, so the draft is read once after hydration. Document
  // acceptances never survive a reload (ADR-031); the draft restores only the allowlisted,
  // non-sensitive fields.
  const restored = useMemo(
    () => (isClient && initialStage !== null ? readDraft(browserSessionStorage(), new Date()) : undefined),
    [isClient, initialStage],
  );
  const profile: Partial<RequiredDataRequest> = editedProfile ?? {
    displayName: restored?.displayName,
    region: restored?.region,
    usageIntents: restored?.usageIntents,
  };
  const interestIds = editedInterests ?? restored?.interestIds ?? [];

  // Syncs browser-only systems once: stale local progress, an expired cookie and the address bar.
  useEffect(() => {
    if (initialStage === null) {
      clearDraft(browserSessionStorage());
      if (notice === 'expired') void cancelRegistration();
    }
    if (window.location.search) window.history.replaceState(null, '', '/cadastro');
  }, [initialStage, notice]);

  function persist(patch: DraftPatch) {
    writeDraft(browserSessionStorage(), patch, new Date());
  }

  /** Step changes come from handlers, so focus moves there too (`rerender-move-effect-to-event`). */
  function goTo(next: Step) {
    flushSync(() => setStep(next));
    persist({ localStep: next });
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }

  function restart(message: Banner | null) {
    clearDraft(browserSessionStorage());
    setStage(null);
    setProfile({});
    setInterestIds([]);
    setAcceptedDocuments([]);
    setVerification({});
    setBanner(message);
    goTo('birth');
  }

  async function onFailure(failure: Failure): Promise<string | null> {
    if (failure.kind === 'expired') {
      restart(INITIAL_BANNERS.expired);
      return null;
    }
    if (failure.kind !== 'conflict') return messageForFailure(failure);

    // A single resynchronization with the authoritative snapshot.
    const snapshot = await callRegistrationApi({ path: '/api/registration', method: 'GET' }, snapshotDataSchema);
    if (snapshot.kind === 'ok') {
      const next = reconcileStep(snapshot.data.stage, step);
      setStage(snapshot.data.stage);
      if (snapshot.data.stage === 'verification_pending') {
        setVerification({ expiresAt: snapshot.data.expiresAt, nextResendAt: snapshot.data.nextResendAt });
      }
      setBanner({ tone: 'warning', title: 'Cadastro atualizado', text: MESSAGES.conflict });
      if (next === null) router.replace('/cadastro/concluido');
      else goTo(next);
      return null;
    }
    if (snapshot.kind === 'expired') {
      restart(INITIAL_BANNERS.expired);
      return null;
    }
    setBanner({ tone: 'error', title: 'Não foi possível sincronizar', text: MESSAGES.conflictPersistent, restart: true });
    return null;
  }

  function advance(next: Step, nextStage: FlowStage) {
    setBanner(null);
    setStage(nextStage);
    goTo(next);
  }

  function refreshCatalogs() {
    startRefresh(() => router.refresh());
  }

  /** The backend runs the expiration first; only if it cannot be reached does the person stay (ADR-030). */
  async function cancel() {
    const result = await cancelRegistration();
    if (result.kind !== 'ok' && result.kind !== 'expired') {
      setConfirmingCancel(false);
      setBanner({ tone: 'error', title: 'Não foi possível cancelar', text: MESSAGES.cancelFailed });
      return;
    }
    clearDraft(browserSessionStorage());
    router.push('/');
  }

  // A version published mid-flow: accepted ids that are no longer offered are dropped and the
  // documents must be accepted again. Adjusted during render because it follows a prop change.
  if (documents.status === 'ready' && acceptedDocuments.some((id) => !documents.items.some((item) => item.id === id))) {
    setAcceptedDocuments([]);
    setBanner({ tone: 'warning', title: 'Documentos atualizados', text: MESSAGES.documentsChanged });
  }

  const base = { headingRef, onFailure };
  const readyInterests = interests.status === 'ready' ? interests.items : [];

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 pb-16 sm:px-8 lg:px-10">
      <header className="flex items-center justify-between gap-4 py-6">
        <BrandMark size="sm" />
        {stage !== null ? (
          <Button variant="quiet" onClick={() => setConfirmingCancel(true)} aria-expanded={confirmingCancel}>
            Cancelar cadastro
          </Button>
        ) : null}
      </header>

      {confirmingCancel ? (
        <div className="mb-8 space-y-4 rounded-2xl border-2 border-warning/60 bg-surface p-5">
          <p className="font-semibold">Cancelar o cadastro?</p>
          <p className="text-muted-foreground">
            Encerramos o cadastro, descartamos o e-mail e a senha informados e apagamos o progresso guardado neste
            navegador. Para participar depois, é preciso começar de novo.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={cancel}>
              Sim, cancelar
            </Button>
            <Button variant="quiet" onClick={() => setConfirmingCancel(false)}>
              Continuar cadastro
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mb-10">
        <ProgressRail current={step} />
      </div>

      <main className="flex-1" aria-busy={!isClient || undefined}>
        {banner ? (
          <Notice tone={banner.tone} role="status" title={banner.title} className="mb-8">
            <p>{banner.text}</p>
            {banner.restart ? (
              <Button variant="quiet" className="-ms-3 mt-2" onClick={() => restart(null)}>
                Recomeçar cadastro
              </Button>
            ) : null}
          </Notice>
        ) : null}

        {step === 'birth' ? <BirthStep {...base} onEligible={() => advance('contact', 'age_eligible')} /> : null}
        {step === 'contact' ? (
          <ContactStep
            {...base}
            onRequested={(window) => {
              setVerification(window);
              advance('otp', 'verification_pending');
            }}
          />
        ) : null}
        {step === 'otp' ? (
          <OtpStep
            {...base}
            window={verification}
            onWindow={setVerification}
            onVerified={() => {
              advance('password', 'contact_verified');
              refreshCatalogs();
            }}
          />
        ) : null}
        {step === 'password' ? (
          <PasswordStep
            {...base}
            documents={documents}
            accepted={acceptedDocuments}
            onAcceptedChange={setAcceptedDocuments}
            onCancel={cancel}
            onRetry={refreshCatalogs}
            retrying={refreshing}
            onSaved={(data) => advance('required_data', data.stage)}
          />
        ) : null}
        {step === 'required_data' ? (
          <RequiredDataStep
            key={restored ? 'restored' : 'empty'}
            {...base}
            initial={profile}
            onDraft={(patch) => {
              setProfile({ ...profile, ...patch });
              persist(patch);
            }}
            onSaved={(data, saved) => {
              setProfile(saved);
              persist(saved);
              advance('interests', data.stage);
              refreshCatalogs();
            }}
          />
        ) : null}
        {step === 'interests' ? (
          <InterestsStep
            headingRef={headingRef}
            interests={interests}
            selected={interestIds}
            onSelectedChange={(ids) => {
              setInterestIds(ids);
              persist({ interestIds: ids });
            }}
            onContinue={() => goTo(nextLocalStep('interests') ?? 'review')}
            onRetry={refreshCatalogs}
            retrying={refreshing}
          />
        ) : null}
        {step === 'review' ? (
          <ReviewStep
            {...base}
            profile={profile}
            interests={readyInterests.filter((interest) => interestIds.includes(interest.id))}
            documents={documents}
            accepted={acceptedDocuments}
            onAcceptedChange={setAcceptedDocuments}
            onCancel={cancel}
            onRetry={refreshCatalogs}
            retrying={refreshing}
            onBack={() => goTo(previousStep('review') ?? 'interests')}
            onActivationRefused={refreshCatalogs}
            onActivated={() => {
              clearDraft(browserSessionStorage());
              router.replace('/cadastro/concluido');
            }}
          />
        ) : null}
      </main>
    </div>
  );
}
