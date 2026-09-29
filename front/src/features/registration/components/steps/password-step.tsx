import { type FormEvent, type ReactNode, useState } from 'react';

import { Button } from '@/components/server/ui/button';
import { CheckIcon } from '@/components/server/ui/icons';
import { TextField } from '@/components/server/ui/text-field';
import { cn } from '@/shared/ui/cn';

import { PASSWORD_MAX, PASSWORD_MIN, type StageData, stageDataSchema } from '../../contracts';
import { messageForReason } from '../../messages';
import { useCommand } from '../../use-command';
import { useFormError } from '../../use-form-error';
import { FormError } from '../form-error';
import { StepFrame } from '../step-frame';
import type { StepBaseProps } from './step-types';

type PasswordStepProps = StepBaseProps & Readonly<{ onSaved: (stage: StageData) => void }>;

export function PasswordStep({ headingRef, onFailure, onSaved }: PasswordStepProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const { pending, run } = useCommand();
  const form = useFormError();

  const lengthOk = password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
  const matches = password.length > 0 && password === confirmation;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.clear();
    if (!lengthOk || !matches) {
      setFieldError(!lengthOk ? `Use entre ${PASSWORD_MIN} e ${PASSWORD_MAX} caracteres.` : 'As duas senhas precisam ser iguais.');
      return;
    }
    setFieldError(undefined);
    const result = await run(
      { path: '/api/registration/password', method: 'PUT', body: { password, passwordConfirmation: confirmation } },
      stageDataSchema,
    );
    if (!result) return;
    // Secrets are discarded as soon as the request settles, whatever the outcome.
    setPassword('');
    setConfirmation('');
    if (result.kind === 'ok') {
      onSaved(result.data);
      return;
    }
    if (result.kind === 'unprocessable') {
      form.show(messageForReason(result.reason));
      return;
    }
    const message = await onFailure(result);
    if (message) form.show(message);
  }

  return (
    <StepFrame
      step="password"
      title="Crie sua senha"
      headingRef={headingRef}
      why={
        <p>
          Seu e-mail está confirmado. A senha protege sua conta; uma frase longa que só você conhece é mais
          segura e fácil de lembrar.
        </p>
      }
    >
      <form noValidate onSubmit={submit} className="space-y-6">
        <FormError message={form.error} errorRef={form.errorRef} />
        <TextField
          label="Senha"
          type={visible ? 'text' : 'password'}
          name="password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldError}
          disabled={pending}
        />
        <TextField
          label="Confirme a senha"
          type={visible ? 'text' : 'password'}
          name="passwordConfirmation"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={pending}
        />
        <ul aria-label="Requisitos da senha" className="space-y-2 text-sm">
          <Requirement met={lengthOk}>Entre {PASSWORD_MIN} e {PASSWORD_MAX} caracteres</Requirement>
          <Requirement met={matches}>As duas senhas são iguais</Requirement>
        </ul>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
          <input
            type="checkbox"
            checked={visible}
            onChange={(event) => setVisible(event.target.checked)}
            className="size-5 accent-primary"
          />
          Mostrar senhas
        </label>
        <Button type="submit" wide forward pending={pending} pendingLabel="Salvando…">
          Salvar senha
        </Button>
      </form>
    </StepFrame>
  );
}

function Requirement({ met, children }: Readonly<{ met: boolean; children: ReactNode }>) {
  return (
    <li className={cn('flex items-center gap-2', met ? 'text-foreground' : 'text-muted-foreground')}>
      <span
        aria-hidden
        className={cn(
          'grid size-5 place-items-center rounded-full border-2',
          met ? 'border-success bg-success text-background' : 'border-border text-transparent',
        )}
      >
        <CheckIcon className="size-3.5" strokeWidth={3} />
      </span>
      {children}
      <span className="sr-only">{met ? '(atendido)' : '(pendente)'}</span>
    </li>
  );
}
