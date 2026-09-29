export default function RegistrationLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-6xl space-y-10 px-5 py-6 sm:px-8 lg:px-10">
      <span className="sr-only">Carregando seu cadastro…</span>
      <div aria-hidden className="h-7 w-40 animate-pulse rounded-md bg-surface" />
      <div aria-hidden className="h-3 animate-pulse rounded-full bg-surface" />
      <div aria-hidden className="grid gap-8 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-2xl bg-surface" />
        <div className="h-64 animate-pulse rounded-2xl bg-surface" />
      </div>
    </div>
  );
}
