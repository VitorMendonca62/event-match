# ADR-044: Modelar preferências de atividades como catálogo próprio e seleção privada do perfil

- **Status:** accepted
- **Data:** 2026-10-06
- **Decisores:** produto, backend, frontend e privacidade
- **Relacionado:** `specs/sdd-017-preferencias-atividades/tasks.md`; ADR-002, ADR-038, ADR-043; Task 15
- **Substitui/Substituído por:** N/A

## Contexto

O RF081 prevê "preferências de atividades" entre os campos opcionais do perfil. A Task 15 citava a reutilização do catálogo de **tipos de atividade**, mas o DER distingue três conceitos (RN147): **interesse** é gosto amplo; **tipo de atividade** descreve o que acontecerá no evento; **preferência de atividade** descreve características desejadas para a experiência. O DER §3.10 define um catálogo inicial próprio para preferências (12 opções).

Usar tipos de atividade como preferência repetiria quase item a item os interesses obrigatórios (Cinema/cinema, Teatro/teatro, Jogos de tabuleiro/jogos de tabuleiro), justamente a duplicação que a Task 15 pede para evitar. Produto confirmou em 2026-10-06:

- catálogo canônico: preferências de atividades do DER §3.10;
- até cinco escolhas, sem prioridade ou ordem explícita;
- uma visibilidade para a lista, `private` por padrão, editável entre `private | authenticated`.

O catálogo de tipos de atividade continua pertencendo ao futuro fluxo de criação de eventos (RF017) e não é criado nesta decisão.

## Drivers da decisão

- Respeitar a separação semântica do DER e não duplicar catálogos.
- Manter os três interesses obrigatórios independentes da nova seleção.
- Oferecer códigos estáveis para filtros/recomendação futuros sem antecipar o algoritmo.
- Tratar desativação de item sem quebrar leitura nem permitir nova seleção.
- Reutilizar o padrão já aceito para idiomas (ADR-043): catálogo relacional, relação normalizada, privacidade por grupo e update atômico com revisão.

## Opções consideradas

1. **Catálogo relacional próprio `activity_preference` no contexto `catalog` + relação `profile_activity_preference` + visibilidade de grupo no perfil.**
2. Reutilizar tipos de atividade — rejeitada: diverge de RN147, duplica interesses e acopla o perfil a um catálogo cujo dono (eventos) ainda não existe.
3. Catálogo genérico único (`catalog_option` com discriminador de tipo) para interesses, idiomas e preferências — rejeitada: exigiria migrar catálogos já em produção, enfraquece FKs/constraints por tipo e não reduz complexidade real nesta entrega.
4. Array de códigos/JSON na linha `profile` — rejeitada pelos mesmos motivos da ADR-043 (sem integridade referencial, estado ativo nem consulta eficiente para descoberta).
5. Enum fechado no código — rejeitada: RN148 exige que profissionais possam acrescentar, desativar e reorganizar opções sem deploy de domínio.

## Decisão

Adotar a opção 1.

### Catálogo

O contexto `catalog` passa a ser dono de `activity_preference(code, label_pt_br, sort_order, active, created_at, updated_at)`. `code` é identificador estável em `snake_case` ASCII (`^[a-z][a-z0-9_]{1,39}$`); o rótulo é conteúdo localizado e nunca identidade. O seed inicial, na ordem do DER:

| `code` | Rótulo pt-BR |
|---|---|
| `outdoor` | Ao ar livre |
| `indoor` | Ambiente interno |
| `quiet_setting` | Ambiente tranquilo |
| `lively_setting` | Ambiente movimentado |
| `small_group` | Grupo pequeno |
| `medium_group` | Grupo médio |
| `light_physical_activity` | Atividade física leve |
| `moderate_physical_activity` | Atividade física moderada |
| `cultural_experience` | Experiência cultural |
| `conversation_and_socializing` | Conversa e socialização |
| `structured_activity` | Atividade estruturada |
| `spontaneous_activity` | Atividade espontânea |

Novas opções entram por migration/seed revisável. Renomear rótulo ou reordenar não muda o significado do código (RN148); mudança de significado exige novo código e desativação do anterior. Não há ligação física entre preferências, interesses e tipos de atividade.

Leitura pública em `GET /api/v1/catalog/activity-preferences?locale=pt-BR`, devolvendo `{ code, label }` ativos em ordem estável, sem sessão e com `Cache-Control: no-store`, no mesmo padrão de interesses e idiomas. A porta `ACTIVITY_PREFERENCE_CATALOG_READER_PORT` (`listActive`, `findByCodes`) é exportada pelo `CatalogModule` e consumida por `profiles`.

### Seleção no perfil

- `profile_activity_preference(account_id, preference_code, selected_at)`, PK composta, FK para `account` com `ON DELETE CASCADE` e FK para `activity_preference`.
- Zero a cinco códigos únicos. Não há prioridade: a seleção é um conjunto e toda projeção ordena pelo `sort_order` do catálogo. `selected_at` é auditoria técnica, sem significado de produto.
- Opções aparentemente opostas (ex.: "Ao ar livre" e "Ambiente interno") podem coexistir e significam que ambas são aceitáveis; não há exclusão mútua.
- Item desativado já selecionado continua legível na visão própria e nas projeções autorizadas, marcado como `active: false` na visão própria; pode ser preservado em uma edição, mas não readicionado após remoção. A UI orienta a substituição sem removê-lo automaticamente.
- Erros de catálogo usam `UNKNOWN_ACTIVITY_PREFERENCE` e `INACTIVE_ACTIVITY_PREFERENCE` (`422`, `data.reason` allowlisted), sem ecoar conteúdo.

### Visibilidade e projeção

`profile.activity_preferences_visibility` usa `private | authenticated | public`, default `private`. Em continuidade às ADR-038 e ADR-043, o DTO editável aceita apenas `private | authenticated`. A prévia inclui `activityPreferences: { code, label }[]` somente quando a visibilidade é `authenticated` e a lista não é vazia.

A seleção não entra nos seis itens de `ProfileCompletion`, não concede capacidade, não altera interesses obrigatórios nem eventos existentes e não é usada para recomendação nesta entrega.

### Contrato e concorrência

`GET/PUT /api/v1/profiles/me` e `GET /preview` são ampliados de forma aditiva. O `PUT` continua recebendo snapshot completo com `revision`; `activityPreferenceCodes` e `activityPreferencesVisibility` passam a ser obrigatórios no snapshot. A substituição de `profile_activity_preference` ocorre na mesma unidade de trabalho e compare-and-set dos demais campos; qualquer valor inválido rejeita a mutação inteira.

Para consumo futuro pela descoberta, o contrato estável é o conjunto de `code` mais a visibilidade; a porta de leitura para descoberta será criada pela tarefa de busca/recomendação, sem antecipação aqui.

Nenhum código, rótulo ou contagem de preferências por pessoa entra em logs ou métricas; a telemetria mantém apenas operação, resultado e correlação já adotados.

## Consequências positivas

- Semântica alinhada ao DER, sem catálogo duplicado nem pergunta repetida no formulário.
- Interesses obrigatórios, completude e capacidades permanecem intactos.
- Códigos estáveis preparam filtros futuros com integridade referencial e índice por preferência.
- Reaproveita padrões, testes e UX já aceitos para idiomas, reduzindo risco.

## Consequências negativas e riscos

- Mais uma tabela de catálogo e uma relação no snapshot do perfil; o `PUT` cresce em dois campos obrigatórios e exige publicação coordenada front/back (schemas Zod estritos).
- Opções opostas simultâneas podem tornar o sinal ambíguo para recomendação futura; a semântica "ambas aceitáveis" fica documentada.
- Os códigos em inglês divergem dos slugs em português de `interest`; a escolha segue o padrão de códigos estáveis de `language` e não é exibida à pessoa.
- O catálogo de tipos de atividade continua pendente para o fluxo de eventos.

## Plano de adoção e rollback

Migration aditiva `0009_profile_activity_preferences`: cria `activity_preference` com seed idempotente, `profile_activity_preference` e a coluna `activity_preferences_visibility` com default `private`. Nenhum valor é inferido para contas existentes.

Rollout com `PROFILE_UI_ENABLED=false` → migration → backend → frontend → smoke → religar UI. Rollback operacional desliga a UI e volta as aplicações, preservando schema e dados; correções são forward-only, sem down migration destrutiva.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF017, RF022–RF023, RF081; RN014, RN147–RN149; §3.10
- `docs/02-regras-de-negocio.md` §§2 e 10
- `docs/03-modelos-de-dominio.md` §2.11
- ADR-038, ADR-043
- `back/src/modules/catalog/`, `back/src/modules/profiles/`
- `front/.impeccable/surfaces/src-app-perfil-page-tsx.md`
