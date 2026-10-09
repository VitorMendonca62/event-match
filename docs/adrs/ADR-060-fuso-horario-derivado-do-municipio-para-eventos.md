# ADR-060: Derivar o fuso horário do município para datas de eventos

- **Status:** accepted
- **Data:** 2026-10-08
- **Decisores:** produto, backend e arquitetura
- **Relacionado:** TASK 23.1; ADR-052; ADR-054; RF017–RF021
- **Substitui/Substituído por:** N/A

## Contexto

Eventos presenciais dependem do horário local correto. Fixar todo o produto em `America/Sao_Paulo` é incorreto para parte dos municípios brasileiros, e permitir que a anfitriã escolha livremente o fuso cria erros evitáveis.

## Decisão

- O catálogo de municípios recebe o identificador IANA de fuso horário aplicável, carregado por migration/seed versionado junto ao catálogo; nenhum endpoint consulta um provedor externo em tempo de requisição.
- O comando de rascunho recebe início e término como data/hora local sem offset. O backend resolve o instante usando o fuso do município selecionado, rejeita hora local inexistente ou ambígua e persiste o instante normalizado junto ao snapshot do fuso IANA.
- A publicação exige início entre 24 horas e 30 dias no futuro. O término é opcional e, quando informado, deve ser posterior ao início e durar no máximo oito horas.

## Consequências

- A migration da TASK 23.1 estende o catálogo e a porta de leitura de municípios de forma aditiva; Eventos consome o fuso pela porta, sem importar schema do Catálogo.
- DTOs e OpenAPI distinguem entrada em horário local da resposta normalizada com `timeZone`, e testes cobrem municípios com fusos distintos e transições de horário.

## Evidências e referências

- `docs/adrs/ADR-052-catalogo-versionado-de-ufs-e-municipios.md`
- `docs/adrs/ADR-054-agregado-evento-e-ciclo-de-vida-inicial.md`
- `docs/DER-EventMatch-MVP.md` RF017–RF021
