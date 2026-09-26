# Task: Implementar a fundação PostgreSQL do fluxo de cadastro

- **Slug:** persistencia-postgresql-cadastro
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-25
- **Status:** ready
- **Versão-alvo:** 0.8.0
- **Tipo:** feature
- **Impacto público:** none (sem endpoint/OpenAPI; schema PostgreSQL aditivo e novas variáveis de ambiente obrigatórias)

## 1. Contexto e Motivação

A Task 04 de `specs/tasks.txt` pede a persistência PostgreSQL do bounded context de cadastro com Drizzle, migrations revisáveis e adapters hexagonais, sem endpoints, UI ou provedores reais. Rastreabilidade:

- DER v1.3: RF001–RF007, RN001–RN016, RN147–RN149, §3.10, RNF002–RNF004.
- `docs/02-regras-de-negocio.md` §2 (Cadastro, verificação e retomada) e §10.
- `docs/03-modelos-de-dominio.md` §2.1 (Registration, ContactVerification, OtpChallenge), §4.
- ADR-002 (contextos), ADR-004 (Zod), ADR-007 (Drizzle/pool/migrations), ADR-008 a ADR-012 (fluxo, OTP, canais, progresso local, aceites).
- `specs/sdd-006-modelagem-conceitual-cadastro/tasks.md` (especificação conceitual).

Estado atual do código: `back/src/shared/infrastructure/persistence/schema.ts` vazio; `drizzle.config.ts` aponta para ele; `DrizzleDatabase` é `NodePgDatabase<Record<string, never>>`; `UnitOfWorkPort` expõe `TransactionContext` opaco; `back/drizzle/` só contém `meta/`; não há `CHANGELOG.md`; manifests em `0.6.0`.

Versão: a SDD-006 permanece `0.7.0` e esta task publica `0.8.0` nos manifests da raiz e de `back/`; `CHANGELOG.md` é criado na raiz com as entradas `0.7.0` e `0.8.0`.

## 2. Escopo

Inclui:

- [ ] Schemas Drizzle por módulo e migration `0000` revisada + migration custom de seed dos 20 interesses do DER §3.10 (ADR-013).
- [ ] Tabelas: `contact_verification`, `verification_rate_window`, `registration`, `account`, `account_contact`, `account_credential`, `terms_document`, `terms_acceptance`, `profile`, `profile_usage_intent`, `account_interest`, `interest`.
- [ ] Domínio `registration`: entidades `ContactVerification`, `Registration`, `Account`; value objects `ContactIdentifier`, `ContactChannel`, `Password`, `BirthDate`, `DisplayName`, `Region`, `UsageIntent`, `RegistrationStatus`, `VerificationPolicy` (parâmetros da ADR-009); erros tipados.
- [ ] Portas outbound e adapters Drizzle, mapeadores, `ContactProtectorPort`, `VerificationSecretPort`, `PasswordHasherPort`, `CommonPasswordCheckerPort`, `ClockPort`, `IdGeneratorPort`, `VerificationDeliveryPort` (apenas porta + double de teste).
- [ ] Casos de uso internos (sem controller): `RequestContactVerification`, `ResendContactVerification`, `VerifyContact`, `StartRegistration` (senha), `SaveRequiredData` (cria `Account` incompleta + `Profile`), `CompleteRegistration` (nascimento, aceites, ≥3 interesses → `active`), `ExpireStaleRegistrations`. Os casos de uso de pedido de desafio/reenvio contam a tentativa em unidade de trabalho própria, antes da unidade de negócio (ADR-015).
- [ ] Módulos NestJS `registration`, `profiles`, `catalog` com tokens e DI, sem controllers.
- [ ] Limpeza oportunista de janelas de limite com mais de 2 h do mesmo sujeito, no próprio comando de contagem (ADR-015); sem job.
- [ ] `resolveExecutor` (ADR-016); `DrizzleDatabase` permanece sem tipo de schema; remover o `schema.ts` compartilhado vazio e apontar `drizzle.config.ts` ao glob dos módulos (ADR-013); regra de lint restringindo import de schema entre módulos à pasta `schema/`.
- [ ] Novas variáveis Zod: `CONTACT_HASH_KEY`, `CONTACT_ENCRYPTION_KEY`, `VERIFICATION_SECRET_KEY` (ADR-014); `.env.example`, README e testes.
- [ ] Testes unitários, integração PostgreSQL isolada e `db:check`.
- [ ] Docs: `docs/03-*` (schema físico), `docs/02-*` (regras novas: normalização, senha), `docs/01-*` (módulos, ADRs 013–017), `docs/04-*` (porta de entrega sem provedor), `back/README.md` (migration, rollout, rollback), `CHANGELOG.md` criado, bump de versão.

Exclui:

- Controllers, DTOs, OpenAPI, Route Handlers, páginas, componentes.
- SDKs/credenciais/chamadas Resend ou WhatsApp.
- Login, sessão, recuperação completa (apenas a intenção neutra de recuperação é registrada pela porta de entrega), alteração de contato, perfil público, eventos, outros catálogos.
- Conteúdo jurídico real e seed de `terms_document`.
- Job agendado ou exclusão física de dados de cadastro/conta (ADR-017), inclusive purga de contadores de limite órfãos (ADR-015).
- Limite por origem/IP (ADR-009): escopo `origin` previsto na tabela e na porta, mas não incrementado até haver ADR de origem confiável (ADR-015).
- Alteração do limite de pool.

## 3. Impacto Arquitetural e ADRs

```text
(futuro controller) ──> application/use-cases (registration)
                           │  UnitOfWorkPort.execute(ctx => …)
                           ├─> domain/ports/outbound
                           │     VerificationRepository, RegistrationRepository,
                           │     AccountRepository, RateLimitRepository,
                           │     TermsRepository, ContactProtector, VerificationSecret,
                           │     PasswordHasher, Clock, IdGenerator, VerificationDelivery
                           ├─> profiles port  ProfileWriter (ctx)
                           └─> catalog port   InterestCatalogReader (ctx)
                                   ▲
infrastructure/persistence (Drizzle, resolveExecutor(ctx)) ──> PostgreSQL
infrastructure/security    (node:crypto, Bun.password)
VerificationDelivery: somente porta + fake em teste; envio após commit
```

Estrutura prevista (`back/src/modules/`):

```text
registration/
  domain/{entities,value-objects,services,ports/outbound,errors}
  application/{use-cases,contracts}
  infrastructure/{persistence/{schema,repositories,mappers},security}
  registration.module.ts
profiles/  (schema profile/profile_usage_intent/account_interest, ProfileWriter adapter)
catalog/   (schema interest, InterestCatalogReader adapter, seed SQL)
shared/infrastructure/persistence/{resolve-executor.ts}  (sem schema agregado; drizzle.config.ts usa glob dos schemas dos módulos)
back/drizzle/0000_*.sql, 0001_seed_interests.sql, meta/
```

Regras `nestjs-expert`: `@Injectable()` + constructor injection; tokens `UPPER_SNAKE_CASE` via `Symbol`; sem `forwardRef`; erros de domínio independentes de HTTP; `Test.createTestingModule` para providers. Sem controllers, portanto sem `ValidationPipe`/Swagger novos. Frontend não é alterado; regras Vercel não se aplicam.

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Schema físico, ownership por módulo e seed de interesses | `docs/adrs/ADR-013-schema-fisico-e-ownership-do-cadastro.md` | accepted | Primeiro schema físico; tabelas de 3 contextos da ADR-002. |
| Proteção de contato, OTP/link e senha | `docs/adrs/ADR-014-protecao-de-contatos-segredos-e-senhas.md` | accepted | Criptografia, segredos novos, algoritmo de senha e lista versionada de senhas comuns. |
| Limites de abuso em PostgreSQL | `docs/adrs/ADR-015-limites-de-abuso-persistidos-em-postgresql.md` | accepted | Alternativa a cache; consistência entre réplicas. |
| Repositórios transacionais e concorrência | `docs/adrs/ADR-016-repositorios-transacionais-e-concorrencia.md` | accepted | Contexto transacional explícito, `READ COMMITTED`, locks direcionados e timeout de 2 segundos. |
| Expiração e liberação de contato sem job | `docs/adrs/ADR-017-expiracao-e-liberacao-de-contato-sem-job-destrutivo.md` | accepted | Expiração lazy, minimização imediata e tombstones até uma futura purga física. |

Todos devem estar `accepted` antes da implementação; ao aceitá-los, o status deste plano passa a `ready`.

## 4. Contratos e Interfaces

Sem rotas NestJS/BFF, OpenAPI ou DTOs. Contratos internos (pseudocódigo):

```text
UnitOfWorkPort.execute<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T>   // existente

VerificationRepositoryPort
  findOpenForUpdate(ctx, contactHash, purpose): ContactVerification | null
  insert(ctx, verification); save(ctx, verification)
  expireOpen(ctx, contactHash, purpose, now)
RateLimitRepositoryPort
  tryConsume(ctx, scope, subjectHash, windowStart, kind: 'challenge'|'resend', limit): boolean
RegistrationRepositoryPort
  findInProgressForUpdate(ctx, registrationId); insert; save; expireStale(ctx, now, batch)
AccountRepositoryPort
  existsHoldingContact(ctx, contactHash): boolean
  insertIncomplete(ctx, account, contact, credential); findForUpdate(ctx, accountId)
  activate(ctx, accountId, expectedStatus='account_incomplete'); expireStale(ctx, now, batch)
TermsRepositoryPort
  findApproved(ctx, documentIds); recordAcceptances(ctx, accountId, acceptances)
ProfileWriterPort (profiles)      upsertRequired(ctx, accountId, data); replaceUsageIntents(ctx, accountId, intents); replaceInterests(ctx, accountId, ids)
InterestCatalogReaderPort (catalog)  findActiveByIds(ctx, ids): InterestRef[]
ContactProtectorPort  blindIndex(c): Bytes; seal(c): Sealed; open(s): ContactIdentifier
VerificationSecretPort generateOtp(): {plain, digest}; generateLinkToken(); matches(plain, digest): boolean
PasswordHasherPort    hash(Password): PasswordHash; verify(...)
VerificationDeliveryPort send({verificationId, channel, sealedContact, kind: 'verify'|'recovery_notice', idempotencyKey}): DeliveryResult
```

Resultados dos casos de uso retornam somente ids opacos, estado e instantes (`nextResendAt`, `expiresAt`); nunca contato, OTP, motivo de bloqueio ou existência de conta. Para contato que já pertence a conta `active`/`account_incomplete`, `RequestContactVerification` responde exatamente como no caminho normal e agenda `kind: 'recovery_notice'` pelo mesmo canal.

Schema físico (detalhe final em `docs/03-*` após aceite):

| Tabela | Colunas-chave | Constraints/índices |
|---|---|---|
| `contact_verification` | `id uuid PK`, `purpose` (`registration`), `channel` (`email`/`whatsapp`), `contact_hash bytea`, `contact_ciphertext bytea`, `key_version`, `otp_digest bytea`, `link_token_digest bytea null`, `expires_at`, `failed_attempts smallint`, `locked_until null`, `resend_count smallint`, `last_sent_at`, `delivery_idempotency_key uuid`, `whatsapp_consent_at null`, `consumed_at null`, `status` (`open`/`verified`/`consumed`/`expired`), `created_at`, `updated_at` | `CHECK failed_attempts BETWEEN 0 AND 5`; `CHECK resend_count BETWEEN 0 AND 3`; `CHECK (channel <> 'whatsapp' OR whatsapp_consent_at IS NOT NULL)`; `UNIQUE (contact_hash, purpose) WHERE status IN ('open','verified')`; `UNIQUE (delivery_idempotency_key)`; índice `(expires_at)` |
| `verification_rate_window` | `scope` (`contact`/`origin`), `subject_hash bytea`, `window_start timestamptz`, `request_count int`, `resend_count int` | PK `(scope, subject_hash, window_start)`; `CHECK (scope IN ('contact','origin'))`; `CHECK (request_count >= 0 AND resend_count >= 0)` |
| `registration` | `id`, `verification_id FK`, `channel`, `contact_hash null`, `contact_ciphertext null`, `password_hash text null`, `status`, `last_updated_at`, `expires_at`, `expired_at null` | `UNIQUE (contact_hash) WHERE status = 'registration_in_progress'`; `UNIQUE (verification_id)`; `CHECK (status <> 'expired' OR contact_hash IS NULL)`; índice `(status, expires_at)` |
| `account` | `id`, `registration_id FK unique`, `status` (`account_incomplete`/`active`/`expired`), `birth_date date null`, `last_updated_at`, `activated_at null`, `expired_at null` | `CHECK (status <> 'active' OR (birth_date IS NOT NULL AND activated_at IS NOT NULL))`; índice `(status, last_updated_at)` |
| `account_contact` | `account_id FK`, `channel`, `contact_hash null`, `contact_ciphertext null`, `key_version`, `confirmed_at`, `holds_contact boolean` | PK `(account_id, channel)`; `UNIQUE (channel, contact_hash) WHERE holds_contact` |
| `account_credential` | `account_id PK/FK`, `password_hash`, `algorithm`, `updated_at` | — |
| `terms_document` | `id`, `kind` (`terms`/`privacy`/`community_rules`), `version`, `locale`, `effective_at`, `content_digest`, `status` (`placeholder`/`approved`/`retired`) | `UNIQUE (kind, version, locale)` |
| `terms_acceptance` | `id`, `account_id FK RESTRICT`, `document_id FK`, `accepted_at`, `context jsonb` mínimo | `UNIQUE (account_id, document_id)` |
| `profile` | `account_id PK/FK`, `display_name`, `region`, timestamps | `CHECK char_length(display_name) BETWEEN 1 AND 60`; `CHECK char_length(region) BETWEEN 2 AND 80` |
| `profile_usage_intent` | `account_id FK`, `usage_intent text`, `selected_at` | PK `(account_id, usage_intent)`; `CHECK usage_intent IN ('friendship','activity_company','explore_city','networking')` |
| `account_interest` | `account_id FK`, `interest_id FK`, `selected_at` | PK `(account_id, interest_id)` |
| `interest` | `id`, `slug unique`, `label`, `position`, `active`, `created_at`, `deactivated_at null` | `UNIQUE (slug)` |

`holds_contact` é mantido pela aplicação (`true` em `account_incomplete`/`active`), pois o predicado do índice parcial não pode referenciar outra tabela. Mínimo de três interesses é invariante do caso de uso sob lock (não expressável como constraint simples).

Compatibilidade: somente aditiva; nenhuma tabela existente é alterada. Novas variáveis de ambiente obrigatórias são mudança operacional: o deploy falha cedo sem elas (ADR-004).

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | OTP 15 min; 5 falhas; bloqueio 20 min. | Persistido com digest, `failed_attempts`, `locked_until`; 6ª tentativa em bloqueio não incrementa nem revela estado. | ADR-009, RNF003 |
| 2 | Reenvio após 60 s, até 3/contato/h; 5 desafios/contato/h; 10/origem/h. | Janelas horárias UTC persistidas e consumidas atomicamente, contando pedidos em transação própria; limite por origem adiado (ADR-015). | ADR-009, ADR-015 |
| 3 | Contato ativo não é revelado. | Mesmo resultado externo; porta de entrega recebe `recovery_notice`. | RNF004, ADR-010 |
| 4 | `Registration` nasce após contato verificado e senha. | Só criado a partir de verificação `verified`, consumindo-a na mesma transação; senha validada por RN006/RN007. | ADR-008, RN006–RN007 |
| 5 | `Account` após dados obrigatórios. | `SaveRequiredData` cria `account_incomplete`, `account_contact`, `account_credential`, `profile`; `Registration` encerra. | RF004, ADR-008 |
| 6 | Ativação exige 18+, aceites e 3 interesses. | `CompleteRegistration` revalida sob lock; exige três documentos `approved` e ≥3 interesses ativos. Sem documento aprovado, ativação falha com erro tipado. | RF001, RF005–RF006, RN001, RN008, ADR-012 |
| 7 | Expiração 24 h / 15 dias. | Expiração lazy por contato + caso de uso em lote não agendado; anulação de dados sensíveis; sem exclusão física. | ADR-008, ADR-017 |
| 8 | Contato único entre contas ativas. | Único entre contas `account_incomplete` e `active` e registros em progresso até expirarem. | RN002–RN003 |
| 9a | Intenção de uso obrigatória, sem valores definidos. | Múltipla escolha, mínimo 1, entre quatro valores fixos; validada no value object `UsageIntent` e por `CHECK`. | RF004, RF022 |
| 9 | Catálogo de interesses do DER. | 20 interesses com `slug` estável, ordem do DER, seed idempotente. | RN147–RN149, §3.10 |

## 6. Critérios de Aceitação

- Migration gerada por `bun run --cwd back db:generate`, SQL revisado, sem `drizzle-kit push`; cria somente as 12 tabelas, seus índices/constraints e o seed de interesses. `db:check` passa.
- Aplicar a migration duas vezes (ledger) e o seed em base já semeada não duplica interesses.
- Duas transações concorrentes não criam duas contas/registros retendo o mesmo contato; a perdedora recebe erro de domínio neutro.
- Seis tentativas OTP concorrentes contra o mesmo desafio resultam em exatamente cinco falhas contabilizadas e bloqueio; nenhuma verifica com código errado.
- Ativação concorrente dupla ativa uma única vez; ativação com < 3 interesses, sem aceites aprovados ou menor de 18 anos falha sem efeito parcial (rollback verificado).
- Nenhum import de `drizzle-orm`, `pg`, `@nestjs/*` ou `node:crypto` em `domain/` ou `application/` (verificado por teste de arquitetura ou regra ESLint `no-restricted-imports`).
- Nenhum valor de contato, OTP, token, senha ou `DATABASE_URL` em logs, mensagens de erro ou snapshots; fixtures usam domínios reservados (`example.test`) e números fictícios.
- Adapters registrados por tokens explícitos e resolvidos via DI; nenhum `new` de serviço fora de factories de módulo.
- Novas chaves de ambiente validadas por Zod, obrigatórias e sem eco de valor.
- Observabilidade: eventos estruturados com `verificationId`/`registrationId`/`accountId`, `channel` e código de resultado; contadores agregados de bloqueio/limite.
- Nenhum endpoint, UI ou SDK de provedor adicionado.

## 7. Plano de Testes

Unitários (`bun run --cwd back test`):

- Value objects: normalização de e-mail/E.164 `+55`, `Password` (8+, só espaços, lista óbvia), `BirthDate` (18 anos completos com fuso/limite de aniversário), `DisplayName`, `UsageIntent`.
- `ContactVerification`: expiração, falhas, bloqueio 20 min, reenvio 60 s, limite de 3 reenvios, consumo único.
- `Registration`/`Account`: transições válidas/inválidas, expiração 24 h/15 dias, anulação de dados sensíveis.
- Casos de uso com repositórios em memória e `ClockPort` fixo: antienumeração (mesmo resultado externo), idempotência de entrega, rollback em erro, mínimo de 3 interesses, aceites apenas aprovados.
- Mapeadores: ida e volta domínio↔registro sem perda; nenhum tipo Drizzle exportado.
- Adapters de segurança: HMAC determinístico, AES-GCM com nonce único e falha em adulteração, comparação em tempo constante.
- Módulos: `Test.createTestingModule` resolve tokens de `registration`, `profiles`, `catalog`.

Integração (`bun run --cwd back test:integration`, `DATABASE_INTEGRATION_URL` de container descartável):

- Setup cria banco efêmero `eventmatch_it_<random>` via conexão administrativa, aplica migrations com o migrator Drizzle e remove o banco ao final; nunca usa banco compartilhado.
- Migration: tabelas, índices e constraints existentes (`information_schema`/`pg_indexes`); seed com 20 interesses; reaplicação idempotente.
- Constraints: duplicidade de contato, `CHECK`s, FKs, `RESTRICT` em aceites.
- Concorrência com dois pools independentes: OTP, criação de desafio acima do limite, ativação dupla, contato disputado.
- Limite (ADR-015): a tentativa é contada quando a unidade de negócio termina em rollback ou em resposta neutra (contato retido); limpeza oportunista remove só janelas antigas do mesmo sujeito; escopo `origin` não é incrementado com `RequestOrigin = null`.
- Transações: falha no meio de `CompleteRegistration` não deixa perfil/interesses/aceites parciais.

E2E: `test:e2e` existente continua verde (sem novas rotas).

Comandos obrigatórios: `bun run --cwd back lint`, `bun run --cwd back typecheck`, `bun run --cwd back test`, `bun run --cwd back test:e2e`, `bun run --cwd back test:integration`, `bun run --cwd back build`, `bun run --cwd back db:check`; no frontend, executar separadamente `bun run --cwd front lint`, `typecheck`, `test` e `build` apenas para garantir ausência de regressão no workspace.

## 8. Dependências e Riscos

Dependências: nenhuma nova dependência de runtime prevista (sem `@nestjs/schedule`); recursos já disponíveis (`node:crypto`, `Bun.password`, `drizzle-orm`/`drizzle-kit` já fixados). UUIDv7 via `Bun.randomUUIDv7()` no adapter `IdGenerator`.

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Vazamento de tipo Drizzle para aplicação | média | alto | `resolveExecutor` na infraestrutura; regra `no-restricted-imports`. |
| Corrida em OTP/ativação | média | alto | `FOR UPDATE`, updates condicionais, índices parciais, testes com pools separados. |
| Perda de chave de cifra | baixa | alto | Segredos em cofre, `key_version`, runbook no README. |
| Pool de 1 conexão serializa e causa timeout sob lock | média | médio | Transações curtas, `lock_timeout`, sem I/O externo em transação. |
| Tombstones de cadastro acumulam sem purga | alta | baixo | Documentar; job em task futura. |
| Limite por origem/IP não aplicado (adiado) | alta | médio | Limite por contato ativo; ADR futura de origem confiável (ADR-015). |
| Contadores de sujeitos que não voltam acumulam | alta | baixo | Limpeza oportunista por sujeito; purga total na task futura de jobs. |
| Rajada na virada da janela horária | média | baixo | Aceito na ADR-015; revisar com métricas. |
| Mudança do DER no catálogo | baixa | médio | `slug` estável; novas opções por migration forward. |
| Ausência de termos aprovados impede ativação real | certa | médio | Comportamento intencional (ADR-012); testes usam documentos `approved` inseridos apenas no banco efêmero. |

Rollout:

1. Aceitar ADR-013 a ADR-017; configurar os três segredos no ambiente alvo.
2. Gerar e revisar SQL; commitar `drizzle/*.sql` e `meta/`.
3. Validar em PostgreSQL descartável (`test:integration`, `db:check`).
4. Executar `bun run --cwd back db:migrate` como job único antes do deploy da API.
5. Deploy da API (sem rotas novas); monitorar readiness e logs.

Rollback:

- Aplicação: reimplantar versão anterior; tabelas novas não são lidas por ela.
- Banco: forward fix. Se for necessário remover objetos, criar migration explícita `DROP` revisada, somente enquanto não houver dados reais; nunca `down` automático.

## 9. Perguntas em Aberto (bloqueantes)

- Nenhuma.

- [x] **1. Ownership (ADR-013):** módulos próprios — `registration` (cadastro, conta, contatos, credencial, aceites), `profiles` (`profile`, `account_interest`) e `catalog` (`interest`), integrados por portas na mesma unidade de trabalho.
- [x] **2. Proteção de contato (ADR-014):** contato cifrado com AES-256-GCM, índice cego HMAC-SHA-256 para unicidade/busca, OTP/link apenas como HMAC e senha com Argon2id via `Bun.password`; três novos segredos obrigatórios (`CONTACT_HASH_KEY`, `CONTACT_ENCRYPTION_KEY`, `VERIFICATION_SECRET_KEY`).
- [x] **3. Retenção de contato e expiração (ADR-017):** `registration_in_progress` (até 24 h) e `account_incomplete` (até 15 dias) retêm o contato; nova tentativa recebe resposta neutra de recuperação. Vencido o prazo, a próxima tentativa expira o registro na mesma transação, anula dados sensíveis e libera o contato; sem exclusão física.
- [x] **4a. Limites de texto:** `display_name` de 1 a 60 caracteres (trim, não somente espaços); `region` texto livre de 2 a 80 caracteres, exibida de forma aproximada (RN011).
- [x] **4b. Senhas óbvias (RN006):** arquivo `.txt` UTF-8, uma senha por linha, em minúsculas, em `back/src/modules/registration/infrastructure/security/data/common-passwords.txt`; carregado uma vez em `Set` por adapter de `CommonPasswordCheckerPort`; comparação sem distinção de caixa. A fonte é `Passwords/Common-Credentials/10-million-password-list-top-10000.txt` do SecLists release `2026.1` (MIT), copiada e normalizada no repositório com origem, licença e SHA-256 registrados.
- [x] **4c. Intenção de uso (RF004):** escolha múltipla, mínimo 1, entre `friendship` (fazer amizades), `activity_company` (companhia para atividades), `explore_city` (conhecer a cidade) e `networking` (conhecer pessoas da área/profissionais); persistida em `profile_usage_intent`. Não há opção de relacionamento amoroso.
- [x] **5. Versão:** SDD-006 como `0.7.0` e esta task como `0.8.0`; criar `CHANGELOG.md` na raiz com as entradas `0.7.0` (modelagem conceitual do cadastro) e `0.8.0` (persistência PostgreSQL do cadastro).

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos (sem contrato HTTP nesta task).
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices` e `nestjs-expert` foram aplicadas conforme o escopo (apenas backend).
- [x] Testes, migration e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.
