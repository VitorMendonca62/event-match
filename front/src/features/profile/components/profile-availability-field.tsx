'use client';

import { useState } from 'react';
import {
  AVAILABILITY_PERIODS,
  AVAILABILITY_WEEKDAYS,
  type AvailabilitySlot,
  type OwnProfile,
  type PreferredDistance,
  PREFERRED_DISTANCES,
} from '../contracts';
import {
  AVAILABILITY_PERIOD_LABELS,
  AVAILABILITY_WEEKDAY_LABELS,
  PREFERRED_DISTANCE_LABELS,
  PREFERRED_DISTANCE_SHORT_LABELS,
} from '../messages';

type Props = Readonly<{
  initial: OwnProfile;
  availabilityError?: string;
  preferredDistanceError?: string;
  onDirty: () => void;
}>;

const WEEKDAY_NIGHT_SLOTS = AVAILABILITY_WEEKDAYS
  .slice(0, 5)
  .map((weekday) => `${weekday}_evening` as AvailabilitySlot);
const WEEKEND_SLOTS = AVAILABILITY_WEEKDAYS
  .slice(5)
  .flatMap((weekday) => AVAILABILITY_PERIODS.map((period) => `${weekday}_${period}` as AvailabilitySlot));

const DISTANCE_OPTIONS: readonly { key: string; distance: PreferredDistance | null; label: string; shortLabel: string }[] = [
  { key: 'none', distance: null, label: 'Não informar', shortLabel: 'Não informar' },
  { key: 'up_to_2km', distance: 'up_to_2km', label: PREFERRED_DISTANCE_LABELS.up_to_2km, shortLabel: PREFERRED_DISTANCE_SHORT_LABELS.up_to_2km },
  { key: 'up_to_5km', distance: 'up_to_5km', label: PREFERRED_DISTANCE_LABELS.up_to_5km, shortLabel: PREFERRED_DISTANCE_SHORT_LABELS.up_to_5km },
  { key: 'up_to_10km', distance: 'up_to_10km', label: PREFERRED_DISTANCE_LABELS.up_to_10km, shortLabel: PREFERRED_DISTANCE_SHORT_LABELS.up_to_10km },
  { key: 'up_to_25km', distance: 'up_to_25km', label: PREFERRED_DISTANCE_LABELS.up_to_25km, shortLabel: PREFERRED_DISTANCE_SHORT_LABELS.up_to_25km },
  { key: 'same_city', distance: 'same_city', label: PREFERRED_DISTANCE_LABELS.same_city, shortLabel: PREFERRED_DISTANCE_SHORT_LABELS.same_city },
];

function distanceIndex(distance: PreferredDistance | null): number {
  if (distance === null) return 0;
  const index = PREFERRED_DISTANCES.indexOf(distance);
  return index < 0 ? 0 : index + 1;
}

export function ProfileAvailabilityField({ initial, availabilityError, preferredDistanceError, onDirty }: Props) {
  const [selected, setSelected] = useState<ReadonlySet<AvailabilitySlot>>(
    () => new Set(initial.availabilitySlots),
  );
  const [preferredDistance, setPreferredDistance] = useState<PreferredDistance | null>(
    initial.preferredDistance,
  );
  const availabilityDescriptionIds = ['availability-hint', 'availability-note', availabilityError ? 'availability-error' : null]
    .filter(Boolean)
    .join(' ');
  const distanceDescriptionIds = ['distance-hint', preferredDistanceError ? 'preferred-distance-error' : null]
    .filter(Boolean)
    .join(' ');
  const preferredDistanceInputDescriptionIds = ['preferred-distance-value', preferredDistanceError ? 'preferred-distance-error' : null]
    .filter(Boolean)
    .join(' ');

  function toggle(slot: AvailabilitySlot, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(slot);
      else next.delete(slot);
      return next;
    });
    onDirty();
  }

  function addSlots(slots: readonly AvailabilitySlot[]) {
    setSelected((current) => new Set([...current, ...slots]));
    onDirty();
  }

  function clearSlots() {
    setSelected(new Set());
    onDirty();
  }

  function chooseDistance(index: number) {
    const option = DISTANCE_OPTIONS[index] ?? DISTANCE_OPTIONS[0];
    setPreferredDistance(option.distance);
    onDirty();
  }

  return (
    <section aria-labelledby="profile-availability" className="space-y-6 border-t border-border pt-10">
      <div>
        <h2 id="profile-availability" className="text-xl font-bold">
          Quando e até onde você costuma ir
        </h2>
        <p id="availability-hint" className="mt-1 max-w-[65ch] text-muted-foreground">
          É opcional e só você vê estas informações. Quando a descoberta existir, elas poderão ajudar a sugerir encontros — por enquanto, a distância ainda não filtra nada.
        </p>
      </div>
      <fieldset aria-describedby={availabilityDescriptionIds} className="space-y-4">
        <legend className="font-semibold">Disponibilidade geral</legend>
        <div className="overflow-hidden rounded-2xl border-2 border-border bg-surface p-3 sm:p-4">
          <table className="w-full table-fixed border-collapse text-center">
            <caption className="mb-3 text-left text-sm text-muted-foreground">
              Marque os períodos em que costuma participar de encontros.
            </caption>
            <colgroup>
              <col className="w-[5.25rem]" />
              {AVAILABILITY_PERIODS.map((period) => <col key={period} />)}
            </colgroup>
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground sm:text-sm">
                <th scope="col" className="pb-3 text-left font-semibold">Dia</th>
                {AVAILABILITY_PERIODS.map((period) => (
                  <th key={period} scope="col" className="px-0.5 pb-3 font-semibold" title={AVAILABILITY_PERIOD_LABELS[period]}>
                    <span className="sm:hidden">{period === 'early_hours' ? 'Madrug.' : period === 'morning' ? 'Manhã' : period === 'afternoon' ? 'Tarde' : 'Noite'}</span>
                    <span className="hidden sm:inline">{AVAILABILITY_PERIOD_LABELS[period]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AVAILABILITY_WEEKDAYS.map((weekday) => (
                <tr key={weekday} className="border-b border-border last:border-b-0">
                  <th scope="row" className="py-1 text-left text-xs font-semibold sm:text-sm">{AVAILABILITY_WEEKDAY_LABELS[weekday]}</th>
                  {AVAILABILITY_PERIODS.map((period) => {
                    const slot = `${weekday}_${period}` as AvailabilitySlot;
                    const label = `${AVAILABILITY_WEEKDAY_LABELS[weekday]} ${AVAILABILITY_PERIOD_LABELS[period].toLocaleLowerCase('pt-BR')}`;
                    return (
                      <td key={slot} className="p-0.5">
                        <label className="mx-auto grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-lg border-2 border-transparent hover:border-muted-foreground has-[:checked]:border-primary has-[:checked]:bg-primary-muted has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-warning">
                          <input
                            type="checkbox"
                            name="availabilitySlots"
                            value={slot}
                            checked={selected.has(slot)}
                            onChange={(event) => toggle(slot, event.currentTarget.checked)}
                            aria-label={label}
                            className="size-5 accent-primary"
                          />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p id="availability-note" className="text-sm text-muted-foreground">
          A madrugada de sexta vai da 0h às 6h de sexta. Se você quer marcar a madrugada depois da noite de sexta, escolha sábado de madrugada.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => addSlots(WEEKDAY_NIGHT_SLOTS)} className="min-h-11 rounded-full border-2 border-border px-4 font-semibold text-foreground hover:border-muted-foreground">
            Dias úteis à noite
          </button>
          <button type="button" onClick={() => addSlots(WEEKEND_SLOTS)} className="min-h-11 rounded-full border-2 border-border px-4 font-semibold text-foreground hover:border-muted-foreground">
            Fins de semana
          </button>
          <button type="button" onClick={clearSlots} className="min-h-11 rounded-full px-3 font-semibold text-muted-foreground underline decoration-border decoration-2 underline-offset-4 hover:text-foreground">
            Limpar
          </button>
        </div>
        <p aria-live="polite" className="text-sm tabular-nums text-muted-foreground">
          <span className="sr-only">Disponibilidade: </span>{selected.size} {selected.size === 1 ? 'período marcado' : 'períodos marcados'}
        </p>
        {availabilityError ? <p id="availability-error" className="font-semibold text-error">{availabilityError}</p> : null}
      </fieldset>
      <fieldset aria-describedby={distanceDescriptionIds} className="space-y-4">
        <legend className="sr-only">Até onde você costuma se deslocar?</legend>
        <p id="distance-hint" className="text-sm text-muted-foreground">
          A distância parte da região informada no seu perfil; o EventMatch não pede a localização do aparelho.
        </p>
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <label htmlFor="preferred-distance-range" className="font-semibold">Até onde você costuma se deslocar?</label>
            <span id="preferred-distance-value" aria-live="polite" aria-atomic="true" className="font-semibold text-foreground">
              {DISTANCE_OPTIONS[distanceIndex(preferredDistance)].label}
            </span>
          </div>
          <input
            id="preferred-distance-range"
            type="range"
            name="preferredDistanceRange"
            min={0}
            max={DISTANCE_OPTIONS.length - 1}
            step={1}
            value={distanceIndex(preferredDistance)}
            onChange={(event) => chooseDistance(Number(event.currentTarget.value))}
            aria-describedby={preferredDistanceInputDescriptionIds}
            aria-invalid={preferredDistanceError ? 'true' : undefined}
            aria-valuetext={DISTANCE_OPTIONS[distanceIndex(preferredDistance)].label}
            className="min-h-11 w-full cursor-pointer accent-primary"
          />
          <input type="hidden" name="preferredDistance" value={preferredDistance ?? ''} />
          <div role="group" aria-label="Escolha uma faixa de distância" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {DISTANCE_OPTIONS.map(({ key, label, shortLabel }, index) => {
              const isSelected = index === distanceIndex(preferredDistance);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => chooseDistance(index)}
                  aria-label={label}
                  aria-pressed={isSelected}
                  className={`min-h-11 rounded-lg border-2 px-2 text-xs leading-tight transition-colors ${isSelected ? 'border-primary bg-primary-muted font-semibold text-foreground' : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'}`}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Só você vê estas informações.</p>
        {preferredDistanceError ? <p id="preferred-distance-error" className="font-semibold text-error">{preferredDistanceError}</p> : null}
      </fieldset>
    </section>
  );
}
