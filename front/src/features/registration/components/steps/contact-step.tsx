import { type FormEvent, useState } from 'react';

import { Button } from '@/components/server/ui/button';
import { Choice } from '@/components/server/ui/choice';
import { ChatIcon, MailIcon } from '@/components/server/ui/icons';
import { TextField } from '@/components/server/ui/text-field';

import { CONTACT_MAX, contactVerificationRequestSchema, type VerificationWindow, verificationWindowDataSchema } from '../../contracts';
import { useCommand } from '../../use-command';
import { useFormError } from '../../use-form-error';
import { FormError } from '../form-error';
import { StepFrame } from '../step-frame';
import type { StepBaseProps } from './step-types';

type ContactStepProps = StepBaseProps & Readonly<{ onRequested: (window: VerificationWindow) => void }>;

export function ContactStep({ headingRef, onFailure, onRequested }: ContactStepProps) {
  const [contact, setContact] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const { pending, run } = useCommand();
  const form = useFormError();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.clear();
    const body = { channel: 'email' as const, contact: contact.trim() };
    if (!contactVerificationRequestSchema.safeParse(body).success) {
      setFieldError('Informe um e-mail válido, como nome@exemplo.com.');
      return;
    }
    setFieldError(undefined);
    const result = await run({ path: '/api/registration/contact-verification', method: 'POST', body }, verificationWindowDataSchema);
    if (!result) return;
    if (result.kind === 'ok') {
      setContact('');
      onRequested(result.data);
      return;
    }
    const message = await onFailure(result);
    if (message) form.show(message);
  }

  return (
    <StepFrame
      step="contact"
      title="Como confirmamos que é você?"
      headingRef={headingRef}
      why={
        <p>
          Enviamos um código de 6 dígitos para confirmar que o e-mail é seu. Ele será seu acesso ao EventMatch
          e não aparece para outras pessoas.
        </p>
      }
    >
      <form noValidate onSubmit={submit} className="space-y-6">
        <FormError message={form.error} errorRef={form.errorRef} />
        <fieldset className="space-y-3">
          <legend className="mb-3 font-semibold">Canal de confirmação</legend>
          <Choice type="radio" name="channel" value="email" defaultChecked label="E-mail" icon={<MailIcon className="size-5" />} />
          <Choice
            type="radio"
            name="channel"
            value="whatsapp"
            disabled
            label="WhatsApp"
            badge="Em breve"
            description="Ainda não disponível."
            icon={<ChatIcon className="size-5" />}
          />
        </fieldset>
        <TextField
          label="Seu e-mail"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          autoCapitalize="none"
          required
          maxLength={CONTACT_MAX}
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          error={fieldError}
          disabled={pending}
        />
        <Button type="submit" wide forward pending={pending} pendingLabel="Enviando…">
          Enviar código
        </Button>
      </form>
    </StepFrame>
  );
}
