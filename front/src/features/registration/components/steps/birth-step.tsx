import { type FormEvent, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { Button, ButtonLink } from '@/components/server/ui/button';
import { Notice } from '@/components/server/ui/notice';
import { TextField } from '@/components/server/ui/text-field';

import { birthDateSchema, eligibilityDataSchema } from '../../contracts';
import { MESSAGES } from '../../messages';
import { useCommand } from '../../use-command';
import { useFormError } from '../../use-form-error';
import { FormError } from '../form-error';
import { StepFrame } from '../step-frame';
import type { StepBaseProps } from './step-types';

type BirthStepProps = StepBaseProps & Readonly<{ onEligible: () => void }>;

export function BirthStep({ headingRef, onFailure, onEligible }: BirthStepProps) {
  const [birthDate, setBirthDate] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [underage, setUnderage] = useState(false);
  const underageRef = useRef<HTMLDivElement>(null);
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
    const result = await run(
      { path: '/api/registration/eligibility', method: 'POST', body: { birthDate } },
      eligibilityDataSchema,
    );
    if (!result) return;
    if (result.kind === 'ok') {
      setBirthDate('');
      if (result.data.eligible) onEligible();
      else {
        flushSync(() => setUnderage(true));
        underageRef.current?.focus();
      }
      return;
    }
    const message = await onFailure(result);
    if (message) form.show(message);
  }

  return (
    <StepFrame
      step="birth"
      title="Quando você nasceu?"
      headingRef={headingRef}
      why={
        <p>
          O EventMatch é exclusivo para pessoas com 18 anos ou mais. Usamos a data só para confirmar isso
          antes de pedir qualquer contato — ela não fica guardada nesta etapa.
        </p>
      }
    >
      {underage ? (
        <div className="space-y-6">
          <Notice ref={underageRef} tone="blocked" role="status" title="Cadastro indisponível para menores de 18 anos">
            {MESSAGES.underage}
          </Notice>
          <ButtonLink href="/" variant="secondary" wide>
            Voltar ao início
          </ButtonLink>
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="space-y-6">
          <FormError message={form.error} errorRef={form.errorRef} />
          <TextField
            label="Data de nascimento"
            hint="Use o seletor ou digite a data."
            type="date"
            name="birthDate"
            autoComplete="bday"
            required
            max={new Date().toISOString().slice(0, 10)}
            min="1900-01-01"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            error={fieldError}
            disabled={pending}
            inputClassName="tabular"
          />
          <Button type="submit" wide forward pending={pending} pendingLabel="Verificando…">
            Continuar
          </Button>
        </form>
      )}
    </StepFrame>
  );
}
