'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { Button } from '@/components/server/ui/button';
import { Choice } from '@/components/server/ui/choice';
import { Notice } from '@/components/server/ui/notice';
import { TextField } from '@/components/server/ui/text-field';

import { EMAIL_MAX, LOGIN_PASSWORD_MAX } from '../contracts';
import { AUTH_MESSAGES, loginOutcome, messageForLogin } from '../messages';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

/**
 * The only client island of `/entrar`: fields, pending state and focus. It holds no business rule;
 * the BFF sets the HttpOnly cookie and the page moves on with history replacement (ADR-037).
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Focus moves are caused by the submit, so they live in the handler (`rerender-move-effect-to-event`).
  function showFormError(message: string) {
    flushSync(() => setFormError(message));
    errorRef.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setFormError(null);

    const errors: FieldErrors = {
      ...(email.trim() ? {} : { email: AUTH_MESSAGES.emailRequired }),
      ...(password ? {} : { password: AUTH_MESSAGES.passwordRequired }),
    };
    flushSync(() => setFieldErrors(errors));
    if (errors.email) return emailRef.current?.focus();
    if (errors.password) return passwordRef.current?.focus();

    inFlight.current = true;
    setPending(true);
    let status = 0;
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, rememberMe }),
        credentials: 'same-origin',
        cache: 'no-store',
      });
      status = response.status;
    } catch {
      status = 0;
    }
    // The password is discarded as soon as the request settles, whatever the outcome.
    setPassword('');

    const outcome = loginOutcome(status);
    if (outcome === 'ok') {
      // Replace, so going back never reopens a usable login form (ADR-037). Stays pending until then.
      router.replace('/inicio');
      return;
    }
    inFlight.current = false;
    setPending(false);
    showFormError(messageForLogin(outcome));
  }

  return (
    <form
      noValidate
      // Without JavaScript the browser posts form-encoded data, which the BFF refuses; credentials
      // never end up in a URL.
      method="post"
      action="/api/auth/login"
      onSubmit={submit}
      className="space-y-6"
    >
      {formError ? (
        <Notice tone="error" role="alert" ref={errorRef} title={formError} />
      ) : null}
      <TextField
        ref={emailRef}
        label="E-mail"
        type="email"
        name="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={EMAIL_MAX}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email}
        disabled={pending}
      />
      <TextField
        ref={passwordRef}
        label="Senha"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        maxLength={LOGIN_PASSWORD_MAX}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password}
        disabled={pending}
      />
      <Choice
        type="checkbox"
        name="rememberMe"
        label="Manter conectado"
        description="Use só em um aparelho pessoal. Você continua conectado por até 30 dias."
        checked={rememberMe}
        onChange={(event) => setRememberMe(event.target.checked)}
        disabled={pending}
      />
      <Button type="submit" wide forward pending={pending} pendingLabel="Entrando…">
        Entrar
      </Button>
    </form>
  );
}
