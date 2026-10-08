# Task: Implementar primeiro acesso com convite para completar o perfil

- **Slug:** primeiro-acesso-completar-perfil
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-30
- **Status:** implemented — publicado em `0.13.0`; ADR-041 rejeitada e contrato sem promessa de expiração conforme ADR-042. A configuração produtiva do Cloudinary continua como pré-requisito operacional de rollout.
- **Versão-alvo:** workspace/front `0.13.0`; back `0.12.0`
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A área autenticada criada na SDD-013 valida a sessão em `/inicio`, mas ainda apresenta “Completar perfil” como indisponível. O cadastro já fornece nome de exibição, região aproximada, intenções e ao menos três interesses; o contexto `profiles` somente grava esses dados durante o cadastro e não oferece leitura/edição autenticada.

A Task 13 deve tornar esse próximo passo útil sem recriar o cadastro nem bloquear uma conta ativa. Produto confirmou:

- convite para qualquer perfil realmente incompleto, novo ou veterano;
- foto principal e apresentação como novos dados desta entrega;
- edição dos dados básicos já existentes;
- adiamento por sete dias no navegador via cookie HttpOnly;
- Cloudinary como provedor de imagem atrás de porta do backend;
- campos opcionais do RF081, perfil visível a terceiros e moderação visual automática adiados.

Rastreabilidade: `docs/DER-EventMatch-MVP.md` RF012–RF016 e RF081; RN008–RN014, RN018, RN112–RN114 e RNF001; `docs/01-visao-geral-arquitetura.md` (Perfis e Preferências); `docs/02-regras-de-negocio.md` §2; `docs/03-modelos-de-dominio.md` §2.2; `docs/04-integracoes-externas.md` §§1 e 3; ADR-036/037; brief `front/.impeccable/surfaces/src-app-perfil-page-tsx.md`.

> **Gate de execução:** direção de produto confirmada e ADRs 038–040 aceitas em 2026-10-01. Plano liberado para `code-implementer`.

## 2. Escopo

### Inclui

- [x] Evoluir `profiles` para agregado editável com completude, revisão otimista e projeção de prévia.
- [x] Ler e editar nome, região aproximada, intenções, interesses, apresentação e visibilidade de foto/apresentação.
- [x] Preservar no mínimo três interesses ativos, uma intenção e os limites já existentes de nome/região.
- [x] Criar uma única foto principal privada no Cloudinary, com seleção, recorte, prévia local, upload assinado direto, finalização, substituição e remoção.
- [x] Entregar somente variantes raster normalizadas e autenticadas, sem EXIF/localização.
- [x] Criar limpeza idempotente de assets pendentes/deletáveis, execução oportunista limitada e comando operacional explícito.
- [x] Expor API NestJS v1 somente ao BFF, com sessão/capacidades, DTOs, Swagger, no-store e erros tipados.
- [x] Criar BFF/proxy Next.js para perfil e foto sem acesso ao PostgreSQL nem exposição de segredo/token.
- [x] Transformar o item de `/inicio` em convite acionável com progresso e “Agora não”.
- [x] Persistir o adiamento por sete dias em cookie HttpOnly escopado ao sujeito pseudônimo da conta.
- [x] Criar `/perfil` para edição e `/perfil/previa` para projeção autenticada restrita à titular.
- [x] Cobrir estados vazios, loading/pending, sucesso, conflito, sessão expirada, indisponibilidade, arquivo inválido, rate limit e falha do provedor.
- [x] Atualizar docs 01–04, OpenAPI, `.env.example`, READMEs, `CHANGELOG.md`, versões e runbook de mídia.
- [x] Executar revisão visual Impeccable delimitada com capturas desktop/mobile e finish review.

### Exclui

- Pronomes, profissão, idiomas, fotos adicionais, preferências de atividades, disponibilidade, distância, redes sociais, acessibilidade e alimentação (RF081).
- Perfil consultável por outras pessoas, URL pública de perfil, descoberta e indexação.
- Moderação visual automática, painel de moderação, denúncia e recurso de foto.
- Tornar foto/apresentação obrigatórias para login, sessão ou uso comum.
- Conceder capacidade de anfitrião; esta task apenas mantém os dados que futuramente participam de RN018.
- Edição de e-mail, celular, nascimento, status da conta ou região exata/localização do aparelho.
- Cropping facial, reconhecimento, biometria ou inferência de atributos.
- Scheduler interno, `@nestjs/schedule`, Redis, fila externa ou novo serviço de objetos.
- Alterar o mundo visual “Convite Cívico”, cadastro, login, recuperação de senha ou descoberta.

### Entregas verticais

1. **Perfil e projeção:** migration, agregado, repositório, completude, edição, prévia, autorização, contratos e testes backend.
2. **Mídia privada:** porta Cloudinary/fake, grants assinados, finalização, variantes, lifecycle/cleanup, remoção e testes.
3. **Experiência web:** BFF, cookie de adiamento, `/inicio`, `/perfil`, `/perfil/previa`, acessibilidade, E2E e revisão visual.

## 3. Impacto Arquitetural e ADRs

### Estrutura prevista

```text
back/src/modules/profiles/
├── domain/
│   ├── entities/profile.ts
│   ├── entities/profile-photo-asset.ts
│   ├── errors/profile.error.ts
│   ├── services/profile-completion.ts
│   ├── services/profile-preview-projector.ts
│   └── ports/outbound/
│       ├── profile-repository.port.ts
│       ├── profile-image-store.port.ts
│       ├── profile-media-attempt-repository.port.ts
│       └── profile-telemetry.port.ts
├── application/use-cases/
│   ├── get-own-profile.use-case.ts
│   ├── update-own-profile.use-case.ts
│   ├── preview-own-profile.use-case.ts
│   ├── create-profile-photo-upload.use-case.ts
│   ├── finalize-profile-photo-upload.use-case.ts
│   ├── remove-profile-photo.use-case.ts
│   └── cleanup-profile-media.use-case.ts
├── infrastructure/
│   ├── media/cloudinary-profile-image-store.adapter.ts
│   ├── media/fake-profile-image-store.adapter.ts
│   ├── observability/logger-profile-telemetry.adapter.ts
│   └── persistence/
└── presentation/http/
    ├── controllers/profile.controller.ts
    ├── dto/
    └── profile-error.filter.ts

front/src/
├── app/inicio/page.tsx
├── app/perfil/page.tsx
├── app/perfil/previa/page.tsx
├── app/api/profile/route.ts
├── app/api/profile/preview/route.ts
├── app/api/profile/photo/uploads/route.ts
├── app/api/profile/photo/uploads/[uploadId]/finalize/route.ts
├── app/api/profile/photo/route.ts
├── app/api/profile/invitation/dismiss/route.ts
├── features/profile/
│   ├── components/profile-form.tsx
│   ├── components/profile-photo-editor.tsx
│   ├── contracts.ts
│   └── messages.ts
└── shared/server/profile-bff.ts
```

Nomes podem receber ajustes mecânicos, mas ownership, dependências e contratos não podem migrar para controllers, DTOs, Route Handlers ou Client Components.

### Fluxo

```text
GET /inicio (RSC)
  -> valida sessão no identity-access
  -> GetOwnProfile [profiles]
     -> ProfileRepository [PostgreSQL]
     -> ProfileCompletion [domínio]
  -> compara invitationSubject com cookie HttpOnly
  -> renderiza convite, progresso ou estado completo

PUT /api/profile (browser)
  -> BFF: mesma origem + JSON + cookie de sessão
  -> PUT /api/v1/profiles/me
     -> AuthenticatedRequestGuard(profile_write)
     -> UpdateOwnProfile [revisão + UoW]
        -> catálogo valida interesses ativos
        -> profile/intenções/interesses atualizados atomicamente
  <- perfil/completude sem ids internos; BFF traduz allowlist

Selecionar foto
  -> preview/recorte local (nenhum upload)
  -> POST /api/profile/photo/uploads
     -> CreateProfilePhotoUpload
        -> limites por conta/origem
        -> asset pending + grant Cloudinary assinado por 5 min
  -> browser POST direto api.cloudinary.com
  -> POST .../[uploadId]/finalize { resposta assinada, revision }
     -> verificar assinatura + consultar Cloudinary fora da transação
     -> ativar novo asset e marcar anterior delete_pending em UoW curta
  -> CleanupProfileMedia tenta lote pequeno fora da transação

POST /api/profile/invitation/dismiss
  -> mesma origem + sessão válida
  -> resolve completion + invitationSubject no backend
  -> Set-Cookie HttpOnly por 7 dias; nenhum write de negócio
```

### Hexagonal, DI e autorização

- Domínio/aplicação de `profiles` não importam NestJS, Drizzle, Cloudinary, HTTP ou React.
- `ProfilesModule` compõe tokens com adapters `@Injectable()` via constructor injection; não usa `new`, service locator ou `forwardRef()`.
- `IdentityAccessModule` exporta um guard/adaptador de apresentação que resolve a sessão com estado live e anexa somente `{ accountId }` server-side. `profiles` importa `identity-access` em uma direção; nenhum ciclo é criado.
- ADR-036 é ampliada documentalmente com `profile_read` e `profile_write`, permitidas somente para conta `active`. Sessão ausente/inválida retorna `401`; conta não ativa revoga/recusa; capacidade negada retorna `403` genérico.
- Erros `ProfileNotFound`, `ProfileRevisionConflict`, `InvalidProfileContent`, `InactiveInterest`, `PhotoUploadExpired`, `PhotoRejected`, `MediaRateLimited` e `MediaUnavailable` são independentes de HTTP; filter mapeia respostas allowlisted.
- Validação de DTO usa `ValidationPipe`, `class-validator`, limites explícitos e Swagger. Domínio repete invariantes para chamadas não HTTP.
- Cloudinary implementa somente `ProfileImageStorePort`; fake determinístico é selecionável apenas em teste. Produção falha no bootstrap se mídia estiver habilitada sem credenciais válidas.

### RSC, Client Components e BFF

- `/inicio`, `/perfil` e `/perfil/previa` são RSC dinâmicos e `no-store`; sessão e dados são resolvidos antes de renderizar.
- Client Components ficam restritos a formulário, recorte, upload direto, pending, foco, contador e confirmação de remoção. Nenhum token de sessão, account id, provider secret ou `invitationSubject` vira prop.
- Route Handlers validam origem/content-type/tamanho, leem cookie HttpOnly, delegam uma vez ao NestJS, filtram resposta e nunca acessam PostgreSQL.
- A resposta de grant contém somente valores públicos/efêmeros necessários ao POST direto; `api_secret` e assinatura fora dos parâmetros exatos nunca saem do backend.
- URLs de foto são assinadas, mas não prometem expiração temporal. Usar elemento com dimensões estáveis e entrega direta sem cache público do otimizador Next; CSP permite somente endpoints Cloudinary necessários.
- Aplicar `server-auth-actions`, `server-no-shared-module-state`, `server-serialization`, `async-api-routes`, `async-parallel`, `async-defer-await`, `bundle-barrel-imports`, `bundle-analyzable-paths`, `rerender-derived-state-no-effect` e `rerender-move-effect-to-event`.

### PostgreSQL e migration

`back/drizzle/0007_profile_completion.sql` é aditiva:

| Objeto | Alteração/colunas | Constraints e índices |
|---|---|---|
| `profile` | `presentation text null`, `photo_visibility text default 'private'`, `presentation_visibility text default 'private'`, `revision integer default 1` | apresentação 1–500 quando presente; visibilidade `private|authenticated|public`; revisão positiva |
| `profile_photo_asset` | id, account id, provider, public/provider asset ids, version, format, bytes, width, height, state, upload expiry, activated/delete timestamps, attempts, created/updated | FK de conta preserva lifecycle; public ids únicos; state check; no máximo um `pending` e um `active` por conta; índices de cleanup |
| `profile_media_attempt` | id, scope `account|origin`, subject HMAC, attempted_at | índice `(scope, subject_hash, attempted_at)` e retenção curta; sem IP, token ou PII |

Backfill define visibilidades privadas e revisão `1`; não inventa apresentação/foto. Concorrência usa lock da linha do perfil e `revision` esperada. I/O Cloudinary nunca ocorre dentro de transação ou segurando conexão. Finalização consulta o provedor primeiro, depois faz uma transação curta; falha após upload mantém asset pendente e recuperável/limpável.

Rollback operacional desliga flags e preserva schema. Não há down migration destrutiva; correções são forward-only.

### ADRs

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Agregado editável, completude, revisão, prévia e visibilidade de foto/apresentação | `docs/adrs/ADR-038-modelo-de-completude-e-visibilidade-do-perfil.md` | accepted | Centraliza regras e evita modelar antecipadamente o RF081. |
| Cloudinary, upload direto assinado, assets autenticados, normalização e cleanup | `docs/adrs/ADR-039-cloudinary-para-foto-principal-do-perfil.md` | accepted | Decide integração externa, segurança, custos e lifecycle. |
| Convite por estado real e adiamento de 7 dias em cookie por conta/navegador | `docs/adrs/ADR-040-convite-de-perfil-adiado-no-navegador.md` | accepted | Evita persistência de onboarding e flash/client-only state. |
| Expiração real de URLs de derivados Cloudinary | `docs/adrs/ADR-041-expiracao-real-de-urls-cloudinary.md` | rejected | Produto rejeitou token-based authentication/proxy nesta entrega e retirou a promessa de expiração. |
| URL assinada sem prazo contratual | `docs/adrs/ADR-042-remover-expiracao-da-url-de-foto.md` | accepted | Remove `expiresAt` e explicita o risco de reutilização da URL enquanto o asset existir. |

As três decisões foram aceitas em 2026-10-01. Mudanças materiais futuras exigem novo ADR ou supersessão explícita; não editar silenciosamente a decisão aceita.

## 4. Contratos e Interfaces

### 4.1 Domínio e portas (pseudocódigo)

```ts
type ProfileFieldVisibility = 'private' | 'authenticated' | 'public';
type EditableProfileVisibility = Exclude<ProfileFieldVisibility, 'public'>;
type MissingProfileItem =
  | 'display_name' | 'region' | 'usage_intents' | 'interests' | 'photo' | 'presentation';

interface OwnProfile {
  revision: number;
  displayName: string;
  region: string;
  usageIntents: readonly UsageIntent[];
  interests: readonly { id: string; slug: string; label: string }[];
  presentation: string | null;
  photoVisibility: ProfileFieldVisibility;
  presentationVisibility: ProfileFieldVisibility;
  photo: null | { deliveryUrl: string; width: 512; height: 512 };
  completion: { complete: boolean; completedCount: number; totalCount: 6; missing: readonly MissingProfileItem[] };
}

interface ProfileRepositoryPort {
  findOwn(context, accountId): Promise<ProfileAggregate | null>;
  updateIfRevision(context, profile, expectedRevision): Promise<'updated' | 'conflict'>;
  createPendingPhoto(context, input): Promise<PendingPhotoAsset>;
  activatePhotoIfRevision(context, input): Promise<'activated' | 'conflict' | 'expired'>;
  markActivePhotoForDeletion(context, input): Promise<'marked' | 'absent' | 'conflict'>;
  listMediaForCleanup(context, now, limit): Promise<readonly ProfilePhotoAsset[]>;
  recordCleanupResult(context, input): Promise<void>;
}

interface ProfileImageStorePort {
  createSignedUpload(input): Promise<SignedUploadGrant>;
  verifyUploaded(input): Promise<VerifiedProfileImage>;
  createSignedDelivery(input): Promise<{ url: string }>;
  delete(input): Promise<'deleted' | 'already_absent'>;
}

interface ProfileMediaAttemptRepositoryPort {
  consume(input: {
    accountSubject: Uint8Array; originSubject: Uint8Array; now: Date;
    accountWindowMs: 86_400_000; accountLimit: 10;
    originWindowMs: 900_000; originLimit: 30;
  }): Promise<'allowed' | 'account_limited' | 'origin_limited'>;
}
```

`UpdateOwnProfile` recebe snapshot completo editável + `revision`, normaliza/valida e substitui intenções/interesses na mesma UoW. `PreviewOwnProfile` sempre cria projeção nova a partir do agregado e visibilidades; não devolve a entidade de persistência.

### 4.2 HTTP NestJS (`/api/v1/profiles`)

Todas as rotas exigem `X-EventMatch-BFF-Token`, Bearer de sessão, `PROFILE_HTTP_ENABLED=true`, capacidade aplicável e `Cache-Control: private, no-store`. `PROFILE_MEDIA_ENABLED` protege somente subrotas de foto.

| Método e rota | Entrada | Sucesso | Falhas allowlisted |
|---|---|---|---|
| `GET /profiles/me` | sessão | `200 OwnProfileResponse` | `401`, `403`, `404` flag, `503` |
| `PUT /profiles/me` | `UpdateProfileDto` | `200 OwnProfileResponse` | `400`, `401`, `403`, `409`, `503` |
| `GET /profiles/me/preview` | sessão | `200 ProfilePreviewResponse` | `401`, `403`, `404`, `503` |
| `POST /profiles/me/photo/uploads` | `{ revision }` + origin fingerprint | `201 SignedUploadGrantResponse` | `400`, `401`, `403`, `409`, `429`, `503` |
| `POST /profiles/me/photo/uploads/:uploadId/finalize` | `{ revision, providerResponse }` | `200 OwnProfileResponse` | `400`, `401`, `403`, `404`, `409`, `410`, `422`, `503` |
| `DELETE /profiles/me/photo` | `{ revision }` | `200 OwnProfileResponse` | `400`, `401`, `403`, `409`, `503` |

`UpdateProfileDto`:

```ts
{
  revision: positive integer;
  displayName: string;              // 1..60 after trim
  region: string;                   // 2..80 after trim
  usageIntents: UsageIntent[];      // >=1, unique
  interestIds: UUID[];              // >=3, unique, active
  presentation: string | null;      // 1..500 when non-null
  photoVisibility: 'private' | 'authenticated';
  presentationVisibility: 'private' | 'authenticated';
}
```

O contrato nunca devolve account id, provider public id, provider asset id, contato, nascimento, status/restrição ou assinatura reutilizável. `invitationSubject` existe somente no envelope interno usado por RSC/handler e deve ser removido de respostas browser-facing. O schema/domínio conhecem `public`, mas esta versão do DTO rejeita esse valor até a tarefa de exposição pública.

`providerResponse` tem schema fechado e tamanho máximo pequeno; assinatura, timestamp/version e ids são revalidados no adapter. `410` significa grant vencido; `422` significa arquivo decodificado mas incompatível com a política. `409` contém mensagem de recarregar, sem conteúdo concorrente.

Controllers usam `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`, DTOs concretos e decorators para `200/201/400/401/403/404/409/410/422/429/503`. OpenAPI v1 e testes de contrato são atualizados.

### 4.3 BFF e cookie

| Browser | Backend | Regra |
|---|---|---|
| `GET /api/profile` | `GET /profiles/me` | sessão; resposta allowlisted; no-store |
| `PUT /api/profile` | `PUT /profiles/me` | mesma origem + JSON <= 8 KiB; sem retry |
| `GET /api/profile/preview` | `GET /profiles/me/preview` | sessão; no-store |
| `POST /api/profile/photo/uploads` | rota equivalente | mesma origem + JSON; fingerprint; sem segredo |
| `POST /api/profile/photo/uploads/:id/finalize` | rota equivalente | id allowlisted; JSON <= 8 KiB; sem retry implícito |
| `DELETE /api/profile/photo` | rota equivalente | mesma origem + JSON; confirmação na UI |
| `POST /api/profile/invitation/dismiss` | consulta `GET /profiles/me` | grava somente cookie de preferência |

Mutações exigem `Origin === FRONTEND_PUBLIC_URL`, `Sec-Fetch-Site` ausente/`same-origin` e `application/json`. Resposta `401` expira o cookie de sessão; `403` preserva; timeouts/falhas viram `503`. BFF não repassa headers Cloudinary, stack, ids internos ou mensagens upstream.

Cookie de convite em produção:

```text
__Host-eventmatch_profile_invite=v1.<opaque-subject>.<dismissed-until>
HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800; no Domain
```

O subject é HMAC versionado gerado no backend e comparado somente no servidor. Prazo inválido, além de sete dias ou de outro subject é ignorado. Cookie não altera completude/autorização. Local/teste usa `eventmatch_profile_invite` sem `Secure` somente em configuração não publicada.

### 4.4 Cloudinary e configuração

```text
PROFILE_HTTP_ENABLED=false
PROFILE_MEDIA_ENABLED=false
PROFILE_MEDIA_PROVIDER=cloudinary
PROFILE_MEDIA_KEY=<base64 32+ bytes>
PROFILE_INVITATION_KEY=<base64 32+ bytes>
PROFILE_PHOTO_UPLOAD_TTL_SECONDS=300
PROFILE_PHOTO_MAX_BYTES=5242880
PROFILE_PHOTO_ACCOUNT_DAILY_LIMIT=10
PROFILE_PHOTO_ORIGIN_15M_LIMIT=30
CLOUDINARY_CLOUD_NAME=<required when media enabled>
CLOUDINARY_API_KEY=<required when media enabled>
CLOUDINARY_API_SECRET=<secret, required when media enabled>
CLOUDINARY_PROFILE_UPLOAD_PRESET=<signed preset>
PROFILE_UI_ENABLED=false                 # front
```

Backend valida relações/minimums e recusa config incoerente. `.env.example` contém placeholders, nunca valores reais. Cloudinary Console deve espelhar formatos, transformações, entrega autenticada, Strict Transformations e limites; um smoke opt-in detecta drift.

### 4.5 Rotas e UX

- `/inicio`: sessão e perfil resolvidos no servidor. Perfil incompleto sem snooze mostra progresso, ação “Completar perfil” e “Agora não”; completo não mostra convite; falha de perfil mostra estado recuperável sem conteúdo privado.
- `/perfil`: formulário pré-preenchido, foto e dados básicos primeiro, depois apresentação, intenções e interesses. Salvar exige revisão observada; conflito preserva rascunho local e oferece recarregar conscientemente.
- `/perfil/previa`: projeção server-side da audiência `authenticated`, com ação clara de voltar à edição. Campos privados aparecem como ausentes, não como placeholders públicos.
- Foto: input nativo + drop opcional, recorte quadrado acessível, preview local, estado de upload, retry explícito e remoção confirmada. Layout não se move entre estados.
- Apresentação: textarea de texto simples, limite 500, contador próximo do limite, instrução para não incluir contato e erro associado.
- “Agora não”: pending protegido, sucesso remove convite e anuncia “Lembraremos você novamente em sete dias”. Falha mantém convite.
- Nenhuma tela chama o processo de “publicação” para terceiros nesta entrega; usar “prévia” e “visibilidade futura para pessoas do EventMatch”. A audiência `public` permanece indisponível até a tarefa correspondente.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Perfil básico nasce no cadastro. | Dados válidos aparecem preenchidos e podem ser editados pela titular. | RF012; RN008, RN011 |
| 2 | `/inicio` não conhece o perfil. | Convite depende da completude calculada no backend, para novatos e veteranos. | decisão produto; ADR-038/040 |
| 3 | Próximos passos são indisponíveis. | Completar perfil navega para `/perfil`; descoberta permanece indisponível. | ADR-037; brief confirmado |
| 4 | Não há apresentação. | Apresentação é opcional, texto simples de até 500 caracteres e privada por padrão. | RF012, RF015; RN014 |
| 5 | Não há foto. | Existe no máximo uma foto principal ativa, privada por padrão e somente em derivados autenticados. | RF012, RF015; ADR-039 |
| 6 | Interesses são gravados no cadastro. | Edição mantém no mínimo três ids únicos e ativos. | RF012; RN008 |
| 7 | Não há revisão concorrente. | Toda mutação exige `revision`; escrita obsoleta falha sem overwrite silencioso. | ADR-038 |
| 8 | Não há prévia. | Titular recebe projeção sem contato, nascimento, status, sessão ou campos privados. | RF013; RN009, RN014 |
| 9 | Não há adiamento. | “Agora não” oculta por sete dias apenas para a mesma conta/navegador. | decisão produto; ADR-040 |
| 10 | Foto/apresentação não participam do sistema. | Presença contribui para completude e futuro RN018, mas não concede anfitrião nem bloqueia uso. | RF016; RN018 |
| 11 | Campos RF081 estão apenas documentados. | Permanecem fora desta entrega e não ganham colunas/DTOs vazios. | decisão produto |
| 12 | Não há exposição de foto. | Somente titular recebe URL assinada sem prazo contratual; exposição a terceiros exige nova tarefa de segurança, privacidade e moderação. | decisão produto; ADR-039; ADR-042 |

## 6. Critérios de Aceitação

### Funcionais

- [x] Conta ativa com perfil incompleto vê convite e contagem correta em `/inicio`; conta completa não vê.
- [x] O mesmo comportamento vale para conta recém-ativada e veterana; nenhuma flag `firstLogin` é necessária.
- [x] “Agora não” oculta o convite por sete dias naquele navegador e conta; outra conta no mesmo navegador não é afetada.
- [x] Limpar o cookie apenas antecipa o convite e nunca muda o perfil ou autorização.
- [x] `/perfil` reaproveita valores existentes e salva alterações válidas atomicamente.
- [x] Menos de três interesses, intenção vazia, duplicatas, interesse inativo e limites inválidos são recusados sem escrita parcial.
- [x] Duas abas com a mesma revisão produzem um sucesso e um conflito recuperável, nunca last-write-wins silencioso.
- [x] Foto pode ser pré-visualizada, enviada, finalizada, substituída e removida somente pela titular.
- [x] Grant vencido, arquivo inválido, resposta Cloudinary forjada e asset de outra conta nunca ativam foto.
- [x] `/perfil/previa` usa projeção do backend e nunca contém contato, nascimento completo, estado, restrição, sessão ou ids internos.
- [x] Foto/apresentação privadas não aparecem na projeção; mudar para `authenticated` altera somente a prévia nesta entrega; `public` é rejeitado pela API/UI.
- [x] Completar foto/apresentação não concede capacidade de anfitrião.

### Segurança, privacidade e operação

- [x] `api_secret`, tokens, cookies, upload signatures, URLs assinadas, texto e ids do provedor não aparecem em logs/telemetria.
- [x] Upload aceita apenas JPEG/PNG/WebP estático <= 5 MiB e dimensões permitidas; somente derivados normalizados são servidos.
- [x] Fixtures com EXIF/GPS não mantêm esses metadados na variante entregue.
- [x] Assets não finalizados não entram em leitura; vencidos/substituídos/removidos convergem para deleção idempotente.
- [x] Limites 10/24 h por conta e 30/15 min por origem persistem entre réplicas e não guardam IP/PII.
- [x] Falha Cloudinary preserva foto atual e não impede salvar texto; resposta é recuperável e neutra.
- [x] CSP e configuração permitem somente upload/entrega Cloudinary necessários; nenhum wildcard amplo é adicionado.
- [x] Flags desligadas retornam 404/ocultam UI; configuração de mídia incompleta falha no bootstrap somente quando habilitada.

### UX, acessibilidade e performance

- [x] Formulário, recorte, remoção, erros e convite funcionam com teclado, leitor de tela e zoom de 200%.
- [x] Alvos têm >=44 px, foco visível e mensagens associadas; `aria-live` não anuncia progresso excessivamente.
- [x] Estados de foto têm dimensões estáveis; texto de 60/80/500 caracteres não sobrepõe controles em mobile/desktop.
- [x] `prefers-reduced-motion` é respeitado e nenhuma informação depende de cor/movimento.
- [x] RSC evita cascata: sessão/perfil/catálogo independentes são iniciados em paralelo quando seguro; nenhuma busca client-only causa flash do convite.
- [x] Client bundle não inclui SDK administrativo Cloudinary; cropper é carregado somente na edição de foto e justificado no bundle.
- [x] Capturas de `/inicio` incompleto, `/perfil` e `/perfil/previa` em desktop/mobile passam no detector e finish review em no máximo dois passes.

### Observabilidade

- [x] Eventos estruturados: `profile.read`, `profile.update`, `profile.conflict`, `profile.preview`, `profile.invite.dismiss`, `profile.photo.grant`, `profile.photo.finalize`, `profile.photo.reject`, `profile.photo.remove`, `profile.media.cleanup`.
- [x] Eventos contêm outcome, status allowlisted, duração, correlation id, provider e contagens agregadas; nunca conteúdo do perfil ou mídia.
- [x] Métricas distinguem falha de validação, limite, provider, banco e cleanup; alerta operacional acompanha fila `delete_pending` e uso Cloudinary.

## 7. Plano de Testes

### Backend unitário

- `Profile` normaliza/valida limites, visibilidade, apresentação, intenções/interesses e revisão.
- `ProfileCompletion` cobre cada item ausente, total 6 e transições sem persistir resultado.
- `ProfilePreviewProjector` inclui somente campos autorizados e nunca conhece contato/nascimento.
- Casos de uso: leitura, update atômico, interesse inativo, conflito, grant/limites, assinatura forjada, expiração, finalize, replace, remove e cleanup idempotente.
- Adapter NestJS via `Test.createTestingModule`: tokens, provider selecionado, config fail-fast e ausência de `forwardRef()`.
- Cloudinary adapter com fetch/SDK mockado: parâmetros assinados exatos, allowlist, consulta autoritativa, signed delivery e destroy idempotente.

### Backend integração/PostgreSQL

- Migration 0007 sobre banco vazio e snapshot 0006 com perfis existentes; defaults privados e constraints.
- Dois pools concorrentes: update por revisão, finalização dupla, uma foto ativa/pending e consumo exato de limites.
- UoW: falha em interesses/intenções não altera perfil; I/O Cloudinary não segura transação/conexão.
- Lifecycle: pending vencido, replace/remove, retry de destroy, retenção curta de attempts e expiração/erasure da conta.

### Backend E2E/contrato

- Supertest cobre todos os endpoints, BFF guard, sessão/capacidades, DTOs/Swagger e códigos allowlisted.
- Conta A não lê/finaliza/remove foto de B; ids inexistentes não permitem enumeração útil.
- OpenAPI snapshot confirma que segredos/ids internos não integram schemas públicos.

### Frontend unitário/integração

- Schemas BFF rejeitam payloads/respostas extras, tamanhos e ids inválidos.
- Cookie: produção/local, sete dias, subject diferente, prazo adulterado, expiração e sem impacto na sessão.
- RSC: completo/incompleto/snoozed, sessão anônima/forbidden/unavailable, no flash e sem serialização do subject.
- Formulário: prefill, validação, dirty state, submit único, conflito preservando rascunho, foco no erro e contador.
- Foto: MIME/tamanho cliente, preview/revogação de object URL, recorte por teclado, cancelamento, progress, retry e remoção.
- BFF: same-origin, content-type, no retry, timeout, `401` limpa sessão, `403` preserva, upstream malformado vira `502/503`.

### E2E navegador

- Fake media adapter apenas no ambiente de teste e intercept controlado do upload direto; produção recusa fake.
- Conta incompleta: convite -> adiar -> refresh -> oculto; prazo simulado -> reaparece.
- Duas contas no mesmo navegador não compartilham adiamento.
- Editar dados, manter três interesses, apresentação inválida/válida, conflito de duas abas e preview.
- Foto válida com fixture EXIF, inválida, grant vencido, falha de upload, finalize, replace e remove.
- Sessão expirada no meio do fluxo retorna login sem expor rascunho/segredo.
- Chromium desktop e mobile; axe/teclado/zoom conforme harness existente. Firefox foi retirado da matriz por decisão de produto em 2026-10-03 para reduzir o tempo da suíte.

### Smoke Cloudinary opt-in

- Ambiente isolado cria asset autenticado de fixture, confirma variantes 512/128, metadados removidos, URL assinada e destruição.
- Executado manualmente/CI protegida somente com segredos dedicados; sempre cleanup em `finally` e sem imprimir resposta completa.

### Comandos de verificação

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

Não criar scripts ausentes apenas para mascarar validação; o plano pode adicionar `profile-media:cleanup` e smoke como entregáveis reais, documentados e testados.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Custo Cloudinary cresce por tráfego/transformações | média | alto | duas variantes fixas, no original, métricas/alertas, limite de grants e port adapter |
| Drift de preset/Strict Transformations expõe ou rejeita assets | média | alto | config documentada, smoke opt-in e rollout bloqueado por checklist |
| Upload concluído sem finalização cria órfão | alta | médio | pending invisível, expiração, cleanup oportunista + comando idempotente |
| Falha entre ativação DB e deleção anterior | média | médio | estado `delete_pending`, retry fora da UoW e alerta por idade da fila |
| URL assinada é compartilhada ou reutilizada | baixa | alto | owner-only, no-store/referrer, nenhum endpoint de terceiros e destruição do asset em substituição/remoção; sem promessa de expiração (ADR-042) |
| Conteúdo visual impróprio sem moderação | média | alto futuro | nenhuma exposição a terceiros; nova tarefa obrigatória antes do perfil público |
| Texto contém contato disfarçado | média | alto futuro | instrução + padrões evidentes agora; moderação/política antes de terceiros |
| Duas abas sobrescrevem dados | média | médio | revision otimista e `409` recuperável |
| Cookie de uma conta afeta outra | baixa | médio | subject HMAC por conta e comparação server-side |
| SDK/cropper aumenta bundle | média | baixo | SDK admin só backend; cropper lazy na rota e análise de bundle |
| Provedor indisponível bloqueia todo perfil | média | médio | separar update textual de mídia e preservar foto atual |
| Migration falha em perfis legados | baixa | alto | defaults/backfill determinísticos e teste snapshot 0006 -> 0007 |
| DPA, região, subprocessadores ou retenção Cloudinary incompatíveis com LGPD | média | alto | avaliação jurídica/privacidade obrigatória antes de produção; mídia permanece flag-off |

### Rollout

1. Aceitar ADRs, concluir avaliação jurídica/privacidade para produção e configurar ambiente Cloudinary isolado/preset assinado.
2. Aplicar migration 0007 e publicar backend com flags desligadas.
3. Habilitar `PROFILE_HTTP_ENABLED` para smoke interno e validar leitura/edição sem UI.
4. Habilitar `PROFILE_MEDIA_ENABLED`, executar smoke e cleanup; observar fila/custos.
5. Publicar frontend com `PROFILE_UI_ENABLED=false`, executar E2E e review visual.
6. Habilitar UI gradualmente; acompanhar conflitos, rejeições, latência, cleanup e créditos.

### Rollback

- Desligar `PROFILE_UI_ENABLED` remove convite/rotas visuais sem afetar sessão.
- Desligar `PROFILE_MEDIA_ENABLED` impede novos uploads, preserva texto e mantém cleanup disponível.
- Desligar `PROFILE_HTTP_ENABLED` oculta contrato; schema e assets permanecem para reativação/correção.
- Não apagar colunas/tabelas/assets ativos em rollback emergencial. Correções são forward-only; destruir assets somente por lifecycle autorizado.

## 9. Perguntas em Aberto (bloqueantes)

Nenhuma. Produto rejeitou a ADR-041 e aceitou retirar `expiresAt` do contrato conforme ADR-042.

ADRs 038–040 permanecem aceitas. Credenciais, avaliação jurídica e preset Cloudinary continuam pré-requisitos de rollout; testes comuns funcionam com fake sem segredos reais.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material.
- [x] Código de produção, migration e testes foram implementados; a publicação consta no `CHANGELOG.md` `0.13.0`.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices` e `nestjs-expert` foram aplicadas conforme o escopo.
- [x] Testes, migration e rollback foram implementados e documentados.
- [x] Perguntas em aberto foram exauridas.

## 11. Revisão posterior (2026-10-07)

O `code-reviewer` confirmou a implementação, as migrations, os artefatos de revisão visual e o registro de entrega no `CHANGELOG.md` `0.13.0`. `back lint`, `back typecheck`, `back build`, `front lint`, `front test`, `front typecheck` e o build do frontend concluíram com sucesso quando executados sem concorrência sobre `.next`.

Há uma pendência transversal de infraestrutura de teste: `bun run --cwd back test` falha em testes HTTP ao inicializar Supertest com Bun (`app.address()` nulo / porta `0`). Ela não invalida os critérios já implementados, mas impede declarar a suíte agregada do backend inteiramente verde até o runner ser corrigido. Credenciais, DPA/avaliação de privacidade e preset assinado do Cloudinary continuam exclusivamente como pré-requisitos de rollout produtivo.
