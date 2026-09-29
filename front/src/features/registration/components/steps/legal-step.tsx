import { type RefObject, useRef, useState } from 'react';

import { Button } from '@/components/server/ui/button';
import { Choice } from '@/components/server/ui/choice';
import { Notice } from '@/components/server/ui/notice';

import { LEGAL_DOCUMENT_KINDS } from '../../contracts';
import { type Catalog, LEGAL_DOCUMENT_TITLES, type LegalDocumentView } from '../../view-models';
import { StepFrame } from '../step-frame';
import { CatalogLoading, CatalogUnavailable } from './catalog-state';
import type { StepBaseProps } from './step-types';

type LegalStepProps = Pick<StepBaseProps, 'headingRef'> &
  Readonly<{
    documents: Catalog<LegalDocumentView>;
    accepted: readonly string[];
    onAcceptedChange: (ids: string[]) => void;
    onContinue: () => void;
    /** Leaves the registration without any backend call; the provisional data expires by TTL. */
    onExit: () => void;
    onRetry: () => void;
    retrying: boolean;
  }>;

const DATE = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' });

/**
 * Three approved documents, each accepted by an explicit, unchecked-by-default checkbox or refused
 * with "Não aceito". A missing document or one without text blocks activation; nothing is invented
 * (ADR-012). Acceptances stay in memory, and a refusal records nothing.
 */
export function LegalStep({ headingRef, documents, accepted, onAcceptedChange, onContinue, onExit, onRetry, retrying }: LegalStepProps) {
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [refused, setRefused] = useState(false);
  const refusalRef = useRef<HTMLDivElement>(null);

  function refuse(id: string) {
    onAcceptedChange(accepted.filter((acceptedId) => acceptedId !== id));
    setRefused(true);
    setShowIncomplete(false);
    // The notice mounts after this event, so focus moves once it exists.
    queueMicrotask(() => refusalRef.current?.focus());
  }

  function review(items: readonly LegalDocumentView[]) {
    setRefused(false);
    const next = LEGAL_DOCUMENT_KINDS.map((kind) => findDocument(items, kind)).find(
      (item) => item && !accepted.includes(item.id),
    );
    queueMicrotask(() => {
      if (next) window.document.getElementById(regionId(next.id))?.focus();
      else headingRef.current?.focus();
    });
  }

  return (
    <StepFrame
      step="legal"
      title="Combinados da comunidade"
      headingRef={headingRef}
      why={
        <p>
          Antes de ativar sua conta, leia e aceite os documentos que explicam como o EventMatch funciona, como
          cuidamos dos seus dados e como convivemos nos encontros.
        </p>
      }
    >
      {documents.status === 'deferred' ? <CatalogLoading label="Carregando documentos…" /> : null}
      {documents.status === 'unavailable' ? (
        <CatalogUnavailable title="Documentos indisponíveis" onRetry={onRetry} pending={retrying} />
      ) : null}
      {documents.status === 'ready' ? (
        <DocumentList
          documents={documents.items}
          accepted={accepted}
          onAcceptedChange={onAcceptedChange}
          showIncomplete={showIncomplete}
          refused={refused}
          refusalRef={refusalRef}
          onRefuse={refuse}
          onReview={() => review(documents.items)}
          onExit={onExit}
          onContinue={() => {
            if (LEGAL_DOCUMENT_KINDS.every((kind) => isAccepted(documents.items, accepted, kind))) onContinue();
            else setShowIncomplete(true);
          }}
        />
      ) : null}
    </StepFrame>
  );
}

const regionId = (documentId: string) => `legal-text-${documentId}`;

function findDocument(documents: readonly LegalDocumentView[], kind: string) {
  return documents.find((document) => document.kind === kind);
}

function isAccepted(documents: readonly LegalDocumentView[], accepted: readonly string[], kind: string): boolean {
  const document = findDocument(documents, kind);
  return Boolean(document?.body && accepted.includes(document.id));
}

function DocumentList({
  documents,
  accepted,
  onAcceptedChange,
  onContinue,
  onRefuse,
  onReview,
  onExit,
  showIncomplete,
  refused,
  refusalRef,
}: Readonly<{
  documents: readonly LegalDocumentView[];
  accepted: readonly string[];
  onAcceptedChange: (ids: string[]) => void;
  onContinue: () => void;
  onRefuse: (id: string) => void;
  onReview: () => void;
  onExit: () => void;
  showIncomplete: boolean;
  refused: boolean;
  refusalRef: RefObject<HTMLDivElement | null>;
}>) {
  const blocked = LEGAL_DOCUMENT_KINDS.some((kind) => !findDocument(documents, kind)?.body);

  return (
    <div className="space-y-5">
      {blocked ? (
        <Notice tone="blocked" role="status" title="Ainda não é possível concluir o cadastro">
          Os documentos do EventMatch não estão disponíveis agora. Tente novamente em instantes; não é possível
          ativar a conta sem lê-los.
        </Notice>
      ) : null}
      <ul className="space-y-8">
        {LEGAL_DOCUMENT_KINDS.map((kind) => {
          const document = findDocument(documents, kind);
          const title = LEGAL_DOCUMENT_TITLES[kind];
          return (
            <li key={kind} className="border-t-2 border-border pt-5">
              <h2 className="font-display text-xl font-bold">{title}</h2>
              {document ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Versão <span className="tabular">{document.version}</span> · vigente desde{' '}
                  {DATE.format(new Date(document.effectiveAt))}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Não disponível no momento.</p>
              )}
              {document?.body ? (
                <>
                  {document.fixture ? (
                    <p className="mt-3 inline-block rounded-full border border-warning/60 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-warning">
                      Conteúdo de teste — aceite sem efeito
                    </p>
                  ) : null}
                  <div
                    id={regionId(document.id)}
                    role="region"
                    aria-label={`Texto: ${title}`}
                    tabIndex={0}
                    className="mt-4 max-h-96 overflow-y-auto rounded-xl border border-border bg-background p-4 text-sm leading-relaxed text-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-warning"
                  >
                    {document.body}
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <Choice
                      className="sm:flex-1"
                      type="checkbox"
                      checked={accepted.includes(document.id)}
                      onChange={(event) =>
                        onAcceptedChange(
                          event.target.checked ? [...accepted, document.id] : accepted.filter((id) => id !== document.id),
                        )
                      }
                      label={`Li e aceito: ${title}`}
                    />
                    <Button variant="secondary" aria-label={`Não aceito: ${title}`} onClick={() => onRefuse(document.id)}>
                      Não aceito
                    </Button>
                  </div>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
      {refused ? <RefusalNotice refusalRef={refusalRef} onReview={onReview} onExit={onExit} /> : null}
      {showIncomplete && !blocked ? (
        <Notice tone="error" role="alert" title="Faltam aceites">
          Aceite os três documentos para continuar.
        </Notice>
      ) : null}
      <Button wide forward onClick={onContinue} disabled={blocked}>
        Continuar para interesses
      </Button>
    </div>
  );
}

/** Shown after "Não aceito": explains the consequence and offers a way back or out; records nothing. */
export function RefusalNotice({
  refusalRef,
  onReview,
  onExit,
}: Readonly<{ refusalRef?: RefObject<HTMLDivElement | null>; onReview: () => void; onExit: () => void }>) {
  return (
    <div
      ref={refusalRef}
      tabIndex={-1}
      role="status"
      className="space-y-4 rounded-2xl border-2 border-warning/60 bg-surface p-5 outline-none"
    >
      <p className="font-semibold">Sem os três aceites, sua conta não é ativada</p>
      <p className="text-muted-foreground">
        Nenhum aceite foi registrado. Você pode rever os documentos ou sair do cadastro; os dados já enviados
        expiram sozinhos.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onReview}>
          Rever documentos
        </Button>
        <Button variant="quiet" onClick={onExit}>
          Sair do cadastro
        </Button>
      </div>
    </div>
  );
}
