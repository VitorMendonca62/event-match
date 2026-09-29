import { useState } from 'react';

import { Button } from '@/components/server/ui/button';
import { Choice } from '@/components/server/ui/choice';
import { Notice } from '@/components/server/ui/notice';

import { MIN_INTERESTS } from '../../contracts';
import type { Catalog, InterestOption } from '../../view-models';
import { StepFrame } from '../step-frame';
import { CatalogLoading, CatalogUnavailable } from './catalog-state';
import type { StepBaseProps } from './step-types';

type InterestsStepProps = Pick<StepBaseProps, 'headingRef'> &
  Readonly<{
    interests: Catalog<InterestOption>;
    selected: readonly string[];
    onSelectedChange: (ids: string[]) => void;
    onBack: () => void;
    onContinue: () => void;
    onRetry: () => void;
    retrying: boolean;
  }>;

export function InterestsStep({
  headingRef,
  interests,
  selected,
  onSelectedChange,
  onBack,
  onContinue,
  onRetry,
  retrying,
}: InterestsStepProps) {
  const [showMinimum, setShowMinimum] = useState(false);
  // Only ids still offered by the catalog count; the backend revalidates them anyway.
  const offered = interests.status === 'ready' ? new Set(interests.items.map((item) => item.id)) : new Set<string>();
  const count = selected.filter((id) => offered.has(id)).length;
  const enough = count >= MIN_INTERESTS;

  return (
    <StepFrame
      step="interests"
      title="Do que você gosta?"
      headingRef={headingRef}
      onBack={onBack}
      why={
        <p>
          Seus interesses aproximam você de atividades e pessoas com afinidades parecidas. Escolha pelo menos{' '}
          {MIN_INTERESTS}; dá para mudar depois.
        </p>
      }
    >
      {interests.status === 'deferred' ? <CatalogLoading label="Carregando interesses…" /> : null}
      {interests.status === 'unavailable' ? (
        <CatalogUnavailable title="Interesses indisponíveis" onRetry={onRetry} pending={retrying} />
      ) : null}
      {interests.status === 'ready' ? (
        <div className="space-y-6">
          <fieldset>
            <legend className="sr-only">Interesses</legend>
            <ul className="flex flex-wrap gap-2.5">
              {interests.items.map((interest) => (
                <li key={interest.id}>
                  <Choice
                    appearance="chip"
                    type="checkbox"
                    name="interests"
                    value={interest.id}
                    checked={selected.includes(interest.id)}
                    onChange={(event) => {
                      setShowMinimum(false);
                      onSelectedChange(
                        event.target.checked ? [...selected, interest.id] : selected.filter((id) => id !== interest.id),
                      );
                    }}
                    label={interest.label}
                  />
                </li>
              ))}
            </ul>
          </fieldset>
          <p aria-live="polite" className="font-semibold">
            <span className="tabular">{count}</span> {count === 1 ? 'interesse escolhido' : 'interesses escolhidos'}
            {enough ? '' : ` · faltam ${MIN_INTERESTS - count}`}
          </p>
          {showMinimum && !enough ? (
            <Notice tone="error" role="alert" title={`Escolha pelo menos ${MIN_INTERESTS} interesses`}>
              Assim conseguimos sugerir atividades que façam sentido para você.
            </Notice>
          ) : null}
          <Button
            wide
            forward
            aria-disabled={!enough}
            onClick={() => (enough ? onContinue() : setShowMinimum(true))}
          >
            Revisar cadastro
          </Button>
        </div>
      ) : null}
    </StepFrame>
  );
}
