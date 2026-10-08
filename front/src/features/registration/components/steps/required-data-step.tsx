import { type FormEvent, useState } from 'react';

import { Button } from '@/components/server/ui/button';
import { Choice } from '@/components/server/ui/choice';
import { TextField } from '@/components/server/ui/text-field';

import {
  DISPLAY_NAME_MAX,
  type RequiredDataRequest,
  requiredDataRequestSchema,
  type StageData,
  stageDataSchema,
  USAGE_INTENTS,
  type UsageIntent,
} from '../../contracts';
import { messageForReason } from '../../messages';
import { useCommand } from '../../use-command';
import { useFormError } from '../../use-form-error';
import { FormError } from '../form-error';
import { StepFrame } from '../step-frame';
import type { StepBaseProps } from './step-types';
import { LocationField } from '@/features/location/components/location-field';
import type { FederativeUnitOption } from '@/features/location/contracts';

export const USAGE_INTENT_LABELS: Record<UsageIntent, { label: string; description: string }> = {
  friendship: { label: 'Fazer amizades', description: 'Conhecer pessoas para conviver.' },
  activity_company: { label: 'Ter companhia para atividades', description: 'Ir junto a shows, trilhas, jogos e afins.' },
  explore_city: { label: 'Descobrir a cidade', description: 'Conhecer lugares e programas novos.' },
  networking: { label: 'Trocar experiências', description: 'Ampliar contatos com quem compartilha interesses.' },
};

type RequiredDataStepProps = StepBaseProps &
  Readonly<{
    initial: Partial<RequiredDataRequest>;
    initialMunicipalityName?: string;
    federativeUnits: readonly FederativeUnitOption[];
    onDraft: (patch: Partial<RequiredDataRequest> & { municipalityName?: string }) => void;
    onSaved: (stage: StageData, data: RequiredDataRequest) => void;
  }>;

export function RequiredDataStep({ headingRef, onFailure, initial, initialMunicipalityName, federativeUnits, onDraft, onSaved }: RequiredDataStepProps) {
  const [displayName, setDisplayName] = useState(initial.displayName ?? '');
  const [ufCode, setUfCode] = useState<RequiredDataRequest['ufCode'] | ''>(initial.ufCode ?? '');
  const [municipalityCode, setMunicipalityCode] = useState(initial.municipalityCode ?? '');
  const [municipalityName, setMunicipalityName] = useState(initialMunicipalityName ?? '');
  const [intents, setIntents] = useState<UsageIntent[]>(initial.usageIntents ?? []);
  const [errors, setErrors] = useState<{ displayName?: string; location?: string; intents?: string }>({});
  const { pending, run } = useCommand();
  const form = useFormError();

  function toggleIntent(intent: UsageIntent, checked: boolean) {
    const next = checked ? USAGE_INTENTS.filter((value) => value === intent || intents.includes(value)) : intents.filter((value) => value !== intent);
    setIntents(next);
    onDraft({ usageIntents: next });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.clear();
    const body = { displayName: displayName.trim(), ufCode: ufCode || undefined, municipalityCode, usageIntents: intents };
    const nextErrors = {
      displayName: body.displayName ? undefined : 'Informe um nome de exibição.',
      location: body.ufCode && body.municipalityCode ? undefined : 'Escolha seu estado e município.',
      intents: intents.length ? undefined : 'Escolha pelo menos uma opção.',
    };
    setErrors(nextErrors);
    const parsedBody = requiredDataRequestSchema.safeParse(body);
    if (!parsedBody.success) return;

    onDraft({ displayName: parsedBody.data.displayName, ufCode: parsedBody.data.ufCode, municipalityCode: parsedBody.data.municipalityCode, municipalityName });
    const result = await run({ path: '/api/registration/required-data', method: 'PUT', body: parsedBody.data }, stageDataSchema);
    if (!result) return;
    if (result.kind === 'ok') {
      onSaved(result.data, parsedBody.data);
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
      step="required_data"
      title="Conte um pouco sobre você"
      headingRef={headingRef}
      why={
        <p>
          Seu nome aparece para quem participa dos mesmos encontros. A localização ajuda a sugerir atividades
          perto de você — nunca mostramos endereço exato.
        </p>
      }
    >
      <form noValidate onSubmit={submit} className="space-y-6">
        <FormError message={form.error} errorRef={form.errorRef} />
        <TextField
          label="Nome de exibição"
          hint="Pode ser seu primeiro nome ou um apelido."
          name="displayName"
          autoComplete="nickname"
          required
          maxLength={DISPLAY_NAME_MAX}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          error={errors.displayName}
          disabled={pending}
        />
        <LocationField
          federativeUnits={federativeUnits}
          initialUfCode={ufCode || undefined}
          initialMunicipalityCode={initial.municipalityCode}
          initialMunicipalityName={initialMunicipalityName}
          error={errors.location}
          disabled={pending}
          onChange={(value) => {
            setUfCode(value.ufCode);
            setMunicipalityCode(value.municipalityCode);
            setMunicipalityName(value.municipalityName);
            onDraft({ ufCode: value.ufCode || undefined, municipalityCode: value.municipalityCode, municipalityName: value.municipalityName });
          }}
        />
        <fieldset className="space-y-3" aria-describedby={errors.intents ? 'intents-error' : 'intents-hint'}>
          <legend className="font-semibold">O que você procura no EventMatch?</legend>
          <p id="intents-hint" className="text-sm text-muted-foreground">
            Escolha uma ou mais opções.
          </p>
          {USAGE_INTENTS.map((intent) => (
            <Choice
              key={intent}
              type="checkbox"
              name="usageIntents"
              value={intent}
              checked={intents.includes(intent)}
              onChange={(event) => toggleIntent(intent, event.target.checked)}
              label={USAGE_INTENT_LABELS[intent].label}
              description={USAGE_INTENT_LABELS[intent].description}
              disabled={pending}
            />
          ))}
          {errors.intents ? (
            <p id="intents-error" className="text-sm font-semibold text-error">
              {errors.intents}
            </p>
          ) : null}
        </fieldset>
        <Button type="submit" wide forward pending={pending} pendingLabel="Salvando…">
          Salvar e continuar
        </Button>
      </form>
    </StepFrame>
  );
}
