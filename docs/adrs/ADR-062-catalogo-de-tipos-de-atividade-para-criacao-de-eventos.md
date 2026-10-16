# ADR-062: Disponibilizar o catálogo de tipos de atividade para criação de eventos

- **Status:** accepted
- **Data:** 2026-10-09
- **Decisores:** produto, backend e frontend
- **Relacionado:** TASK 23.1, TASK 23.2, ADR-056, ADR-058, ADR-060
- **Substitui/Substituído por:** N/A

## Contexto

O contrato de Eventos aceita `activityTypeCode` e projeta o rótulo de um item já salvo, mas não oferece uma consulta para que a anfitriã selecione um tipo de atividade ao iniciar um rascunho. O frontend não pode embutir nem inferir o catálogo versionado do banco.

## Opções consideradas

1. Expor uma leitura pública e limitada do catálogo ativo, sob o contexto `catalog`, para consumo server-side pelo frontend e pelo BFF quando necessário.
2. Duplicar os códigos e rótulos no bundle do frontend. Rejeitada: cria divergência do catálogo autoritativo e exige novo deploy para cada alteração.
3. Criar o rascunho sem tipo e pedir que a pessoa digite um código. Rejeitada: não é uma interação compreensível e invalida a finalidade do catálogo.

## Decisão

- Adicionar `GET /api/v1/catalog/event-activity-types?locale=pt-BR`, público, sem sessão nem credencial interna, retornando no máximo os itens ativos ordenados por `sortOrder`, cada um como `{ code, label }`.
- O endpoint reutiliza uma porta de leitura do catálogo de Eventos; controller, DTO, OpenAPI, schema e testes permanecem separados do agregado e dos comandos autenticados.
- O frontend o consome no Server Component de criação; a resposta é validada por schema estrito. Nenhum código, rótulo ou lista é duplicado no Client Component além das opções necessárias à interação.
- Respostas recebem `no-store`; formato inválido, indisponibilidade ou campos extras falham fechados no frontend/BFF. A rota não publica atividade inativa, métricas de uso, eventos associados ou dados de anfitriãs.

## Consequências

- A TASK 23.2 passa a depender de uma pequena extensão backend/OpenAPI antes de sua implementação.
- A decisão preserva ADR-056 como dona do vocabulário e ADR-058 como dona dos comandos de rascunho.

## Aceite

Aceita em 2026-10-09: o catálogo permanece autoritativo no backend, é exposto como leitura pública limitada e chega ao navegador pelo proxy server-only do Next.js, no mesmo padrão de interesses, idiomas, preferências, UFs e municípios.

## Evidências

- `back/src/modules/events/domain/ports/event-activity-type-catalog.port.ts`
- `back/src/modules/events/application/use-cases/list-active-event-activity-types.use-case.ts`
- `back/src/modules/events/infrastructure/persistence/drizzle-event-activity-type-catalog.adapter.ts`
- `back/src/modules/events/presentation/http/controllers/event-activity-types.controller.ts`
- `back/src/modules/events/presentation/http/dto/event-activity-types-response.dto.ts`
- `docs/adrs/ADR-056-catalogo-e-atributos-de-evento.md`
- `docs/adrs/ADR-058-contrato-http-e-projecoes-de-evento.md`
