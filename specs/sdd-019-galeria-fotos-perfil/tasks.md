# Task: Adicionar galeria contextual de fotos ao perfil

- **Slug:** galeria-fotos-perfil
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-07
- **Status:** blocked
- **Versão-alvo:** workspace/front `0.17.0`; back `0.16.0`
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A Task 17 materializa o campo “fotos adicionais” do RF081. A galeria serve para contextualizar hobbies, atividades, lugares frequentados ou visitados, preservando o posicionamento não romântico do EventMatch. Produto decidiu: até cinco fotos adicionais; legenda opcional de até 120 caracteres; localização contextual opcional; audiência `private | authenticated`, com `private` como padrão e sem `public`; e moderação antes de qualquer exposição a terceiros.

Rastreabilidade: `docs/DER-EventMatch-MVP.md` RF012, RF015, RF068, RF081; RN011–RN014; RN075–RN077; RN150–RN155; RNF001–RNF002, RNF017, RNF022. Também se aplica ADR-038 (revisão e projeção), ADR-039/042 (upload e entrega Cloudinary), `docs/02-regras-de-negocio.md` §§2, 5 e 6, `docs/03-modelos-de-dominio.md` §2.2 e `front/.impeccable/surfaces/src-app-perfil-page-tsx.md`.

> **Gate de execução:** ADR-046 foi aceita em 2026-10-07. Nenhuma implementação inicia enquanto ADR-047 e ADR-048 não forem aceitas. A ADR-047 ainda depende da seleção do fornecedor, validação jurídica/privacidade e existência do fluxo operacional de denúncia, revisão e recurso.

## 2. Escopo

### Inclui

- [ ] Até cinco fotos adicionais ativas, independentes da foto principal, com ordenação estável, substituição, remoção e conflito por revisão.
- [ ] Legenda opcional, texto simples de 1–120 caracteres quando presente, sem links, contatos ou localização precisa.
- [ ] Localização contextual opcional por foto: cidade, bairro/região aproximada e/ou nome do lugar como texto; sem GPS, endereço, CEP, coordenadas, horário em tempo real ou geocodificação.
- [ ] Reutilização de upload direto assinado, validação autoritativa, normalização, stripping de EXIF, derivados autenticados, rate limit e cleanup Cloudinary da ADR-039.
- [ ] Visibilidade por foto `private | authenticated`; `public` recusada. A prévia própria simula somente a audiência autorizada, sem criar perfil navegável ou diretório.
- [ ] Estados de moderação e integração por porta, com falha fechada para qualquer exposição a terceiros.
- [ ] Documentação de domínio, integração, OpenAPI, contratos BFF, versões, changelog e testes completos.

### Exclui

- Vídeo, áudio, stories, comentários, reações, reconhecimento facial e importação de redes sociais.
- Perfil público, diretório de pessoas, busca, recomendação ou entrega de galeria a qualquer pessoa autenticada fora de contexto autorizado.
- Leitura de GPS/EXIF, localização do aparelho, endereço, CEP, geocodificação, mapa, rota ou local em tempo real.
- Implementar ad hoc um console profissional: denúncia, caso, revisão e recurso dependem do contexto de Confiança e Segurança.
- Alterar a foto principal, completude, capacidades de anfitriã ou regras de eventos.

## 3. Impacto Arquitetural e ADRs

### Estrutura prevista

```text
back/drizzle/0011_profile_gallery.sql

back/src/modules/profiles/
├── domain/
│   ├── entities/profile-gallery-photo.ts
│   ├── value-objects/gallery-photo-metadata.ts
│   └── ports/outbound/{profile-media,profile-image-moderation}.ports.ts
├── application/use-cases/profile-gallery.use-cases.ts
├── infrastructure/
│   ├── media/cloudinary-profile-image-store.adapter.ts    (generalizado, sem duplicar adapter)
│   ├── moderation/<provider>.adapter.ts                   (após ADR-047 aceita)
│   └── persistence/{schema,drizzle-profile-media.repository}.ts
└── presentation/http/{controllers, dto}/profile-gallery.*.ts

front/src/
├── app/api/profile/gallery/**/route.ts                    (BFF estrito)
├── features/profile/components/profile-gallery-field.tsx  (Client)
├── features/profile/{contracts,messages}.ts
└── app/perfil/{page.tsx, previa/page.tsx}
```

### Fluxo

```text
RSC /perfil -> GET /api/v1/profiles/me -> itens próprios, sem URL persistida
browser -> POST BFF /api/profile/gallery/uploads -> Nest create grant (revision)
browser -> Cloudinary authenticated direct upload -> BFF finalize
Nest -> valida provedor -> UoW cria item privado/pending_moderation -> cleanup oportunista

edição de legenda/local/visibilidade/reordenação -> BFF -> Nest [UoW + compare-and-set]
projeção authenticated -> somente item approved + audiência permitida
```

### Hexagonal, DI e NestJS (`nestjs-expert`)

- O domínio não importa NestJS, Drizzle, Cloudinary ou fornecedor de moderação. `ProfileImageStorePort` continua responsável por arquivos; `ProfileImageModerationPort` recebe derivado/referência opaca e devolve veredito normalizado.
- Casos de uso são injetados por token e adapters `@Injectable()` usam constructor injection. Não haverá `new`, `forwardRef()` ou dependência circular.
- DTOs usam `class-validator`, `ValidationPipe` global e Swagger (`@ApiTags`, `@ApiOperation`, respostas explícitas). Erros continuam tipados e são mapeados no filter de apresentação.
- Operações de Cloudinary/moderação ocorrem fora de transação. A UoW curta trava/atualiza a revisão do perfil, aplica o máximo de cinco itens e reordena sem estado parcial.

### PostgreSQL e migration

Migration `0011_profile_gallery.sql`, aditiva e forward-only:

| Objeto | Alteração | Integridade |
|---|---|---|
| `profile_photo_asset` | finalidade `primary | gallery`, preservando linhas como `primary` | índices parciais da foto principal ajustados para `purpose = 'primary'`; índices de cleanup preservados |
| `profile_gallery_photo` | id, account_id, asset_id, position, caption, city, area, place_name, visibility, moderation_state, datas | FK composta ao asset da mesma conta, `asset_id` único, posição 1–5, enum/checks, unicidade de posição ativa por conta e índices para leitura/cleanup |
| limites | conta existente inicia sem linhas | máximo de cinco validado sob a mesma revisão/UoW; banco impede posições duplicadas |

Legenda, cidade, área e lugar recebem CHECK de tamanho; nenhuma coluna de coordenada, endereço, precisão, EXIF ou URL é criada. A exclusão/expiração de conta remove metadados por FK e encaminha assets ao cleanup idempotente.

Rollback operacional: flags desligadas e aplicações revertidas, preservando schema, itens privados e limpeza. Não haverá down migration destrutiva.

### ADRs

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Asset por finalidade + item de galeria separado, ordem 1–5 e lifecycle compartilhado | `docs/adrs/ADR-046-galeria-de-fotos-do-perfil.md` | accepted | Evita duplicar Cloudinary e separa arquivo de metadados editáveis. |
| Porta de moderação, falha fechada, denúncia/recurso fora do contexto de perfil | `docs/adrs/ADR-047-moderacao-de-fotos-adicionais.md` | proposed | Exposição requer fornecedor, governança humana e integração de confiança e segurança. |
| Localização contextual textual, aproximada e herdando a audiência da foto | `docs/adrs/ADR-048-localizacao-contextual-em-fotos-do-perfil.md` | proposed | Gera contexto social sem GPS, endereço ou rastreamento. |
| Revisão otimista, audiência e prévia | ADR-038 | accepted | Padrão do agregado `Profile`. |
| Upload/normalização/limpeza e entrega autenticada | ADR-039 e ADR-042 | accepted | Reutilizados, sem segundo adapter. |

## 4. Contratos e Interfaces

### 4.1 Domínio (pseudocódigo)

```ts
type GalleryVisibility = 'private' | 'authenticated';
type GalleryModerationState = 'pending_moderation' | 'approved' | 'flagged' | 'rejected' | 'unavailable';
type GalleryPhotoLocation = Readonly<{
  city: string | null;       // 2..80 quando presente
  area: string | null;       // 2..80 quando presente
  placeName: string | null;  // 2..120 quando presente
}>;
type GalleryPhoto = Readonly<{
  id: string; position: 1 | 2 | 3 | 4 | 5; caption: string | null;
  location: GalleryPhotoLocation; visibility: GalleryVisibility;
  moderationState: GalleryModerationState; image: ProfilePhoto;
}>;

createGalleryUpload({ accountId, revision, originSubject }): UploadGrant;
finalizeGalleryUpload({ accountId, uploadId, revision, providerResponse }): OwnProfile;
updateGalleryPhotoMetadata({ accountId, photoId, revision, caption, location, visibility }): OwnProfile;
reorderGalleryPhotos({ accountId, revision, photoIds }): OwnProfile;
removeGalleryPhoto({ accountId, photoId, revision }): OwnProfile;
```

Toda mutação recebe a revisão observada. `Profile` rejeita mais de cinco itens, posição inválida, IDs duplicados, `public`, texto fora dos limites e localização completamente precisa/estruturada; o adapter/provedor nunca determina regras de negócio.

### 4.2 HTTP NestJS e BFF

Todos os endpoints exigem BFF token, sessão, capacidade `profile_write` ou `profile_read`, `Cache-Control: private, no-store`, DTOs estritos e respostas envelopadas.

| Método e rota NestJS | Entrada | Resultado |
|---|---|---|
| `POST /profiles/me/gallery/uploads` | `revision` | grant de upload (`201`) |
| `POST /profiles/me/gallery/uploads/:uploadId/finalize` | `revision`, resposta Cloudinary | visão própria (`200`) |
| `PATCH /profiles/me/gallery/:photoId` | `revision`, legenda, localização, visibilidade | visão própria (`200`) |
| `PUT /profiles/me/gallery/order` | `revision`, cinco ou menos IDs únicos | visão própria (`200`) |
| `DELETE /profiles/me/gallery/:photoId` | `revision` | visão própria (`200`) |
| `GET /profiles/me` e `GET /profiles/me/preview` | sem rota nova | acrescentam itens próprios/projetados de maneira compatível |

Os BFFs equivalentes ficam em `/api/profile/gallery/**`; validam origem, JSON, limites e schemas Zod, delegando sem retry e sem acesso a PostgreSQL. O contrato da visão própria inclui estado de moderação; a prévia e qualquer projeção de terceiros omitem item privado ou não aprovado. `public` é `400` no DTO e no schema do BFF.

### 4.3 UX e acessibilidade (`impeccable`)

- Acrescentar a seção operacional “Fotos que contam um pouco sobre você” após a foto principal, explicando que ela serve para hobbies, atividades e lugares — não para uma vitrine de aparência.
- Grid reordenável com alternativa completa por teclado: botões “Mover para cima/baixo”, posição anunciada e não dependente de arrastar/soltar. Cada ação tem alvo mínimo de 44 px, foco âmbar e confirmação de remoção.
- Cada item oferece legenda, localização contextual e visibilidade própria. A ajuda explica que cidade/região/nome do local são opcionais e proíbe endereço, rotina, GPS e localização em tempo real.
- Status “em análise”, “precisa de revisão” ou “não disponível para outras pessoas” é textual, não depende de cor e não revela detalhes sensíveis da triagem. Apenas a titular vê item pendente/rejeitado.
- O RSC aproveita a leitura do próprio perfil; a ilha cliente recebe somente os itens e estados necessários (`server-serialization`). Cropper/modais são carregados sob demanda (`bundle-dynamic-imports`); reordenação, contadores e estados derivados seguem `rerender-derived-state-no-effect` e `rerender-move-effect-to-event`.
- Atualizar o surface brief antes da UI. A entrega termina com um passe visual desktop/mobile/zoom, correção em lote, uma confirmação no máximo, detector e finish review do Impeccable.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Só há uma foto principal ativa. | Perfil tem zero a cinco fotos adicionais, sem alterar foto principal ou completude. | RF012, RF081; ADR-046 |
| 2 | Não há metadados de galeria. | Legenda opcional até 120 e localização contextual textual aproximada são editáveis sem reenviar arquivo. | decisão de produto; ADR-048 |
| 3 | Foto começa privada; `public` não é aceito. | Cada item começa `private`; somente `private | authenticated` são aceitos. | RF015, RN014; ADR-038 |
| 4 | Não há exposição de mídia de galeria. | Apenas item `approved` e `authenticated` pode ser projetado em superfície autorizada; falha de moderação mantém privado. | Task 17; ADR-047 |
| 5 | Update usa revisão otimista. | Upload, metadados, remoção e ordenação usam a mesma revisão e são atômicos. | ADR-038, ADR-046 |
| 6 | EXIF é removido da foto principal. | Galeria não lê/guarda/mostra EXIF ou GPS; só derivados normalizados são entregues. | ADR-039, ADR-048 |
| 7 | Exclusão limpa foto principal de forma convergente. | Remoção, substituição, expiração e exclusão de conta encaminham cada asset de galeria à mesma limpeza idempotente. | RF068; ADR-039, ADR-046 |

## 6. Critérios de Aceitação

- A conta não cria ou finaliza mais de cinco itens ativos; a foto principal não conta para o limite e não é alterada por reordenação/remoção da galeria.
- Legenda aceita `null` ou 1–120 caracteres normalizados; URLs, e-mails, telefones e texto inválido são recusados. Cidade/área/lugar são anuláveis, dentro dos limites e nunca viram coordenada ou endereço.
- Todo item novo é privado. `public` é recusado; item `authenticated` não aprovado, sinalizado, rejeitado ou sem serviço de moderação não aparece fora da visão própria.
- Grant vencido, arquivo inválido, asset de outra conta, resposta forjada, upload incompleto e conflito de revisão não criam item ativo/projetável.
- Reordenar com duas abas produz um sucesso e um `409`, sem posição duplicada ou perda de item.
- URL de entrega, original, EXIF, localização contextual, legenda, razões de moderação e identificadores de fornecedor não entram em logs, métricas, erros públicos ou telemetria.
- DTOs são validados e documentados no Swagger; adapters são injetados; BFF é same-origin, stateless e não acessa banco.
- Fluxo é operável por teclado, leitor de tela e zoom de 200%; mobile e desktop não ocultam controles nem exigem drag-and-drop.
- `async-parallel`, `server-serialization`, `server-no-shared-module-state`, `server-auth-actions`, `bundle-dynamic-imports`, `bundle-barrel-imports`, `rerender-derived-state-no-effect` e `rerender-move-effect-to-event` são verificados na revisão.

## 7. Plano de Testes

### Backend unitário

- Value objects: limites, normalização, campos nulos, rejeição de links/contatos e GPS/endereço; posição e audiência.
- Entidade/casos de uso: criar até cinco, sexto recusado, reorder, remove, replace, revisão conflitante e independência da foto principal.
- Moderação: `approved`, `flagged`, `rejected`, `unavailable`, retries e nenhuma projeção a terceiros sem aprovação.
- `Test.createTestingModule`: DI, guards, DTOs, Swagger e mapeamento de falhas.

### Backend integração e E2E

- Upgrade `0010 -> 0011`: defaults, CHECKs, FKs, índices parciais, unicidade de posição, máximo concorrente, expiração e cascade.
- Duas transações para grant/finalização/reorder: uma vence, outra conflita; não há órfão lógico nem posição duplicada.
- Supertest: todos os endpoints, autenticação BFF, `400/401/403/404/409/429/503`, ownership A/B e snapshot OpenAPI.
- Smoke Cloudinary opt-in: transformação, EXIF stripping, asset autenticado e cleanup; fornecedor de moderação somente após aprovação da ADR-047 e com segredo fora do CI comum.

### Frontend unitário, integração e E2E

- Schemas Zod estritos, BFFs, payloads completos, URLs descartáveis de preview e recusa de `public`.
- Componente: adicionar/remover, legenda, localização, alternar audiência, reordenar por teclado, status e foco após remoção.
- Playwright: upload válido/inválido, cinco itens, sexto bloqueado, ordenação em duas abas, recarregar, falha/retry, preview e ausência de exposição para não aprovados.
- Axe, teclado, leitor de tela, 390 px e zoom 200%; capturas desktop/mobile, detector Impeccable e finish review delimitado.

Comandos de validação ao implementar: `bun run --cwd back lint`, `bun run --cwd back typecheck`, `bun run --cwd back test`, `bun run --cwd back test:e2e`, `bun run --cwd front lint`, `bun run --cwd front typecheck`, `bun run --cwd front test`, `bun run --cwd front test:e2e`, builds de ambos e `bun run --cwd back db:migrate` em banco descartável.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Fornecedor/moderação sem DPA ou retenção compatível | média | alto | ADR-047 aceita somente após avaliação jurídica/privacidade e contrato do fornecedor. |
| Fluxo de denúncia/recurso inexistente | alta | alto | Não habilitar `authenticated`; entregar somente galeria privada até o contexto de confiança e segurança existir. |
| Custo de transformações/moderação | média | alto | Limite de cinco, cota compartilhada, métricas agregadas, flags e alertas. |
| Concorrência na ordenação | média | médio | revisão otimista, lock/UoW curta, índice de posição e testes concorrentes. |
| Exposição de rotina/local preciso | média | alto | sem GPS/endereço, EXIF stripping, validação textual, audiência por foto e moderação. |
| Falha externa deixa órfão | média | médio | estado pendente, finalização autoritativa, cleanup idempotente e retry. |

Rollout: flags desligadas → migration → backend/fake adapters → frontend privado → smoke → moderação em observação → denúncias/recurso → projeção `authenticated`. Rollback desliga primeiro a projeção a terceiros, depois a UI, sem apagar dados nem assets; correções são forward-only.

## 9. Perguntas em Aberto (bloqueantes)

- [ ] Qual fornecedor de triagem automática será adotado, com quais categorias, limiares, região de processamento, DPA, suboperadores, retenção e custos?
- [ ] Qual bounded context/entrega disponibilizará denúncia, caso, revisão humana, recurso, auditoria e autorização profissional antes de habilitar a audiência `authenticated`?
- [ ] Quem é o owner operacional, qual SLA de revisão e qual política de comunicação para `flagged`/`rejected`?

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Uma ADR `proposed` foi criada para cada decisão material.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices`, `nestjs-expert` e Impeccable foram aplicadas ao escopo.
- [x] Testes, migration e rollback estão planejados.
- [ ] Perguntas em aberto foram exauridas.
