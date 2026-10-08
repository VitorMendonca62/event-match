# Task: Consolidar o BFF de catálogos e delegar a dispensa do convite do perfil

- **Slug:** catalog-bff-dispensa-convite
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-08
- **Status:** ready
- **Versão-alvo:** workspace/front `0.19.1`; backend inalterado em `0.17.0`
- **Tipo:** refactor
- **Impacto público:** none

## 1. Contexto e Motivação

Este plano consolida a TASK 21, já implementada na SDD-021, com a TASK 22, que é o follow-up solicitado para completar o padrão de BFF do contexto de perfil.

A TASK 21 centralizou os proxies públicos de interesses, idiomas e preferências de atividades em `front/src/shared/server/catalog-bff.ts`, reduziu os Route Handlers a delegações, adicionou testes equivalentes e tornou a fronteira `server-only` verificável. O código, a documentação, os testes e a ADR-050 já registram essa implementação; não se deve reabrir esse escopo.

A TASK 22 ainda mantém `POST /api/profile/invitation/dismiss` como exceção: o Route Handler concentra autenticação, proteção same-origin/JSON, leitura do perfil, logging e serialização do cookie, enquanto os demais proxies de perfil estão em `front/src/shared/server/profile-bff.ts`. A extração deve ser interna e preservar integralmente o contrato já publicado.

Rastreabilidade: `specs/tasks.txt` TASK 21 e TASK 22; SDD-021; SDD-015; `docs/DER-EventMatch-MVP.md` RF012–RF016, RN014 e RNF001; `docs/01-visao-geral-arquitetura.md` §§2 e 5; `docs/04-integracoes-externas.md` §§1, 7 e “Perfil v1 e BFF”; ADR-040 e ADR-050.

## 2. Escopo

### Inclui

- Tratar a TASK 21 como baseline implementada e verificar, antes da entrega da TASK 22, que `catalog-bff.ts`, as três rotas de catálogo, os testes de catálogo, `server-only`, a documentação e a ADR-050 continuam coerentes.
- Criar em `front/src/shared/server/profile-bff.ts` um proxy injetável para `POST /api/profile/invitation/dismiss`, com assinatura equivalente a `proxyProfile(request, deps)` e `Deps = Readonly<{ env: BffEnv; fetchImpl?: typeof fetch }>`.
- Transferir para o proxy a flag `PROFILE_UI_ENABLED`, as validações de origem confiável e `Content-Type: application/json`, a leitura da sessão, a consulta a `readOwnProfile`, o mapeamento de status, o logging allowlisted e a serialização do cookie.
- Reduzir `front/src/app/api/profile/invitation/dismiss/route.ts` à obtenção de `getBffEnv()` e à delegação para o proxy de perfil.
- Adicionar cobertura de integração do BFF para todos os caminhos definidos na TASK 22, incluindo contagem de chamadas, headers, cookie, envelope e privacidade dos logs.
- Reexecutar a regressão da fronteira de catálogos da TASK 21 e as validações do frontend afetadas pela refatoração.

### Não inclui

- Alterar rotas, métodos, corpos, envelopes, mensagens públicas, status, headers, flag, prazo do cookie, nome do cookie, escopo `Path`, atributos `HttpOnly`, `SameSite`, `Secure` ou prefixo `__Host-`.
- Alterar a UX do convite, o modelo de completude, o endpoint NestJS, o contrato OpenAPI, sessões, autorização, banco, migrations, cache, retry ou telemetria.
- Juntar o proxy autenticado de perfil a `catalog-bff.ts`; a separação da ADR-050 permanece.
- Validar ou consumir o corpo JSON da dispensa além da checagem já existente de `Content-Type`: a extração não deve introduzir uma nova regra de conteúdo.
- Alterar visual, RSC, Client Components ou surface brief; não há superfície visual nova nesta tarefa.

## 3. Impacto Arquitetural e ADRs

### Baseline da TASK 21

```text
Browser
  -> GET /api/catalog/{interests|languages|activity-preferences}
     -> Route Handler de uma delegação
        -> shared/server/catalog-bff.ts [server-only]
           -> callBackend(internal: false, cache: no-store)
              -> NestJS /api/v1/catalog/* [inalterado]
```

Essa parte está implementada pela SDD-021. A implementação da TASK 22 não altera o limite público de catálogos nem os contratos do backend.

### Mudança planejada para a TASK 22

```text
Browser
  -> POST /api/profile/invitation/dismiss
     -> route.ts: getBffEnv() + proxyProfileInvitationDismiss(request, { env })
        -> profile-bff.ts [server-only]
           -> same-origin/JSON + sessão
           -> readOwnProfile(session, deps)
              -> callBackend(GET /api/v1/profiles/me, internal: true, session)
                 -> NestJS Profiles [inalterado]
           <- profile seguro + invitationSubject interno
        -> jsonResponse + cookie de dispensa + log allowlisted
```

O proxy permanece um adapter de entrada do BFF: não acessa PostgreSQL, não duplica completude, não interpreta regra de domínio e não instancia dependências com `new`. A função usa dependências explícitas por parâmetro, importações estáticas e nenhum estado mutável de request em módulo. O `server-only` já presente em `profile-bff.ts` continua protegendo todos os seus consumidores.

As regras de frontend aplicadas são `async-api-routes` (falhas locais antes do único `await` upstream), `server-no-shared-module-state`, `server-serialization`, `bundle-analyzable-paths` e `bundle-barrel-imports`. Não há trabalho visual; `impeccable` não é acionado porque nenhuma interface é criada ou alterada.

Não há mudança NestJS nesta entrega. A análise de `nestjs-expert` confirma que não serão criados controller, DTO, `ValidationPipe`, provider, porta, adapter, Swagger, migration ou teste de integração backend. Os contratos NestJS e o adapter de perfil devem apenas permanecer cobertos pela regressão existente.

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Adiar o convite por cookie HttpOnly de sete dias vinculado a `invitationSubject` pseudônimo, sem persistência no banco | `docs/adrs/ADR-040-convite-de-perfil-adiado-no-navegador.md` | accepted | A extração não pode mudar cookie, privacidade, idempotência ou fonte de autoridade do perfil. |
| Separar módulos BFF server-only e manter catálogos públicos em `catalog-bff.ts` | `docs/adrs/ADR-050-catalog-bff-server-boundary.md` | accepted | A TASK 21 já implementou e aceitou essa fronteira; a TASK 22 não deve misturar o proxy autenticado de perfil com catálogos. |
| Extrair a dispensa para `profile-bff.ts` | Nenhum novo ADR | não material | Refatoração interna já prescrita pela TASK 22, sem mudança de contrato, limite front/back, persistência, segurança ou regra de negócio. |

Todo ADR necessário está aceito antes da implementação; não há ADR `proposed` nova para esta consolidação.

## 4. Contratos e Interfaces

### Função interna do BFF

Assinatura planejada, sem novo contrato público:

```ts
type Deps = Readonly<{
  env: BffEnv;
  fetchImpl?: typeof fetch;
}>;

proxyProfileInvitationDismiss(
  request: Request,
  deps: Deps,
): Promise<Response>;
```

O nome da função pode ser ajustado para seguir a convenção já usada no módulo, mas deve ser único, explícito e não exportar dados internos além do necessário ao Route Handler/testes.

### Compatibilidade externa obrigatória

| Caminho | Comportamento preservado |
|---|---|
| `PROFILE_UI_ENABLED = false` | `404`, envelope de falha, sem upstream e sem cookie. |
| Origem ausente/repetida/estranha ou `Content-Type` diferente de `application/json` | `403`, envelope de falha, sem upstream e sem cookie. “Conteúdo inválido” nesta refatoração significa a checagem de tipo já existente; não se adiciona parsing do corpo. |
| Sessão ausente ou inválida | `401`, envelope de falha, cookie de sessão expirado, sem upstream. |
| Perfil lido com sucesso | `200`, `data: {}`, mensagem `Invitation dismissed.`, uma leitura autenticada de `/api/v1/profiles/me` e cookie de convite de sete dias com o `invitationSubject` pseudônimo. |
| Upstream `401` | `401`, cookie de sessão expirado, sem exposição do corpo upstream. |
| Upstream `403` | `403`, sem cookie de convite ou sessão novo. |
| Upstream indisponível, status não mapeado ou `200` com shape inválido | `503`, envelope genérico, sem cookie de convite. |

O sucesso continua emitindo `Set-Cookie` com `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=604800`, `Secure` em produção, nome `__Host-eventmatch_profile_invite` em produção, nome de teste/desenvolvimento fora de produção e sem `Domain`. A resposta usa `content-type: application/json; charset=utf-8`, `cache-control: no-store`, `referrer-policy: no-referrer` e `x-content-type-options: nosniff` por meio de `jsonResponse`.

O único upstream é `GET /api/v1/profiles/me`, com `internal: true`, Bearer da sessão e credencial BFF interna adicionada somente por `callBackend`; cookie, `invitationSubject`, token e dados do perfil não são enviados ao navegador em JSON nem aos logs. Não há alteração em OpenAPI, DTOs, portas, enums, tabelas, índices, constraints ou migrations.

### Telemetria

O evento permanece `profile.invite.dismiss` com `scope: profile-bff`, status, duração e `correlationId` aleatório. Nenhum corpo, query, cookie, subject, token, perfil, UUID, fingerprint ou stack trace entra no log.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | O convite só é dispensado quando a UI de perfil está habilitada, a requisição é same-origin/JSON e há sessão válida. | Inalterada; a lógica apenas muda de arquivo. | TASK 22; ADR-040; `docs/04` §Perfil v1 e BFF |
| 2 | O backend continua autoridade para o perfil e para `invitationSubject`; o BFF não calcula completude. | Inalterada; o proxy reutiliza `readOwnProfile`. | ADR-040; SDD-015 |
| 3 | Uma dispensa bem-sucedida é local ao navegador, dura sete dias e é isolada por sujeito pseudônimo. | Inalterada; cookie e atributos permanecem byte a byte equivalentes. | ADR-040 |
| 4 | `401` expira sessão; `403` é preservado; falhas indisponíveis resultam em `503`. | Inalterada em todos os caminhos. | TASK 22; `docs/04` §Perfil v1 e BFF |
| 5 | Catálogos públicos são proxies `server-only`, sem sessão ou credencial interna, com filtro estrito e falha fechada. | Inalterada; a SDD-021 é somente baseline de regressão. | ADR-050; SDD-021 |

## 6. Critérios de Aceitação

- `front/src/app/api/profile/invitation/dismiss/route.ts` contém somente a obtenção do ambiente e a delegação para o proxy de perfil, sem autenticação, logging, cookie ou chamada upstream inline.
- O proxy mantém exatamente a flag, as checagens same-origin/JSON, a leitura de sessão, o envelope, a mensagem pública, o mapeamento `401`/`403`/`404`/`503`, os headers e os cookies atuais.
- Requisição válida faz exatamente uma chamada autenticada a `GET /api/v1/profiles/me`; requisição bloqueada localmente não chama o backend.
- O corpo JSON da resposta nunca contém `invitationSubject`, token, cookie, perfil ou erro upstream; o cookie de dispensa continua sendo o único local de saída do subject pseudônimo.
- Logs mantêm apenas os campos allowlisted de `profile.invite.dismiss`; testes demonstram ausência de subject, token, cookie e conteúdo do perfil.
- O módulo `profile-bff.ts` continua protegido por `server-only`; nenhum módulo de catálogo ou perfil autenticado é importado por Client Component.
- Os endpoints públicos de catálogo e a prova de fronteira da TASK 21 permanecem verdes; nenhum contrato NestJS, migration ou acesso frontend ao PostgreSQL é introduzido.
- Lint, typecheck, testes e build do frontend passam; o smoke E2E existente não identifica regressão no cadastro/perfil.

## 7. Plano de Testes

### Frontend unitário/integração

- Criar `front/tests/integration/profile-invitation-bff.test.ts` ou incorporar uma seção isolada ao teste de `profile-bff`, usando `fetchImpl` injetável e as fixtures existentes.
- Sucesso: validar `200`, envelope exato, ausência de dados de perfil no JSON, um único upstream, caminho `GET /api/v1/profiles/me`, `Authorization` de sessão, credencial BFF somente no upstream, ausência de cookie encaminhado e cookie de convite com todos os atributos.
- Flag desligada: validar `404` e zero chamadas upstream.
- Origem ausente/estranha/repetida e `Content-Type` inválido: validar `403` e zero chamadas upstream. Manter explícito que JSON malformado com `Content-Type` válido não recebe regra nova nesta refatoração.
- Sessão ausente/forma inválida: validar `401`, cookie de sessão expirado e zero chamadas upstream.
- Upstream `401`, `403`, `503`/falha de rede e `200` com shape inválido: validar o mapeamento de status, cookies e envelope sem repassar detalhes.
- Telemetria: capturar temporariamente `console.info`, que é o sink padrão atual de `logBffEvent`, e validar `scope`, operação, status, duração e correlation id; confirmar que subject, token, cookie e perfil não aparecem.
- Manter `front/tests/unit/profile.test.ts` cobrindo nome, prazo, isolamento por subject e atributos do cookie; não substituir teste unitário por teste do proxy.

### Regressão da TASK 21 e fronteiras

- Reexecutar `front/tests/integration/catalog-bff.test.ts` para interesses, idiomas e preferências de atividades, incluindo shape estrito, falha fechada, status `400`/`503`, chamada única e ausência de credencial interna.
- Reexecutar `front/tests/verify-server-only-boundary.sh` para comprovar que `catalog-bff.ts` continua inacessível a Client Components; confirmar que `profile-bff.ts` permanece sob a mesma fronteira.

### Comandos Bun

```text
bun run --cwd front lint
bun run --cwd front typecheck
bun run --cwd front test
bun run --cwd front build
bun run --cwd front test:server-boundary
bun run --cwd front test:e2e
```

Como não há alteração em `back/`, migration ou contrato NestJS, não são necessários testes de integração PostgreSQL/E2E da API para a implementação. `bun run --cwd back lint`, `bun run --cwd back typecheck` e `bun run --cwd back build` podem ser executados como smoke de workspace, mas uma falha localizada no backend não é atribuída a esta refatoração sem evidência de regressão.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---:|---:|---|
| A extração alterar mensagem, status, headers ou ordem dos cookies | média | médio | Congelar respostas por caminho nos testes antes da troca; comparar o handler atual com o proxy e manter `jsonResponse`/helpers existentes. |
| O proxy consumir o body ou acrescentar uma validação não existente | baixa | médio | Preservar somente `hasJsonContentType`; registrar no teste que não há parsing novo do corpo. |
| Subject pseudônimo, token ou perfil aparecer em log/JSON durante a movimentação | baixa | alto | Reutilizar `readOwnProfile` apenas internamente, remover dados antes da resposta e testar o sink allowlisted e o corpo serializado. |
| Importação acidental do BFF por Client Component | baixa | alto | Manter `import 'server-only'`, imports diretos e executar a prova de build da fronteira. |
| Regressão silenciosa na TASK 21 por conflito de imports/reformatação | baixa | médio | Reexecutar testes de catálogo e comparar o diff limitado a `profile-bff.ts`, rota e testes da dispensa. |

Rollout: publicar somente o frontend após os testes de integração e smoke; não há migration, alteração de banco, flag nova ou deploy coordenado com o backend. Rollback: reverter o artefato frontend para a versão anterior ou desligar `PROFILE_UI_ENABLED`; cookies, sessões, API e dados permanecem compatíveis.

## 9. Perguntas em Aberto (bloqueantes)

- Nenhuma. A TASK 22 declara o contrato e os casos sem dúvida bloqueante; ADR-040 e ADR-050 já estão aceitas. O plano permanece `ready`.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs existentes.
- [x] Toda decisão arquitetural material aplicável usa ADR aceita; nenhuma ADR nova é necessária para uma extração interna sem alteração de contrato.
- [x] Nenhum código de produção foi escrito neste planejamento.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explicitamente preservados; não há alteração de contrato ou schema.
- [x] Performance, segurança, privacidade, telemetria e fronteira server-only foram tratadas.
- [x] `vercel-react-best-practices` foi aplicada ao Route Handler/BFF; `nestjs-expert` foi analisada e backend permanece inalterado.
- [x] Testes unitários, integração, smoke E2E e comandos Bun estão planejados.
- [x] Rollout e rollback foram definidos; não há migration a executar ou reverter.
- [x] Perguntas bloqueantes foram exauridas.
