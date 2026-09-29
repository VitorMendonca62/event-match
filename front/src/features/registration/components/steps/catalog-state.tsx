import { Button } from '@/components/server/ui/button';
import { Notice } from '@/components/server/ui/notice';

/** Loading and failure states shared by the documents and interests catalogs. */
export function CatalogLoading({ label }: Readonly<{ label: string }>) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((row) => (
        <div key={row} aria-hidden className="h-16 animate-pulse rounded-2xl bg-surface" />
      ))}
    </div>
  );
}

export function CatalogUnavailable({ title, onRetry, pending }: Readonly<{ title: string; onRetry: () => void; pending: boolean }>) {
  return (
    <div className="space-y-4">
      <Notice tone="error" role="alert" title={title}>
        Não conseguimos carregar agora. Suas etapas anteriores continuam salvas.
      </Notice>
      <Button variant="secondary" wide onClick={onRetry} pending={pending} pendingLabel="Carregando…">
        Tentar novamente
      </Button>
    </div>
  );
}
