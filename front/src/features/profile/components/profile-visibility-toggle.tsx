'use client';

import { useId } from 'react';
import { VisibilityIcon } from './profile-visibility-icon';

type ProfileVisibilityToggleProps = Readonly<{
  name: 'photoVisibility' | 'presentationVisibility' | 'pronounsVisibility' | 'professionVisibility' | 'languagesVisibility' | 'activityPreferencesVisibility';
  question: string;
  /** Read by assistive technology; visible only as `note` when it adds something beyond the state. */
  description: string;
  /** Visible explanation that replaces the state line, e.g. why the toggle is locked. */
  note?: string;
  defaultChecked: boolean;
  disabled?: boolean;
}>;

/**
 * Compact audience switch: one row with the question, the current audience in words and the
 * switch. The section intro explains the shared rule once, so rows do not repeat it.
 */
export function ProfileVisibilityToggle({
  name,
  question,
  description,
  note,
  defaultChecked,
  disabled = false,
}: ProfileVisibilityToggleProps) {
  const descriptionId = useId();
  return (
    // `mt-auto` pins the row to the bottom of a flex column, so side-by-side fields keep their
    // switches on one line; in normal flow it resolves to 0.
    <div className="group/visibility mt-auto border-t border-border pt-3">
      <label className="flex cursor-pointer items-start gap-3 rounded-lg has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-warning">
        <input
          type="checkbox"
          role="switch"
          name={name}
          value="authenticated"
          defaultChecked={defaultChecked}
          disabled={disabled}
          aria-describedby={descriptionId}
          className="peer sr-only"
        />
        <VisibilityIcon />
        <span className="min-w-0 flex-1 py-0.5">
          <span className="block text-sm font-semibold text-foreground">{question}</span>
          {note ? (
            <span className="block text-sm text-muted-foreground">{note}</span>
          ) : (
            <span aria-hidden="true" className="block text-sm text-muted-foreground">
              <span className="group-has-[:checked]/visibility:hidden">Só você vê</span>
              <span className="hidden group-has-[:checked]/visibility:inline">Será visível no EventMatch</span>
            </span>
          )}
          <span id={descriptionId} className="sr-only">{description}</span>
        </span>
        <span
          aria-hidden="true"
          className="relative mt-1 h-7 w-12 shrink-0 rounded-full border-2 border-muted-foreground bg-card transition-colors after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-muted-foreground after:content-[''] after:transition-[transform,background-color] after:duration-200 after:ease-out peer-checked:border-primary peer-checked:bg-primary peer-checked:after:translate-x-5 peer-checked:after:bg-primary-foreground peer-disabled:opacity-50"
        />
      </label>
      <input type="hidden" name={name} value="private" />
    </div>
  );
}
