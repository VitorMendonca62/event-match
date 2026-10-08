/**
 * Lock while private, two people once shared. Swapped by the nearest `group/visibility`
 * ancestor's checked switch, so the glyph never disagrees with the input state.
 */
export function VisibilityIcon() {
  return (
    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-muted-foreground group-has-[:checked]/visibility:bg-primary-muted group-has-[:checked]/visibility:text-foreground">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-4 group-has-[:checked]/visibility:hidden">
        <rect x="4" y="9" width="12" height="8" rx="2" />
        <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
      </svg>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="hidden size-4 group-has-[:checked]/visibility:block">
        <circle cx="7.5" cy="7" r="2.75" />
        <path d="M2.5 16.5c0-2.75 2.25-4.5 5-4.5s5 1.75 5 4.5" />
        <path d="M13 4.5a2.5 2.5 0 0 1 0 5M14.5 12.25c1.75.5 3 1.9 3 4.25" />
      </svg>
    </span>
  );
}
