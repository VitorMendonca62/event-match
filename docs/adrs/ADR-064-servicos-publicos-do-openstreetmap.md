# ADR-064: Usar os serviços públicos do OpenStreetMap para o mapa de eventos

- **Status:** accepted
- **Data:** 2026-10-09
- **Decisores:** produto e engenharia
- **Relacionado:** TASK 32; SDD-029; RF017, RF020–RF021; ADR-052, ADR-055, ADR-058, ADR-059, ADR-060 e ADR-061
- **Substitui/Substituído por:** —

## Contexto

A anfitriã precisa buscar o nome de um local público, mover o pino e ver na prévia uma área aproximada. O evento já guarda a coordenada exata cifrada no backend e a projeção de prévia já recebe uma área aproximada calculada no servidor. Ainda não existe mapa interativo nem geocoding.

O produto escolheu **serviços públicos do OpenStreetMap (OSM)**, depois de conhecer a diferença entre uso público, provedor OSM gerenciado, fornecedor comercial alternativo e hospedagem própria. Essa escolha não significa que a infraestrutura pública do OSM ofereça disponibilidade contratada: tiles são financiados pela comunidade, em capacidade limitada e sem SLA. O Nominatim público admite busca acionada pela pessoa em tráfego moderado, mas limita a aplicação a no máximo uma requisição por segundo e proíbe autocomplete.

## Drivers da decisão

- Evitar custo de provedor gerenciado no MVP.
- Manter os dados geográficos abertos e permitir trocar serviços sem redesenhar a interface.
- Não mostrar o ponto exato a participantes ou visitantes; a prévia usa só a área aproximada do backend.
- Não submeter consultas por tecla, não persistir a busca e não registrar conteúdo de consulta.
- Cumprir as políticas de serviço público do OSM e permitir degradar busca/mapa sem perder o formulário.

## Opções consideradas

1. **Usar diretamente Nominatim e tiles públicos do OSM. Aceita.** Escolha explícita do produto; sem custo de fornecedor, com consulta manual e proteção para limites/indisponibilidade.
2. Usar serviço gerenciado baseado em OSM (ex.: MapTiler). Não escolhido agora: simplifica capacidade e SLA, mas introduz contrato, chave, preço e fornecedor.
3. Google Maps ou Mapbox. Não escolhido agora: muda o fornecedor/dados e exige avaliação separada de cobertura, custos, termos, privacidade e lock-in.
4. Hospedar tiles e Nominatim. Não escolhido para MVP: dá controle de infraestrutura, mas exige capacidade, atualização e operação próprias.

## Decisão

- Tiles interativos usam `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, somente para a área visível solicitada pela pessoa. Não há prefetch, bulk download ou modo offline. Atribuição “© OpenStreetMap contributors” permanece visível; o cliente respeita cache e políticas HTTP, usa HTTPS e não bloqueia o Referer necessário.
- Busca textual é explícita (botão/submit), sem autocomplete nem consulta ao digitar. O município continua escolhido pelo catálogo local de UF/IBGE. O backend compõe o nome pesquisado com município/UF/país e pode usar a busca estruturada do Nominatim (`city`, `state`, `country`); portanto a API consegue pesquisar município diretamente, embora o catálogo local continue autoritativo.
- A chamada do Nominatim parte do backend com User-Agent identificável, timeout, sem retry automático e sem logs do termo. A resposta é allowlisted para rótulo transitório e coordenadas de seleção. Nome/endereço, resultado bruto e busca não são auditados nem persistidos.
- Uma contenção compartilhada em PostgreSQL limita a aplicação inteira a no máximo uma chamada por segundo, mesmo com várias réplicas. Guarda apenas o próximo instante permitido, sem texto pesquisado ou identificador de pessoa. O limite excedido pelo próprio app recebe resposta recuperável e não gera chamada externa.
- A consulta não envia conta, sessão, ID de evento ou coordenada exata ao provedor. O serviço público recebe o nome explicitamente consultado e a região do município. Tile requests no mapa de edição podem revelar ao OSMF a área do pino/viewport e o IP do navegador; a interface explica isso antes do primeiro uso.
- Na prévia, o navegador recebe somente a área aproximada já produzida pelo backend, nunca `exactLocation`. Busca/tiles podem falhar sem impedir a anfitriã de continuar editando.
- URLs de serviços são configuráveis para troca futura. Se tráfego, qualidade de busca ou disponibilidade exceder os limites do serviço público, reavaliar provedor gerenciado ou hospedagem própria em nova ADR.

## Consequências

- A Nominatim oferece melhores resultados para a busca dada, não catálogo completo de POIs; a pessoa sempre pode ajustar o pino.
- Consultas concorrentes podem receber limitação/espera, e um serviço público pode bloquear a aplicação ou mudar política sem aviso. A UI precisa explicar indisponibilidade e conservar a posição em edição.
- Requer nova rota NestJS autenticada, integração em `infrastructure/integrations`, rate gate no PostgreSQL e rota BFF.
- Tiles carregados pelo navegador revelam ao provedor público a região vista; esse risco é distinto da exposição pública do evento e deve ser comunicado. A prévia usa centro/raio aproximados.
- Dados OSM têm atribuição/licença; uso não remove obrigações da ODbL nem autoriza redistribuir extrações fora dos limites de uso justo.

## Plano de adoção e rollback

1. Aplicar a migration operacional para a janela compartilhada de taxa; publicar backend com endpoint atrás da flag existente.
2. Publicar BFF e frontend desabilitados, revisar atribuição, referer, cache e ausência de autocomplete, depois ativar gradualmente.
3. Monitorar somente latência, status agregado e volume por operação; não incluir consulta, resposta, coordenada, sessão ou ID em logs/métricas.
4. Rollback desligando a busca/mapa e mantendo coordenadas exatas já cifradas no backend. Não apagar dados nem reverter migration operacional.

## Referências

- OpenStreetMap Foundation, [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/), consultada em 2026-10-09.
- OpenStreetMap Foundation, [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/), consultada em 2026-10-09.
- Nominatim, [Search API](https://nominatim.org/release-docs/latest/api/Search/), consultada em 2026-10-09.
- `docs/DER-EventMatch-MVP.md` §§ RF017, RF020–RF021, RN020–RN021.
- `docs/adrs/ADR-055-ponto-exato-protegido-de-eventos.md` e `docs/adrs/ADR-061-proibir-residencia-em-eventos-do-mvp.md`.
