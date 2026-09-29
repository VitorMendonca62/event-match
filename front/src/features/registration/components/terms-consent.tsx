'use client';

import { useId, useState } from 'react';

import { Dialog } from '@/components/client/ui/dialog';
import { Button } from '@/components/server/ui/button';
import { CheckIcon } from '@/components/server/ui/icons';
import { Notice } from '@/components/server/ui/notice';
import { cn } from '@/shared/ui/cn';

import { LEGAL_DOCUMENT_KINDS } from '../contracts';
import { type Catalog, LEGAL_DOCUMENT_CONSENT, type LegalDocumentView } from '../view-models';
import { CatalogLoading, CatalogUnavailable } from './steps/catalog-state';

type TermsConsentProps = Readonly<{
  documents: Catalog<LegalDocumentView>;
  accepted: readonly string[];
  onAcceptedChange: (ids: string[]) => void;
  /** Gives up the registration; the flow asks the backend to expire it (ADR-030). */
  onCancel: () => void;
  onRetry: () => void;
  retrying: boolean;
}>;

/** DOM id of the link that opens a document; the dialog hands focus back to it when it closes. */
function consentLinkId(documentId: string): string {
  return `consent-link-${documentId}`;
}

/** True when the three documents exist with text, so the person can actually read and accept them. */
export function documentsReady(documents: Catalog<LegalDocumentView>): boolean {
  return (
    documents.status === 'ready' &&
    LEGAL_DOCUMENT_KINDS.every((kind) => documents.items.some((item) => item.kind === kind && item.body))
  );
}

/** True when every required document is offered and accepted. */
export function allAccepted(documents: Catalog<LegalDocumentView>, accepted: readonly string[]): boolean {
  if (documents.status !== 'ready' || !documentsReady(documents)) return false;
  return LEGAL_DOCUMENT_KINDS.every((kind) => {
    const document = documents.items.find((item) => item.kind === kind);
    return Boolean(document && accepted.includes(document.id));
  });
}

/**
 * “Li e concordo com …” (ADR-031). The texts stay closed: the name of each document is a link that
 * opens it in a modal, where the person accepts or refuses. Accepting checks the box; refusing
 * explains that the account is not activated and offers to review the documents or cancel. The box
 * itself never checks without reading: ticking it opens the document.
 */
export function TermsConsent({ documents, accepted, onAcceptedChange, onCancel, onRetry, retrying }: TermsConsentProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [refusedId, setRefusedId] = useState<string | null>(null);

  if (documents.status === 'deferred') return <CatalogLoading label="Carregando documentos…" />;
  if (documents.status === 'unavailable') {
    return <CatalogUnavailable title="Documentos indisponíveis" onRetry={onRetry} pending={retrying} />;
  }

  const items = documents.items;
  const blocked = !documentsReady(documents);

  function accept(id: string) {
    if (!accepted.includes(id)) onAcceptedChange([...accepted, id]);
    setOpenId(null);
  }

  function refuse(id: string) {
    onAcceptedChange(accepted.filter((acceptedId) => acceptedId !== id));
    setOpenId(null);
    setRefusedId(id);
  }

  return (
    <div className="space-y-4">
      {blocked ? (
        <Notice tone="blocked" role="status" title="Ainda não é possível concluir o cadastro">
          Os documentos do EventMatch não estão disponíveis agora. Tente novamente em instantes; não é possível
          ativar a conta sem lê-los.
        </Notice>
      ) : null}
      <ul aria-label="Documentos para aceitar" className="space-y-3">
        {LEGAL_DOCUMENT_KINDS.map((kind) => {
          const document = items.find((item) => item.kind === kind);
          if (!document?.body) return null;
          return (
            <ConsentRow
              key={kind}
              documentId={document.id}
              kind={kind}
              checked={accepted.includes(document.id)}
              fixture={document.fixture}
              onOpen={() => setOpenId(document.id)}
              onUncheck={() => onAcceptedChange(accepted.filter((id) => id !== document.id))}
            />
          );
        })}
      </ul>

      {items.map((document) => (
        <DocumentDialog
          key={document.id}
          document={document}
          open={openId === document.id}
          onClose={() => setOpenId((current) => (current === document.id ? null : current))}
          onAccept={() => accept(document.id)}
          onRefuse={() => refuse(document.id)}
        />
      ))}

      <RefusalDialog
        open={refusedId !== null}
        onReview={() => {
          const id = refusedId;
          setRefusedId(null);
          setOpenId(id);
        }}
        onCancel={() => {
          setRefusedId(null);
          onCancel();
        }}
        onClose={() => setRefusedId(null)}
      />
    </div>
  );
}

function ConsentRow({
  documentId,
  kind,
  checked,
  fixture,
  onOpen,
  onUncheck,
}: Readonly<{
  documentId: string;
  kind: (typeof LEGAL_DOCUMENT_KINDS)[number];
  checked: boolean;
  fixture?: boolean;
  onOpen: () => void;
  onUncheck: () => void;
}>) {
  const id = useId();
  const { article, title } = LEGAL_DOCUMENT_CONSENT[kind];
  return (
    <li
      className={cn(
        'flex min-h-16 items-center gap-3 rounded-2xl border-2 bg-surface p-4',
        checked ? 'border-foreground bg-primary-muted' : 'border-border',
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        aria-labelledby={`${id}-text`}
        onChange={(event) => (event.target.checked ? onOpen() : onUncheck())}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        aria-hidden
        className={cn(
          'grid size-6 shrink-0 cursor-pointer place-items-center rounded-md border-2 border-muted-foreground text-transparent transition-colors',
          'peer-checked:border-primary peer-checked:bg-primary peer-checked:text-foreground',
          'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-warning',
        )}
      >
        <CheckIcon className="size-4" strokeWidth={3} />
      </label>
      <span id={`${id}-text`} className="min-w-0 flex-1 font-semibold">
        Li e concordo com {article}{' '}
        <button
          type="button"
          id={consentLinkId(documentId)}
          onClick={onOpen}
          className="rounded-sm font-bold text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:text-primary-hover focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning"
        >
          {title}
        </button>
        {fixture ? (
          <span className="ms-2 inline-block rounded-full border border-warning/60 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-warning">
            Conteúdo de teste — aceite sem efeito
          </span>
        ) : null}
      </span>
    </li>
  );
}

function DocumentDialog({
  document,
  open,
  onClose,
  onAccept,
  onRefuse,
}: Readonly<{
  document: LegalDocumentView;
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
  onRefuse: () => void;
}>) {
  const id = useId();
  const { title } = LEGAL_DOCUMENT_CONSENT[document.kind];
  const documentId = document.id;
  if (!document.body) return null;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={`${id}-title`}
      returnFocus={() => globalThis.document.getElementById(consentLinkId(documentId))}
    >
      <header className="border-b-2 border-border px-5 py-4 sm:px-6">
        <h2 id={`${id}-title`} className="font-display text-xl font-bold">
          {title}
        </h2>
      </header>
      <div
        role="region"
        aria-label={`Texto: ${title}`}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 text-sm leading-relaxed text-muted-foreground focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-warning sm:px-6"
      >
        {document.body}
      </div>
      <footer className="flex flex-col-reverse gap-3 border-t-2 border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="secondary" onClick={onRefuse}>
          Recusar<span className="sr-only">: {title}</span>
        </Button>
        <Button onClick={onAccept}>
          Aceitar<span className="sr-only">: {title}</span>
        </Button>
      </footer>
    </Dialog>
  );
}

function RefusalDialog({
  open,
  onReview,
  onCancel,
  onClose,
}: Readonly<{ open: boolean; onReview: () => void; onCancel: () => void; onClose: () => void }>) {
  const id = useId();
  return (
    <Dialog open={open} onClose={onClose} labelledBy={`${id}-title`} describedBy={`${id}-text`} role="alertdialog">
      <div className="space-y-3 px-5 py-5 sm:px-6">
        <h2 id={`${id}-title`} className="font-display text-xl font-bold">
          Sem os três aceites, sua conta não é ativada
        </h2>
        <p id={`${id}-text`} className="text-muted-foreground">
          Nenhum aceite foi registrado. Você pode rever os documentos ou cancelar o cadastro; ao cancelar, o
          e-mail e a senha informados são descartados.
        </p>
      </div>
      <footer className="flex flex-col-reverse gap-3 border-t-2 border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar cadastro
        </Button>
        <Button onClick={onReview}>Rever documentos</Button>
      </footer>
    </Dialog>
  );
}
