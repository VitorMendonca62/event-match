# Task: Expor a API HTTP e entregar verificações do cadastro

- **Slug:** api-http-entrega-verificacao-cadastro
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-26
- **Status:** blocked
- **Versão-alvo:** 0.9.0
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A TASK 06 de `specs/tasks.txt` pede a primeira fatia HTTP pública do cadastro e os adapters reais de Resend/WhatsApp sobre a fundação implementada pela SDD-007. Hoje os casos de uso existem e estão ligados por DI, porém `RegistrationModule` não possui controllers, a entrega usa `NoopVerificationDeliveryAdapter`, a API só expõe health/readiness e o frontend ainda não possui BFF.

O DER v1.3 exige maioridade, contato confirmado, senha, dados obrigatórios, aceites e três interesses (RF001–RF007, RN001–RN009). A ADR-019, aceita após discussão de produto, determina validar nascimento antes de coletar contato. A implementação continua bloqueada pelas demais decisões propostas desta SDD.

Rastreabilidade: `docs/02-regras-de-negocio.md` §2; `docs/03-modelos-de-dominio.md` §2.1 e §4; `docs/04-integracoes-externas.md` §§1, 4 e 6; ADR-008 a ADR-018; `specs/sdd-007-persistencia-postgresql-cadastro/tasks.md`; código e testes atuais de `back/src/modules/registration/`.

Versão: elevar raiz e backend de `0.8.1` para `0.9.0`, atualizar Swagger e `CHANGELOG.md`. O frontend permanece em sua versão atual nesta task; Route Handlers serão implementados apenas na TASK 07.

## 2. Escopo

Inclui:

- [ ] Etapa de validação de nascimento antes do contato, emitindo credencial de continuação somente para maior de 18 anos e sem persistir a data (ADR-019/ADR-021).
- [ ] Contrato HTTP v1, DTOs, presenters, controller(s), guard de continuação e mapeamento tipado de `RegistrationError` (ADR-020).
- [ ] Credencial opaca de continuação com digest, expiração, rotação, revogação e autorização por etapa; ids internos deixam de ser credenciais públicas (ADR-021).
- [ ] Migration forward `0003` para `registration_flow_session` e `registration_idempotency`, com constraints, índices, rollout e forward fix (ADR-021).
- [ ] Casos de uso/portas necessários para consultar o estado mínimo do fluxo, listar interesses ativos, listar metadados de documentos aprovados, verificar link de e-mail e operar a sessão de continuação.
- [ ] Limite de dez novos desafios por origem/hora usando fingerprint HMAC fornecida apenas por camada confiável, sem persistir IP (ADR-023).
- [ ] Adapter de e-mail com SDK oficial `resend` e adapter WhatsApp Cloud API com `fetch` nativo, composição por canal, configuração Zod, timeout/retry/idempotência e testes contratuais (ADR-010/ADR-024).
- [ ] OTP e link no e-mail; somente OTP no WhatsApp. O link usa token opaco, alta entropia, uso único e expiração igual à do desafio (ADR-024).
- [ ] OpenAPI, `.env.example`, Docker Compose, README, docs arquiteturais/de integração, changelog e versão.
- [ ] Testes unitários, arquitetura, contrato de provedor, integração PostgreSQL, E2E e validações Bun.

Exclui:

- Componentes, páginas e Route Handlers Next.js; pertencem à TASK 07.
- Login/sessão geral da conta, recuperação completa de senha, alteração de contato e campos opcionais posteriores à ativação.
- Conteúdo jurídico definitivo, publicação administrativa de documentos, storage de artefatos jurídicos e ativação real enquanto não existirem os três documentos aprovados.
- Webhooks/recibos assíncronos de entrega, fila/outbox, job agendado, SMS e painel operacional.
- Alteração do pool máximo de uma conexão.

## 3. Impacto Arquitetural e ADRs

```text
Browser (TASK 07)
  -> Next.js Route Handler BFF
       - valida mesma origem/CSRF
       - guarda continuação em cookie HttpOnly
       - envia fingerprint de origem assinada
       -> NestJS /api/v1/registration
            presentation: DTO -> guard -> controller -> presenter/filter
            application: casos de uso + autorização da etapa
            domain: regras/portas sem HTTP, NestJS ou Drizzle
            infrastructure:
              PostgreSQL/Drizzle (flow session + idempotência + cadastro)
              Resend HTTP / WhatsApp Cloud API HTTP
```

Regras `nestjs-expert`/hexagonal: DTOs com `class-validator`; `ValidationPipe` global existente; Swagger em cada operação; adapters `@Injectable()` por tokens; nenhum `new` de serviço; erros de domínio/aplicação sem HTTP; controller sem regra de negócio; `Test.createTestingModule` e Supertest. Não usar `forwardRef()`.

Regras Next/Vercel aplicáveis ao contrato futuro: Route Handlers apenas como BFF; `server-auth-actions`, `server-no-shared-module-state`, `server-serialization`, `async-api-routes`, `async-defer-await` e `async-parallel`. Nenhum código frontend é criado nesta task.

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Validar nascimento antes do contato sem persistir a data | `docs/adrs/ADR-019-validar-maioridade-antes-do-contato.md` | accepted | Altera parcialmente a ordem aceita na ADR-008 e reduz coleta/custo para menores. |
| Contrato HTTP v1 e respostas neutras | `docs/adrs/ADR-020-contrato-http-v1-do-cadastro.md` | accepted | Primeiro contrato público do cadastro. |
| Credencial opaca, rotação e idempotência | `docs/adrs/ADR-021-credencial-de-continuacao-do-cadastro.md` | accepted | IDs não podem autorizar operações; exige schema e segredo novos. |
| Next.js BFF como única entrada do navegador | `docs/adrs/ADR-022-bff-nextjs-para-o-cadastro.md` | accepted | Simplifica cookie HttpOnly, CORS e CSRF sem mover regras ao frontend. |
| Fingerprint de origem confiável | `docs/adrs/ADR-023-origem-confiavel-para-limites-do-cadastro.md` | accepted | Vercel direta fornece a origem inicial; BFF transforma em fingerprint e autentica o encaminhamento. |
| Entrega por provedor e link de e-mail | `docs/adrs/ADR-024-entrega-de-verificacao-e-link-de-email.md` | accepted | SDK oficial do Resend, `fetch` nativo para WhatsApp e semântica explícita de retry/idempotência. |

Todos devem estar `accepted` antes da implementação. A ADR-019 substitui parcialmente a ordem da ADR-008; os links bidirecionais e os documentos canônicos foram atualizados no aceite.

## 4. Contratos e Interfaces

Prefixo proposto: `/api/v1`. Toda resposta com corpo mantém `{ data, message, statusCode }`. Datas são UTC ISO-8601. A credencial entra como `Authorization: Bearer <opaque>` entre BFF e NestJS; tokens rotacionados saem apenas no header sensível `X-Registration-Continuation`, que o BFF converte em cookie e remove da resposta ao browser. Todas as respostas do fluxo usam `Cache-Control: no-store`.

Todas as rotas de cadastro exigem ainda `X-EventMatch-BFF-Token`, comparado em tempo constante na apresentação antes de qualquer caso de uso. As operações que criam um desafio recebem também `X-EventMatch-Origin-Fingerprint`, produzido pelo BFF da Vercel; o NestJS valida apenas forma/tamanho e nunca tenta reconstruí-lo a partir de headers públicos. Esses headers são internos, redigidos de logs e documentados no OpenAPI como requisitos da integração BFF → backend, sempre com exemplos fictícios.

| Método e rota | Entrada principal | Sucesso proposto | Autorização/observação |
|---|---|---|---|
| `POST /api/v1/registration/eligibility` | `{ birthDate: YYYY-MM-DD }` | `200 { eligible }`; emite continuação apenas se elegível | Sem persistir nascimento; `Idempotency-Key` opcional. |
| `POST /api/v1/registration/contact-verification` | `{ channel, contact, whatsappConsent }` | `202 { expiresAt, nextResendAt }` | Estágio `age_eligible`; sempre resposta neutra. |
| `POST /api/v1/registration/contact-verification/resend` | `{}` | `202 { expiresAt, nextResendAt }` | Continuação; `Idempotency-Key` obrigatório. |
| `POST /api/v1/registration/contact-verification/confirm` | `{ otp }` | `200 { verified }` | Continuação; falso cobre inválido, expirado, bloqueado ou indisponível. |
| `POST /api/v1/registration/contact-verification/confirm-link` | `{ token }` | `200 { verified }` | Token do link basta; em sucesso emite/rotaciona continuação. |
| `PUT /api/v1/registration/password` | `{ password, passwordConfirmation }` | `200 { stage, expiresAt }` | Estágio `contact_verified`; confirmação não chega ao domínio. |
| `PUT /api/v1/registration/required-data` | `{ displayName, region, usageIntents[] }` | `200 { stage, expiresAt }` | Cria `account_incomplete`; sem ids internos. |
| `GET /api/v1/registration` | — | `200 { stage, expiresAt, nextResendAt? }` | Snapshot mínimo; nunca retorna contato ou nascimento. |
| `GET /api/v1/catalog/interests` | `locale=pt-BR` | `200 { interests[] }` | Público, somente ativos, ordem estável. |
| `GET /api/v1/registration/legal-documents` | `locale=pt-BR` | `200 { documents[] }` | Somente metadados `approved`; vazio enquanto não houver conteúdo jurídico. |
| `POST /api/v1/registration/complete` | `{ birthDate, documentIds[], interestIds[] }` | `200 { status: active }` | Estágio `account_incomplete`; revalida maioridade e tudo em transação. |

Contratos propostos adicionais:

```text
RegistrationFlowSessionPort
  issueEligible(ctx, expiresAt): { session, plainToken }
  authorizeForUpdate(ctx, tokenDigest, allowedStages, now): FlowSession | null
  bindVerification(ctx, session, verificationId, expiresAt)
  bindRegistration(ctx, session, registrationId, expiresAt)
  bindAccount(ctx, session, accountId, expiresAt)
  rotate(ctx, session, newDigest, graceUntil): plainToken
  complete/revoke/expire(ctx, session, now)

RegistrationIdempotencyPort
  find(ctx, sessionId, operation, keyHash): StoredHttpOutcome | null
  reserve(ctx, sessionId, operation, keyHash, requestHash, expiresAt)
  complete(ctx, reservation, safeOutcome)

TrustedOriginFingerprintPort
  parseTrustedFingerprint(internalHeader): Buffer | null

RegistrationFlowTokenPort
  generate(): { plain, digest }
  digest(plain): Buffer
```

Schema proposto da migration `0003`:

| Tabela | Colunas-chave | Constraints/índices |
|---|---|---|
| `registration_flow_session` | `id`, `token_digest`, `previous_token_digest`, `previous_valid_until`, `stage`, `verification_id`, `registration_id`, `account_id`, `expires_at`, `revoked_at`, timestamps | digest atual único; FKs; `CHECK` de estágio/vínculo; índice `(stage, expires_at)`; tokens anulados em conclusão/expiração. |
| `registration_idempotency` | `id`, `flow_session_id`, `operation`, `key_hash`, `request_hash`, `http_status`, `response_body jsonb`, `expires_at`, timestamps | único `(flow_session_id, operation, key_hash)`; resposta nunca contém token/PII; índice `expires_at`. |

O token terá 32 bytes aleatórios em base64url; somente HMAC/digest será persistido com `REGISTRATION_FLOW_SECRET` próprio. TTL: elegibilidade 30 min; verificação acompanha os 15 min do desafio; `registration_in_progress` acompanha 24 h; `account_incomplete` acompanha 15 dias. Rotação ocorre nas mudanças de privilégio. Por no máximo 60 s, o token anterior permite somente repetir a requisição idempotente que causou a rotação, com a mesma chave e o mesmo payload; ele nunca autoriza uma nova operação. A recuperação não repete o efeito de negócio e emite atomicamente uma nova continuação. Conclusão/expiração revoga e anula digests.

Erros propostos:

- `400`: forma/DTO inválido, sem ecoar valor.
- `401`: continuação ausente/inválida/expirada, mensagem única.
- `409`: estágio incompatível ou mesma idempotency key com payload diferente.
- `422`: senha fraca ou campos semanticamente inválidos; menoridade usa `200 { eligible: false }` antes do fluxo.
- `429`: somente quando não criar diferença observável por contato; pedidos de contato/recuperação continuam `202` neutros mesmo quando limitados.
- `503`: dependência interna/provedor indisponível apenas onde não violar neutralidade; solicitação de contato continua neutra e falha de entrega vira telemetria segura.

Configuração de deploy: o BFF recebe `EDGE_PROVIDER=vercel`, `ORIGIN_FINGERPRINT_KEY`, `BFF_INTERNAL_TOKEN` e `BACKEND_INTERNAL_URL`; o backend recebe o mesmo `BFF_INTERNAL_TOKEN`. Todos são validados no startup e ficam somente em variáveis protegidas da plataforma. O adapter futuro `cloudflare` usará `CF-Connecting-IP` sem alterar os dois headers internos nem as portas de aplicação.

Compatibilidade: contrato novo e aditivo. OpenAPI recebe DTOs concretos, headers e exemplos fictícios; nenhum token/PII real. `ExpireStaleRegistrations` passa também a expirar sessões/idempotência associadas sem exclusão física destrutiva nesta task.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Nascimento é validado na ativação. | Primeira informação após a apresentação; menor não recebe credencial nem avança. Data não é persistida e é revalidada na conclusão. | RF001, RN001, ADR-019 aceita. |
| 2 | Casos de uso recebem ids internos. | HTTP resolve ids exclusivamente a partir da continuação autorizada para a etapa. | RNF003–RNF004, ADR-021 aceita. |
| 3 | Limite por origem está adiado no código atual. | BFF na Vercel produz fingerprint autenticada; backend consome até 10 desafios/origem/hora antes da UoW de negócio. | ADR-009, ADR-015, ADR-023 aceita. |
| 4 | E-mail/WhatsApp usam adapter noop. | SDK oficial do Resend envia OTP+link; adapter HTTP da Meta envia OTP; recuperação permanece no mesmo canal e resposta é neutra. | ADR-010, ADR-024 aceita. |
| 5 | Link digest existe, mas não é usado. | Token de 32 bytes, digest persistido, expiração junto ao desafio e consumo único sob lock. | ADR-014, ADR-024 aceita. |
| 6 | Interesses só são buscados por ids. | Catálogo expõe somente interesses ativos em ordem estável. | RF006, RN147–RN149. |
| 7 | Termos não têm conteúdo aprovado. | Endpoint retorna somente metadados aprovados e, hoje, lista vazia; nenhuma conta real ativa com placeholder. | RF005, ADR-012. |
| 8 | Entrega falha sem alterar resposta. | Mantém neutralidade; retries seguem classificação por provedor e nunca mantêm transação aberta. | ADR-010, ADR-016. |

## 6. Critérios de Aceitação

- OpenAPI descreve todas as rotas, headers, DTOs, envelopes, status e erros sem expor segredos; snapshot de contrato versionado.
- `ValidationPipe` mantém `whitelist`, `forbidNonWhitelisted` e `transform`; DTOs têm limites de tamanho, enums, UUIDs/datas e arrays deduplicados/limitados.
- Guard/presentation resolvem a continuação antes de invocar casos de uso; nenhuma rota de mutação aceita `verificationId`, `registrationId` ou `accountId` fornecido pelo browser.
- Nascimento de menor retorna inelegível sem escrita de contato, desafio, registro ou conta; nascimento nunca entra em log, token, idempotência ou snapshot de retomada.
- Tokens têm entropia, digest, TTL, rotação, janela anterior, revogação e comparação segura; nunca são registrados ou guardados em texto no banco.
- Idempotency key repetida com mesmo payload retorna o resultado seguro anterior; payload diferente retorna conflito; duplicidade não envia nova mensagem.
- Origem é limitada sem armazenar IP; o BFF aceita somente `x-vercel-forwarded-for` na Vercel direta, autentica o encaminhamento com `BFF_INTERNAL_TOKEN` e o ambiente publicado falha cedo se cadeia/configuração estiver ausente.
- Resend usa idempotency key nativa; WhatsApp documenta a limitação de idempotência do provedor e não repete timeout ambíguo. Timeout por tentativa é 5 s; no máximo duas novas tentativas somente quando classificadas como seguras/transitórias.
- Nenhum I/O externo ocorre dentro de transação PostgreSQL; pool continua em uma conexão.
- Logs/métricas usam ids opacos, operação, canal, outcome, latência e provedor; não incluem contato, nascimento, OTP, link, cookie, bearer, corpo do provedor ou credencial.
- `NoopVerificationDeliveryAdapter` fica restrito a teste/desenvolvimento explicitamente configurado; produção exige adapter/segredos reais e falha cedo sem eles.
- Nenhuma conta ativa sem três documentos `approved`, maioridade e ao menos três interesses; endpoint jurídico vazio mantém conclusão indisponível com erro seguro.

## 7. Plano de Testes

Unitários (`bun run --cwd back test`):

- DTOs/controller/presenter/filter: validação, envelopes, datas, limites, headers e mapeamento neutro de cada `RegistrationError`.
- Elegibilidade: aniversário-limite, menoridade, data inválida e ausência de persistência/telemetria sensível.
- Guard/sessão: token atual/anterior, rotação, expiração, revogação, etapa errada e resposta perdida; token anterior só recupera a mesma requisição idempotente e não executa novo efeito.
- Idempotência: replay igual, conflito de payload, concorrência e resposta armazenada sem segredo.
- Link: geração, digest, confirmação única, expirado, inválido e concorrente.
- Adapters: composição por canal, redaction, timeout, `Retry-After`, 4xx definitivo, 429/5xx transitório e timeout ambíguo; `Test.createTestingModule` valida bindings.
- Arquitetura: domínio/aplicação sem imports NestJS/HTTP/Drizzle; apresentação sem SQL/regra de negócio.

Integração (`bun run --cwd back test:integration` pelo runner descartável):

- Migration `0003`, constraints/FKs/índices, aplicação em cadeia limpa e upgrade de `0000`–`0002` para `0003`.
- Sessão/idempotência sob concorrência com pools separados; rollback sem efeito parcial.
- Rate limit de contato + origem persistido; IP nunca aparece no NestJS, banco, logs ou telemetria; header genérico forjado e chamada direta sem credencial BFF são rejeitados.
- Consulta de interesses e termos aprovados; placeholders/retirados nunca saem no endpoint.

Contrato de provedores:

- Servidor HTTP fake valida URL, método, headers, template/payload, timeout, retry e idempotency key sem chamar internet real.
- Resend: `POST /emails` e `Idempotency-Key` estável por entrega.
- Meta: `POST /{phone-number-id}/messages`, template configurado e versão Graph fixada/configurável; testes não dependem da versão remota.

E2E/Supertest (`bun run --cwd back test:e2e`):

- nascimento elegível → contato → OTP/link → senha → dados obrigatórios → interesses/termos fixture → ativação;
- menoridade, WhatsApp sem consentimento, OTP inválido/expirado/bloqueado, cooldown/reenvio, contato retido, idempotência, token roubado/inválido e etapa fora de ordem;
- antienumeração compara status, shape, mensagem e timing com tolerância definida;
- ausência de termos aprovados bloqueia ativação.

Validação final: `bun run --cwd back lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `build`, `db:check`; `bun run --cwd front lint`, `typecheck`, `test`, `build` para garantir que documentação/configuração compartilhada não quebrou o workspace.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---:|---:|---|
| Mudança de ordem divergir da ADR-008/código | alta | alto | ADR-019 aceita, links bidirecionais e documentos canônicos atualizados; cobrir a alteração nos casos de uso e testes. |
| Roubo/replay da continuação | média | alto | Token opaco, HttpOnly no BFF, digest, TTL, rotação, revogação e no-store. |
| Rotação perder resposta e bloquear usuário | média | médio | Token anterior por 60 s somente para recuperar a mesma requisição idempotente, sem repetir o efeito de negócio. |
| Origem forjada via header | baixa com controles | alto | Vercel direta, header específico, resolvedor fail-closed e credencial BFF separada; backend ignora headers públicos. |
| Enumeração por status/tempo | média | alto | Shape/mensagem neutros, trabalho equivalente e testes de timing. |
| Timeout Meta gerar mensagem duplicada | média | médio | Não repetir resultado ambíguo; novo envio apenas por reenvio explícito. |
| Falha após commit impedir entrega | média | médio | Evento seguro + reenvio; outbox/webhook fica para tarefa futura, pois OTP claro não é persistido. |
| Termos sem conteúdo impedirem ativação | certa | médio | Comportamento intencional; fixtures aprovadas só em banco efêmero. |
| Migration bloquear deploy | baixa | alto | Objetos aditivos, SQL revisado, teste de upgrade e job único antes da API. |
| Pool único elevar latência | média | médio | Transações curtas; hashing e I/O externo fora da transação; métricas sem PII. |

Rollout:

1. Obter domínio/templates/credenciais em ambientes secretos; validar Graph API vigente e a versão do SDK Resend antes de fixá-las.
2. Gerar/revisar migration `0003`, validar banco descartável e aplicar como job único.
3. Fazer deploy do backend com rotas desabilitadas por configuração/flag até a TASK 07 entregar BFF e fingerprint confiável.
4. Habilitar em ambiente de teste, rodar smoke por canal, monitorar falhas/latência/rate limit sem PII e promover gradualmente.

Rollback: desabilitar rotas/adapter real e reimplantar `0.8.1`; tabelas/colunas aditivas ficam sem uso. Corrigir banco somente por migration forward; preservar digests e não executar `down` destrutivo. Revogar credenciais/tokens de provedor se houver incidente.

## 9. Perguntas em Aberto (bloqueantes)

- [x] **Ordem (ADR-019):** nascimento é a primeira informação após a apresentação, sem persistência; após refresh deve ser informado novamente e será reenviado/revalidado na conclusão.
- [x] **Contrato (ADR-020):** rotas, métodos, status, envelope, headers e regra de idempotência aceitos.
- [x] **Continuação (ADR-021):** token opaco de 32 bytes, tabelas de sessão/idempotência, novo `REGISTRATION_FLOW_SECRET`, TTLs por etapa e rotação aceitos; a tolerância de 60 s vale somente para repetir a mesma requisição idempotente, nunca para uma operação nova.
- [x] **Topologia (ADR-022):** Next.js BFF será a única entrada do navegador em produção, mantendo o NestJS como API de negócio interna.
- [x] **Origem (ADR-023):** frontend/BFF inicial na Vercel direta, usando apenas `x-vercel-forwarded-for`, fingerprint HMAC e credencial interna do BFF; migração futura para Cloudflare fica isolada e exige nova ADR.
- [x] **Protocolo de provedores (ADR-024):** SDK oficial `resend` no adapter de e-mail, `fetch` nativo no adapter WhatsApp, retries classificados e sem outbox nesta task.
- [ ] **Ativação dos provedores:** fornecer/configurar domínio Resend, remetente, API key, conta/telefone/template da Meta, token e URL pública do frontend por ambiente seguro (nunca no Git ou no chat).
- [x] **Documentos jurídicos:** o endpoint retorna apenas metadados aprovados (inicialmente vazio); lorem ipsum existe somente em fixtures/testes de interface e a ativação real continua bloqueada até tarefa jurídica/publicação futura.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos no plano.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices`, `nestjs-expert`, `nestjs-hexagonal-architecture` e `nextjs-architecture` foram aplicadas conforme o escopo.
- [x] Testes, migration, rollout e rollback estão planejados.
- [ ] Perguntas em aberto foram exauridas.
