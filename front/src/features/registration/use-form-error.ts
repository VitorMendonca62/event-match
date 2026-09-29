import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

/**
 * Form-level error summary. Showing an error is caused by a submit, so the focus move happens in
 * that handler (`rerender-move-effect-to-event`), not in an effect.
 */
export function useFormError() {
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  function show(message: string) {
    flushSync(() => setError(message));
    errorRef.current?.focus();
  }

  return { error, errorRef, show, clear: () => setError(null) };
}
