# Task: Publicar o conteúdo dos documentos legais e permitir aceite ou recusa no cadastro

- **Slug:** publicar-conteudo-documentos-legais
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-28
- **Status:** implemented
- **Versão-alvo:** 0.11.0
- **Tipo:** feature
- **Impacto público:** additive

> **Atualização de 2026-09-29 (ADR-030, ADR-031):** o passo “Documentos” foi removido e os aceites foram para a tela da senha, com link e diálogo; versão e vigência deixaram de ser exibidas; “Cancelar cadastro” expira o cadastro no backend. Onde este plano descreve o passo `legal-step.tsx`, vale o ADR-031.

## 1. Contexto e Motivação

A TASK 08 de `specs/tasks.txt` pede que o texto dos documentos legais em `docs/legal/pt-BR/` fique no PostgreSQL e seja apresentado no cadastro, para que a pessoa aceite ou não cada documento.

Estado atual, verificado no código:

- `back/drizzle/0004_seed_legal_documents.sql` publica Termos de Uso, Política de Privacidade e Regras de Convivência `pt-BR` 1.0.0 como `approved`, com UUIDs `019c0000-0000-7000-8000-00000000000{1,2,3}` e `content_digest`. Os digests conferem com `sha256sum docs/legal/pt-BR/*.md`. O texto não está no banco.
- `TermsRepositoryPort.listApproved` (`back/src/modules/registration/domain/ports/outbound/persistence.ports.ts:104`) devolve apenas metadados (`ApprovedTermsMetadata`). O adapter `drizzle-terms.repository.ts:18` devolve todas as versões `approved` em ordem crescente de vigência. `findApproved` (`:37`) aceita qualquer id `approved`, sem checar vigência.
- `GET /api/v1/registration/legal-documents` (`registration.controller.ts:290`) usa `LegalDocumentDto` sem `content` (`registration-response.dto.ts:44`), e o exemplo de `version` está errado (`'2026-10-01'`).
- No frontend, `fetchDocuments` (`front/src/shared/server/registration-view.ts:24`) serializa só `id/kind/version/effectiveAt`. Por isso `LegalDocumentView.content` nunca é preenchido, e `legal-step.tsx` mostra sempre “Ainda não é possível concluir o cadastro”.
- `LEGAL_DOCUMENT_TITLES.community_rules` (`view-models.ts`) exibe “Regras da Comunidade”, divergindo do DER e do documento (“Regras de Convivência”).
- Na seleção de documento, `findDocument` pega a **primeira** versão do tipo, que é a mais antiga, pela ordenação atual do adapter.

Decisões confirmadas pela pessoa responsável em 2026-09-28:

- Conteúdo em coluna de `terms_document`, entregue na listagem existente → ADR-028.
- Markdown renderizado com `react-markdown` → ADR-029, renderização no servidor, links apenas `https:`/`mailto:` e o primeiro `#` do corpo omitido.
- Recusa: “Não aceito” explica que sem os três aceites a conta não é ativada, oferece “Rever documentos” e “Sair do cadastro” e não grava nada. O cadastro provisório expira pelo TTL normal.

Rastreabilidade: `docs/DER-EventMatch-MVP.md` v1.3, RF005, RN008 (sequência de conclusão) e RNF023/RNF025 (validação jurídica); `docs/02-regras-de-negocio.md` §2; `docs/03-modelos-de-dominio.md` (schema físico do cadastro); `docs/04-integracoes-externas.md` (linhas das rotas `legal-documents`); ADR-011, ADR-012, ADR-013, ADR-020 e ADR-027.

**Validação jurídica:** em 2026-09-28, a pessoa responsável informou que o jurídico autorizou os três documentos v1.0.0 e o registro de aceites. As condições da ADR-012 ficam cumpridas (registrado na ADR-028), e esta entrega habilita a ativação real. `docs/legal/README.md` e `CHANGELOG.md` devem registrar a autorização. Retenção de dados, cópia de dados e documentos excepcionais (`AGENTS.md` §1) continuam fora deste escopo.

Versão: raiz e frontend passam de `0.10.0` para `0.11.0`; o backend passa de `0.9.0` para `0.10.0`, porque o contrato ganha um campo de forma aditiva e a regra de vigência muda.

## 2. Escopo

Inclui:

- [x] Migration `back/drizzle/0005_legal_document_content.sql` (ADR-028), com coluna `content`, backfill com os três arquivos integrais, `CHECK` de digest, `CHECK` de conteúdo obrigatório para `approved`, trigger de imutabilidade e atualização de `meta/_journal.json`. A `0004` não é alterada.
- [x] `termsDocument.content` no schema Drizzle.
- [x] Value object de domínio `LegalDocumentText`, que separa frontmatter e corpo, sem dependências de framework.
- [x] Porta com `listCurrent(context, locale, now)` substituindo `listApproved`, e `findCurrent(context, ids, now)` substituindo `findApproved`. O adapter devolve uma versão vigente por tipo (`DISTINCT ON (kind)`, `effective_at <= now`, `ORDER BY kind, effective_at DESC, version DESC`), mantendo `FOR SHARE` em `findCurrent`.
- [x] Caso de uso `ListCurrentLegalDocuments`, renomeado de `ListApprovedLegalDocuments`, com `ClockPort` injetado; devolve metadados e corpo. `CompleteRegistration` passa a usar `findCurrent` com o mesmo `now` da transação.
- [x] `LegalDocumentDto.content` (Markdown, sem frontmatter), exemplo de `version` corrigido para `1.0.0`, `@ApiOperation` atualizado e `Cache-Control: no-store` explícito.
- [x] Frontend: `legalDocumentSchema` com `content: z.string().min(1)`; `fetchDocuments` repassa o corpo apenas até o RSC.
- [x] `LegalMarkdown` (Server Component, ADR-029): `app/cadastro/page.tsx` gera `body: ReactNode` por documento e envia à ilha cliente sem o texto bruto.
- [x] ~~`legal-step.tsx`~~ → `terms-consent.tsx` na tela da senha e na revisão (ADR-031): “Li e concordo com …” desmarcado por padrão, nome do documento abre diálogo com o `body` em região rolável acessível, **Aceitar** e **Recusar**; a recusa abre `alertdialog` com “Rever documentos” e “Cancelar cadastro”.
- [x] Corrigir `LEGAL_DOCUMENT_TITLES.community_rules` para “Regras de Convivência”.
- [x] Tratar a troca de versão durante o fluxo: se a conclusão falhar porque um documento aceito deixou de ser vigente, recarregar os documentos (`router.refresh()`), limpar os aceites em memória e pedir novo aceite na revisão com um aviso neutro (ADR-031).
- [x] Cancelamento no backend (ADR-030): `CancelRegistration`, `DELETE /api/v1/registration` e `DELETE /api/registration` no BFF, usados por “Cancelar cadastro” no cabeçalho e no aviso de recusa.
- [x] Documentação: `docs/legal/README.md` (processo de publicação de nova versão e autorização jurídica de 2026-09-28), `docs/02-*`, `docs/03-*`, `docs/04-*`, `front/README.md`, `CHANGELOG.md`, versões, `DESIGN.md` se surgirem novos padrões visuais, e artefatos de revisão do Impeccable.

Exclui:

- Redação ou revisão jurídica do conteúdo.
- Reaceite de novas versões por contas já ativas, login e painel administrativo de publicação.
- Idiomas além de `pt-BR`.
- ~~Operação de cancelamento no backend.~~ Incluída em 2026-09-29 pela ADR-030.
- Cache entre requisições dos documentos (ADR-028).
- Mudanças nos demais passos do cadastro.

## 3. Impacto Arquitetural e ADRs

Arquivos afetados:

```text
back/drizzle/0005_legal_document_content.sql                                  (novo)
back/drizzle/meta/_journal.json                                               (+ entrada 0005)
back/src/modules/registration/infrastructure/persistence/schema/*.ts          (termsDocument.content)
back/src/modules/registration/domain/value-objects/legal-document-text.ts     (novo)
back/src/modules/registration/domain/ports/outbound/persistence.ports.ts      (porta)
back/src/modules/registration/infrastructure/persistence/repositories/drizzle-terms.repository.ts
back/src/modules/registration/application/use-cases/list-current-legal-documents.use-case.ts (renomeado)
back/src/modules/registration/application/use-cases/complete-registration.use-case.ts
back/src/modules/registration/registration.module.ts                          (+ CLOCK no provider)
back/src/modules/registration/presentation/http/controllers/registration.controller.ts
back/src/modules/registration/presentation/http/dto/registration-response.dto.ts
front/package.json, bun.lock                                                  (react-markdown)
front/src/features/registration/contracts.ts
front/src/features/registration/view-models.ts
front/src/shared/server/registration-view.ts
front/src/features/registration/components/legal-markdown.tsx                 (novo, server)
front/src/app/cadastro/page.tsx
front/src/features/registration/components/registration-flow.tsx
front/src/features/registration/components/terms-consent.tsx                  (substitui legal-step.tsx, ADR-031)
front/src/components/client/ui/dialog.tsx                                     (novo, ADR-031)
back/src/modules/registration/application/use-cases/cancel-registration.use-case.ts (novo, ADR-030)
front/src/app/api/registration/route.ts                                       (+ DELETE, ADR-030)
```

Fluxo:

```text
PostgreSQL terms_document (content + digest + CHECK + trigger)
  -> DrizzleTermsRepository.listCurrent(locale, now)      [infrastructure]
  -> ListCurrentLegalDocuments (ClockPort, LegalDocumentText) [application/domain]
  -> RegistrationController GET legal-documents -> LegalDocumentDto{content}  [presentation]
  -> BFF callBackend (internal) -> registration-view.fetchDocuments (zod)      [front server]
  -> app/cadastro/page.tsx: <LegalMarkdown source/> => body: ReactNode          [RSC]
  -> RegistrationFlow ('use client') -> LegalStep: body + aceite/recusa         [client island]
  -> POST complete {documentIds} -> CompleteRegistration.findCurrent FOR SHARE -> terms_acceptance
```

- **Hexagonal:** o domínio ganha `LegalDocumentText`, sem NestJS nem ORM. A aplicação depende de `TermsRepositoryPort` e `ClockPort`. A infraestrutura concentra o SQL. Controller e DTO só mapeiam.
- **DI:** `useCaseProvider(ListCurrentLegalDocuments, [UNIT_OF_WORK_PORT, TERMS_REPOSITORY_PORT, CLOCK_PORT])`, usando o token de clock já existente no módulo. Não há `forwardRef`.
- **RSC/Client:** `react-markdown` roda só no servidor. A ilha recebe `ReactNode` pronto (`bundle-conditional`, `server-serialization`, `server-dedup-props`). Documentos e interesses continuam buscados em paralelo (`async-parallel`, `server-parallel-fetching`). Nova tentativa continua via `router.refresh()`.
- **BFF:** a Route Handler `api/registration/legal-documents` continua só como proxy, agora propagando `content`.
- **PostgreSQL:** mudança aditiva. `sha256()` e `convert_to()` são nativas e imutáveis no PostgreSQL 17 (`docker-compose.back.dev.yml`).

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Conteúdo em `terms_document.content`, integridade por `CHECK` de digest, imutabilidade por trigger, versão vigente por tipo, listagem com conteúdo, sem cache | `docs/adrs/ADR-028-armazenar-e-entregar-conteudo-dos-documentos-legais.md` | accepted | Contrato, schema, regra de vigência e cache são materiais. |
| `react-markdown` como nova dependência, renderizado só no servidor | `docs/adrs/ADR-029-renderizar-markdown-legal-com-react-markdown-no-servidor.md` | accepted | Nova dependência e decisão de fronteira RSC/cliente. |
| Cancelamento com expiração imediata no backend | `docs/adrs/ADR-030-cancelar-cadastro-com-expiracao-imediata.md` | accepted | Nova rota pública e mudança da regra de saída (2026-09-29). |
| Aceite dos documentos na tela da senha, com diálogo | `docs/adrs/ADR-031-aceite-de-documentos-na-senha-com-dialogo.md` | accepted | Remove o passo “Documentos” e muda a posição do aceite no fluxo (2026-09-29). |

A recusa sem gravação é regra de produto registrada em `docs/02-*`; não exige ADR.

Todo ADR necessário deve estar `accepted` antes da implementação.

## 4. Contratos e Interfaces

### 4.1 PostgreSQL (`0005_legal_document_content`)

```sql
ALTER TABLE "terms_document" ADD COLUMN "content" text;
UPDATE "terms_document" SET "content" = $eventmatch_legal$<arquivo integral>$eventmatch_legal$
  WHERE "id" = '019c0000-0000-7000-8000-000000000001';   -- idem …002, …003
ALTER TABLE "terms_document" ADD CONSTRAINT "terms_document_content_digest_check"
  CHECK ("content" IS NULL OR sha256(convert_to("content", 'UTF8')) = "content_digest");
ALTER TABLE "terms_document" ADD CONSTRAINT "terms_document_approved_content_check"
  CHECK ("status" <> 'approved' OR "content" IS NOT NULL);
-- trigger BEFORE UPDATE: se OLD.status in ('approved','retired'), rejeita mudança de
-- kind/version/locale/effective_at/content_digest/content; status só 'approved' -> 'retired'.
CREATE INDEX "terms_document_current_idx" ON "terms_document" ("locale", "kind", "effective_at" DESC)
  WHERE "status" = 'approved';
```

O conteúdo inclui o frontmatter e o `\n` final, exatamente como no arquivo. Uma linha `placeholder` pode ter `content` nulo.

### 4.2 Domínio e portas (assinaturas)

```ts
// domain/value-objects/legal-document-text.ts
export class LegalDocumentText {
  static fromArtifact(markdown: string): LegalDocumentText; // lança erro tipado se o frontmatter estiver malformado
  readonly body: string;                                   // Markdown sem frontmatter, sem espaços à esquerda
}

// domain/ports/outbound/persistence.ports.ts
export interface CurrentTermsDocument {
  readonly id: string; readonly kind: TermsDocumentKind; readonly version: string;
  readonly locale: string; readonly effectiveAt: Date; readonly content: string; // artefato integral
}
export interface TermsRepositoryPort {
  listCurrent(context: TransactionContext, locale: string, now: Date): Promise<CurrentTermsDocument[]>;
  findCurrent(context: TransactionContext, documentIds: string[], now: Date): Promise<ApprovedTermsDocument[]>;
  recordAcceptances(/* inalterado */): Promise<void>;
}
```

`ApprovedTermsMetadata` e `listApproved`/`findApproved` são removidos, porque só têm uso interno.

### 4.3 Aplicação

```ts
export class ListCurrentLegalDocuments {
  constructor(uow: UnitOfWorkPort, terms: TermsRepositoryPort, clock: ClockPort);
  execute(input: { locale: string }): Promise<Array<{
    id: string; kind: TermsDocumentKind; version: string; locale: string; effectiveAt: Date; body: string;
  }>>;
}
```

`CompleteRegistration`: `findCurrent(context, ids, now)`. O restante continua igual; um id não vigente faz `coversRequiredTerms` falhar e retorna `ACCOUNT_CANNOT_BE_ACTIVATED` (`422 activation_unavailable`), como hoje.

### 4.4 HTTP NestJS (`/api/v1`)

| Rota | Mudança | Resposta |
|---|---|---|
| `GET /registration/legal-documents?locale=pt-BR` | `LegalDocumentDto` ganha `content: string` (`@ApiProperty({ description: 'Markdown sem frontmatter' })`). Só a versão vigente de cada tipo. `Cache-Control: no-store`. | `200 { documents[] }`; lista vazia ou parcial quando não houver versão vigente |
| `POST /registration/complete` | Contrato inalterado; a regra passa a exigir ids vigentes | `200` / `422 activation_unavailable` |

A mudança é aditiva: clientes que ignoram `content` continuam funcionando. `LocaleQueryDto` segue validado pelo `ValidationPipe` global.

### 4.5 Frontend

```ts
// contracts.ts
legalDocumentSchema = z.object({ id, kind, version, locale, effectiveAt, content: z.string().min(1) });

// view-models.ts (props da ilha)
export type LegalDocumentView = Readonly<{
  id: string; kind: LegalDocumentKind; version: string; effectiveAt: string;
  body?: ReactNode;   // substitui `content?: string`; ausente => bloqueio
  fixture?: boolean;
}>;

// components/legal-markdown.tsx (Server Component; sem 'use client')
export function LegalMarkdown(props: { source: string }): ReactNode;
```

`registration-view.ts` continua devolvendo dados puros com `content` para o RSC. A conversão em `body` acontece em `page.tsx`, para que o `.ts` do servidor não dependa de JSX.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Qualquer documento `approved` aparece e pode ser aceito | Só a versão vigente de cada tipo (`approved`, maior `effective_at <= now`) aparece e pode ser aceita | RF005, ADR-012, ADR-028 |
| 2 | Texto não existe no banco | Texto integral imutável e coincidente com o digest; linha `approved` sem texto é inválida | ADR-012, ADR-028 |
| 3 | Passo bloqueado por falta de conteúdo | Com as três versões vigentes, o passo permite ler e aceitar; se faltar alguma, continua bloqueado | RF005 |
| 4 | Recusa = não marcar o checkbox | “Não aceito” explícito: aviso de que a conta não será ativada, “Rever documentos” ou “Sair do cadastro”; nenhum aceite ou recusa é gravado; “Sair do cadastro” cancela o cadastro no backend, expirando-o de imediato (atualizado em 2026-09-29 pela ADR-030; antes, expirava pelo TTL) | Decisão de produto 2026-09-28 e 2026-09-29 |
| 5 | — | Aceites ficam só em memória até a conclusão, nunca em `sessionStorage` | ADR-011, `docs/02` §2 |
| 6 | — | Se a versão mudar durante o fluxo, a conclusão falha, os documentos são recarregados e os aceites anteriores são descartados | ADR-028 |
| 7 | — | Fixture de teste continua sem efeito de ativação | ADR-012 |
| 8 | Título “Regras da Comunidade” | “Regras de Convivência” | DER RF005 |

## 6. Critérios de Aceitação

Comportamento:

- Após `bun run --cwd back db:migrate` em banco vazio, as três linhas têm `content` igual, byte a byte, a `docs/legal/pt-BR/*.md`, e os dois `CHECK`s estão ativos. Alterar um caractere faz a migration ou o `UPDATE` falhar.
- `UPDATE` do conteúdo ou do digest de uma linha `approved` é rejeitado pelo trigger. `approved → retired` é aceito.
- `GET legal-documents` devolve três documentos com `content` sem frontmatter, apenas as versões vigentes, e `Cache-Control: no-store`. O Swagger mostra `content` e `version: 1.0.0`.
- No cadastro, os três documentos aparecem formatados (títulos, negrito, listas), sem `---`/frontmatter, sem marcação literal e sem repetir o título `#` do arquivo. Com os três aceites, a conta é ativada e `terms_acceptance` guarda os três ids.
- “Recusar” mostra o aviso com as duas saídas (ADR-031). “Rever documentos” reabre o mesmo documento. “Cancelar cadastro” chama `DELETE /api/registration`, que expira o cadastro no backend e o cookie (ADR-030); em sucesso ou `401`, chama `clearDraft` e navega para `/`; com o backend indisponível, a pessoa permanece na tela com um aviso.
- Um id `retired`, futuro ou inexistente em `documentIds` resulta em `422`; o frontend recarrega os documentos e zera os aceites.

Segurança:

- Não há `dangerouslySetInnerHTML`, `rehype-raw` nem imagens renderizadas. HTML embutido no Markdown é descartado (`skipHtml`).
- Só links `https:` e `mailto:` são renderizados. `http:`, `javascript:`, `data:` e relativos viram texto. `https:` abre em nova aba com `rel="noopener noreferrer"` e o aviso acessível “(abre em nova aba)”.
- Nenhum log contém o conteúdo dos documentos. Aceites não vão para `sessionStorage`.

Performance e Vercel:

- `react-markdown` não aparece em nenhum chunk do cliente (verificar a saída de `next build` / `.next/static`) (`bundle-conditional`).
- O texto bruto não é serializado para a ilha (`server-serialization`, `server-dedup-props`). Documentos e interesses continuam em `Promise.all` (`async-parallel`, `server-parallel-fetching`). Sem estado mutável de módulo (`server-no-shared-module-state`). Aceite e recusa ficam em handlers de evento (`rerender-move-effect-to-event`).

Acessibilidade (Impeccable):

- A hierarquia de títulos fica `h1` (passo) → `h2` (documento, título do cadastro) → `h3`/`h4` (seções `##`/`###`); o primeiro `#` do corpo é omitido. A região rolável tem `role="region"`, nome acessível e `tabIndex=0`. Checkbox e botão têm nomes distintos por documento. O aviso de recusa fica em região `role="status"`, e o foco é gerenciado.
- A tela funciona com zoom de 200% e toque (alvos ≥ 44 px), com contraste AA sobre `--background`/`--card` e feedback que não depende só de cor. Usa só os tokens obrigatórios.
- Capturas desktop e mobile em `.impeccable/review/cadastro/` para o passo com documentos, a recusa e o bloqueio, mais o detector e o finish review do Impeccable.

NestJS (`nestjs-expert`):

- DI por construtor e tokens, sem `new` de serviços. Swagger com `@ApiTags`, `@ApiOperation` e `@ApiOkResponse` atualizados. Erros de domínio tipados, convertidos pelo `RegistrationErrorFilter`. Testes com `Test.createTestingModule`.

## 7. Plano de Testes

Backend unitário (`bun run --cwd back test`):

- `LegalDocumentText`: separa frontmatter, preserva o corpo, rejeita frontmatter malformado e aceita arquivo sem frontmatter.
- `ListCurrentLegalDocuments`: usa o `ClockPort` e mapeia o corpo.
- `CompleteRegistration`: ids não vigentes são rejeitados; `now` é o mesmo da transação.
- Controller e DTO via `Test.createTestingModule`: formato do envelope e cabeçalho `no-store`.

Backend integração (`bun run --cwd back test:integration`, runner descartável):

- Depois das migrations: o conteúdo confere com os arquivos lidos do disco e com `sha256`.
- Os `CHECK`s rejeitam conteúdo divergente e `approved` sem conteúdo; o trigger bloqueia edição.
- `listCurrent` com duas versões (antiga `retired`, futura `approved`, vigente `approved`) devolve só a vigente.
- `findCurrent` usa `FOR SHARE`; `recordAcceptances` é persistido.

Backend E2E (`bun run --cwd back test:e2e`, Supertest):

- `GET legal-documents` com `content`.
- Cadastro completo com os três aceites.
- `complete` com id `retired` → `422`.

Frontend unitário e componentes (`bun run --cwd front test`):

- `LegalMarkdown`: omissão do primeiro `#`, mapeamento dos demais títulos, descarte de HTML e imagens, ausência de frontmatter, links `https:`/`mailto:` com `rel` e aviso de nova aba, e `javascript:`/`http:`/`data:`/relativo convertidos em texto.
- `terms-consent` (ADR-031): estados de aceite, recusa, “Rever documentos”, “Cancelar cadastro”, bloqueio sem `body`, fixture e título “Regras de Convivência”.
- Schema zod exige `content`.

Frontend integração:

- `registration-view` e BFF contra backend fake: `content` propagado, resposta inválida → `unavailable`.
- `page.tsx` entrega `body` sem texto bruto.

E2E full-stack (runner descartável):

- Aceite total → `/cadastro/concluido`.
- Recusa → aviso → cancelar cadastro (ADR-030).
- Documento ausente → bloqueio.
- Troca de versão durante o fluxo → recarga e novo aceite.

Comandos obrigatórios:

```bash
bun run --cwd back lint && bun run --cwd back typecheck && bun run --cwd back test
bun run --cwd back test:integration && bun run --cwd back test:e2e && bun run --cwd back build
bun run --cwd back db:check
bun run --cwd front lint && bun run --cwd front typecheck && bun run --cwd front test && bun run --cwd front build
```

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Diferença de bytes (quebra de linha, BOM, `\n` final) entre o arquivo e o backfill | Média | Alto (migration falha) | `CHECK` de digest falha cedo; teste de integração compara com o disco; gerar o SQL por script efêmero, não versionado, a partir dos arquivos. |
| Delimitador de dollar-quoting presente no texto | Baixa | Médio | Delimitador `$eventmatch_legal$`; teste que garante que ele não aparece em `docs/legal/`. |
| `react-markdown` (ESM/unified) incompatível com Next 16/React 19/Bun | Baixa | Médio | Validar no `build`; rollback para texto puro sem mudar o contrato (ADR-029). |
| Parse do Markdown migrar acidentalmente para o cliente | Média | Médio (bundle) | `LegalMarkdown` sem `'use client'`, teste de bundle e revisão com `bundle-conditional`. |
| Versão publicada durante o cadastro | Baixa | Baixo | Regra 6 e teste E2E. |
| Nova versão publicada sem nova autorização jurídica | Baixa | Alto | `docs/legal/README.md` exige registrar a autorização de cada versão antes da migration de seed. |
| Trigger bloqueando correções legítimas | Baixa | Médio | Corrigir por nova versão, como define o processo em `docs/legal/README.md`. |

Rollout: aplicar `0005` antes de subir o backend `0.10.0`. O backend `0.9.0` continua compatível com a coluna nova. Depois, subir o frontend `0.11.0`. O frontend `0.10.0` com o backend novo continua funcionando, porque zod remove chaves extras e o passo permanece bloqueado.

Rollback: fix-forward com uma migration posterior que remove o trigger e os `CHECK`s e anula `content`, sem apagar documentos nem `terms_acceptance`. O frontend volta ao passo bloqueado.

## 9. Perguntas em Aberto (bloqueantes)

Nenhuma. Armazenamento/entrega, renderização, semântica da recusa, links, título do corpo e autorização jurídica foram decididos em 2026-09-28. ADR-028 e ADR-029 estão `accepted`.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR foi criado para cada decisão material (ADR-028, ADR-029), ambos `accepted`.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices` e `nestjs-expert` foram aplicadas conforme o escopo.
- [x] Testes, migration e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.
