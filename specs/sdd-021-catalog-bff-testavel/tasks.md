# Task: Padronizar proxies BFF de catálogos em módulo testável

- **Slug:** catalog-bff-testavel
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-07
- **Status:** implemented — ADR-050 aceita em 2026-10-07; frontend/workspace preparado na versão `0.18.0`.
- **Versão-alvo:** workspace/front `0.18.0`; backend inalterado (`0.16.0`)
- **Tipo:** refactor
- **Impacto público:** none

## 1. Contexto e Motivação

A TASK 21 corrige o padrão divergente registrado na revisão da SDD-017: os proxies públicos de interesses, idiomas e preferências de atividades devem residir no mesmo módulo server-side, receber dependências injetáveis e ter a mesma cobertura de segurança. O objetivo é impedir regressão em filtros estritos e falhas fechadas, sem alterar a API do navegador nem a API NestJS.

O código atual é a fonte de verdade e já diverge parcialmente da descrição histórica: interesses usa `registrationHandler(REGISTRATION_OPERATIONS.interests)`, idiomas está inline em sua rota e preferências é exportado por `profile-bff.ts`. O plano preserva a saída efetivamente publicada hoje por cada endpoint antes de unificá-los.

Rastreabilidade: `specs/tasks.txt` TASK 21; `docs/DER-EventMatch-MVP.md` RF006, RF081 e RN147–RN149; `docs/01-visao-geral-arquitetura.md` §§2 e 5; `docs/04-integracoes-externas.md` §§1, 2 e contratos de catálogo; ADR-022, ADR-043 e ADR-044.

## 2. Escopo

### Inclui

- Criar `front/src/shared/server/catalog-bff.ts` com `proxyInterestCatalog`, `proxyLanguageCatalog` e `proxyActivityPreferenceCatalog`, cada uma recebendo `Deps = Readonly<{ env: BffEnv; fetchImpl?: typeof fetch }>`.
- Mover o proxy de preferências de `profile-bff.ts`, retirar interesses do `REGISTRATION_OPERATIONS` e reduzir as três rotas de catálogo a delegações de uma linha.
- Preservar as rotas, query `locale=pt-BR`, envelope, mensagens, status, headers de segurança/no-store, uma chamada upstream, `internal: false` e ausência de sessão/credencial interna.
- Adicionar testes de integração equivalentes para os três catálogos e separar do teste de perfil a cobertura de preferências.
- Declarar `server-only` e marcar os consumidores diretos de `getBffEnv`/`callBackend` listados na ADR-050; provar que a fronteira falha no build quando cruzada por Client Component.
- Atualizar `docs/01-visao-geral-arquitetura.md` e `docs/04-integracoes-externas.md` para indicar o módulo comum e a fronteira de servidor; atualizar manifesto/lockfile e changelog/versão somente se a política de release aprovar a publicação `0.18.0`.

### Exclui

- Alterar rotas, query, envelopes, schemas Zod, mensagens, status, OpenAPI ou contratos NestJS.
- Cache de catálogo, retry, logging novo, autenticação, feature flag, migration ou acesso do frontend ao PostgreSQL.
- Alteração visual, RSC/Client Component de produto ou trabalho de UI; `impeccable` não é acionado porque não há superfície visual.
- Refatorar proxies não relacionados a catálogos, além da marcação `server-only` delimitada.

## 3. Impacto Arquitetural e ADRs

```text
Browser
  -> GET /api/catalog/{interests|languages|activity-preferences}
     -> Route Handler (delegação de uma linha)
        -> shared/server/catalog-bff.ts [server-only]
           -> callBackend(internal: false, cache: no-store)
              -> GET /api/v1/catalog/... ?locale=pt-BR (NestJS; inalterado)
           <- envelope estrito + schema público do catálogo
  <- jsonResponse no-store/nosniff, sem token ou sessão
```

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Módulo único para proxies de catálogo e dependência direta `server-only` | `docs/adrs/ADR-050-catalog-bff-server-boundary.md` | accepted | Separa o BFF de catálogos dos contextos de cadastro/perfil e torna a fronteira cliente-servidor verificável. |

O backend NestJS, suas portas, DI, DTOs, `ValidationPipe`, Swagger, PostgreSQL e migrations não mudam; as diretrizes `nestjs-expert` foram verificadas como não aplicáveis à implementação. No frontend aplicam-se `server-auth-actions`, `async-api-routes`, `server-no-shared-module-state`, `bundle-analyzable-paths` e `bundle-barrel-imports`: uma chamada por request, caminho/import estáticos, nenhuma mutação de estado de request em módulo e nenhum dado/segredo serializado ao cliente.

Toda ADR necessária deve estar `accepted` antes da implementação.

## 4. Contratos e Interfaces

Pseudocódigo interno, sem novo contrato público:

```ts
type CatalogBffDeps = Readonly<{ env: BffEnv; fetchImpl?: typeof fetch }>;

proxyInterestCatalog(deps: CatalogBffDeps): Promise<Response>;
proxyLanguageCatalog(deps: CatalogBffDeps): Promise<Response>;
proxyActivityPreferenceCatalog(deps: CatalogBffDeps): Promise<Response>;
```

| Navegador → BFF | NestJS inalterado | Autenticação | Sucesso | Falhas permitidas |
|---|---|---|---|---|
| `GET /api/catalog/interests` | `GET /api/v1/catalog/interests?locale=pt-BR` | pública; `internal: false` | `200 { interests: ... }` | conserva a resposta atual para `400` e `503` |
| `GET /api/catalog/languages` | `GET /api/v1/catalog/languages?locale=pt-BR` | pública; `internal: false` | `200 { languages: { code, label }[] }` | `400`, `503` |
| `GET /api/catalog/activity-preferences` | `GET /api/v1/catalog/activity-preferences?locale=pt-BR` | pública; `internal: false` | `200 { activityPreferences: { code, label }[] }` | `400`, `503` |

Antes da troca, os testes devem congelar por rota o corpo completo, `content-type`, `cache-control: no-store`, `referrer-policy: no-referrer` e `x-content-type-options: nosniff`; a extração não pode normalizar mensagens nem transformar falhas sem uma alteração pública aprovada. O schema de sucesso é estrito: propriedades extras em item ou `data` fazem retornar a falha fechada já vigente. Nenhuma rota envia `X-EventMatch-BFF-Token`, `Authorization`, cookie ou continuação ao upstream.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Catálogos públicos expõem somente opções ativas no contrato de cada endpoint. | Inalterada; BFF filtra estritamente a projeção permitida. | RN148–RN149; ADR-043/044 |
| 2 | Falha de upstream ou shape inválido não é repassada ao navegador. | Inalterada; cada proxy falha fechado com a resposta já publicada. | TASK 21 |
| 3 | Catálogos não precisam de sessão nem credencial BFF interna. | Inalterada; testes verificam `internal: false` e headers ausentes. | `docs/04` |
| 4 | Módulos BFF dependem de env/cliente backend server-side por convenção. | `server-only` torna o limite verificável no build. | ADR-050 aceita |

## 6. Critérios de Aceitação

- Os três Route Handlers de catálogo delegam somente ao respectivo proxy de `catalog-bff.ts`; não leem env nem fazem `fetch`/`callBackend` localmente.
- `profile-bff.ts` não exporta proxy de catálogo e `REGISTRATION_OPERATIONS` não inclui interesses; nenhum comportamento de perfil/cadastro muda.
- Para cada catálogo, `200` válido passa somente os campos do schema; item/campo extra, envelope inválido, timeout/rede e `5xx` resultam em falha fechada; `400` mantém o mapeamento atual.
- Cada chamada continua única, `cache: 'no-store'`, sem retry, sem estado mutável de request (`async-api-routes`, `server-no-shared-module-state`), e sem token/cookie interno para catálogo público (`server-auth-actions`).
- `server-only` está no manifesto e lockfile, é importado em cada consumidor direto delimitado pela ADR-050 e uma prova de build demonstra que um Client Component não pode importar essa fronteira.
- Não há alteração de banco, migration, NestJS, OpenAPI, cache cross-request, telemetria, UI, acessibilidade visual ou feature flag. Imports são diretos e estáticos (`bundle-analyzable-paths`, `bundle-barrel-imports`).

## 7. Plano de Testes

### Frontend unitário/integração

- Criar `front/tests/integration/catalog-bff.test.ts` (ou equivalente) parametrizado pelos três catálogos, cobrindo URL/query, `internal: false`, ausência de `Authorization`/`X-EventMatch-BFF-Token`, um único fetch e cabeçalhos BFF.
- Por catálogo: sucesso com payload permitido; rejeição de propriedade extra no item e no objeto `data`; envelope inválido; upstream `400`; `500`; e falha de rede/timeout simulada, sempre comparando status e envelope atuais.
- Mover o caso de preferências de `profile-bff.test.ts`; preservar os testes existentes de perfil e cadastro, adaptando somente imports/operação removida.
- Adicionar teste/fixture de compilação que tenta importar `catalog-bff.ts` (e um consumidor marcado) em Client Component e espera falha atribuível a `server-only`; evitar fixture incluída na build normal.

### Regressão e comandos Bun

```text
bun run --cwd front lint
bun run --cwd front typecheck
bun run --cwd front test
bun run --cwd front build
bun run --cwd front test:e2e
```

O E2E é regressão dos endpoints/fluxo de perfil e cadastro; não há E2E NestJS, migration ou teste de banco porque não haverá mudança no backend.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---:|---:|---|
| Centralização alterar mensagem/envelope já público, sobretudo interesses hoje delegado ao handler de cadastro | média | médio | Congelar corpo e headers por rota antes da extração; não usar uma mensagem genérica compartilhada. |
| `server-only` não resolver sob Bun/Next 16 | baixa | alto | Instalar como dependência direta, confirmar resolução e validar build com fixture cliente antes de migrar módulos. |
| Marcação ampla quebrar utilitário usado em cliente | baixa | médio | Inventariar importadores com `rg`, começar pelos consumidores diretos e corrigir apenas dependência inválida, sem remover a proteção. |
| Teste de erro não representar timeout real | baixa | médio | Simular rejeição do `fetchImpl` e manter o teste de `status: 0` pelo cliente backend. |
| Reformatação prévia de `profile-bff.ts` se misturar ao refactor | média | baixo | Fazer commit lógico separado ou reverter somente a mudança sem comportamento após comparar com o commit anterior; não mesclar com `catalog-bff`. |

Rollout: publicar somente o frontend após checks e smoke dos três `GET`; não há migration nem flag. Rollback: reverter o frontend/dependência para a versão anterior; API, contratos e dados permanecem intactos.

## 9. Perguntas em Aberto (bloqueantes)

- [x] Aceitar a ADR-050 para adicionar `server-only` como dependência direta e adotar `catalog-bff.ts` como fronteira única dos proxies públicos de catálogo (aceita em 2026-10-07).
- [x] Confirmar disponibilidade atual de `server-only`: ausente de `front/package.json`, `bun.lock` e da resolução `bun --cwd front` em 2026-10-07.
- [x] Confirmar o escopo backend/banco: nenhum endpoint NestJS, schema, migration, DTO, porta ou Swagger muda.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material.
- [x] Código de produção, testes, fixture de fronteira e documentação foram implementados; backend permanece em `0.16.0`.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices` foi aplicado; `nestjs-expert` foi analisado e não há escopo NestJS.
- [x] Testes, migration inexistente e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.

## 11. Implementação e validação

- [x] Proxies públicos centralizados em `front/src/shared/server/catalog-bff.ts`; as três rotas delegam ao módulo comum.
- [x] Proxy de atividades removido de `profile-bff.ts`; interesses removido de `REGISTRATION_OPERATIONS`.
- [x] `server-only` adicionado aos consumidores server-side delimitados pela ADR-050, com prova de build em `front/tests/fixtures/server-only-boundary/`.
- [x] Cobertura dos três catálogos adicionada em `front/tests/integration/catalog-bff.test.ts`.
- [x] Documentação, changelog, manifests e lockfile atualizados para `0.18.0`; sem alteração de backend, OpenAPI, banco ou migration.
- [x] `bun run --cwd front lint`, `typecheck`, `test`, `build` e `test:server-boundary` passaram; frontend: 165 testes, 0 falhas.
- [x] `bun run --cwd back lint`, `typecheck`, `build` e `test` passaram; a suíte HTTP que abre portas efêmeras foi executada fora do sandbox (367 testes, 0 falhas).
- [x] `bun run --cwd front test:e2e` passou fora do sandbox: 80 testes passaram, 1 foi ignorado.
