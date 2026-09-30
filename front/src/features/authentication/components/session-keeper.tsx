'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Keeps a protected page honest across tabs and history (ADR-034, ADR-037). When the page regains
 * focus, becomes visible or is restored from the back/forward cache, the BFF re-validates the
 * session (rotating a due remembered one); a `401` sends the person to `/entrar`. It renders
 * nothing and never sees the token.
 */
export function SessionKeeper() {
  const router = useRouter();

  useEffect(() => {
    let checking = false;

    async function check() {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
        if (response.status === 401 || response.status === 404) router.replace('/entrar');
        else if (response.status === 403) router.refresh();
      } catch {
        // Offline or unavailable: the server re-validates on the next navigation.
      } finally {
        checking = false;
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void check();
    };

    window.addEventListener('focus', check);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router]);

  return null;
}
