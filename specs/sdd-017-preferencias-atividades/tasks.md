# Task: Adicionar preferências opcionais de atividades ao perfil

- **Slug:** preferencias-atividades
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-06
- **Status:** implemented — ADR-044 aceita em 2026-10-06; implementação concluída e revisada em 2026-10-06 (`code-reviewer`: APROVADO; finish review Impeccable: `ship`). Pronta para commit/PR; follow-up em TASK 21 (§11).
- **Versão-alvo:** workspace/front `0.15.0`; back `0.14.0`
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A Task 15 pede preferências de atividades mais específicas, sem confundi-las com os três interesses obrigatórios. O DER separa três conceitos (RN147):

| Conceito | Representa | Exemplo | Quem escolhe |
|---|---|---|---|
| Interesse | gosto amplo | Música | pessoa, obrigatório (≥ 3) |
| Tipo de atividade | o que acontece no evento | Show ou apresentação musical | anfitrião, no evento (RF017) |
| Preferência de atividade | características desejadas da experiência | Grupo pequeno, ambiente tranquilo | pessoa, opcional (RF081) |

O texto original da Task 15 citava o catálogo de tipos de atividade, o que duplicaria os interesses. Produto confirmou em 2026-10-06:

- catálogo canônico: **Preferências de atividades do DER §3.10** (12 opções);
- **até cinco** escolhas;
- **sem prioridade** ou ordenação explícita;
- uma visibilidade para a lista, **`private` por padrão**, editável entre `private | authenticated`.

Rastreabilidade: `docs/DER-EventMatch-MVP.md` RF012, RF015, RF017, RF022–RF023, RF081; RN008, RN014, RN147–RN149; §3.10. `docs/01-visao-geral-arquitetura.md` (Perfis e Preferências; Catálogos), `docs/02-regras-de-negocio.md` §§2 e 10, `docs/03-modelos-de-dominio.md` §§2.2 e 2.11, `docs/04-integracoes-externas.md` (perfil e catálogos); ADR-038, ADR-043, ADR-044; brief `front/.impeccable/surfaces/src-app-perfil-page-tsx.md`.

> **Gate de execução:** concluído. A ADR-044 foi aceita em 2026-10-06 e o plano está liberado para `code-implementer`.

## 2. Escopo

### Inclui

- [x] Criar catálogo versionado `activity_preference` com as 12 opções do DER, códigos estáveis, ordem e estado ativo.
- [x] Expor `GET /api/v1/catalog/activity-preferences?locale=pt-BR` público, `no-store`, com proxy BFF filtrado.
- [x] Permitir selecionar de zero a cinco preferências únicas e ativas, remover e preservar item já selecionado que foi desativado.
- [x] Aplicar visibilidade única à lista, `private` por padrão, editável entre `private | authenticated`.
- [x] Ampliar agregado, repositório, purga de expiração, visão própria, prévia e update atômico com revisão.
- [x] Criar migration aditiva `0009` com seed idempotente e default privado para contas existentes.
- [x] Estender `/perfil` e `/perfil/previa` com seção acessível, estados de limite, item desativado e erro de catálogo.
- [x] Atualizar docs 01–04, OpenAPI, `CHANGELOG.md`, versões, surface brief e testes.
- [x] Executar revisão visual Impeccable delimitada com capturas desktop/mobile e finish review.

### Exclui

- Catálogo de tipos de atividade (pertence ao fluxo de criação de eventos, RF017).
- Prioridade, ranking, peso ou ordenação definida pela pessoa.
- Algoritmo de recomendação, filtros de descoberta, aprendizado implícito ou porta de leitura para descoberta.
- Criação de opções pela pessoa, texto livre ou console de operação de catálogos.
- Disponibilidade, distância, localização, região estruturada (Tasks 16 e 20).
- Audiência `public`, perfil consultável por terceiros e moderação.
- Qualquer alteração nos interesses obrigatórios, completude, habilitação de anfitrião ou eventos.

### Entregas verticais

1. **Catálogo de preferências:** schema, seed, porta, adapter, caso de uso, controller, DTO, BFF e testes.
2. **Preferências no perfil:** agregado, persistência, update atômico, purga, prévia, OpenAPI e testes.
3. **Experiência web:** carregamento RSC paralelo, seção acessível, prévia, E2E e validação visual.

## 3. Impacto Arquitetural e ADRs

### Estrutura prevista

```text
back/drizzle/0009_profile_activity_preferences.sql

back/src/modules/catalog/
├── domain/ports/activity-preference-catalog-reader.port.ts
├── application/use-cases/list-active-activity-preferences.use-case.ts
├── infrastructure/persistence/
│   ├── schema/catalog.schema.ts                       (+ activityPreference)
│   └── drizzle-activity-preference-catalog-reader.adapter.ts
├── presentation/http/
│   ├── controllers/activity-preferences.controller.ts
│   └── dto/activity-preferences.dto.ts
└── catalog.module.ts                                   (provider + export + NoStore)

back/src/modules/profiles/
├── domain/entities/profile.ts                          (+ activityPreferences, visibility)
├── domain/errors/profile.error.ts                      (+ 2 códigos/reasons)
├── domain/services/profile-preview-projector.ts
├── domain/ports/outbound/profile-repository.port.ts    (+ activityPreferenceCodes)
├── application/use-cases/profile.use-cases.ts
├── infrastructure/persistence/
│   ├── schema/profiles.schema.ts                       (+ coluna, profileActivityPreference)
│   ├── drizzle-profile-repository.adapter.ts
│   └── drizzle-profile-writer.adapter.ts               (purga na expiração)
├── presentation/http/
│   ├── dto/profile-request.dto.ts
│   ├── dto/profile-response.dto.ts
│   └── profile-error.filter.ts
└── profiles.module.ts                                  (+ porta nos use cases)

front/src/
├── app/api/catalog/activity-preferences/route.ts
├── app/perfil/page.tsx                                 (fetch paralelo)
├── app/perfil/previa/page.tsx
└── features/profile/
    ├── components/profile-activity-preferences-field.tsx
    ├── components/profile-form.tsx
    ├── contracts.ts
    └── messages.ts
```

### Fluxo

```text
GET /perfil (RSC, no-store)
  -> em paralelo:
     GET /api/v1/profiles/me
     GET /api/v1/catalog/interests
     GET /api/v1/catalog/languages?locale=pt-BR
     GET /api/v1/catalog/activity-preferences?locale=pt-BR
  -> serializa perfil + opções { code, label } à ilha cliente

PUT /api/profile (browser)
  -> BFF: sessão, origem, JSON, tamanho (limite atual de 8 KiB basta)
  -> PUT /api/v1/profiles/me
     -> UpdateOwnProfile [UoW + revision]
        -> valida interesses, idiomas e preferências pelas portas de catálogo
        -> Profile.update valida limite/unicidade/visibilidade
        -> atualiza profile + relações (incl. profile_activity_preference)
  <- visão própria com activityPreferences[{ code, label, active }]

GET /perfil/previa (RSC, no-store)
  -> GET /api/v1/profiles/me/preview
  -> ProfilePreviewProjector: inclui activityPreferences só se authenticated e não vazia
```

### Hexagonal, DI e NestJS (`nestjs-expert`)

- `catalog` é dono de `activity_preference` e exporta `ACTIVITY_PREFERENCE_CATALOG_READER_PORT`; `profiles` depende apenas da porta, sem importar adapter ou schema de preferências fora da camada de persistência (o join de leitura em `profiles.schema` segue o padrão já existente de `language`).
- Domínio e aplicação sem NestJS/Drizzle/HTTP. Erros novos são tipados em `ProfileError` e traduzidos pelo `ProfileErrorFilter`.
- Adapter com `@Injectable()` e constructor injection; use case registrado por `useCaseProvider`, sem `new`, `forwardRef()` ou dependência circular.
- `UpdateOwnProfile`, `GetOwnProfile` e `PreviewOwnProfile` recebem a nova porta. Leituras de catálogo ocorrem dentro da UoW; nenhum I/O externo na transação.
- Controller com `@ApiTags('catalog')`, `@ApiOperation`, `@ApiOkResponse`/erros; DTO de query com `class-validator` (`locale` restrito a `pt-BR`), mesmo padrão de `LanguagesController`.

### RSC, Client Components e performance (`vercel-react-best-practices`)

- `/perfil` inicia os quatro fetches juntos e aguarda em paralelo (`async-parallel`, `server-parallel-fetching`); falha do catálogo de preferências degrada somente a seção, sem derrubar a página.
- A ilha recebe apenas `{ code, label }` ativos e os itens selecionados com `active` (`server-serialization`).
- Com 12 opções, a seleção é um grupo de checkboxes sem busca nem request por interação; estado derivado na renderização (`rerender-derived-state-no-effect`, `rerender-move-effect-to-event`).
- Importações diretas, sem nova dependência de UI (`bundle-barrel-imports`, `bundle-analyzable-paths`).
- Route Handler apenas valida e delega, sem estado de módulo nem PostgreSQL (`async-api-routes`, `server-auth-actions`, `server-no-shared-module-state`).

### PostgreSQL e migration

`back/drizzle/0009_profile_activity_preferences.sql`, aditiva e forward-only:

| Objeto | Alteração/colunas | Constraints e índices |
|---|---|---|
| `profile` | `activity_preferences_visibility text NOT NULL DEFAULT 'private'` | `CHECK in ('private','authenticated','public')` |
| `activity_preference` | `code`, `label_pt_br`, `sort_order`, `active`, `created_at`, `updated_at` | PK `code`; `CHECK code ~ '^[a-z][a-z0-9_]{1,39}$'`; rótulo não vazio; `UNIQUE(sort_order)`; índice `(active, sort_order)` |
| `profile_activity_preference` | `account_id`, `preference_code`, `selected_at` | PK `(account_id, preference_code)`; FK `account` `ON DELETE CASCADE`; FK `activity_preference`; índice `(preference_code)` para descoberta futura |

Seed com os 12 códigos da ADR-044 (`sort_order` 10..120) via `ON CONFLICT (code) DO UPDATE` de rótulo/ordem, como `0008`. Limite de cinco garantido no domínio sob compare-and-set da revisão; constraints garantem unicidade e referências. Contas existentes recebem só a visibilidade privada.

Rollback: UI desligada, aplicações revertidas, schema e dados preservados; sem down migration destrutiva.

### ADRs

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Catálogo próprio de preferências (DER §3.10), relação normalizada, até cinco sem prioridade, visibilidade de grupo privada por padrão | `docs/adrs/ADR-044-preferencias-de-atividades-no-perfil.md` | accepted | Define semântica vs. interesses/tipos, persistência, códigos, desativação e privacidade. |
| Visibilidade `private\|authenticated` com `public` reservado | `docs/adrs/ADR-038-modelo-de-completude-e-visibilidade-do-perfil.md` | accepted | Reutilizada sem mudança. |
| Padrão de catálogo relacional + update atômico | `docs/adrs/ADR-043-identidade-opcional-e-catalogo-de-idiomas.md` | accepted | Reutilizado sem mudança. |

Toda ADR necessária deve estar `accepted` antes da implementação.

## 4. Contratos e Interfaces

### 4.1 Domínio e portas (pseudocódigo)

```ts
// catalog
export const ACTIVITY_PREFERENCE_CATALOG_READER_PORT: unique symbol;
type ActivityPreferenceSummary = Readonly<{ code: string; label: string; active: boolean }>;
interface ActivityPreferenceCatalogReaderPort {
  listActive(context, locale: 'pt-BR'): Promise<readonly ActivityPreferenceSummary[]>; // sort_order
  findByCodes(context, codes: readonly string[]): Promise<readonly ActivityPreferenceSummary[]>;
}

// profiles
type ProfileActivityPreference = Readonly<{ code: string; label: string; active: boolean }>;
ProfileState += {
  activityPreferences: readonly ProfileActivityPreference[];   // ordem do catálogo
  activityPreferencesVisibility: ProfileFieldVisibility;
};
PersistedProfileState += { activityPreferenceCodes: readonly string[] };
ProfileErrorCode += 'UNKNOWN_ACTIVITY_PREFERENCE' | 'INACTIVE_ACTIVITY_PREFERENCE';
ProfileError.reason += 'unknown_activity_preference' | 'inactive_activity_preference';
```

`Profile.update` exige `activityPreferences.length <= 5`, códigos únicos e visibilidade em `private | authenticated`. `UpdateOwnProfile` busca `findByCodes(input ∪ atuais)`; desconhecido → `UNKNOWN_ACTIVITY_PREFERENCE`; inativo que não estava selecionado → `INACTIVE_ACTIVITY_PREFERENCE`; inativo já selecionado é preservado. A lista resultante é ordenada pela ordem do catálogo, nunca pela do payload.

### 4.2 HTTP NestJS

Envelope padrão e `Cache-Control: no-store` em todas as rotas.

| Método e rota | Mudança | Sucesso | Falhas allowlisted | Auth |
|---|---|---|---|---|
| `GET /api/v1/catalog/activity-preferences?locale=pt-BR` | nova | `200 { activityPreferences: { code, label }[] }` | `400`, `503` | pública (`internal: false`) |
| `GET /api/v1/profiles/me` | `+ activityPreferences: { code, label, active }[]`, `+ activityPreferencesVisibility` | `200` | `401`, `403`, `404`, `503` | sessão |
| `PUT /api/v1/profiles/me` | `+ activityPreferenceCodes: string[]` (0..5, únicos, regex do código), `+ activityPreferencesVisibility: 'private'\|'authenticated'` — **obrigatórios** | `200` | `400`, `401`, `403`, `409`, `422`, `503` | sessão + capacidade |
| `GET /api/v1/profiles/me/preview` | `+ activityPreferences?: { code, label }[]` | `200` | `401`, `403`, `404`, `503` | sessão |

DTO: `@IsArray() @ArrayMaxSize(5) @ArrayUnique() @Matches(..., { each: true })` e `@IsEnum(['private','authenticated'])`, com `@ApiProperty` (`maxItems: 5`). `422` devolve `data.reason` allowlisted sem ecoar códigos enviados. Prévia não expõe visibilidade nem `active`.

Compatibilidade: aditiva na leitura; no `PUT`, os novos campos obrigatórios fazem um cliente antigo receber `400`. Como os schemas Zod do frontend são estritos, front e back são publicados de forma coordenada (mesma janela da SDD-016).

### 4.3 BFF e frontend

- `GET /api/catalog/activity-preferences` delega com `internal: false` e filtra `{ activityPreferences: { code, label }[] }` estritamente; erro upstream → `400`/`503` genérico.
- `contracts.ts`: `activityPreferenceSchema` (`code` com a regex do backend, `label` não vazio), `ownActivityPreferenceSchema` (+ `active`), campos novos em snapshot/update/preview; `activityPreferenceCodes` `.max(5)` com refine de unicidade.
- `PUT /api/profile` mantém limite de 8 KiB, mesma origem e sem retry; apenas repassa os novos campos.
- `messages.ts` traduz `unknown_activity_preference`/`inactive_activity_preference`.

### 4.4 UX e acessibilidade (`impeccable`)

- Nova seção sem card **"Como você gosta dos encontros"** logo após "Interesses", com uma frase que diferencia: interesses dizem do que você gosta; preferências, como prefere que o encontro seja. Opcional, sem impacto na completude.
- `fieldset` + `legend` com checkboxes (chips de alvo ≥ 44 px), ordem do catálogo, contador `n/5` em `aria-live="polite"`. Ao atingir cinco, os não selecionados ficam `aria-disabled` com explicação textual, sem esconder opções.
- Item desativado já escolhido aparece selecionado com rótulo "Opção descontinuada", pode ser desmarcado, e uma vez desmarcado não retorna à lista; orientação para escolher outra.
- Falha do catálogo mostra estado recuperável apenas na seção; salvar continua possível preservando a seleção atual.
- Controle de visibilidade binário existente (`profile-visibility-toggle`) ao fim da seção; nenhum consentimento global.
- Prévia mostra a lista somente quando autorizada, depois de interesses.
- Erros associados ao campo e resumidos na região focável existente; conflito/rascunho seguem SDD-015. Teclado, leitor de tela, zoom 200%, mobile em uma coluna e `prefers-reduced-motion` validados.
- Surface brief do `/perfil` atualizado antes da UI; sem mudança durável em `DESIGN.md`.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Perfil não possui preferências de atividade. | Lista opcional de 0–5 preferências do catálogo próprio, removível. | RF081, ADR-044 |
| 2 | Interesses: mínimo três ativos. | Inalterado; preferências não substituem, reduzem nem validam interesses. | RN008, RN147 |
| 3 | Catálogos do DER podem ser acrescentados/desativados sem mudar significado. | Preferência desativada continua legível, pode ser preservada, não pode ser readicionada. | RN148, ADR-044 |
| 4 | — | Sem prioridade: conjunto exibido na ordem do catálogo. | decisão de produto 2026-10-06 |
| 5 | — | Opções aparentemente opostas podem coexistir ("ambas aceitáveis"). | ADR-044 |
| 6 | Grupos opcionais começam `private`; editável `private\|authenticated`. | Mesma regra para a lista de preferências. | RN014, ADR-038 |
| 7 | Completude com seis itens. | Inalterada; preferências não concedem capacidade nem alteram eventos. | RF016, ADR-038 |
| 8 | Update por snapshot + revisão. | Preferências participam da mesma mutação atômica. | ADR-038, ADR-043 |
| 9 | — | Sem uso em recomendação/filtros nesta entrega. | Task 15 fora de escopo |

## 6. Critérios de Aceitação

- Catálogo lista exatamente as 12 opções do DER em ordem estável; somente ativas.
- `PUT` aceita 0–5 códigos únicos ativos; seis, duplicado, desconhecido ou inativo novo → rejeição sem gravar nenhuma parte do snapshot.
- Item desativado já selecionado é lido, preservável e marcado `active: false`; após remoção, readição → `422 inactive_activity_preference`; a UI orienta substituição.
- Alterar preferências não altera interesses, completude, capacidades nem eventos.
- Contas existentes e novas começam com lista vazia e visibilidade `private`; prévia omite a lista quando privada ou vazia.
- Conflito de revisão → `409`, sem substituição parcial da relação.
- Expiração/exclusão de conta remove `profile_activity_preference` (purga e cascata).
- Respostas não autorizadas, logs e métricas não contêm códigos/rótulos de preferências da pessoa.
- Controller com Swagger completo; DTOs `class-validator`; DI por construtor; `Test.createTestingModule` nos testes de composição.
- Frontend não acessa PostgreSQL nem duplica regra; BFF filtra resposta e falha fechado em resposta inválida.
- Seção operável por teclado e leitor de tela, sem deslocamento de layout no limite/erro; desktop, mobile e zoom 200%.
- Regras Vercel citadas na §3 aplicadas e verificadas na revisão.
- Um passe conjunto de capturas desktop/mobile, correção em lote, no máximo uma confirmação e finish review Impeccable.

## 7. Plano de Testes

### Backend unitário

- `Profile`: 0/5/6 preferências, duplicatas, visibilidade `public` rejeitada, ausência válida.
- `UpdateOwnProfile`: desconhecido, inativo novo vs. preservado, ordem do catálogo independente do payload, conflito, interesses inalterados.
- `ProfilePreviewProjector`: matriz `private/authenticated` × vazio/não vazio, sem `active`.
- `ListActiveActivityPreferences`: ordem, ativos, locale.
- Controller/DTO/filter/módulo via `Test.createTestingModule`, incluindo metadados Swagger e reasons allowlisted.

### Backend integração/PostgreSQL

- Upgrade `0008 -> 0009`: default privado, seed idempotente após rerun do migrator, checks, FKs, cascata, unicidade, índice e ledger com dez migrations.
- Compare-and-set concorrente entre duas transações: um vencedor, relação íntegra.
- Desativação: leitura histórica, preservação e recusa após remoção.
- Purga de expiração remove a relação.

### Backend E2E (Supertest)

- Catálogo público ordenado com `no-store`; sessão/capacidade nas rotas de perfil; `PUT` válido; `400` (sem campos novos, 6 itens, regex), `409`, `422`; prévia sem lista privada; OpenAPI versionada.

### Frontend unitário/integração

- Schemas estritos, mensagens, limite cinco com `aria-disabled`, item descontinuado, desmarcar/remover, snapshot completo.
- RSC: quatro fetches em paralelo e degradação isolada do catálogo de preferências.
- BFF de catálogo: filtro, erros, `internal: false`; `PUT /api/profile` repassa campos e traduz `422`.

### Frontend E2E/visual (Playwright)

- Login → `/perfil` → escolher preferências → limite → salvar → alternar visibilidade → prévia → remover. Teclado integral e axe em desktop/mobile; capturas e zoom 200% no passe Impeccable.

### Comandos de validação

```text
bun run --cwd back lint
bun run --cwd back typecheck
bun run --cwd back test
bun run --cwd back test:integration
bun run --cwd back test:e2e
bun run --cwd back build
bun run --cwd front lint
bun run --cwd front typecheck
bun run --cwd front test
bun run --cwd front test:e2e
bun run --cwd front build
```

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Pessoa confundir preferências com interesses | média | médio | seção separada, frase explicativa e exemplos; nenhuma opção repete interesse. |
| Sinal ambíguo por opções opostas | média | baixo | semântica "ambas aceitáveis" documentada; recomendação futura decide uso. |
| Backend novo rejeitar `PUT` do frontend antigo (campos obrigatórios) | aceita na janela | alto | `PROFILE_UI_ENABLED=false` durante migration/deploy; publicação coordenada e smoke conjunto. |
| Substituição parcial da relação | baixa | alto | UoW única + compare-and-set; teste de concorrência. |
| Desativação quebrar edição | baixa | médio | preservação de item histórico e recusa apenas de readição. |
| Formulário longo | média | médio | 12 checkboxes compactos, sem busca/wizard; revisão Impeccable. |
| Vazamento em logs | baixa | médio | telemetria só com operação/resultado; testes asseguram ausência de conteúdo. |

Rollout: `PROFILE_UI_ENABLED=false` → migration `0009` → backend `0.14.0` → frontend `0.15.0` → smoke de catálogo/perfil/prévia → E2E/capturas → `PROFILE_UI_ENABLED=true` → monitorar apenas contagens de resultado. Rollback: UI desligada, aplicações revertidas, schema/dados preservados; correções forward-only.

## 9. Perguntas em Aberto (bloqueantes)

- [x] Catálogo canônico: preferências do DER §3.10 (decidido 2026-10-06).
- [x] Limite: até cinco (decidido 2026-10-06).
- [x] Prioridade: nenhuma (decidido 2026-10-06).
- [x] Visibilidade: `private | authenticated`, default `private` (decidido 2026-10-06).
- [x] Produto/arquitetura aceitou a ADR-044 como escrita em 2026-10-06 (códigos em inglês `snake_case`, coexistência de opções opostas e título da seção).

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices`, `impeccable` e `nestjs-expert` foram aplicadas conforme o escopo.
- [x] Testes, migration e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.

## 11. Revisão (2026-10-06)

**`code-reviewer`: APROVADO**, sem divergências bloqueantes.

| Comando | Resultado |
|---|---|
| `back` lint, typecheck, build | ok |
| `back` test | 354 passaram |
| `back` test:integration | 59 passaram |
| `back` test:e2e | 26 passaram |
| `front` lint, typecheck, build | ok |
| `front` test | 149 passaram |
| `front` test:e2e | 76 passaram (rodada final, já com as capturas de evidência). Na primeira rodada houve uma falha intermitente no helper `registerAccount`, alheia a esta entrega, que passou 4/4 ao ser repetida. |

**Finish review Impeccable: `ship`**, sem correções materiais (`front/.impeccable/review/finish-review.md`). Foi feito em passe in-thread degradado, porque o agente revisor não está disponível no harness. O E2E de preferências passou a gerar capturas do limite 5/5, da prévia com a lista e do zoom 200% (640 × 400 CSS), com checagem de rolagem horizontal.

Pendências registradas, nenhuma bloqueante:

- **TASK 21** (`specs/tasks.txt`): padronizar o BFF de catálogos em `front/src/shared/server/catalog-bff.ts`, com testes para os três catálogos. O mesmo trabalho adiciona `server-only` e separa a reformatação sem mudança funcional de `profile-bff.ts`.
- Quando o catálogo falha (`options === null`), um `422` de preferência só aparece no resumo de status, não junto à seção. Ajuste de UX menor, a avaliar.
- `front/next-env.d.ts` é artefato de build e não deve entrar no commit.
- O helper E2E `registerAccount` é intermitente e merece investigação separada.
