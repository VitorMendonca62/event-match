import { type FormEvent, useEffect, useState } from 'react';

import { Button } from '@/components/server/ui/button';
import { Notice } from '@/components/server/ui/notice';
import { TextField } from '@/components/server/ui/text-field';

import { type VerificationWindow, verificationWindowDataSchema, verifiedDataSchema } from '../../contracts';
import { formatClock, secondsUntil } from '../../countdown';
import { MESSAGES } from '../../messages';
import { useCommand } from '../../use-command';
import { useFormError } from '../../use-form-error';
import { FormError } from '../form-error';
import { StepFrame } from '../step-frame';
import type { StepBaseProps } from './step-types';

type OtpStepProps = StepBaseProps &
  Readonly<{
    window: Partial<VerificationWindow>;
    onWindow: (window: VerificationWindow) => void;
    onVerified: () => void;
  }>;

/** Re-reads the clock every second and when the tab becomes visible again (`client-event-listeners`). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return now;
}

export function OtpStep({ headingRef, onFailure, window: verification, onWindow, onVerified }: OtpStepProps) {
  const [otp, setOtp] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [resent, setResent] = useState(0);
  const confirm = useCommand();
  const resend = useCommand();
  const form = useFormError();
  const now = useNow();

  // Derived during render (`rerender-derived-state-no-effect`).
  const expiresIn = secondsUntil(verification.expiresAt, now);
  const resendIn = secondsUntil(verification.nextResendAt, now);
  const expired = verification.expiresAt !== undefined && expiresIn === 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.clear();
    if (!/^\d{6}$/.test(otp)) {
      setFieldError('Digite os 6 números do código.');
      return;
    }
    setFieldError(undefined);
    const result = await confirm.run(
      { path: '/api/registration/contact-verification/confirm', method: 'POST', body: { otp } },
      verifiedDataSchema,
    );
    if (!result) return;
    setOtp('');
    if (result.kind === 'ok' && result.data.verified) {
      onVerified();
      return;
    }
    const message = result.kind === 'ok' ? MESSAGES.otpRejected : await onFailure(result);
    if (message) form.show(result.kind === 'invalid' ? MESSAGES.otpRejected : message);
  }

  async function requestAgain() {
    form.clear();
    const result = await resend.run(
      { path: '/api/registration/contact-verification/resend', method: 'POST', body: {} },
      verificationWindowDataSchema,
    );
    if (!result) return;
    if (result.kind === 'ok') {
      onWindow(result.data);
      setResent((count) => count + 1);
      return;
    }
    const message = await onFailure(result);
    if (message) form.show(message);
  }

  return (
    <StepFrame
      step="otp"
      title="Digite o código"
      headingRef={headingRef}
      why={
        <p>
          O código confirma que o e-mail é seu. Se preferir, abra o link da mensagem — ele leva você de volta
          para cá já confirmado.
        </p>
      }
    >
      <div className="space-y-6">
        <Notice tone="info" role="status" title={resent > 0 ? 'Pedido de novo código recebido' : 'Pedido recebido'}>
          {MESSAGES.requestSent}
        </Notice>
        <form noValidate onSubmit={submit} className="space-y-6">
          <FormError message={form.error} errorRef={form.errorRef} />
          <TextField
            label="Código de 6 dígitos"
            hint={
              expired
                ? 'Este código expirou. Peça um novo abaixo.'
                : verification.expiresAt
                  ? `O código vale por mais ${formatClock(expiresIn)}.`
                  : 'O código vale por 15 minutos.'
            }
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            error={fieldError}
            disabled={confirm.pending}
            inputClassName="tabular text-center font-display text-3xl font-bold tracking-[0.5em]"
          />
          <Button type="submit" wide forward pending={confirm.pending} pendingLabel="Confirmando…">
            Confirmar e-mail
          </Button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <p className="text-sm text-muted-foreground">Não chegou? Confira spam e lixo eletrônico.</p>
          <Button
            variant="quiet"
            onClick={requestAgain}
            disabled={resendIn > 0 || resend.pending}
            pending={resend.pending}
            pendingLabel="Pedindo…"
          >
            {resendIn > 0 ? (
              <>
                Reenviar em <span className="tabular">{formatClock(resendIn)}</span>
              </>
            ) : (
              'Reenviar código'
            )}
          </Button>
        </div>
      </div>
    </StepFrame>
  );
}
