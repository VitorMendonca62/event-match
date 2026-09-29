import { useState } from 'react';

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
    onRetry: () => void;
    retrying: boolean;
  }>;

const DATE = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' });

/**
 * Three approved documents, each accepted by an explicit, keyboard-operable checkbox. A missing
 * document or one without approved content blocks activation; nothing is invented (ADR-012).
 */
export function LegalStep({ headingRef, documents, accepted, onAcceptedChange, onContinue, onRetry, retrying }: LegalStepProps) {
  const [showIncomplete, setShowIncomplete] = useState(false);

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
          onContinue={() => {
            if (LEGAL_DOCUMENT_KINDS.every((kind) => isAccepted(documents.items, accepted, kind))) onContinue();
            else setShowIncomplete(true);
          }}
        />
      ) : null}
    </StepFrame>
  );
}

function findDocument(documents: readonly LegalDocumentView[], kind: string) {
  return documents.find((document) => document.kind === kind);
}

function isAccepted(documents: readonly LegalDocumentView[], accepted: readonly string[], kind: string): boolean {
  const document = findDocument(documents, kind);
  return Boolean(document?.content && accepted.includes(document.id));
}

function DocumentList({
  documents,
  accepted,
  onAcceptedChange,
  onContinue,
  showIncomplete,
}: Readonly<{
  documents: readonly LegalDocumentView[];
  accepted: readonly string[];
  onAcceptedChange: (ids: string[]) => void;
  onContinue: () => void;
  showIncomplete: boolean;
}>) {
  const blocked = LEGAL_DOCUMENT_KINDS.some((kind) => !findDocument(documents, kind)?.content);

  return (
    <div className="space-y-5">
      {blocked ? (
        <Notice tone="blocked" role="status" title="Ainda não é possível concluir o cadastro">
          Os documentos oficiais do EventMatch estão em aprovação. Assim que forem publicados, você poderá
          lê-los e ativar sua conta.
        </Notice>
      ) : null}
      <ul className="space-y-6">
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
                <p className="mt-1 text-sm text-muted-foreground">Ainda não publicado.</p>
              )}
              {document?.content ? (
                <>
                  {document.fixture ? (
                    <p className="mt-3 inline-block rounded-full border border-warning/60 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-warning">
                      Conteúdo de teste — aceite sem efeito
                    </p>
                  ) : null}
                  <div
                    role="region"
                    aria-label={`Texto: ${title}`}
                    tabIndex={0}
                    className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-border bg-background p-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-line"
                  >
                    {document.content}
                  </div>
                  <Choice
                    className="mt-4"
                    type="checkbox"
                    checked={accepted.includes(document.id)}
                    onChange={(event) =>
                      onAcceptedChange(
                        event.target.checked ? [...accepted, document.id] : accepted.filter((id) => id !== document.id),
                      )
                    }
                    label={`Li e aceito: ${title}`}
                  />
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
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
