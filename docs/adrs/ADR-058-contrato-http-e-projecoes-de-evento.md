# ADR-058: Expor comandos de evento autenticados e projeções mínimas por audiência

- **Status:** accepted
- **Data:** 2026-10-08
- **Decisores:** backend, frontend, produto e privacidade
- **Relacionado:** TASK 23.1; `specs/sdd-025-backend-eventos/tasks.md`; RF018–RF021; RN021; RNF001–RNF008
- **Substitui/Substituído por:** N/A

## Contexto

O backend atual recebe chamadas do navegador exclusivamente por BFF autenticado. A fundação de Eventos precisa de comandos de rascunho/publicação e prévia sem permitir que DTOs de proprietário virem, por acidente, resposta pública ou rota de descoberta.

## Drivers da decisão

- Preservar o limite Browser → BFF → NestJS da ADR-022.
- Tornar cada audiência e projeção revisável no contrato OpenAPI.
- Evitar enumeração, exposição de ponto exato e duplicação de regras no BFF.

## Opções consideradas

1. Rotas HTTP autenticadas por BFF, com comandos separados e DTOs de projeção explícitos.
2. Endpoint genérico de CRUD que retorna o registro persistido. Rejeitada: mistura rascunho, ponto exato e dados públicos.
3. Browser falando diretamente com NestJS. Rejeitada: diverge da ADR-022 e do limite BFF.

## Decisão

- Publicar sob `/api/v1/events` somente: `POST /drafts`, `GET /drafts/:eventId`, `PUT /drafts/:eventId`, `GET /drafts/:eventId/preview` e `POST /drafts/:eventId/publish`.
- Todas exigem header interno do BFF, bearer de sessão e capability nova de Eventos; guards resolvem o principal e casos de uso validam que a anfitriã é a proprietária.
- `preview` devolve a projeção pública derivada, sem ponto exato, contato, motivo interno, auditoria ou identificador de segurança. Rotas de lista, detalhe público e localização de confirmado pertencem às TASKs 24 e 25.
- `official` não integra nenhum comando nem DTO desta entrega e permanece imutavelmente `false`; eventos oficiais exigem contexto de Operações futuro.
- DTOs usam `class-validator`, `ValidationPipe`, Swagger, envelopes v1 e filtros de erro tipados. `400` cobre formato inválido, `401` sessão ausente, `403` capacidade/posse negada de modo neutro, `404` recurso não pertencente/ausente sem enumeração e `409` revisão concorrente.

## Consequências

- O BFF da TASK 23.2 apenas autentica, valida origem/JSON, encaminha e filtra respostas; não replica regras, não acessa PostgreSQL e mantém `server-auth-actions`, `async-api-routes`, `server-no-shared-module-state` e `server-serialization`.
- Contratos OpenAPI e schemas do BFF precisam ser publicados coordenadamente antes de habilitar a UI.
- Logs estruturados preservam correlação, rota, status e duração, sem payload, endereço ou token.

## Plano de adoção e rollback

Adicionar endpoints atrás de `EVENTS_HTTP_ENABLED=false` por padrão, aplicar migration, publicar backend e executar Supertest. Depois a TASK 23.2 introduz o BFF. Rollback desliga a flag e restaura a aplicação; não remove dados nem contrato já persistido.

## Evidências e referências

- `docs/adrs/ADR-022-bff-nextjs-para-o-cadastro.md`
- `docs/04-integracoes-externas.md` §§2–3
- `back/src/modules/profiles/presentation/http/controllers/profile.controller.ts`
