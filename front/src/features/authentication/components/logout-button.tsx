'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/server/ui/button';

/**
 * Ends the current session. The BFF expires the cookie whatever the upstream result, so the page
 * always leaves with history replacement; a second click while pending does nothing (ADR-037).
 */
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  async function logout() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: '{}',
        credentials: 'same-origin',
        cache: 'no-store',
      });
    } catch {
      // The local cookie is HttpOnly; the next protected request re-validates on the server anyway.
    }
    router.replace('/entrar');
  }

  return (
    <Button variant="secondary" onClick={logout} pending={pending} pendingLabel="Saindo…">
      Sair
    </Button>
  );
}
