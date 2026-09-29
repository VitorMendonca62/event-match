import type { SVGProps } from 'react';

/**
 * Authored icon set: 24px grid, 2px round stroke, `currentColor`. Decorative by default; pass
 * `aria-hidden={false}` with a `<title>` only when an icon carries meaning alone.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      {...props}
    >
      {children}
    </svg>
  );
}

export function PeopleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16.4 14.3c2.4.1 4.1 1.8 4.6 4.7" />
    </Base>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.2h.01M12 17.2h.01" strokeWidth={2.6} />
    </Base>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 21s-6.5-6.1-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.8" r="2.3" />
    </Base>
  );
}

export function SproutIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 21v-8.5" />
      <path d="M12 12.5C12 8 9 5.5 4.5 5.5 4.5 10 7.5 12.5 12 12.5Z" />
      <path d="M12 10.5c0-3.6 2.6-6 7.5-6 0 4.1-2.8 6-7.5 6Z" />
    </Base>
  );
}

export function HeartOffIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M19.5 12.7 12 20l-7.5-7.3A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 7.5 5.9Z" />
      <path d="M3 3l18 18" />
    </Base>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m9 5 7 7-7 7" />
    </Base>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Base>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Base>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <path d="M12 10v4.5M12 17.2h.01" />
    </Base>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </Base>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6.5L20.5 7" />
    </Base>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 19.5 5.3 16A8 8 0 1 1 8 18.7L4 19.5Z" />
    </Base>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </Base>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </Base>
  );
}
