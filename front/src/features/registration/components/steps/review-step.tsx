import { type FormEvent, type ReactNode, useState } from 'react';

import { Button } from '@/components/server/ui/button';
import { TextField } from '@/components/server/ui/text-field';

import { activatedDataSchema, birthDateSchema, type RequiredDataRequest } from '../../contracts';
import { messageForReason } from '../../messages';
import { useCommand } from '../../use-command';
import { useFormError } from '../../use-form-error';
import { LEGAL_DOCUMENT_TITLES, type InterestOption, type LegalDocumentView } from '../../view-models';
import { FormError } from '../form-error';
import { StepFrame } from '../step-frame';
import { USAGE_INTENT_LABELS } from './required-data-step';
import type { StepBaseProps } from './step-types';

type ReviewStepProps = StepBaseProps &
  Readonly<{
    profile: Partial<RequiredDataRequest>;
    interests: readonly InterestOption[];
    documents: readonly LegalDocumentView[];
    onBack: () => void;
    onActivated: () => void;
    /** The refusal may mean a newer document version; the flow reloads the documents. */
    onActivationRefused: () => void;
  }>;

export function ReviewStep({ headingRef, onFailure, profile, interests, documents, onBack, onActivated, onActivationRefused }: ReviewStepProps) {
  const [birthDate, setBirthDate] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const { pending, run } = useCommand();
  const form = useFormError();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.clear();
    if (!birthDateSchema.safeParse(birthDate).success) {
      setFieldError('Informe uma data válida, com dia, mês e ano.');
      return;
    }
    setFieldError(undefined);
    const body = {
      birthDate,
      documentIds: documents.map((document) => document.id),
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
          {documents.map((document) => `${LEGAL_DOCUMENT_TITLES[document.kind]} (v${document.version})`).join(', ')}
        </Row>
      </dl>
      <form noValidate onSubmit={submit} className="space-y-6">
        <FormError message={form.error} errorRef={form.errorRef} />
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
        <Button type="submit" wide forward pending={pending} pendingLabel="Ativando…">
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
