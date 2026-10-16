# Finish review — SDD-028 e SDD-029

- Data: 2026-10-09
- Superfície: formulário autenticado de criação de encontros e prévia
- Estado: revisão autenticada do formulário e da prévia concluída; capturas desktop/mobile atualizadas. O diálogo de edição do mapa não foi aberto nesta rodada.
- Direção visual: extensão do mundo “Convite Cívico” existente; sem mudança de `DESIGN.md` ou tokens.

## Evidências de implementação

- Formulário, validações, diálogo de publicação, seletor de local e mapa: `src/features/events/components/event-form.tsx`, `event-location-picker.tsx` e `open-street-map.tsx`.
- Contrato da prévia preserva somente a área aproximada; a coordenada exata não faz parte do schema do navegador.
- Busca passa pelo BFF e endpoint NestJS autenticado. O adapter usa Nominatim configurável, sem autocomplete, com cache volátil, timeout e contenção global de uma chamada por segundo.
- Os tiles são carregados sob demanda com atribuição visível “© OpenStreetMap contributors”. O mapa da prévia usa centro e raio aproximados.
- Validações: frontend lint, typecheck e build; backend lint, typecheck e build — todos concluídos com sucesso. `git diff --check` sem ocorrências.
- Detector Impeccable, direcionado aos três componentes de interface, terminou com código 0 e sem achados (`[]`).
- Testes automatizados não foram executados nesta solicitação.

## Limite da revisão visual

A tentativa de abrir `/eventos/novo` redirecionou para `/entrar`. Não havia sessão autenticada disponível, então não foi possível revisar ou capturar os estados desktop, mobile, zoom 200%, erros de campo, interação do pino ou diálogo centralizado no navegador. As capturas já existentes pertencem à SDD-027 e não servem como evidência das mudanças desta entrega.

## Resultado

O diff e o detector não mostraram defeitos conhecidos. A revisão visual autenticada permanece aberta; este registro não declara aprovação visual nem substitui a confirmação da superfície em desktop e mobile.

## Acompanhamento — falha ao localizar o município

- O mapa agora abre numa visão geral do Brasil antes de a busca automática concluir. Se a busca falhar, a pessoa ainda pode aproximar, arrastar e confirmar o pino; uma resposta tardia não substitui um movimento iniciado por ela.
- Lint e typecheck do frontend passaram. O detector Impeccable retornou `[]` para `event-location-picker.tsx`.
- A confirmação visual autenticada continua pendente; não havia sessão ativa no navegador para revisar as capturas desktop e mobile deste estado.

## Acompanhamento — busca e mapa ampliado

- A escolha de município ainda não salvo agora oferece uma ação explícita que persiste somente UF/município e abre o mapa; as demais edições permanecem locais.
- Busca, resultados e mapa foram reunidos num diálogo ampliado; a busca pode ser digitada enquanto o município é localizado.
- Frontend lint e typecheck passaram. O detector Impeccable retornou `[]` para o seletor, o mapa e o formulário.
- A revisão visual autenticada continua pendente, sem sessão de anfitriã disponível para capturar o diálogo em desktop e mobile.

## Acompanhamento — interação e rótulos do mapa

- Arraste com mouse reposiciona o mapa; scroll e botões nomeados aumentam/diminuem o zoom. O modal aplica desfoque no fundo e a seleção pode ser desmarcada sem expor coordenadas no status.
- Os rótulos transitórios priorizam nome em `pt-BR` e mostram somente rua/número, bairro, município e estado disponíveis; esquema/OpenAPI aceitam até 240 caracteres.
- Frontend e backend passaram lint, typecheck e build; o detector Impeccable terminou sem achados. Testes automatizados não foram executados nesta solicitação.
- A revisão visual autenticada permanece pendente: não há sessão de anfitriã disponível para capturas desktop/mobile do fluxo atualizado.

## Acompanhamento — controles internos e sensibilidade

- Os botões gráficos “+” e “−” estão no canto superior do mapa; o arraste do mouse foi desacelerado e o scroll precisa acumular mais movimento por nível de zoom.
- Frontend lint, typecheck e build passaram; o detector Impeccable terminou sem achados. Testes automatizados não foram executados nesta solicitação.
- A checagem visual autenticada ainda depende de uma sessão de anfitriã para capturar desktop e mobile.

## Acompanhamento — confirmar ponto e voltar ao formulário

- Confirmar “Usar esse ponto” atualiza o pino para verde e fecha o diálogo ampliado. Fechar o diálogo retorna ao grupo “Ponto exato, apenas para organização”, com o mapa inline aberto e foco no controle para ampliá-lo.
- O resultado de busca destaca o nome do local e mostra o endereço (incluindo número disponível) abaixo com menor contraste e tamanho.
- A revisão visual autenticada continua pendente; este registro descreve a implementação, sem declarar aprovação visual.

## Acompanhamento — pino independente no resultado pesquisado

- A escolha de um resultado de busca agora desenha um segundo pino âmbar preso à coordenada do local pesquisado; o pino central continua representando o ponto ajustável. Ao arrastar o mapa, os marcadores podem se separar para comparar a posição escolhida com o ponto exato.
- Quando os marcadores coincidem, o pino âmbar aparece deslocado e ligado por uma linha até a coordenada pesquisada, mantendo os dois visíveis sem alterar a posição geográfica de referência.
- “Desmarcar ponto” também remove o marcador do resultado pesquisado. A revisão visual autenticada segue pendente.

## Acompanhamento — voltar ao ponto selecionado

- O mapa inclui “Voltar ao ponto” quando há um local escolhido na busca ou um ponto confirmado. A ação restaura o centro e o zoom salvos sem gravar nem modificar coordenadas.
- Frontend lint, typecheck, build e detector Impeccable foram executados após essa alteração; revisão visual autenticada permanece pendente.

## Atualização final — SDD-030 (2026-10-09)

- A revisão autenticada do formulário e da prévia foi reproduzida em Chromium desktop e mobile. O E2E passou quatro casos; as capturas `eventos-rascunho-*` e `eventos-previa-*` foram renovadas.
- O mapa da prévia mostra a área aproximada e atribuição OSM sem coordenada exata na interface. A verificação do payload confirma `location.approximateArea` presente e `exactLocation` ausente.
- O detector Impeccable dos quatro componentes de eventos não reportou achados. Removidos blur e sombras dos controles/diálogo do mapa; a área modal continua separada por fundo tonal e bordas.
- A privacidade da busca e dos tiles agora é informada no formulário antes da ação de abrir o mapa. O diálogo de edição do mapa não foi aberto nesta rodada; sua interação continua coberta pelo plano/testes de busca em backend, não por captura visual autenticada.
