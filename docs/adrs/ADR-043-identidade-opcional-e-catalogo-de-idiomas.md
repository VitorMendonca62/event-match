# ADR-043: Modelar identidade opcional e idiomas com visibilidade por grupo

- **Status:** accepted
- **Data:** 2026-10-03
- **Decisores:** produto, backend, frontend e privacidade
- **Relacionado:** `specs/sdd-016-identidade-opcional-perfil/tasks.md`; ADR-002, ADR-013, ADR-038; Task 14
- **Substitui/Substituído por:** N/A

## Contexto

O perfil editável da SDD-015 possui foto, apresentação, nome, região, intenções e interesses. O RF081 também prevê pronomes, profissão e idiomas, mas esses campos foram adiados até que formato, catálogo e privacidade fossem definidos.

Produto decidiu oferecer pronomes por uma lista inicial inclusiva com alternativa personalizada e recusa explícita; profissão como texto livre; e até cinco idiomas vindos de catálogo pesquisável, incluindo Libras e sem proficiência nesta entrega. Os três grupos são opcionais e não podem alterar completude, autorização ou habilitação de anfitrião.

Região estruturada por UF e município não integra esta decisão. Ela afeta o cadastro obrigatório e o dado legado e foi separada na Task 20.

## Drivers da decisão

- Permitir autoidentificação sem obrigar texto livre para os casos mais comuns.
- Distinguir ausência de resposta de uma escolha persistida de não informar.
- Impedir que códigos, grafias e duplicatas de idiomas variem por cliente.
- Manter privacidade por padrão e projeções por audiência no backend.
- Evoluir o catálogo sem migration da tabela de perfil nem bundle com a lista inteira.
- Preservar a atualização otimista e atômica já adotada para o perfil.

## Opções consideradas

1. **Pronomes por seleção controlada mais valor personalizado; profissão em texto; idiomas por catálogo relacional versionado.**
2. Todos os campos em texto livre — rejeitada para idiomas por duplicidade, grafia inconsistente e baixa utilidade futura em filtros.
3. Todos os campos em enums fechados — rejeitada por limitar autoidentificação, profissão e evolução do produto.
4. Idiomas como array/JSON no perfil — rejeitada por perder integridade referencial, estado ativo e evolução de rótulos.
5. Um registro genérico chave/valor por campo opcional — rejeitada porque enfraquece invariantes, contratos e queries sem reduzir complexidade real.

## Decisão

Adotar a opção 1.

### Pronomes

O domínio representa a seleção por códigos estáveis:

- `ela_dela` — “Ela/dela”;
- `ele_dele` — “Ele/dele”;
- `elu_delu` — “Elu/delu”;
- `other` — exige `customPronouns` com 1–40 caracteres após normalização;
- `prefer_not_to_say` — registra a preferência da titular, força visibilidade `private` e nunca produz conteúdo em projeções para terceiros;
- `null` — ainda não respondido/removido.

Rótulos são conteúdo localizado, não identidade persistida. `customPronouns` aceita texto simples normalizado em NFC, rejeita caracteres de controle e padrões evidentes de contato e só pode existir com `other`.

### Profissão

`profession` é texto livre opcional de 1–80 caracteres quando presente, normalizado em NFC e sem catálogo ou verificação. Rejeita caracteres de controle e padrões evidentes de contato. O EventMatch não apresenta o valor como credencial verificada.

### Idiomas

O contexto `catalog` passa a ser dono de `language`, identificado por código estável e com `label_pt_br`, `sort_order`, `active`, `created_at` e `updated_at`. A seleção do perfil usa `profile_language(account_id, language_code, selected_at)` com chave primária composta e `ON DELETE CASCADE` para a conta. Códigos não são inventados pelo browser.

Os códigos seguem subtags de idioma BCP 47 registradas pela IANA. O seed inicial contém, em ordem de produto: `pt` Português, `en` Inglês, `es` Espanhol, `bzs` Libras, `fr` Francês, `it` Italiano, `de` Alemão, `cmn` Mandarim, `ja` Japonês, `ko` Coreano, `ar` Árabe, `ru` Russo e `hi` Hindi. Libras possui código próprio e não é tratada como variante do português. Novos idiomas entram por migration/seed revisável; desativação impede nova seleção, mas preserva referências existentes para leitura e substituição.

A pessoa seleciona zero a cinco idiomas ativos, sem duplicatas e sem nível de proficiência. A lista inteira possui uma única visibilidade; cada idioma não recebe audiência própria.

### Visibilidade e projeção

`pronouns_visibility`, `profession_visibility` e `languages_visibility` usam `private | authenticated | public`, com `private` como default. Em continuidade à ADR-038, o DTO editável aceita apenas `private | authenticated`; `public` permanece reservado até existir perfil público, moderação e denúncia.

Cada grupo controla sua própria audiência. A projeção `authenticated` inclui somente grupos marcados como `authenticated`, com as exceções:

- `prefer_not_to_say` exige `pronouns_visibility = private` e nunca é projetado;
- valor ausente nunca produz campo vazio;
- idioma desativado previamente selecionado continua na visão da titular e nas projeções autorizadas; pode ser preservado em uma edição, mas não adicionado novamente depois de removido.

Os novos campos não entram nos seis itens de `ProfileCompletion`, não concedem capacidade e não são usados para ranking, restrição de participação ou recomendação nesta entrega.

### Contrato e concorrência

`GET /api/v1/catalog/languages?locale=pt-BR` lista idiomas ativos em ordem estável. `GET /api/v1/profiles/me`, `PUT /api/v1/profiles/me` e `/preview` são ampliados de forma aditiva. O update continua recebendo snapshot completo e `revision`; dados escalares e `profile_language` são validados e substituídos na mesma unidade de trabalho. Qualquer valor inválido rejeita a mutação inteira e preserva o estado persistido.

Nenhum conteúdo destes campos entra em logs ou métricas. Telemetria registra somente operação, resultado e correlação segura já adotados pelo contexto.

## Consequências positivas

- A lista cobre usos comuns sem fechar a autoidentificação.
- “Prefiro não informar” não é confundido com campo ainda não respondido e não vaza na prévia.
- Idiomas possuem integridade, ordem estável e evolução controlada.
- O frontend recebe rótulos prontos e não duplica regras ou catálogos.
- A política de privacidade permanece uniforme com a ADR-038.

## Consequências negativas e riscos

- O snapshot do perfil e sua migration ficam maiores.
- Um catálogo inicial curado não cobre todos os idiomas e exige processo de expansão por demanda.
- Texto livre de pronomes e profissão ainda demanda moderação antes de exposição real a terceiros.
- Atualizar todas as relações de idiomas em cada edição custa writes adicionais, embora limitados a cinco linhas.

## Plano de adoção e rollback

Aplicar a migration aditiva `0008_profile_optional_identity` antes do backend. Ela adiciona as seis colunas de valor/visibilidade ao perfil, cria `language` e `profile_language`, sem inferir dados para contas existentes. Todas as visibilidades recebem `private`; valores e seleções começam ausentes.

Publicar backend e frontend atrás das flags existentes de perfil, com o backend antes do frontend. Rollback operacional desliga a UI e mantém colunas, catálogo e seleções; correções de schema são migrations forward-only. A remoção destrutiva das colunas/tabelas não integra rollback.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF012, RF015 e RF081; RN014 e RNF001
- `docs/02-regras-de-negocio.md` §2
- `docs/03-modelos-de-dominio.md` §§2.2 e 2.11
- ADR-038
- `back/src/modules/profiles/`
- `back/src/modules/catalog/`
- `front/.impeccable/surfaces/src-app-perfil-page-tsx.md`
- IANA Language Subtag Registry: `https://www.iana.org/assignments/language-subtag-registry`
