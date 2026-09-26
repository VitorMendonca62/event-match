# Task: Expor a API HTTP e entregar verificações do cadastro

- **Slug:** api-http-entrega-verificacao-cadastro
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-26
- **Status:** ready
- **Versão-alvo:** 0.9.0
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A TASK 06 de `specs/tasks.txt` pede a primeira fatia HTTP pública do cadastro sobre a fundação implementada pela SDD-007. A ADR-025 restringiu a primeira publicação ao e-mail e adiou WhatsApp; a ADR-026 substituiu Resend por Brevo para preservar o custo zero sem domínio próprio. Os endpoints e casos de uso já foram implementados; esta revisão troca somente o adapter de infraestrutura, configuração e testes do provedor.

O DER v1.3 exige maioridade, contato confirmado, senha, dados obrigatórios, aceites e três interesses (RF001–RF007, RN001–RN009). A ADR-019 determina validar nascimento antes de coletar contato. Todas as decisões arquiteturais estão aceitas. A ativação operacional da Brevo (conta, remetente individual verificado, API key e URL pública do callback) não bloqueia a implementação: fica como passo 1 do rollout, antes de habilitar produção.

Rastreabilidade: `docs/02-regras-de-negocio.md` §2; `docs/03-modelos-de-dominio.md` §2.1 e §4; `docs/04-integracoes-externas.md` §§1, 4 e 6; ADR-008 a ADR-026; `specs/sdd-007-persistencia-postgresql-cadastro/tasks.md`; código e testes atuais de `back/src/modules/registration/`.

Versão: elevar raiz e backend de `0.8.1` para `0.9.0`, atualizar Swagger e `CHANGELOG.md`. O frontend permanece em sua versão atual nesta task; Route Handlers serão implementados apenas na TASK 07.

## 2. Escopo

Inclui:

- [x] Etapa de validação de nascimento antes do contato, emitindo credencial de continuação somente para maior de 18 anos e sem persistir a data (ADR-019/ADR-021).
- [x] Contrato HTTP v1, DTOs, presenters, controller(s), guard de continuação e mapeamento tipado de `RegistrationError` (ADR-020).
- [x] Credencial opaca de continuação com digest, expiração, rotação, revogação e autorização por etapa; ids internos deixam de ser credenciais públicas (ADR-021).
- [x] Migration forward `0003` para `registration_flow_session` e `registration_idempotency`, com constraints, índices, rollout e forward fix (ADR-021).
- [x] Casos de uso/portas necessários para consultar o estado mínimo do fluxo, listar interesses ativos, listar metadados de documentos aprovados, verificar link de e-mail e operar a sessão de continuação.
- [x] Limite de dez novos desafios por origem/hora usando fingerprint HMAC fornecida apenas por camada confiável, sem persistir IP (ADR-023).
- [x] Adapter de e-mail com SDK oficial `@getbrevo/brevo`, configuração Zod, timeout/retry/idempotência e testes contratuais; `noop` fica restrito a desenvolvimento/testes (ADR-026).
- [x] OTP e link de uso único no e-mail. O link usa token opaco, alta entropia e expiração igual à do desafio (ADR-024).
- [x] OpenAPI, `.env.example`, Docker Compose, README, docs arquiteturais/de integração, changelog e versão.
- [x] Testes unitários, arquitetura, contrato de provedor, integração PostgreSQL, E2E e validações Bun.

Exclui:

- Componentes, páginas e Route Handlers Next.js; pertencem à TASK 07.
- Login/sessão geral da conta, recuperação completa de senha, alteração de contato e campos opcionais posteriores à ativação.
- Conteúdo jurídico definitivo, publicação administrativa de documentos, storage de artefatos jurídicos e ativação real enquanto não existirem os três documentos aprovados.
- Webhooks/recibos assíncronos de entrega, fila/outbox, job agendado, SMS e painel operacional.
- Integração real, credenciais, template e ativação do WhatsApp; pertencem a tarefa futura (ADR-025).
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
              Brevo SDK oficial
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
| Entrega por provedor e link de e-mail | `docs/adrs/ADR-024-entrega-de-verificacao-e-link-de-email.md` | accepted | Define link, retry/idempotência e ausência de outbox; Resend foi substituído pela ADR-026. |
| Adiar WhatsApp na primeira publicação | `docs/adrs/ADR-025-adiar-whatsapp-no-cadastro.md` | accepted | Evita fluxo sem OTP; UI mostra “Em breve” e o contrato aceita somente e-mail. |
| Substituir Resend por Brevo | `docs/adrs/ADR-026-substituir-resend-por-brevo.md` | accepted | Permite destinatários reais no MVP gratuito sem comprar domínio. |

Todos estão `accepted`. A ADR-019 substitui parcialmente a ordem da ADR-008, a ADR-025 adia WhatsApp e a ADR-026 substitui Resend por Brevo; os links bidirecionais e os documentos canônicos foram atualizados.

## 4. Contratos e Interfaces

Prefixo proposto: `/api/v1`. Toda resposta com corpo mantém `{ data, message, statusCode }`. Datas são UTC ISO-8601. A credencial entra como `Authorization: Bearer <opaque>` entre BFF e NestJS; tokens rotacionados saem apenas no header sensível `X-Registration-Continuation`, que o BFF converte em cookie e remove da resposta ao browser. Todas as respostas do fluxo usam `Cache-Control: no-store`.

Todas as rotas de cadastro exigem ainda `X-EventMatch-BFF-Token`, comparado em tempo constante na apresentação antes de qualquer caso de uso. As operações que criam um desafio recebem também `X-EventMatch-Origin-Fingerprint`, produzido pelo BFF da Vercel; o NestJS valida apenas forma/tamanho e nunca tenta reconstruí-lo a partir de headers públicos. Esses headers são internos, redigidos de logs e documentados no OpenAPI como requisitos da integração BFF → backend, sempre com exemplos fictícios.

| Método e rota | Entrada principal | Sucesso proposto | Autorização/observação |
|---|---|---|---|
| `POST /api/v1/registration/eligibility` | `{ birthDate: YYYY-MM-DD }` | `200 { eligible }`; emite continuação apenas se elegível | Sem persistir nascimento; `Idempotency-Key` opcional. |
| `POST /api/v1/registration/contact-verification` | `{ channel: 'email', contact }` | `202 { expiresAt, nextResendAt }` | Estágio `age_eligible`; sempre resposta neutra. `whatsapp` falha na validação sem escrita. |
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
| 4 | E-mail/WhatsApp usavam adapter noop. | SDK oficial da Brevo envia OTP+link. WhatsApp fica fora do contrato publicado, e `noop` existe apenas em desenvolvimento/testes. | ADR-025 e ADR-026 aceitas. |
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
- Brevo recebe um UUID estável em `headers.idempotencyKey` no corpo da mensagem, derivado deterministicamente da chave interna da entrega. Timeout por tentativa é 5 s; no máximo duas novas tentativas somente quando classificadas como seguras/transitórias, com retry automático do SDK desabilitado.
- O contrato HTTP e o OpenAPI aceitam somente e-mail nesta versão; tentativa de `whatsapp` retorna `400` de validação sem criar desafio, contato, contador ou evento de entrega.
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
- Adapter Brevo: redaction, timeout cancelável, `Retry-After`, 4xx definitivo, 429/5xx transitório e idempotência; `Test.createTestingModule` valida que produção não compõe `noop`.
- Arquitetura: domínio/aplicação sem imports NestJS/HTTP/Drizzle; apresentação sem SQL/regra de negócio.

Integração (`bun run --cwd back test:integration` pelo runner descartável):

- Migration `0003`, constraints/FKs/índices, aplicação em cadeia limpa e upgrade de `0000`–`0002` para `0003`.
- Sessão/idempotência sob concorrência com pools separados; rollback sem efeito parcial.
- Rate limit de contato + origem persistido; IP nunca aparece no NestJS, banco, logs ou telemetria; header genérico forjado e chamada direta sem credencial BFF são rejeitados.
- Consulta de interesses e termos aprovados; placeholders/retirados nunca saem no endpoint.

Contrato de provedores:

- Servidor HTTP fake valida URL, método, headers, template/payload, timeout, retry e idempotency key sem chamar internet real.
- Brevo: `POST /v3/smtp/email`, header HTTP `api-key`, `headers.idempotencyKey` estável por entrega no corpo e nenhum segredo adicional além dos valores necessários ao e-mail.

E2E/Supertest (`bun run --cwd back test:e2e`):

- nascimento elegível → contato → OTP/link → senha → dados obrigatórios → interesses/termos fixture → ativação;
- menoridade, canal WhatsApp rejeitado sem escrita/entrega, OTP inválido/expirado/bloqueado, cooldown/reenvio, contato retido, idempotência, token roubado/inválido e etapa fora de ordem;
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
| WhatsApp parecer disponível antes da integração | baixa com testes | médio | Contrato aceita somente e-mail; TASK 07 usa controle desabilitado, texto “Em breve” e E2E sem chamada. |
| Falha após commit impedir entrega | média | médio | Evento seguro + reenvio; outbox/webhook fica para tarefa futura, pois OTP claro não é persistido. |
| Termos sem conteúdo impedirem ativação | certa | médio | Comportamento intencional; fixtures aprovadas só em banco efêmero. |
| Migration bloquear deploy | baixa | alto | Objetos aditivos, SQL revisado, teste de upgrade e job único antes da API. |
| Pool único elevar latência | média | médio | Transações curtas; hashing e I/O externo fora da transação; métricas sem PII. |

Rollout:

1. Criar conta Brevo, verificar remetente individual e guardar `BREVO_API_KEY`, `EMAIL_FROM` e `FRONTEND_PUBLIC_URL` no cofre do ambiente; revisar cota e reescrita do remetente.
2. Gerar/revisar migration `0003`, validar banco descartável e aplicar como job único.
3. Fazer deploy do backend com rotas desabilitadas por configuração/flag até a TASK 07 entregar BFF e fingerprint confiável.
4. Habilitar em ambiente de teste, rodar smoke de e-mail, monitorar falhas/latência/rate limit sem PII e promover gradualmente.

Rollback: desabilitar rotas/adapter real e reimplantar `0.8.1`; tabelas/colunas aditivas ficam sem uso. Corrigir banco somente por migration forward; preservar digests e não executar `down` destrutivo. Revogar a credencial da Brevo se houver incidente.

## 9. Perguntas em Aberto (bloqueantes)

- [x] **Ordem (ADR-019):** nascimento é a primeira informação após a apresentação, sem persistência; após refresh deve ser informado novamente e será reenviado/revalidado na conclusão.
- [x] **Contrato (ADR-020):** rotas, métodos, status, envelope, headers e regra de idempotência aceitos.
- [x] **Continuação (ADR-021):** token opaco de 32 bytes, tabelas de sessão/idempotência, novo `REGISTRATION_FLOW_SECRET`, TTLs por etapa e rotação aceitos; a tolerância de 60 s vale somente para repetir a mesma requisição idempotente, nunca para uma operação nova.
- [x] **Topologia (ADR-022):** Next.js BFF será a única entrada do navegador em produção, mantendo o NestJS como API de negócio interna.
- [x] **Origem (ADR-023):** frontend/BFF inicial na Vercel direta, usando apenas `x-vercel-forwarded-for`, fingerprint HMAC e credencial interna do BFF; migração futura para Cloudflare fica isolada e exige nova ADR.
- [x] **Protocolo de provedores (ADR-024/ADR-026):** SDK oficial da Brevo no adapter de e-mail, retries classificados e sem outbox nesta task; o desenho HTTP de WhatsApp ficou para implementação futura.
- [x] **Disponibilidade de canal (ADR-025):** WhatsApp desabilitado com “Em breve”, sem chamada do frontend; contrato publicado aceita somente e-mail e `noop` fica restrito a desenvolvimento/testes.
- [x] **Ativação da Brevo:** conta, remetente individual, API key e URL pública serão configurados por ambiente seguro no passo 1 do rollout (nunca no Git ou no chat). O plano permanece `ready`, pois o código lê tudo por `ConfigModule` e os testes usam servidor fake da Brevo.
- [x] **Documentos jurídicos:** o endpoint retorna apenas metadados aprovados (inicialmente vazio); lorem ipsum existe somente em fixtures/testes de interface e a ativação real continua bloqueada até tarefa jurídica/publicação futura.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material.
- [x] Durante a fase de planejamento, nenhum código de produção havia sido escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos no plano.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices`, `nestjs-expert`, `nestjs-hexagonal-architecture` e `nextjs-architecture` foram aplicadas conforme o escopo.
- [x] Testes, migration, rollout e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.

## 11. Registro de implementação (2026-09-26)

Implementado com `code-implementer`, aplicando `nestjs-expert` (DTOs `class-validator`, `ValidationPipe` global, Swagger por operação, providers por token, `Test.createTestingModule` e Supertest). Não houve código frontend. Nenhuma nova decisão arquitetural surgiu; os ajustes de detalhe abaixo cabem nas ADRs aceitas e estão documentados em `docs/04-integracoes-externas.md` e `docs/03-modelos-de-dominio.md`:

- `POST contact-verification` aceita `age_eligible` e também `verification_pending`, para corrigir um e-mail digitado errado sem refazer a elegibilidade.
- `registration_idempotency` não tem `http_status`: só respostas de sucesso são guardadas e o status de cada rota é fixo. Tem `rotates` e `completed_at`.
- `Idempotency-Key` em `eligibility` e `confirm-link` é validada, mas não armazenada: não há sessão prévia, e ambos são naturalmente seguros para repetição (nova sessão curta / link de uso único).
- O fingerprint de payload exclui senha e nascimento; a chave identifica a repetição.
- `422` carrega `data.reason` com códigos que não dependem de terceiros.
- Após a conclusão, os digests são anulados (ADR-021) e uma repetição recebe `401`.
- Efeito de negócio, transição da sessão e resultado idempotente são gravados na mesma transação por ganchos `withinTransaction` nos casos de uso existentes.

Pendências e observações:

- A ADR-026 substituiu o adapter Resend por Brevo após esta implementação inicial; dependência, configuração e testes contratuais foram migrados sem alterar a porta de aplicação.
- Rollout passo 1 continua pendente: conta/remetente verificado, `EMAIL_FROM`, `BREVO_API_KEY` e `FRONTEND_PUBLIC_URL` em cofre por ambiente.
- `test/integration/registration-migrations.integration.test.ts` (“normalizes legacy rows…”) falhava desde o commit `080283e`, que passou a converter apenas registros cuja conta não está expirada. Corrigido na revisão: o fixture cobre agora os dois casos (conta expirada mantém `expired`; conta viva vira `converted`), sem alterar a migration `0002`.
- Revisão: `LocaleQueryDto` foi movido para `back/src/shared/presentation/http/locale-query.dto.ts`, eliminando o import entre bounded contexts, e os controllers de cadastro e catálogo passaram para `presentation/http/controllers/`, conforme `AGENTS.md`.
