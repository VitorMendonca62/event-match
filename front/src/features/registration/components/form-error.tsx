import type { RefObject } from 'react';

import { Notice } from '@/components/server/ui/notice';

/** Error summary of a step form; receives focus when shown and is announced as an alert. */
export function FormError({ message, errorRef }: Readonly<{ message: string | null; errorRef: RefObject<HTMLDivElement | null> }>) {
  if (!message) return null;
  return (
    <Notice tone="error" role="alert" ref={errorRef} title="Não foi possível continuar">
      {message}
    </Notice>
  );
}
