# Task: Implementar autenticação, sessão e primeiro acesso após o cadastro

- **Slug:** autenticacao-sessao-primeiro-acesso
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-29
- **Status:** ready
- **Versão-alvo:** 0.12.0
- **Tipo:** feature
- **Impacto público:** additive

> **Gate de execução:** decisões de produto confirmadas e ADRs 033–037 aceitas em 2026-09-29. Plano liberado para `code-implementer`.

## 1. Contexto e Motivação

A TASK 11 de `specs/tasks.txt` pede que uma pessoa com conta ativa entre por e-mail e senha, use uma sessão segura, encerre-a e chegue a uma experiência autenticada mínima. Hoje a conclusão ativa a conta, revoga a credencial de continuação e navega para `/cadastro/concluido`; não há autenticação geral, cookie de conta, rota protegida ou logout.

Estado verificado no repositório:

- `AccountStatus` implementa apenas `account_incomplete | active | expired`; `account_credential.password_hash` contém o Argon2id produzido por `Bun.password` no cadastro.
- `registration_flow_session` e o cookie `eventmatch_registration`/`__Host-eventmatch_registration` autorizam somente o onboarding (ADR-021/022) e são revogados na conclusão.
- `front/src/app/cadastro/concluido/page.tsx` não exibe dados privados e ainda promete login futuro.
- O BFF já possui origem estrita, credencial interna, fingerprint HMAC, timeout, redaction e `no-store`, reutilizáveis sem duplicar regra de negócio.
- A infraestrutura Playwright da SDD-012 já cobre Chromium desktop/móvel e Firefox contra PostgreSQL descartável.
- Raiz/frontend estão em `0.11.0` e backend em `0.10.0`. Esta feature leva raiz/frontend a `0.12.0` e backend/Swagger a `0.11.0`.

Decisões confirmadas pela pessoa responsável em 2026-09-29:

- sessão opaca stateful única, sem par access token/refresh token;
- sem “Manter conectado”: 12 horas absolutas, 30 minutos de inatividade e cookie não persistente;
- com “Manter conectado”: 30 dias absolutos, 7 dias de inatividade e rotação transparente a cada 24 horas;
- até cinco sessões por conta, removendo a menos recentemente usada ao exceder;
- somente conta `active` recebe sessão comum; capacidades/restrições são reavaliadas a cada requisição;
- limite de 5 tentativas por contato e 30 por origem em 15 minutos, sem bloqueio permanente;
- login em `/entrar` e primeira área autenticada em `/inicio`, sem dados privados, com logout e próximos passos indisponíveis claramente identificados.

Rastreabilidade: DER v1.3 RF008–RF011, RF057–RF062, RF076, RF078, RF088; RN001–RN016, RN085–RN106; RNF001, RNF004–RNF006, RNF009–RNF021; `docs/01-visao-geral-arquitetura.md` (Identidade e Acesso e antienumeração); `docs/02-regras-de-negocio.md`; `docs/03-modelos-de-dominio.md` (Account/Registration); `docs/04-integracoes-externas.md` (Auth e sessões); ADR-014/015/016/021/022/023/027/032.

## 2. Escopo

### Inclui

- [x] Criar `IdentityAccessModule` em arquitetura hexagonal, sem NestJS/HTTP/ORM em domínio/aplicação.
- [x] Autenticar e-mail/senha com normalização e índice cego existentes, verificação Argon2id real ou dummy e resposta neutra.
- [x] Criar sessão opaca stateful separada da continuação, com os dois perfis de duração, atividade amortizada, rotação, graça concorrente, limite de cinco sessões e revogação.
- [x] Adicionar migration `0006_authenticated_session` para sessões, tentativas de login e ampliação dos estados de conta; atualizar snapshot/journal Drizzle.
- [x] Criar limites deslizantes independentes por contato e origem, persistidos no PostgreSQL.
- [x] Expor contrato NestJS v1 de login, consulta de sessão e logout, interno ao BFF, validado e documentado por Swagger.
- [x] Criar BFF `/api/auth/**`, cookie HttpOnly, CSRF/origem, tradução conservadora e flags de rollout.
- [x] Criar `/entrar`, proteger `/inicio` antes do render e implementar logout/expiração/histórico/múltiplas abas.
- [x] Atualizar `/cadastro/concluido` para oferecer login sem autenticação automática.
- [x] Registrar telemetria segura de sucesso, rejeição, limite, rotação, expiração e logout.
- [x] Atualizar `docs/01-*` a `04-*`, READMEs, `.env.example`, OpenAPI, `CHANGELOG.md` e versões.
- [x] Executar revisão visual Impeccable delimitada, detector, capturas desktop/mobile e finish review na implementação.

### Exclui

- Recuperação/redefinição de senha, MFA, Google/Apple, WhatsApp/celular e gestão detalhada de dispositivos.
- Encerrar todas as outras sessões (RF011), listar dispositivos ou nomeá-los; a tabela apenas torna essas evoluções possíveis.
- Reativação, cancelamento de exclusão, recuperação restrita ou fluxos especiais para estados não ativos.
- Persistência completa e administração de restrições; esta task cria a porta/capability gate e negação por padrão.
- Edição/prévia de perfil, mudança de contato/nascimento, desativação/exclusão e cópia de dados.
- Descoberta/listagem de eventos, participação, conversa, notificações e painel administrativo.
- Autenticação automática ao concluir cadastro.
- Redis, cache de sessão, JWT, access token ou refresh token.
- Redesign de `DESIGN.md`; as novas superfícies herdam “Convite Cívico”.

### Entregas verticais

1. **Contrato e sessão:** migration, domínio, portas/adapters, autenticação, autorização, rotação, rate limit, endpoints e testes backend.
2. **Login e logout web:** cookie/BFF, `/entrar`, flags, CSRF, contratos e testes frontend/BFF.
3. **Primeiro acesso:** proteção de `/inicio`, próximos passos, conclusão do cadastro, múltiplas abas, E2E e finish review.

## 3. Impacto Arquitetural e ADRs

### Estrutura prevista

```text
back/src/modules/identity-access/
├── domain/
│   ├── entities/authenticated-session.ts
│   ├── errors/identity-access.error.ts
│   ├── services/session-policy.ts
│   └── ports/outbound/
│       ├── account-access-policy.port.ts
│       ├── authentication-account-reader.port.ts
│       ├── authentication-attempt-repository.port.ts
│       ├── authenticated-session-repository.port.ts
│       ├── authentication-telemetry.port.ts
│       └── authentication-security.ports.ts
├── application/use-cases/
│   ├── authenticate-account.use-case.ts
│   ├── resolve-authenticated-session.use-case.ts
│   └── logout.use-case.ts
├── infrastructure/
│   ├── observability/logger-authentication-telemetry.adapter.ts
│   ├── persistence/repositories/
│   └── security/
├── presentation/http/
│   ├── controllers/auth.controller.ts
│   ├── dto/
│   └── identity-access-error.filter.ts
└── identity-access.module.ts

front/src/
├── app/entrar/page.tsx
├── app/inicio/page.tsx
├── app/api/auth/login/route.ts
├── app/api/auth/session/route.ts
├── app/api/auth/logout/route.ts
├── features/authentication/
│   ├── components/login-form.tsx
│   ├── contracts.ts
│   └── messages.ts
└── shared/server/
    ├── authentication-cookie.ts
    ├── authentication-bff.ts
    └── authenticated-view.ts
```

Nomes finais podem ser ajustados mecanicamente, mantendo as camadas e ownership acima.

### Fluxo

```text
POST /entrar form
  -> Next Route Handler /api/auth/login
     -> NestJS AuthController [DTO + BFF guard]
        -> AuthenticateAccount [application]
           -> consume contact + origin limits [PostgreSQL, UoW curta]
           -> AuthenticationAccountReader [account/contact/credential]
           -> PasswordVerifier real ou dummy
           -> AccountAccessPolicy(active, authenticated_home)
           -> AuthenticatedSessionRepository [lock, prune, max 5, insert]
        <- token opaco somente em header interno
     <- Set-Cookie HttpOnly; JSON sem token
  -> replace('/inicio')

GET /inicio
  -> RSC server-only lê cookie
     -> ResolveAuthenticatedSession
        -> digest -> sessão -> prazos -> estado/capacidade atuais
     -> render mínimo sem dados privados
     X inválida -> redirect('/entrar') + BFF limpa em próxima resposta autenticada

POST /api/auth/logout
  -> BFF valida origem
     -> Logout remove/revoga sessão no PostgreSQL
  <- expira cookie em qualquer resultado seguro
```

### Hexagonal e DI

- Domínio/aplicação não importam NestJS, Drizzle, HTTP ou o módulo `registration`.
- O módulo NestJS é composition root, liga tokens a adapters `@Injectable()` por constructor injection e não usa `forwardRef()`.
- O `BffInternalGuard` existente é extraído para apresentação compartilhada e reutilizado, sem duas implementações da mesma credencial interna.
- Conta/contato/credencial continuam com lifecycle produzido pelo cadastro; definições físicas compartilhadas evitam import infraestrutura→infraestrutura entre bounded contexts.
- Casos de uso usam `UnitOfWorkPort`; rate limit roda em UoW curta antes da verificação. Nenhum hash Argon2id ou I/O externo ocorre dentro de lock/transação.
- Erros `InvalidCredentials`, `SessionExpired`, `SessionRevoked`, `CapabilityDenied` e `RateLimited` são tipados sem HTTP; filter/controller os traduz de forma neutra.
- `ValidationPipe` global permanece a autoridade de DTOs; todos os endpoints usam `class-validator`, `@ApiTags`, `@ApiOperation` e decorators de resposta.

### RSC, Client Components e BFF

- `/entrar` e `/inicio` são RSC. Somente `LoginForm` e manutenção/foco estritamente interativos usam `'use client'`.
- A sessão é validada server-side antes de qualquer conteúdo de `/inicio`; nenhum principal/conta é serializado à ilha.
- Route Handlers autenticam origem, transportam credenciais e delegam; não conhecem estado de conta nem acessam PostgreSQL.
- Aplicar `server-auth-actions`, `server-no-shared-module-state`, `server-serialization`, `async-api-routes`, `async-defer-await`, `bundle-barrel-imports`, `bundle-analyzable-paths`, `rerender-derived-state-no-effect` e `rerender-move-effect-to-event`.

### PostgreSQL e migration

`back/drizzle/0006_authenticated_session.sql`:

- amplia `account_status_check` com os estados da ADR-036;
- cria `authenticated_session` com FK de conta, digests únicos parciais, `idle_timeout_seconds`, coerência de digest anterior/prazo, timestamps e índices por `account_id`, digest e expiração;
- cria `authentication_attempt` com escopo `contact|origin`, `subject_hash`, `attempted_at`, PK e índice `(scope, subject_hash, attempted_at)`;
- não copia token, senha, e-mail, IP, user-agent ou body;
- é aditiva/expansiva; downgrade destrutivo é proibido.

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Sessão opaca stateful, novo contexto, prazos, rotação e múltiplos dispositivos | `docs/adrs/ADR-033-sessoes-autenticadas-opacas-e-stateful.md` | accepted | Define a nova fronteira de autenticação, persistência e ciclo da sessão. |
| Cookie HttpOnly, CSRF/CORS, BFF, cache e desenvolvimento local | `docs/adrs/ADR-034-cookie-http-only-e-bff-para-sessao.md` | accepted | Decide transporte e proteção do segredo no navegador. |
| Limites 5/30 em janela deslizante de 15 min, resposta e telemetria | `docs/adrs/ADR-035-limites-de-abuso-do-login.md` | accepted | Política material contra força bruta e credential stuffing. |
| Somente `active`, capacidades live e negação por padrão | `docs/adrs/ADR-036-autorizacao-de-sessao-por-estado-e-capacidade.md` | accepted | Define autorização para estados/restrições sem vazamento. |
| `/entrar`, `/inicio`, histórico e conteúdo do primeiro acesso | `docs/adrs/ADR-037-rotas-de-login-e-primeiro-acesso.md` | accepted | Contrato público e UX da primeira área autenticada. |

Todos os ADRs devem estar `accepted` antes da implementação.

## 4. Contratos e Interfaces

### 4.1 Domínio e portas (pseudocódigo)

```ts
type SessionMode = 'browser' | 'remembered';
type AccountCapability = 'authenticated_home' | 'logout';

interface AuthenticationAccount {
  accountId: string;
  status: AccountStatus;
  passwordHash: string | null;
}

interface AuthenticationAccountReaderPort {
  findByEmailHash(emailHash: Uint8Array): Promise<AuthenticationAccount | null>;
}

interface AccountAccessPolicyPort {
  decide(accountId: string, status: AccountStatus, capability: AccountCapability): Promise<'allow' | 'deny'>;
}

interface PasswordVerifierPort {
  verify(candidate: string, hash: string): Promise<boolean>;
  verifyDummy(candidate: string): Promise<void>;
}

interface SessionTokenPort {
  issue(): { token: string; digest: Uint8Array };
  digest(token: string): Uint8Array;
}

interface AuthenticatedSessionRepositoryPort {
  createWithLimit(input, maxSessions: 5): Promise<CreatedSession>;
  resolveByDigest(input): Promise<AuthenticatedSession | null>;
  rotateCurrentAtomically(input, previousGraceMs: 60_000): Promise<RotatedSession | 'lost_race'>;
  touchIfDue(sessionId, now, writeIntervalMs: 300_000): Promise<void>;
  revoke(sessionId, now): Promise<void>;
  pruneExpired(now, limit): Promise<number>;
}

interface AuthenticationAttemptRepositoryPort {
  consume(input: {
    contactSubject: Uint8Array; originSubject: Uint8Array;
    now: Date; windowMs: 900_000; contactLimit: 5; originLimit: 30;
  }): Promise<'allowed' | 'contact_limited' | 'origin_limited'>;
}
```

`AuthenticateAccount.execute({ email, password, rememberMe, originFingerprint })` devolve internamente token + metadados seguros; `ResolveAuthenticatedSession.execute({ token, capability, allowRotation })` devolve principal server-only e eventual rotação; `Logout.execute({ token })` é idempotente do ponto de vista do usuário.

### 4.2 Política configurável e fail-fast

Adicionar ao backend, com defaults confirmados e relações validadas:

```text
AUTH_HTTP_ENABLED=false
AUTH_SESSION_SECRET=<base64 32+ bytes>
AUTH_SESSION_ABSOLUTE_TTL_SECONDS=43200
AUTH_SESSION_IDLE_TTL_SECONDS=1800
AUTH_REMEMBERED_ABSOLUTE_TTL_SECONDS=2592000
AUTH_REMEMBERED_IDLE_TTL_SECONDS=604800
AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS=300
AUTH_SESSION_RENEWAL_INTERVAL_SECONDS=86400
AUTH_SESSION_PREVIOUS_TOKEN_GRACE_SECONDS=60
AUTH_MAX_SESSIONS_PER_ACCOUNT=5
AUTH_LOGIN_WINDOW_SECONDS=900
AUTH_LOGIN_CONTACT_LIMIT=5
AUTH_LOGIN_ORIGIN_LIMIT=30
```

`AUTH_SESSION_SECRET` é independente de `REGISTRATION_FLOW_SECRET`. Testes podem usar TTLs menores por ambiente validado; produção recusa valores abaixo dos mínimos documentados. Frontend adiciona somente `AUTH_UI_ENABLED=false`; continua reutilizando `BACKEND_INTERNAL_URL`, `FRONTEND_PUBLIC_URL`, `BFF_INTERNAL_TOKEN`, `ORIGIN_FINGERPRINT_KEY` e `EDGE_PROVIDER`.

### 4.3 HTTP NestJS (`/api/v1/auth`)

Todas as rotas exigem `X-EventMatch-BFF-Token`, `AUTH_HTTP_ENABLED=true`, `Cache-Control: no-store` e envelope padrão. A credencial de sessão entra como Bearer somente em `session/logout`; token novo/rotacionado sai apenas no header interno removido pelo BFF.

| Método e rota | Entrada | Sucesso | Falhas públicas |
|---|---|---|---|
| `POST /auth/login` | `{ email: string, password: string, rememberMe: boolean }` + fingerprint | `200 { authenticated: true, expiresAt, idleExpiresAt, remembered }` | `400` forma; `401` neutro; `429` neutro; `503` |
| `GET /auth/session` | Bearer + capacidade solicitada | `200 { authenticated: true, expiresAt, idleExpiresAt, remembered, rotationDue }` | `401` neutro para ausente/expirada/revogada ou conta fora de `active` (revoga a sessão); `403` genérico para conta `active` com capacidade negada (sessão mantida); `503` |
| `POST /auth/logout` | Bearer | `200 { loggedOut: true }` | `200` também quando já ausente no BFF; `503` não impede apagar cookie local |

DTO de login usa `@IsEmail`, tamanho máximo 320, senha string 1–256 (não reaplica política de criação), `@IsBoolean`; nunca ecoa entrada. Documentar respostas com `@ApiOkResponse`, `@ApiUnauthorizedResponse`, `@ApiForbiddenResponse` (sessão), `@ApiTooManyRequestsResponse` e `@ApiServiceUnavailableResponse`.

O corpo e tamanho de `401` são iguais para e-mail inexistente, senha errada e estado/capacidade sem sessão comum. O adapter executa um único verify Argon2id real ou dummy. `429` não informa bucket nem tempo exato. Na resolução de sessão, `401` expira o cookie no BFF e `403` não; nenhum dos dois informa estado ou motivo (ADR-036).

### 4.4 BFF e cookie

| Browser | Backend | Regra |
|---|---|---|
| `POST /api/auth/login` | `POST /auth/login` | mesma origem + JSON; fingerprint; em sucesso grava cookie; JSON não contém token |
| `GET /api/auth/session` | `GET /auth/session` | lê cookie; pode aceitar rotação interna; sempre `no-store` |
| `POST /api/auth/logout` | `POST /auth/logout` | mesma origem + JSON; sempre expira cookie |

Cookie de produção: `__Host-eventmatch_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sem `Domain`. Sem remember não inclui persistência; remembered usa `Max-Age = min(absoluteExpiresAt-now, 30d)`. Local/teste usa `eventmatch_session` sem `Secure`; nenhuma configuração publicada permite esse fallback.

CSRF: mutações exigem `Origin === FRONTEND_PUBLIC_URL`, `Sec-Fetch-Site` ausente ou `same-origin` e `application/json`; não há CORS. Login não aceita GET/form post tradicional. Não há retry automático.

### 4.5 Rotas e UI

- `GET /entrar`: público; conectado → redirect server-side `/inicio`.
- `GET /inicio`: protegido; inválido → redirect `/entrar`; página e fetches `no-store`.
- sucesso de login: `router.replace('/inicio')` ou navegação equivalente sem manter formulário útil no histórico.
- logout: pending/duplo clique protegido, cookie apagado e `replace('/entrar')`.
- `/cadastro/concluido`: ação primária “Entrar no EventMatch” → `/entrar`; sem login automático.

Copy neutra de credencial: “Não foi possível entrar. Confira os dados e tente novamente.” Limite: “Não foi possível entrar agora. Aguarde um pouco e tente novamente.” Nenhuma mensagem menciona existência, estado ou restrição da conta.

`/inicio` mostra “Você entrou no EventMatch”, logout e cartões/itens “Completar perfil” e “Descobrir encontros” com `Em breve`, sem links falsos, nome, e-mail ou id.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Conta ativa não possui login geral. | E-mail confirmado + senha correta + estado/capacidade permitidos criam sessão comum. | RF008, decisão 2026-09-29 |
| 2 | Continuação termina na ativação. | Continua exclusiva do cadastro; nunca autoriza `/inicio` ou `/auth`. | ADR-021, TASK 11 |
| 3 | — | Sessão comum nunca autoriza operações internas de cadastro. | TASK 11 |
| 4 | — | Sem remember: 12 h absolutas, 30 min de inatividade, cookie não persistente. | Decisão 2026-09-29, ADR-033 |
| 5 | — | Remembered: 30 dias absolutos, 7 dias de inatividade, rotação a cada 24 h. | RF009, decisão 2026-09-29 |
| 6 | — | Atividade renova apenas inatividade; absoluto exige nova autenticação. | ADR-033 |
| 7 | — | Até cinco sessões; a sexta remove a menos recentemente usada. | Decisão 2026-09-29 |
| 8 | — | Somente `active` recebe sessão comum; demais estados falham de forma neutra. | ADR-036 |
| 9 | — | Restrição/capacidade é reavaliada em cada requisição, não copiada para a sessão. | RN097–RN099, ADR-036 |
| 10 | — | Falhas de login consomem buckets independentes: contato 5/15 min, origem 30/15 min; a reserva feita antes do lookup é liberada em sucesso. | Decisão 2026-09-29, ADR-035 |
| 11 | — | Não há bloqueio permanente; janela libera automaticamente. | ADR-035 |
| 12 | — | Logout revoga servidor + cookie; reuso não autoriza. | RF011/RNF005 parcial, ADR-033/034 |
| 13 | Conclusão promete login futuro. | Oferece `/entrar`; login continua explícito e separado. | TASK 11, ADR-037 |
| 14 | — | `/inicio` confirma acesso e indica próximos passos indisponíveis sem dados privados. | Decisão 2026-09-29 |

## 6. Critérios de Aceitação

### Comportamento e contrato

- Conta `active`, e-mail e senha válidos recebem token opaco somente no BFF, cookie correto e redirect `/inicio`.
- E-mail inexistente, senha errada e qualquer estado/capacidade sem sessão comum têm `401` observavelmente equivalente e não criam sessão.
- O caminho inexistente executa verify dummy; erro interno não vira “credencial inválida”.
- Sem remember, servidor aplica 12 h/30 min e cookie não persistente; remembered aplica 30 d/7 d, cookie persistente e rotação 24 h sem estender o absoluto.
- Refresh, URL direta e nova aba preservam sessão válida. Expiração/revogação redireciona sem conteúdo privado renderizado ou cacheado.
- Sexto login remove atomicamente a sessão válida menos recente. Outras quatro permanecem.
- Logout revoga a sessão atual e apaga cookie; repetição/reuso recebe negação. Outras sessões da conta não são revogadas nesta task.
- Continuação do cadastro e sessão comum são mutuamente incapazes de cruzar privilégios.
- `/cadastro/concluido` oferece login, sem autenticação automática.

### Segurança e privacidade

- Token tem 256 bits aleatórios, é persistido somente como HMAC e nunca aparece em JSON, log, trace, screenshot, analytics ou JavaScript.
- Cookie de produção cumpre `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sem `Domain`; local inseguro é recusado em produção.
- Login/logout resistem CSRF/login-CSRF por origem e tipo de conteúdo; backend não libera CORS ao browser.
- Rate limit usa dois buckets independentes, reserva antes do lookup, inclui contato inexistente e libera a reserva em sucesso; concorrência não excede 5/30 falhas dentro da janela deslizante.
- Nenhum log contém e-mail, senha, cookie, token, hash de senha, contact hash, fingerprint, body ou motivo privado. Correlation id não deriva da entrada.
- Sessão consulta estado/capacidade atual antes de cada autorização; negação ocorre antes de serialização RSC.
- Respostas `401/429/5xx` não incluem stack, ids internos ou detalhes de conta.
- Configuração inválida falha cedo e redigida; segredos não entram no Git.

### UX, acessibilidade e visual

- Formulário tem labels visíveis, autocomplete correto, pending, prevenção de duplo envio, erro associado e foco no resumo/campo apropriado.
- Fluxo funciona por teclado, leitor de tela e zoom 200%, sem scroll horizontal; foco visível, contraste AA, alvos ≥44 px e estado não depende só de cor.
- `/inicio` não exibe dado privado nem promessa de funcionalidade disponível; próximos passos indisponíveis possuem texto “Em breve” e não são controles enganosos.
- Login, conclusão e início herdam exclusivamente tokens semânticos e “Convite Cívico”; nenhuma linguagem visual/texteual sugere namoro.
- Antes de editar UI na implementação, carregar `impeccable context` para os alvos, registrar surface brief das novas rotas quando exigido e manter `DESIGN.md` inalterado salvo mudança durável aprovada.
- Finalizar em no máximo duas rodadas visuais: capturas válidas 1440× e 390× juntas, correção em lote, confirmação, detector Impeccable uma vez e finish review independente.

### Performance e regras Vercel/NestJS

- Consulta por digest usa índice único; `last_seen_at` escreve no máximo a cada 5 min; transações/locks não contêm Argon2id nem I/O externo.
- Login mede duração agregada sem PII. Conteúdo principal de `/entrar` e `/inicio` visa RNF013; feedback de submit é imediato e resultado visível dentro do SLO quando dependências respondem.
- RSC por padrão, ilha cliente mínima, props sem principal/expiração/token, imports diretos e analisáveis; nenhuma dependência frontend pesada nova.
- `server-auth-actions`, `server-no-shared-module-state`, `server-serialization`, `async-api-routes`, `async-defer-await`, `bundle-barrel-imports` e `bundle-analyzable-paths` estão cobertas por revisão/testes aplicáveis.
- Providers usam `@Injectable()`/constructor injection; `ValidationPipe`, DTOs `class-validator`, Swagger, erros tipados, `Test.createTestingModule` e Supertest são aplicados.

### Flags, documentação e versão

- `AUTH_HTTP_ENABLED=false` e `AUTH_UI_ENABLED=false` por padrão; UI não é habilitada antes do backend/migration.
- OpenAPI, `docs/01-*` a `04-*`, `.env.example`, READMEs e `CHANGELOG.md` refletem sessão, cookies, flags, comandos, rollout e limites.
- Raiz/frontend passam a `0.12.0`; backend/Swagger passam a `0.11.0`; `bun.lock` só muda se a versão do workspace exigir, sem nova dependência desnecessária.

## 7. Plano de Testes

### Backend unitário (`bun run --cwd back test`)

- `AuthenticatedSession`: criação, ambos os modos, bordas exatas de idle/absolute, atividade sem estender absoluto, ausência de rotação periódica no modo padrão, rotação 24 h no remembered, grace e expiração.
- `AuthenticateAccount`: sucesso, senha errada, e-mail inexistente com dummy, hash nulo, todos os estados, capability deny, rate limit e erro interno.
- Neutralidade: mesmo erro público para inexistente/senha/estado; nenhuma sessão/telemetria sensível.
- Limite de cinco e escolha LRU sob relógio controlado.
- `ResolveAuthenticatedSession`: digest atual/anterior, grace, atividade amortizada, rotação due, estado alterado e capability alterada.
- `Logout`: válido, já removido, expirado e concorrência.
- DTOs/filter/controller/guards e Swagger por snapshot; `Test.createTestingModule` valida todos os tokens/exports sem `forwardRef`.
- Architecture tests impedem imports NestJS/Drizzle/HTTP em domínio/aplicação e imports do contexto `registration` fora dos adapters compartilhados definidos.

### PostgreSQL integração (`bun run --cwd back test:integration`)

- Upgrade `0005 -> 0006`, schema do zero, constraints, índices, HMAC-only e estados ampliados.
- Dois pools/repositórios concorrentes: consumo 5/30 exato em janela deslizante, contatos inexistentes, liberação da reserva em sucesso (logins válidos repetidos não geram `429`), cleanup e ordem sem deadlock.
- Dois logins simultâneos próximos do limite de cinco não deixam seis sessões.
- Rotação atômica iniciada somente pelo token atual; duas réplicas produzem um único vencedor. Digest anterior vale por 60 s apenas para concluir requisição concorrente, nunca recebe o token novo, não rotaciona e é recusado depois; nenhum token fica em claro.
- Idle/absolute em bordas, touch coalescido, logout/reuso e limpeza oportunista.
- Alteração de `account.status` entre duas requisições invalida autorização imediatamente com `401` e revoga a sessão; capacidade negada (fake) em conta `active` retorna `403` e mantém a sessão.

### Backend E2E (`bun run --cwd back test:e2e`)

- BFF token/flag/métodos/DTOs/Swagger/no-store.
- Login válido → sessão → logout → bearer antigo `401`.
- Inexistente, senha errada e estados proibidos com snapshot equivalente.
- `429` genérico nos dois escopos; recuperação automática após relógio/janela de teste.
- Rotação somente em header interno e ausência em corpo/log.

### Frontend unitário e integração (`bun run --cwd front test`)

- Schemas Zod e tradução conservadora de envelopes/status.
- Cookie produção/local, remember on/off, Max-Age limitado ao absoluto, rotação e expiração.
- CSRF: Origin ausente/múltipla/estrangeira, `Sec-Fetch-Site`, content type e métodos rejeitados antes do upstream.
- BFF encaminha somente headers autorizados, não faz retry e nunca devolve token/header interno.
- Formulário: autocomplete, checkbox inicialmente falso, pending, duplo clique, descarte de senha e foco/mensagem neutra.
- `/inicio`: validação antes de render, redirect e ausência de dados privados em HTML/RSC props.
- Conclusão aponta para `/entrar`; `/entrar` autenticado redireciona; logout sempre apaga cookie.
- Headers `Cache-Control`/`no-store` e histórico/navegação substitutiva.

### E2E full-stack Playwright (`bun run --cwd front test:e2e`)

- Criar conta ativa pelo cadastro real, concluir sem auto-login, seguir “Entrar no EventMatch” e autenticar.
- Falha neutra para e-mail reservado inexistente, senha errada e fixtures de estados proibidos; comparar status/copy/semântica sem guardar segredos.
- Remember off/on e atributos de cookie via contexto do navegador; segredo inacessível a `document.cookie`.
- Refresh, URL direta, back/forward e nova aba; nenhuma resposta protegida servida de cache.
- Logout em uma aba invalida reutilização nas demais; próxima atividade/foco redireciona.
- Expiração idle/absolute e rotação com TTLs reduzidos apenas no ambiente E2E.
- CSRF/cross-origin, cookie adulterado, sessão revogada e grace concorrente.
- Teclado, ordem/foco, `aria-live`, leitor de tela por árvore semântica, axe, contraste, 200% e viewports desktop/móvel/Firefox.
- Traces/screenshots/logs usam dados reservados e não contêm senha/token/cookie/e-mail real.

### Validação final

- `bun run --cwd back lint`
- `bun run --cwd back typecheck`
- `bun run --cwd back test`
- `bun run --cwd back test:integration` no runner descartável
- `bun run --cwd back test:e2e`
- `bun run --cwd back build`
- `bun run --cwd front lint`
- `bun run --cwd front typecheck`
- `bun run --cwd front test`
- `bun run --cwd front build`
- `bun run --cwd front test:e2e`
- `bunx @nestjs/cli info` em `back/` para diagnóstico final de ambiente/DI
- inspeção manual de OpenAPI, cookies, headers, cache, logs redigidos e comportamento com JavaScript desabilitado onde aplicável

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---:|---:|---|
| Reutilizar acidentalmente continuação de cadastro | baixa | crítico | Tabelas, segredos, cookies, guards e testes negativos separados. |
| Enumeração por corpo, status ou tempo | média | crítico | `401` único, verify dummy Argon2id, rate limit antes do lookup, snapshots e medição estatística sem prometer igualdade perfeita de rede. |
| Cookie vazar para JS/log/trace | baixa | crítico | HttpOnly/`__Host-`, allowlists, redaction e testes de bundle/headers/traces. |
| Corrida cria mais de cinco sessões | média | alto | Lock transacional e integração com dois pools. |
| Rotação quebra múltiplas abas | média | alto | Digest anterior por 60 s, rotação só pelo BFF e E2E concorrente. |
| Logout concorre com requisição já em voo | média | médio | Reuso posterior negado; documentar que requisição iniciada antes do commit pode terminar. |
| Escrita de atividade sobrecarrega pool único | média | alto | Touch coalescido em 5 min, índice por digest e transações curtas. |
| Rate limit causa DoS em rede compartilhada | média | médio | Buckets independentes, 30/origem, janela temporária, métricas e nenhuma punição permanente. |
| Conta muda de estado após login | média | crítico | Reconsulta de estado/capacidade em toda resolução; sessão não guarda permissões. |
| Cache revela `/inicio` após logout | baixa | crítico | RSC server guard, `private/no-store`, navegação replace e testes back/forward. |
| Flag/UI publicada antes do backend | média | alto | Duas flags server-only, sequência de rollout e smoke antes de habilitar. |
| Estados ampliados afetam lógica de cadastro | baixa | alto | Métodos existentes continuam aceitando apenas estados explícitos; regressão de cadastro e constraint de upgrade. |
| Copy/visual sugerem função inexistente | média | médio | “Em breve” não interativo, surface brief, revisão Impeccable e E2E de texto/semântica. |
| Limpeza oportunista deixa dados operacionais expirados | média | médio | Sem token em claro/metadados de aparelho; limpeza limitada em autenticações e tarefa futura de retenção/job se métricas exigirem. |

### Rollout

1. Aceitar ADR-033 a ADR-037 e mudar este plano para `ready`.
2. Aplicar `0006` em staging com backend antigo; validar upgrade, índices e ausência de lock prolongado.
3. Configurar `AUTH_SESSION_SECRET` e política por cofre/ambiente; confirmar correspondência do `BFF_INTERNAL_TOKEN` e origem Vercel.
4. Publicar backend `0.11.0` com `AUTH_HTTP_ENABLED=false`; validar health, DI, OpenAPI não público e migrations.
5. Publicar frontend `0.12.0` com `AUTH_UI_ENABLED=false`; validar builds e handlers sem exposição.
6. Rodar contrato, integração, E2E full-stack e auditoria de cookies/logs/cache em staging.
7. Habilitar backend, depois UI para canário interno; observar sucesso/rejeição/limite/latência sem PII.
8. Liberar gradualmente e manter caminho de cadastro anterior funcional durante observação.

### Rollback

- Desligar primeiro `AUTH_UI_ENABLED`, depois `AUTH_HTTP_ENABLED`; manter cadastro e continuação independentes.
- Expirar o cookie nos Route Handlers ainda publicados. O backend desligado não aceita bearer remanescente.
- Se houver suspeita de comprometimento, revogar todas as linhas de `authenticated_session` antes de qualquer reativação e rotacionar `AUTH_SESSION_SECRET` conforme runbook.
- Não remover `0006`, estreitar `account_status_check` ou apagar tabelas em produção. Corrigir por migration forward.
- O frontend anterior pode ser reimplantado porque ignora as tabelas aditivas; sessões antigas não voltam a ser aceitas sem a flag/backend.

## 9. Perguntas em Aberto (bloqueantes)

Nenhuma. As três decisões de produto originalmente pendentes e a política de abuso foram confirmadas em 2026-09-29. ADR-033 a ADR-037 foram aceitas em 2026-09-29, com dois refinamentos: ADR-035 não conta logins bem-sucedidos e ADR-036 separa `401` (sem sessão utilizável) de `403` (capacidade negada em conta `active`).

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices`, `nestjs-expert`, `nestjs-hexagonal-architecture`, `nextjs-architecture` e `impeccable` foram aplicadas conforme o escopo.
- [x] Testes, migration e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.
- [x] ADR-033 a ADR-037 foram aceitos e o plano foi promovido de `draft` para `ready`.

## 11. Notas de implementação (2026-09-29)

Ajustes mecânicos em relação ao §3/§4, sem nova decisão arquitetural:

- **Leitura da conta:** em vez de mover `account`, `account_contact` e `account_credential` para infraestrutura compartilhada, `identity-access` declara uma projeção somente leitura (`infrastructure/persistence/account-projection.ts`) fora do glob do drizzle-kit. O dono físico continua sendo `registration`, e nenhum contexto importa a infraestrutura do outro (ADR-033 permite as duas formas). A fórmula do índice cego foi para `back/src/shared/infrastructure/security/contact-blind-index.ts`.
- **Portas:** `AuthenticatedSessionRepositoryPort` expõe `insertWithinLimit`, `findByDigestForUpdate`, `save`, `delete`, `deleteByDigest` e `pruneExpired`; a rotação atômica acontece em `ResolveAuthenticatedSession` sob `FOR UPDATE` (só o digest atual rotaciona). `AuthenticationAttemptRepositoryPort` separa `reserve` e `release`. `LoginSubjectPort` concentra os HMACs do e-mail. Clock e gerador de ids são portas próprias do contexto.
- **Guard compartilhado:** `bffInternalGuardFor(flag)` em `back/src/shared/presentation/http/bff-internal.guard.ts`; `registration` mantém `BffInternalGuard` e `identity-access` usa `AuthBffGuard`.
- **`AUTH_SESSION_SECRET`:** obrigatório com `AUTH_HTTP_ENABLED=true` e sempre em produção, para não quebrar ambientes que ainda não ligaram a autenticação. Mínimos de produção em `AUTH_PRODUCTION_MINIMUMS`.
- **BFF:** a manutenção `GET /api/auth/session` exige `Sec-Fetch-Site` ausente ou `same-origin`, porque pode rotacionar o cookie; o logout funciona mesmo com `AUTH_UI_ENABLED=false`, para limpar cookies no rollback.
- **Rotação na UI:** `SessionKeeper` chama a manutenção no foco, na visibilidade e no retorno do bfcache; RSC valida sem rotacionar.
- **E2E:** helpers tipados ficam em `front/tests/e2e/support/auth.ts`; o spec `entrar.e2e.ts` não usa sintaxe TypeScript, porque o carregador do Playwright sob Bun não a compila em specs (a mesma restrição documentada em `cancelamento.e2e.ts`). O runner do backend encurta a janela de login (8 s), a renovação (3 s) e a graça (2 s) só no E2E; o runner do frontend eleva o limite por origem, já que `EDGE_PROVIDER=fixture` dá a mesma origem a todos os navegadores.
