'use client';

type ProfileVisibilityToggleProps = Readonly<{
  name: 'photoVisibility' | 'presentationVisibility' | 'pronounsVisibility' | 'professionVisibility' | 'languagesVisibility' | 'activityPreferencesVisibility';
  question: string;
  description: string;
  defaultChecked: boolean;
  disabled?: boolean;
}>;

export function ProfileVisibilityToggle({
  name,
  question,
  description,
  defaultChecked,
  disabled = false,
}: ProfileVisibilityToggleProps) {
  return (
    <div className="rounded-2xl border-2 border-border bg-surface p-4 transition-colors has-[:checked]:border-foreground has-[:checked]:bg-primary-muted has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-warning">
      <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4">
        <input
          type="checkbox"
          role="switch"
          name={name}
          value="authenticated"
          defaultChecked={defaultChecked}
          disabled={disabled}
          className="peer sr-only"
        />
        <span className="min-w-0">
          <span className="block font-semibold text-foreground">{question}</span>
          <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
        </span>
        <span
          aria-hidden="true"
          className="relative h-7 w-12 shrink-0 rounded-full border-2 border-muted-foreground bg-card transition-colors after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-muted-foreground after:content-[''] after:transition-[transform,background-color] after:duration-200 after:ease-out peer-checked:border-primary peer-checked:bg-primary peer-checked:after:translate-x-5 peer-checked:after:bg-primary-foreground"
        />
      </label>
      <input type="hidden" name={name} value="private" />
    </div>
  );
}
