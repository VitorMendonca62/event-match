# ADR-056: Manter tipos de atividade e atributos de criação sob o contexto Eventos

- **Status:** accepted
- **Data:** 2026-10-08
- **Decisores:** produto, backend, operações e privacidade
- **Relacionado:** TASK 23.1; `specs/sdd-025-backend-eventos/tasks.md`; RF017, RF084; RN137, RN147–RN149
- **Substitui/Substituído por:** N/A

## Contexto

O DER distingue interesse, preferência de atividade e tipo de atividade. ADR-044 já reservou tipos de atividade para Eventos. RF017 também lista imagem, duração, custo estimado, acessibilidade, alimentação, faixa etária, itens e orientações, mas ainda não há política para alguns desses campos.

## Drivers da decisão

- Preservar a semântica de RN147 e códigos estáveis de RN148–RN149.
- Não lançar campos que exigem moderação, política de privacidade ou finalidade ainda ausentes.
- Manter o catálogo administrável sem acoplar Perfil ao contexto Eventos.

## Opções consideradas

1. Catálogo versionado de tipos de atividade no contexto Eventos e atributos opcionais somente quando sua política estiver definida.
2. Reutilizar interesses ou preferências. Rejeitada: viola RN147 e ADR-044.
3. Texto livre para atividade e metadados arbitrários em JSON. Rejeitada: perde integridade, governança e projeção segura.

## Decisão

- Criar `event_activity_type` versionado, com código estável, rótulo, ordem e estado ativo; o seed contém os tipos do DER §3.10. A criação aceita apenas itens ativos, enquanto registros históricos preservam itens desativados.
- Atividade, título, descrição, data/início, município/UF, ponto exato, capacidade e modalidade são campos do agregado. A modalidade começa em `manual_approval`; `automatic_entry` é persistida, mas suas regras de participação ficam para a TASK 25.
- Imagem de evento não reutiliza automaticamente o fluxo de mídia de perfil. A inclusão depende de decisão específica de armazenamento, moderação e entrega.
- Acessibilidade e alimentação não são persistidas até a TASK 19 e suas ADRs propostas definirem vocabulário, finalidade e privacidade. Custo estimado, faixa etária, itens e orientações não entram no contrato inicial e pertencem à TASK 30; o término estimado permanece opcional. Capa e galeria pertencem à TASK 29.
- `official` inicia sempre `false`; nenhuma rota comum permite marcá-lo. A autorização profissional de RN137 depende do contexto Operações.

## Consequências

- O contrato inicial não deve prometer campos sem validação, moderação ou finalidade aprovada.
- Produto precisa confirmar quais opcionais entram na primeira publicação e seus limites; os omitidos permanecem fora do payload, não nulos silenciosos.
- A administração de catálogo e eventos oficiais é adiada até a existência de Operações, preservando o princípio de menor privilégio.

## Plano de adoção e rollback

Seed e tabela são aditivos e versionados. Opções novas entram por migration; renomear não troca a semântica do código. Rollback desativa a feature e preserva referências históricas; nunca reutiliza códigos.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF017, RF084; RN137, RN147–RN149, §3.10
- `docs/adrs/ADR-044-preferencias-de-atividades-no-perfil.md`
- `specs/sdd-022-acessibilidade-alimentacao-privacidade-contextual/tasks.md`
