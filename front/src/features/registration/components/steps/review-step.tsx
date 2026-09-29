import { type FormEvent, type ReactNode, useState } from 'react';

import { Button } from '@/components/server/ui/button';
import { Notice } from '@/components/server/ui/notice';
import { TextField } from '@/components/server/ui/text-field';

import { activatedDataSchema, birthDateSchema, type RequiredDataRequest } from '../../contracts';
import { MESSAGES, messageForReason } from '../../messages';
import { useCommand } from '../../use-command';
import { useFormError } from '../../use-form-error';
import { type Catalog, type InterestOption, LEGAL_DOCUMENT_TITLES, type LegalDocumentView } from '../../view-models';
import { FormError } from '../form-error';
import { StepFrame } from '../step-frame';
import { allAccepted, documentsReady, TermsConsent } from '../terms-consent';
import { USAGE_INTENT_LABELS } from './required-data-step';
import type { StepBaseProps } from './step-types';

type ReviewStepProps = StepBaseProps &
  Readonly<{
    profile: Partial<RequiredDataRequest>;
    interests: readonly InterestOption[];
    documents: Catalog<LegalDocumentView>;
    accepted: readonly string[];
    onAcceptedChange: (ids: string[]) => void;
    onCancel: () => void;
    onRetry: () => void;
    retrying: boolean;
    onBack: () => void;
    onActivated: () => void;
    /** The refusal may mean a newer document version; the flow reloads the documents. */
    onActivationRefused: () => void;
  }>;

export function ReviewStep({
  headingRef,
  onFailure,
  profile,
  interests,
  documents,
  accepted,
  onAcceptedChange,
  onCancel,
  onRetry,
  retrying,
  onBack,
  onActivated,
  onActivationRefused,
}: ReviewStepProps) {
  const [birthDate, setBirthDate] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const { pending, run } = useCommand();
  const form = useFormError();
  const [showConsentError, setShowConsentError] = useState(false);
  const consented = allAccepted(documents, accepted);
  const acceptedDocuments = documents.status === 'ready' ? documents.items.filter((item) => accepted.includes(item.id)) : [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.clear();
    if (!birthDateSchema.safeParse(birthDate).success) {
      setFieldError('Informe uma data válida, com dia, mês e ano.');
      return;
    }
    setFieldError(undefined);
    if (!consented) {
      setShowConsentError(true);
      return;
    }
    const body = {
      birthDate,
      documentIds: acceptedDocuments.map((document) => document.id),
      interestIds: interests.map((interest) => interest.id),
    };
    const result = await run({ path: '/api/registration/complete', method: 'POST', body }, activatedDataSchema);
    if (!result) return;
    setBirthDate('');
    if (result.kind === 'ok') {
      onActivated();
      return;
    }
    if (result.kind === 'unprocessable') {
      form.show(messageForReason(result.reason));
      if (result.reason === 'activation_unavailable') onActivationRefused();
      return;
    }
    const message = await onFailure(result);
    if (message) form.show(message);
  }

  return (
    <StepFrame
      step="review"
      title="Tudo pronto para começar"
      headingRef={headingRef}
      onBack={onBack}
      why={<p>Confira o resumo. Para ativar a conta, confirmamos sua data de nascimento mais uma vez.</p>}
    >
      <dl className="divide-y divide-border border-y border-border">
        <Row term="Nome de exibição">{profile.displayName ?? '—'}</Row>
        <Row term="Bairro ou cidade">{profile.region ?? '—'}</Row>
        <Row term="O que procura">
          {profile.usageIntents?.map((intent) => USAGE_INTENT_LABELS[intent].label).join(', ') || '—'}
        </Row>
        <Row term={`Interesses (${interests.length})`}>{interests.map((interest) => interest.label).join(', ')}</Row>
        <Row term="Documentos aceitos">
          {consented ? acceptedDocuments.map((document) => LEGAL_DOCUMENT_TITLES[document.kind]).join(', ') : 'Pendente'}
        </Row>
      </dl>
      <form noValidate onSubmit={submit} className="space-y-6">
        <FormError message={form.error} errorRef={form.errorRef} />
        {!consented ? (
          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold">Confirme os documentos</h2>
            <p className="text-muted-foreground">
              Antes de ativar a conta, leia e aceite os documentos do EventMatch.
            </p>
            <TermsConsent
              documents={documents}
              accepted={accepted}
              onAcceptedChange={onAcceptedChange}
              onCancel={onCancel}
              onRetry={onRetry}
              retrying={retrying}
            />
            {showConsentError && documentsReady(documents) ? (
              <Notice tone="error" role="alert" title="Faltam aceites">
                {MESSAGES.consentRequired}
              </Notice>
            ) : null}
          </div>
        ) : null}
        <TextField
          label="Confirme sua data de nascimento"
          hint="Ela não fica guardada no navegador."
          type="date"
          name="birthDate"
          autoComplete="bday"
          required
          min="1900-01-01"
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
          error={fieldError}
          disabled={pending}
          inputClassName="tabular"
        />
        <Button type="submit" wide forward pending={pending} pendingLabel="Ativando…" disabled={!documentsReady(documents)}>
          Concluir cadastro
        </Button>
      </form>
    </StepFrame>
  );
}

function Row({ term, children }: Readonly<{ term: string; children: ReactNode }>) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm font-semibold text-muted-foreground">{term}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}
