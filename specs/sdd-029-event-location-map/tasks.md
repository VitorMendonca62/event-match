# Task: Selecionar local e revisar área aproximada no mapa

- **Slug:** event-location-map
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-09
- **Status:** implemented (2026-10-09)
- **Versão-alvo:** frontend/workspace `0.22.0`; backend alvo definido no rollout
- **Tipo:** feature
- **Impacto público:** additive (prévia privada do anfitrião; novo endpoint autenticado de busca)

## 1. Contexto e Motivação

A anfitriã não conhece latitude/longitude de cabeça e quer encontrar um local pelo nome e mover o pino. Também quer ver na prévia a área aproximada do encontro. A coordenada exata continua protegida e não deve aparecer na prévia.

Rastreabilidade: TASK 32 em `specs/tasks.txt`; preferência explícita “buscar o local pelo nome e mover o pino”; RF017 e RF020–RF021, RN020–RN021 em `docs/DER-EventMatch-MVP.md`; SDD-027 e ADR-055, ADR-058, ADR-059, ADR-060 e ADR-061.

## 2. Escopo

### Inclui
- [x] Buscar explicitamente um local público/estabelecimento por nome, limitado ao município e UF escolhidos; não consultar enquanto a pessoa digita.
- [x] Mostrar resultados temporários e permitir mover/ajustar o pino; salvar no rascunho somente as coordenadas exatas, cifradas pelo fluxo existente.
- [x] Implementar busca via endpoint NestJS autenticado e integração Nominatim; enviar consulta sem `accountId`, `eventId`, sessão ou texto de endereço residencial, não registrar nem persistir a consulta.
- [x] Garantir no máximo uma solicitação total por segundo ao Nominatim público, compartilhada entre réplicas, respeitar respostas/limites, não implementar autocomplete e permitir troca de provedor por configuração.
- [x] Carregar tiles públicos `tile.openstreetmap.org` somente para a viewport ativa, sob interação da pessoa, obedecer cache, HTTPS, referer e atribuição “© OpenStreetMap contributors”; sem pré-carregamento.
- [x] Incluir na prévia apenas o centro e o raio aproximados retornados pelo backend, com círculo/área legível e texto alternativo; jamais serializar o ponto exato ao preview.
- [x] Informar no formulário que a busca de local é enviada ao serviço de mapas e que a área de prévia é aproximada; não solicitar geolocalização do aparelho.
- [x] Carregar o mapa sob demanda; garantir estados de busca, teclado, acessibilidade e layout móvel.
- [x] Atualizar `docs/04-integracoes-externas.md`, `docs/03-modelos-de-dominio.md`, OpenAPI, changelog e snapshot/índice de migrations se aplicável.

### Fora de escopo
- [ ] Mapa público de descoberta, rotas, localização do aparelho, navegação, tracking ou residência.
- [ ] Guardar texto de busca, nome/endereço do resultado ou coordenada exata no navegador além da edição transitória.
- [ ] Substituir o catálogo IBGE de municípios pelo geocoder; município e UF seguem locais e autoritativos.
- [ ] Alterar a projeção determinística de área aproximada, cifra, acesso ao ponto exato ou regras de lugar não residencial.

## 3. Impacto Arquitetural e ADRs

Decisão aceita em ADR-064: usar os serviços públicos do OpenStreetMap (Nominatim para busca e `tile.openstreetmap.org` para tiles), com as limitações e proteções descritas abaixo.

```text
Browser/Client Component
  -> front Route Handler (BFF, mesma origem, cookie, validação de origem)
    -> back EventsController (sessão + propriedade do rascunho)
      -> application SearchEventLocation
        -> domain PlaceSearchPort
          -> infrastructure Nominatim adapter
          -> PostgreSQL global rate gate (1 chamada/s entre réplicas)

Browser -> tile.openstreetmap.org (somente tiles da viewport solicitada)
Backend -> preview sem ponto exato -> BFF redige owner/location -> mapa de área aproximada
```

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Dados/serviços públicos OSM: Nominatim e tiles padrão | `docs/adrs/ADR-064-servicos-publicos-do-openstreetmap.md` | accepted | Escolha do produto; sem custo de provedor gerenciado, com busca explícita e limites públicos tratados. |
| Integração Nominatim, autenticação, rate gate global, tratamento de resposta e não registro | ADR-064 | accepted | Evita que o browser exponha consulta nos logs de URL e limita chamadas em todas as instâncias. |
| Tiles no navegador com atribuição e cache conforme política pública | ADR-064 | accepted | Permite mapa interativo sem proxy de imagem; os dados exibidos continuam sob controle do backend. |

### NestJS e Next.js

- `events` recebe endpoint de busca com DTO `class-validator`, Swagger, guards existentes, no-store e resposta allowlisted `{ results: [{ label, latitude, longitude }] }` com limite pequeno.
- `SearchEventLocation` verifica que município/UF pertencem ao rascunho do anfitrião antes da busca; mantém texto de consulta fora de domínio persistido, auditoria, logs e telemetria.
- Adapter Nominatim fica em `infrastructure/integrations`, identificado por User-Agent de produto, timeout, saída estrita e nenhum retry automático.
- A contenção global de uma requisição por segundo é compartilhada em PostgreSQL (um estado operacional sem o termo pesquisado); o esquema e a migração serão documentados. Erro/quota upstream degrada somente a busca.
- O BFF autentica, protege contra CSRF e projeta a resposta estritamente. Tiles são client-side e usam URL HTTPS oficial, sem prefetch/offline; a política de referer existente precisa permitir um Referer válido ao host de tiles.
- Mapa é Client Component importado dinamicamente só quando aberto. A camada visual de prévia recebe `approximateArea`; a resposta do formulário continua sendo o único lugar autorizado para mostrar coordenada exata à anfitriã.

## 4. Contratos e Interfaces

- Backend autenticado sob `/api/v1/events/drafts/{eventId}/location-search`, `POST` JSON e `no-store`; resposta limitada a resultados sem ids do provedor, endereço completo ou metadados.
- BFF correspondente sob `/api/events/drafts/{eventId}/location-search`; mesma origem, sessão do rascunho e schema estrito.
- Pedido contém `query` limitado em comprimento e nenhum campo de conta, sessão, latitude/longitude ou endereço estruturado; UF/município são obtidos do rascunho no backend, não confiados do browser.
- Resultado contém apenas rótulo temporário e coordenadas de seleção; não é persistido até salvar o rascunho. Queries sem resultados são respostas vazias e erros públicos genéricos.
- Prévia de proprietário/BFF pode incluir `approximateArea: { latitude, longitude, radiusMeters }` já retornada pelo backend. A projeção não inclui `exactLocation`; nenhum preview público global é adicionado.
- Sem dependência de ORM no domínio/aplicação; adapter de rate gate e geocoding na infraestrutura.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | O formulário pede lat/lon manualmente; preview do BFF remove até a área aproximada. | Busca explícita por local e ajuste de pino; preview desenha somente a área pública aproximada. | RF017, RF020–RF021; ADR-055 |
| 2 | Exato é cifrado no backend e omitido da projeção pública. | Invariante preservado; provedor vê somente consultas explícitas e tiles da viewport em edição. | ADR-055 e ADR-061 |
| 3 | Município é catálogo IBGE local. | Mantém-se autoritativo; pesquisa OSM é contextualizada por município/UF; seleção nunca troca município automaticamente. | ADR-052, ADR-053, ADR-060 |
| 4 | Não há integração de geocoding. | Nominatim público é chamado no máximo 1 vez/s para toda a aplicação; sem autocomplete, busca em lote ou cache persistente de consulta. | Política do Nominatim, ADR-064 |

## 6. Critérios de Aceitação

- A pessoa busca um lugar por ação explícita, recebe resultados dentro do município/UF atuais e pode escolher e mover o pino antes de salvar.
- Se o município escolhido ainda não estiver persistido, a ação “Salvar cidade e abrir mapa” grava somente UF/município antes de consultar o geocoder; as outras mudanças permanecem não salvas. O mapa pode ser ampliado em um diálogo que mantém busca e seleção.
- A prévia exibe mapa com círculo de área aproximada do backend; seu payload não inclui latitude/longitude exatas e o mapa não oferece precisão da coordenada exata.
- Nenhuma consulta ocorre por tecla, endereço ou nome de resultado não fica salvo, e campos exatos não são incluídos no pedido de geocoding.
- Backend verifica propriedade, valida entrada/saída e aplica limite global de 1 req/s. A UI informa espera/limite, ausência de resultado e falha; indisponibilidade da busca não apaga valores nem esconde o mapa, que permanece aberto numa visão geral do Brasil para seleção manual do ponto.
- Tile attribution permanece visível; requests são apenas para tiles necessários à interação; cache respeita headers/TTL de política; não há offline/prefetch.
- Nenhum log, auditoria, métrica, cookie, storage persistente ou erro inclui busca, endereço, resposta crua, coordenada exata, session token ou ID de conta.
- Mapa é sob demanda; funciona por toque, teclado com alternativa de coordenadas/localização textual, foco anunciado, contraste e zoom 200%; captura desktop/mobile e finish review são atualizados.
- Aplicar `vercel-react-best-practices`: `bundle-dynamic-imports`, `bundle-conditional`, `rerender-derived-state-no-effect`, `server-serialization`, `async-api-routes`.
- Aplicar `nestjs-expert`: DTOs `class-validator`, `ValidationPipe`, guard, Swagger, DI por construtor, casos de uso testados, e adapter/porta hexagonal.

## 7. Plano de Testes

- Unitários do domínio/aplicação: usuário não proprietário, município incompatível, vazio/limite de resultados, erros upstream, ausência de persistência/auditoria com query e respeito ao rate gate.
- Integração: rate gate PostgreSQL garante espaçamento global entre duas conexões/instâncias simuladas; rota autenticada, timeout e resposta allowlisted.
- BFF/frontend: mesma origem/cookie, payload filtrado, busca só por submit, estado carregando/429/sem resultado e ausência do ponto exato no preview schema.
- Revisão manual visual: viewport desktop e mobile, tecla/toque, zoom 200%, atribuição OSM, seleção/movimento do pino e preview aproximado; detector Impeccable e finish review.
- Comandos Bun previstos pelo AGENTS para mudanças completas; não executar testes automatizados nesta solicitação.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Nominatim limitado ou indisponível | média | alto | Taxa global, consulta somente explícita, sem autocomplete, erros recuperáveis e URL configurável para troca futura. |
| Serviços OSM públicos bloquearem ou ficarem lentos | média | alto | Atribuição, HTTPS, cache correto, sem prefetch, comunicação de indisponibilidade e migração de provedor configurável. |
| Tiles/consultas revelarem local aproximado ou pesquisa ao OSMF | média | alto | Aviso antes do uso, queries transitórias, busca pelo backend, nenhum ID/conta, mapa de preview somente aproximado. |
| Não encontrar estabelecimento em Nominatim | média | médio | Pino ajustável e modo de seleção/entrada manual de coordenadas preservado. |
| Pressão da tabela de rate gate | baixa | médio | Estado único, retenção mínima e métricas sem consulta; lock curto sem segurar transação durante chamada HTTP. |

Rollout: backend e migration antes do BFF; liberar por `EVENTS_HTTP_ENABLED`/`EVENTS_UI_ENABLED`. Rollback: desligar UI e endpoint de busca, manter evento/posição persistidos; migration operacional preserva o único estado de rate gate. Não remover dados existentes.

## 9. Perguntas em Aberto (bloqueantes)

Nenhuma. Provedor escolhido pelo produto: serviços públicos do OSM.

## 10. Checklist de Conformidade

- [x] Requisitos citam `docs/`, tarefa e ADR.
- [x] ADR-064 está aceito após escolha explícita do produto.
- [x] Nenhum código de produção foi escrito durante o planejamento.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos.
- [x] Privacidade, logs, disponibilidade, atribuição, limite global e performance foram tratados.
- [x] `vercel-react-best-practices` e `nestjs-expert` foram aplicadas conforme o escopo.
- [x] Testes e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.

## 11. Registro da Implementação

- Backend `0.20.0`; frontend/workspace `0.22.0`; ADR-064 aceita; migration aditiva `0015_event_location_search_rate_gate`.
- Lint, typecheck e build de front e back passaram. Testes automatizados não foram executados nesta solicitação.
- Detector Impeccable retornou `[]` para o formulário, seletor de local e mapa.
- A revisão visual em navegador não pôde ser concluída: `/eventos/novo` redirecionou para `/entrar` e não havia sessão autenticada disponível. Capturas anteriores da SDD-027 não foram usadas como evidência visual desta mudança.

### Correção do seletor — 2026-10-09

- O mapa abre somente por ação explícita; ao selecionar município ainda não salvo, “Salvar cidade e abrir mapa” persiste apenas UF/município antes da busca, preservando as demais alterações locais.
- O mapa e os controles de busca podem ser ampliados em diálogo; o formulário de busca continua editável enquanto o mapa tenta centralizar.
- Frontend lint e typecheck passaram; detector Impeccable retornou `[]`. Não foi feita revisão visual autenticada nem execução de testes automatizados.

### Refinamento da seleção do pino — 2026-10-09

- Arraste com mouse reposiciona o ponto; scroll e botões de zoom controlam a escala. O texto estático de instrução foi removido e a dica para leitores de tela preserva o uso por teclado.
- Os resultados mostram, em português, nome do local e apenas rua/número, bairro, município e estado disponíveis; a resposta segue transitória e sem endereço completo.
- A confirmação tem botão adjacente para desmarcar o ponto, sem mensagens redundantes nem coordenadas visíveis. O popup do mapa aplica desfoque ao fundo.
- Não foram executados testes automatizados nesta solicitação.

### Refinamento do mouse e zoom — 2026-10-09

- Os botões de zoom ficam sobre o mapa e usam símbolos gráficos “+” e “−”.
- Arraste com mouse move o mapa com resposta reduzida; a rolagem acumula movimento para evitar saltos rápidos no zoom.

### Seleção confirmada e retorno ao formulário — 2026-10-09

- “Usar esse ponto” confirma as coordenadas, muda o pino para verde e fecha o diálogo ampliado.
- Fechar o diálogo retorna ao campo “Ponto exato, apenas para organização”, com o mapa inline ainda aberto e a tela posicionada nesse campo.
- O botão “Voltar ao ponto” restaura o centro e o zoom do último local escolhido na busca ou confirmado, mesmo depois de mover a visualização.
- Resultados mostram o nome do local em destaque e o endereço (incluindo número quando disponível) abaixo, com menor destaque visual.
- A ação inline que oculta o mapa passa a se chamar “Ocultar mapa”, para distinguir esse comportamento de voltar do diálogo mantendo o mapa disponível.
- Ao escolher um resultado de busca, um segundo pino âmbar marca aquela coordenada e permanece ancorado nela enquanto o pino central é movido para ajustar o ponto. Se os pinos coincidirem, o pesquisado fica visualmente deslocado com uma linha que aponta para a coordenada exata. “Desmarcar ponto” também remove esse marcador de referência.
