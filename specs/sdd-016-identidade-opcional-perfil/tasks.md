# Task: Adicionar identidade opcional ao perfil

- **Slug:** identidade-opcional-perfil
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-03
- **Status:** ready — ADR-043 aceita em 2026-10-03
- **Versão-alvo:** workspace/front `0.14.0`; back `0.13.0`
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A SDD-015 entregou edição autenticada, prévia por audiência, revisão otimista e visibilidade de foto/apresentação. A Task 14 amplia essa mesma superfície com três grupos opcionais do RF081: pronomes, profissão e idiomas. A ausência desses dados não reduz capacidades da conta e cada grupo começa privado.

Produto confirmou:

- pronomes por lista inicial `Ela/dela`, `Ele/dele` e `Elu/delu`, mais `Outro` com texto livre e `Prefiro não informar`;
- profissão como texto livre opcional;
- idiomas em catálogo pesquisável e extensível, no máximo cinco, incluindo Libras e sem proficiência;
- visibilidade independente por grupo, mantendo `public` indisponível nesta entrega.

A solicitação adicional de UF e município foi registrada como Task 20: ela altera um campo obrigatório compartilhado com o cadastro e exige compatibilidade com regiões legadas. A Task 14 não modifica o contrato atual de `region`.

Rastreabilidade: `docs/DER-EventMatch-MVP.md` RF012, RF015 e RF081; RN014 e RNF001; `docs/01-visao-geral-arquitetura.md` (Perfis e Preferências/Catálogos); `docs/02-regras-de-negocio.md` §2; `docs/03-modelos-de-dominio.md` §§2.2 e 2.11; `docs/04-integracoes-externas.md`; ADR-038; brief `front/.impeccable/surfaces/src-app-perfil-page-tsx.md`.

> **Gate de execução:** concluído. A ADR-043 foi aceita em 2026-10-03 e o plano está liberado para `code-implementer`.

## 2. Escopo

### Inclui

- [x] Adicionar seleção opcional de pronomes por códigos estáveis, alternativa personalizada e recusa explícita.
- [x] Adicionar profissão opcional em texto livre, sem selo ou alegação de verificação.
- [x] Criar catálogo versionado de idiomas e seleção de zero a cinco itens, incluindo Libras.
- [x] Aplicar visibilidade independente de pronomes, profissão e lista de idiomas, com `private` por padrão.
- [x] Ampliar agregado, repositório, projeção de prévia e snapshot completo do perfil mantendo revisão otimista.
- [x] Criar migration aditiva com defaults privados, seed idempotente e relação normalizada de idiomas.
- [x] Ampliar API NestJS, Swagger, BFF/RSC e contratos Zod sem expor conteúdo em logs.
- [x] Estender `/perfil` e `/perfil/previa` com estados vazios, erro, conflito, remoção e limite de idiomas.
- [x] Atualizar docs 01–04, OpenAPI, `CHANGELOG.md`, versões e testes.
- [x] Executar revisão visual Impeccable delimitada com capturas desktop/mobile e finish review.

### Exclui

- Alterar região aproximada, cadastro ou migração de localização; esse trabalho pertence à Task 20.
- Nível de proficiência, fluência certificada, tradução, teste de idioma ou recomendação por idioma.
- Verificação de profissão, empresa, cargo, conselho profissional ou vínculo de trabalho.
- Inferir pronome por nome, foto, apresentação ou qualquer outro atributo.
- Perfil consultável por terceiros, audiência `public`, moderação/denúncia e indexação.
- Usar os novos campos em completude, habilitação de anfitrião, autorização, descoberta ou ranking.
- Fotos adicionais, preferências de atividades, disponibilidade, distância, redes sociais, acessibilidade e alimentação.

### Entregas verticais

1. **Catálogo de idiomas:** schema, seed, porta, adapter, caso de uso, endpoint, DTO e testes.
2. **Identidade no perfil:** agregado, persistência, update atômico, prévia, OpenAPI e testes.
3. **Experiência web:** carregamento RSC, formulário acessível, BFF, prévia, E2E e validação visual.

## 3. Impacto Arquitetural e ADRs

### Estrutura prevista

```text
back/src/modules/catalog/
├── domain/ports/language-catalog-reader.port.ts
├── application/use-cases/list-active-languages.use-case.ts
├── infrastructure/persistence/
│   ├── schema/catalog.schema.ts
│   └── drizzle-language-catalog-reader.adapter.ts
└── presentation/http/
    ├── controllers/languages.controller.ts
    └── dto/languages.dto.ts

back/src/modules/profiles/
├── domain/entities/profile.ts
├── domain/services/profile-preview-projector.ts
├── domain/ports/outbound/profile-repository.port.ts
├── application/use-cases/profile.use-cases.ts
├── infrastructure/persistence/
│   ├── schema/profiles.schema.ts
│   └── drizzle-profile-repository.adapter.ts
└── presentation/http/dto/
    ├── profile-request.dto.ts
    └── profile-response.dto.ts

front/src/features/profile/
├── components/profile-form.tsx
├── components/profile-pronouns-field.tsx
├── components/profile-language-picker.tsx
├── contracts.ts
└── messages.ts
```

### Fluxo

```text
GET /perfil (RSC, no-store)
  -> em paralelo:
     GET /api/v1/profiles/me
     GET /api/v1/catalog/interests
     GET /api/v1/catalog/languages?locale=pt-BR
  -> serializa somente perfil e opções necessárias à ilha cliente

PUT /api/profile (browser)
  -> BFF valida sessão, origem, JSON e tamanho
  -> PUT /api/v1/profiles/me
     -> ProfileWriteGuard
     -> UpdateOwnProfile [UoW + revision]
        -> valida interesses e idiomas por portas do catálogo
        -> normaliza pronomes/profissão no domínio
        -> atualiza profile + profile_language atomicamente
  <- snapshot próprio sem account id nem dados internos

GET /perfil/previa (RSC, no-store)
  -> GET /api/v1/profiles/me/preview
  -> ProfilePreviewProjector aplica cada visibilidade
  -> omite private, ausentes e prefer_not_to_say
```

### Hexagonal, DI e NestJS

- O contexto `catalog` continua dono do idioma e expõe `LANGUAGE_CATALOG_READER_PORT`; `profiles` depende apenas dessa porta exportada pelo `CatalogModule`.
- Domínio/aplicação não importam NestJS, Drizzle ou HTTP. Controllers usam DTOs `class-validator`, Swagger e filters já existentes; erros de catálogo/perfil continuam tipados fora de HTTP.
- Adapters usam `@Injectable()` e constructor injection. `ProfilesModule` amplia o binding de `UpdateOwnProfile` sem `new`, service locator, dependência circular ou `forwardRef()`.
- `UpdateOwnProfile` lê catálogo e perfil, valida o snapshot e executa compare-and-set mais substituição de idiomas na mesma UoW. Nenhum I/O externo ocorre na transação.
- O endpoint de idiomas é leitura pública de conteúdo não sensível, sem sessão nem token interno de BFF (`internal: false`), no mesmo padrão do catálogo de interesses. Perfil e prévia continuam exigindo sessão/capacidade.

### RSC, Client Components e performance

- `/perfil` permanece RSC dinâmica. Perfil, interesses e idiomas começam juntos e são aguardados em paralelo (`async-parallel`, `server-parallel-fetching`).
- A ilha cliente recebe somente os itens ativos mais eventuais idiomas inativos já selecionados; não recebe account id, sessão, flags internas ou estado de catálogo desnecessário (`server-serialization`).
- A pesquisa de até o catálogo inicial é local e derivada durante renderização; não cria efeito ou request por tecla (`rerender-derived-state-no-effect`, `rerender-move-effect-to-event`).
- Importações permanecem diretas (`bundle-barrel-imports`, `bundle-analyzable-paths`) e nenhum pacote de combobox é adicionado sem necessidade comprovada.
- Route Handlers apenas validam e delegam; não acessam PostgreSQL, não duplicam normalização e não fazem retry de mutação (`server-auth-actions`, `server-no-shared-module-state`, `async-api-routes`).

### PostgreSQL e migration

`back/drizzle/0008_profile_optional_identity.sql` será aditiva:

| Objeto | Alteração/colunas | Constraints e índices |
|---|---|---|
| `profile` | `pronoun_selection`, `custom_pronouns`, `pronouns_visibility`, `profession`, `profession_visibility`, `languages_visibility` | enum/check de seleção e visibilidade; custom obrigatório somente em `other`; limites 40/80; defaults privados |
| `language` | `code`, `label_pt_br`, `sort_order`, `active`, timestamps | PK por código BCP 47; rótulo não vazio; ordem única/estável; índice de ativos |
| `profile_language` | `account_id`, `language_code`, `selected_at` | PK composta; FKs com integridade; índice por idioma; até cinco reforçado no caso de uso/transação |

O seed idempotente adiciona `pt`, `en`, `es`, `bzs`, `fr`, `it`, `de`, `cmn`, `ja`, `ko`, `ar`, `ru` e `hi`. Contas existentes recebem apenas visibilidades privadas; nenhum valor é inferido. A aplicação garante o limite de cinco sob lock/revisão da linha do perfil; constraints garantem unicidade e referências.

Rollback operacional desliga a UI/rotas de perfil, preserva schema e dados e volta o frontend primeiro. Não há down migration destrutiva; correções seguem por migration forward.

### ADRs

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Modelar pronomes controlados/personalizados, profissão textual, catálogo relacional de idiomas e visibilidade por grupo | `docs/adrs/ADR-043-identidade-opcional-e-catalogo-de-idiomas.md` | accepted | Define semântica, persistência, códigos, privacidade e evolução do catálogo. |

Toda ADR necessária deve estar `accepted` antes da implementação.

## 4. Contratos e Interfaces

### 4.1 Domínio e portas (pseudocódigo)

```ts
type PronounSelection =
  | 'ela_dela' | 'ele_dele' | 'elu_delu'
  | 'other' | 'prefer_not_to_say';

type ProfileLanguage = Readonly<{
  code: string;
  label: string;
  active: boolean;
}>;

interface OwnProfileIdentity {
  pronounSelection: PronounSelection | null;
  customPronouns: string | null;
  pronounsVisibility: 'private' | 'authenticated' | 'public';
  profession: string | null;
  professionVisibility: 'private' | 'authenticated' | 'public';
  languages: readonly ProfileLanguage[];
  languagesVisibility: 'private' | 'authenticated' | 'public';
}

interface UpdateOwnProfileIdentity {
  pronounSelection: PronounSelection | null;
  customPronouns: string | null;
  pronounsVisibility: 'private' | 'authenticated';
  profession: string | null;
  professionVisibility: 'private' | 'authenticated';
  languageCodes: readonly string[]; // 0..5, únicas
  languagesVisibility: 'private' | 'authenticated';
}

interface LanguageCatalogReaderPort {
  listActive(context, locale): Promise<readonly ProfileLanguage[]>;
  findByCodes(context, codes): Promise<readonly ProfileLanguage[]>;
}
```

`Profile.update` recebe os campos atuais e os novos no mesmo snapshot. `other` exige `customPronouns`; qualquer outra seleção exige `customPronouns = null`. `prefer_not_to_say` exige `pronounsVisibility = private`, permanece visível somente na visão própria e nunca gera `pronouns` na prévia.

Idioma inativo já selecionado pode ser preservado em uma atualização, mas não pode ser adicionado após remoção. O caso de uso compara seleção anterior, catálogo ativo e entrada para distinguir os dois casos.

### 4.2 HTTP NestJS

Todas as respostas usam envelope padrão e `Cache-Control: no-store` conforme as rotas atuais.

| Método e rota | Mudança | Sucesso | Falhas allowlisted |
|---|---|---|---|
| `GET /api/v1/catalog/languages?locale=pt-BR` | nova lista ordenada de idiomas ativos | `200 { languages[] }` | `400`, `503` |
| `GET /api/v1/profiles/me` | adiciona `OwnProfileIdentity` | `200` | `401`, `403`, `404`, `503` |
| `PUT /api/v1/profiles/me` | adiciona `UpdateOwnProfileIdentity` | `200` | `400`, `401`, `403`, `409`, `422`, `503` |
| `GET /api/v1/profiles/me/preview` | adiciona somente campos autorizados | `200` | `401`, `403`, `404`, `503` |

`422` identifica `inactive_language` ou `unknown_language` por `data.reason` allowlisted, sem ecoar conteúdo livre. DTOs usam `@IsEnum`, `@ValidateIf`, `@IsString`, `@MaxLength`, `@IsArray`, `@ArrayMaxSize`, `@ArrayUnique` e validação de formato do código; o domínio repete invariantes.

O endpoint de catálogo devolve `{ code, label }`. A visão própria inclui `active` somente para permitir tratar seleção desativada. A prévia devolve `pronouns?: string`, `profession?: string` e `languages?: { code, label }[]`; não expõe seleção interna, `prefer_not_to_say`, visibilidade ou estado de catálogo.

### 4.3 BFF e frontend

- `GET /api/catalog/languages` delega ao endpoint NestJS e filtra `{ code, label }`; o RSC pode usar o helper server-side equivalente para carregar em paralelo.
- `PUT /api/profile` mantém mesma origem, `application/json`, limite explícito e sem retry. O limite de payload sobe apenas o necessário para até cinco códigos e dois textos curtos.
- Schemas Zod são estritos e espelham nullabilidade, enums, limites e unicidade. Respostas inválidas do upstream falham fechadas.
- A ordem do payload não define a ordem canônica do catálogo; a ordem de seleção pode ser preservada por `selected_at` somente para apresentação própria, sem significado de proficiência/prioridade.

Mudança é aditiva na API, mas frontend e backend devem ser publicados de forma coordenada porque os schemas Zod atuais são estritos. A operação aceita a incompatibilidade temporária entre versões: desabilitar a UI de perfil, aplicar a migration, publicar o backend, publicar o frontend e só então reabilitar a UI. Não é necessário manter compatibilidade cruzada entre as duas versões durante essa janela controlada.

### 4.4 UX e acessibilidade

- Inserir seção sem card chamada “Identidade e comunicação” depois de “Sua apresentação” e antes de intenções/interesses.
- Pronomes usam combobox controlado com navegação completa por teclado; escolher “Outro” revela campo curto associado. “Prefiro não informar” explica que a escolha fica registrada, força privado e desabilita o controle de compartilhamento enquanto estiver selecionada.
- Profissão usa campo de texto com contador apenas próximo do limite e copy que não sugere verificação.
- Idiomas usam busca e lista selecionável por teclado, com estado vazio, contador `n/5`, itens escolhidos removíveis por botão com nome acessível e bloqueio claro ao atingir cinco.
- Cada grupo termina com o controle binário já usado para `private | authenticated`; o controle não aparece como um único consentimento global.
- Erros ficam associados ao campo e resumidos em região focável. Salvar, conflito, rascunho e prévia preservam o comportamento da SDD-015.
- Mobile mantém alvos de 44 px, uma coluna e texto sem colisão; desktop preserva largura legível. Zoom 200%, contraste, leitor de tela, teclado e `prefers-reduced-motion` entram na validação.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Perfil possui apenas foto/apresentação opcionais nesta fatia. | Pronomes, profissão e idiomas também são opcionais e removíveis. | RF012, RF081 |
| 2 | Foto/apresentação começam privadas. | Cada novo grupo começa `private` e pode mudar independentemente para `authenticated`. | RF015, RN014, ADR-038 |
| 3 | `public` existe no domínio/schema, mas é rejeitado pelo DTO editável. | A mesma restrição vale para os três novos grupos. | ADR-038 |
| 4 | Não há seleção persistida de pronome. | Opções comuns usam códigos; `other` exige texto e `prefer_not_to_say` força privado e nunca é projetado. | decisão de produto, ADR-043 |
| 5 | Não há profissão. | Texto livre de até 80 caracteres, sem alegação de verificação. | decisão de produto, ADR-043 |
| 6 | Não há idiomas. | Até cinco códigos únicos do catálogo; sem proficiência. | decisão de produto, ADR-043 |
| 7 | Completude possui seis itens. | Permanece exatamente com seis; novos campos não bloqueiam uso nem dão capacidade. | RF016, ADR-038 |
| 8 | Update usa snapshot completo + revisão. | Novos campos e relações participam da mesma mutação atômica. | ADR-038, ADR-043 |
| 9 | Região é texto obrigatório de 2–80 caracteres. | Sem mudança nesta SDD; UF/município pertence à Task 20. | RF004, separação de escopo |

## 6. Critérios de Aceitação

- Perfil sem os três grupos continua válido, com mesma completude e capacidades.
- A visão própria distingue ausência, `prefer_not_to_say` e `other`; a recusa força visibilidade privada e a prévia não a revela.
- “Outro” não salva sem texto válido e texto customizado não permanece escondido quando outra opção é escolhida.
- Profissão vazia persiste como `null`; valor não vazio respeita normalização e 80 caracteres.
- Idiomas aceitam zero a cinco códigos únicos; desconhecido/inativo novo é recusado sem gravar parte do snapshot.
- Libras aparece como idioma próprio no catálogo inicial.
- Cada grupo possui controle independente e `private` é o default para contas existentes e novas.
- Conflito de revisão retorna `409`; nenhuma relação de idioma ou campo escalar é parcialmente alterado.
- Respostas, logs e métricas não contêm profissão, pronome customizado ou lista de idiomas fora da projeção autorizada.
- Controllers possuem `@ApiTags`, `@ApiOperation`, respostas Swagger e DTOs validados; providers usam DI por construtor e `Test.createTestingModule` nos testes de composição.
- O frontend não acessa PostgreSQL, não consulta serviço externo de idioma e não replica regra de domínio no BFF.
- A seção é operável por teclado/leitor de tela, não desloca a topologia durante erros e funciona em desktop/mobile e zoom 200%.
- Aplicar e verificar `async-parallel`, `async-api-routes`, `server-auth-actions`, `server-no-shared-module-state`, `server-serialization`, `bundle-barrel-imports`, `bundle-analyzable-paths`, `rerender-derived-state-no-effect` e `rerender-move-effect-to-event`.
- A implementação termina em um passe conjunto de capturas desktop/mobile, correção em lote, no máximo uma confirmação e finish review do Impeccable.

## 7. Plano de Testes

### Backend unitário

- `Profile`: cada opção de pronome, coerência de `other`, recusa, limites/normalização, profissão e visibilidades; ausência continua válida e persiste como `null`.
- `UpdateOwnProfile`: zero/cinco/seis idiomas, duplicatas, desconhecido, inativo preservado versus nova inclusão, conflito e atomicidade.
- `ProfilePreviewProjector`: matriz `private/authenticated`, ausentes, personalizado e `prefer_not_to_say`.
- `ListActiveLanguages`: ordem, ativos e locale suportado.
- Controllers/DTOs/filter/DI via `Test.createTestingModule`, incluindo Swagger e ausência de conteúdo em erros.

### Backend integração/PostgreSQL

- Upgrade `0007 -> 0008`, defaults privados, seed idempotente inclusive após rerun do migrator, checks, FKs, cascata, unicidade, inventário das tabelas `language`/`profile_language` e ledger com nove migrations.
- Compare-and-set concorrente entre duas réplicas, comprovando um vencedor e nenhuma substituição parcial de idiomas.
- Catálogo desativado: leitura histórica, preservação em update e recusa após remoção.
- Exclusão/expiração da conta remove relações e anula os novos escalares conforme ciclo já existente.

### Backend E2E

- Sessão/capacidade nas quatro rotas afetadas; catálogo ordenado; PUT válido; `400/409/422`; preview sem campos privados/recusa; no-store e OpenAPI.

### Frontend unitário/integração

- Schemas estritos, mensagens, filtro de pesquisa, limite cinco, remoção, “Outro”, recusa, “Não informado” serializado como `null` e snapshot completo.
- Combobox de pronomes por mouse e teclado; busca de idiomas mantém foco após cada seleção para permitir escolhas sucessivas.
- RSC carrega perfil/interesses/idiomas em paralelo e passa props mínimas.
- BFF filtra resposta, protege mutação por origem/JSON, traduz `401/409/422/5xx` e não repassa conteúdo inseguro.
- Formulário preserva rascunho no conflito, associa erros, evita duplo envio e mantém prévia somente após salvar.

### Frontend E2E/visual

- Login -> `/perfil` -> preencher cada grupo -> salvar -> prévia; alternar privado; remover; conflito simulado; idioma no limite.
- Playwright desktop e mobile com navegação integral por teclado e axe; capturas no passe Impeccable e verificação de zoom 200%.

### Comandos de validação

```text
bun run --cwd back lint
bun run --cwd back typecheck
bun run --cwd back test
bun run --cwd back test:integration
bun run --cwd back test:e2e
bun run --cwd back build
bun run --cwd front lint
bun run --cwd front typecheck
bun run --cwd front test
bun run --cwd front test:e2e
bun run --cwd front build
```

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Lista de pronomes parecer excludente | média | alto | “Outro” livre, rótulos localizados e expansão por decisão de conteúdo sem inferência. |
| Texto livre carregar contato ou abuso | média | médio | limites, normalização, bloqueio de contato evidente, privado por default e nenhuma exposição real a terceiros nesta entrega. |
| Catálogo não cobrir idioma desejado | média | médio | catálogo relacional extensível por seed/migration e monitorar pedidos sem registrar conteúdo do perfil. |
| Catálogo desativado quebrar edição | baixa | médio | permitir preservar seleção histórica e impedir apenas nova inclusão. |
| Backend novo quebrar schema estrito do frontend antigo | aceita na janela controlada | alto | desabilitar a UI de perfil antes da migration; publicar backend e frontend na ordem definida e reabilitar somente após smoke conjunto. |
| Replace de idiomas ficar parcial em conflito/falha | baixa | alto | UoW única, revision compare-and-set e integração concorrente. |
| Formulário longo aumentar carga cognitiva | média | médio | seção única, progressão direta, disclosure somente para “Outro”, busca local e sem cards/wizard. |
| Seed/código de Libras incorreto | baixa | alto | revisar subtags contra registro IANA antes da migration e testar `bzs` explicitamente. |

Rollout: `PROFILE_UI_ENABLED=false` -> migration `0008` -> backend `0.13.0` -> frontend `0.14.0` -> smoke de catálogo/perfil -> capturas/E2E -> `PROFILE_UI_ENABLED=true` -> monitorar somente contagens de resultado. Rollback: manter a UI desligada, voltar frontend/backend se necessário e preservar schema e dados, sem downgrade destrutivo.

## 9. Perguntas em Aberto (bloqueantes)

- [x] Produto/arquitetura aceitou a ADR-043 como escrita em 2026-10-03.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices`, `impeccable`, `nestjs-expert`, `nestjs-hexagonal-architecture` e `nextjs-architecture` foram aplicadas conforme o escopo.
- [x] Testes, migration e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.
