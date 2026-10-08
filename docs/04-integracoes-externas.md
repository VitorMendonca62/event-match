# 04 — APIs e integrações externas do EventMatch

## 1. Princípios do contrato

- NestJS em `back/` expõe a API de negócio e publica OpenAPI.
- Route Handlers do Next.js são BFF/proxy e, no cadastro, constituem a única entrada do navegador; não acessam PostgreSQL nem implementam regras do domínio.
- DTOs HTTP são validados com `ValidationPipe` e `class-validator`; respostas nunca expõem stack trace, segredo ou sinal antifraude interno.
- Autorização considera identidade, papel, relação com evento/caso, bloqueios, restrições e estado do recurso.
- Operações irreversíveis, concorrentes ou reexecutáveis declaram idempotência e conflito (`409`) explicitamente.
- Erros de autenticação/recuperação respeitam antienumeração.
- `GET /health` é liveness do processo; `GET /health/readiness` consulta PostgreSQL e retorna `503` com envelope seguro quando a dependência está indisponível.

## 2. Grupos de API esperados

Os paths finais serão definidos por contrato OpenAPI e plano de feature. Esta tabela delimita capacidades, não prescreve endpoints.

| Grupo | Capacidades | Requisitos |
|---|---|---|
| Auth e sessões | cadastro, confirmação, login, recuperação, troca de senha, encerrar sessões | RF001–RF011, RNF003–RNF005 |
| Perfil | leitura/edição, prévia pública, interesses, visibilidade, contatos e nascimento protegido | RF012–RF016, RF059, RF075, RF081 |
| Eventos | rascunho, prévia, publicação, edição, transferência, cancelamento, estados | RF017–RF021, RF033–RF038, RF084–RF087 |
| Descoberta | feed, busca, filtros, salvos, desinteresse e compartilhamento público | RF022–RF027, RF102 |
| Participações | solicitar, retirar, decidir, entrar, desistir, remover, reconfirmar e presença | RF028–RF35, RF037–RF038, RF045–RF046, RF069–RF071, RF079, RF088–RF089, RF103, RF107 |
| Conversa | histórico, mensagem, imagem, aviso, edição, moderação, silêncio e contestação | RF039–RF044, RF077, RF090, RF097, RF104 |
| Avaliações | formulário, agregados e atalho de denúncia | RF047–RF048, RF098–RF099 |
| Segurança | denúncia, anexos, acompanhamento, bloqueio, restrições, recursos | RF049–RF058, RF065, RF072–RF076, RF080, RF091, RF097, RF106 |
| Conta e dados | desativação, reativação, exclusão/cancelamento, exportação | RF060–RF062, RF068, RF073–RF074, RF078 |
| Notificações | inbox, preferências e categorias essenciais | RF063–RF064, RF094, RF105 |
| Operação | profissionais, papéis, casos, auditoria, catálogos, eventos oficiais | RF066–RF067, RF082–RF084, RF095–RF101 |

### Contrato técnico inicial

Enquanto os grupos de produto não forem implementados, o backend expõe somente `GET /health`, sem autenticação, como liveness do processo — não como readiness de PostgreSQL ou integrações ainda inexistentes. A resposta 200 é `{ "data": { "status": "ok" }, "message": "API disponível", "statusCode": 200 }`.

Toda resposta HTTP com corpo segue o envelope público `data` (objeto), `message` (string) e `statusCode` (número serializado de `HttpStatus`). A camada de apresentação converte erros conhecidos e inesperados nesse formato sem retornar stack trace, erro bruto de validação ou detalhe de infraestrutura. O OpenAPI do NestJS fica disponível no caminho configurado pelo ambiente e pode ser desabilitado sem alterar `/health`.

### Contrato v1 do cadastro (SDD-009, versão 0.9.0; SDD-011 acrescenta `content` na listagem de documentos, versão 0.10.0)

Prefixo `/api/v1` (ADR-020). Toda rota de `/api/v1/registration` exige `X-EventMatch-BFF-Token` (comparado em tempo constante com `BFF_INTERNAL_TOKEN`; ausente ou inválido → `401`), responde `Cache-Control: no-store` inclusive em erros e fica atrás da flag `REGISTRATION_HTTP_ENABLED` (desligada → `404`) até a TASK 07 publicar o BFF. Nenhuma rota aceita `verificationId`, `registrationId` ou `accountId` do navegador; `forbidNonWhitelisted` rejeita esses campos com `400`.

| Método e rota | Corpo | Sucesso | Credenciais |
|---|---|---|---|
| `POST /api/v1/registration/eligibility` | `{ birthDate }` | `200 { eligible }`; continuação só se elegível | `Idempotency-Key` opcional e não armazenada (nova tentativa só cria outra sessão `age_eligible`) |
| `POST /api/v1/registration/contact-verification` | `{ channel: 'email', contact }` | `202 { expiresAt, nextResendAt }` neutro | Bearer, `Idempotency-Key`, `X-EventMatch-Origin-Fingerprint`; estágio `age_eligible` ou `verification_pending` (corrige e-mail digitado errado) |
| `POST /api/v1/registration/email-delivery-test` | `{ contact }` | `200 { accepted: true }` ou `503` | Smoke temporário: BFF e `Idempotency-Key`; somente fora de produção, com Brevo ativo; não cria desafio e o código `000000` é ilustrativo |
| `POST /api/v1/registration/contact-verification/resend` | `{}` | `202 { expiresAt, nextResendAt }` neutro | Bearer, `Idempotency-Key`; `verification_pending` |
| `POST /api/v1/registration/contact-verification/confirm` | `{ otp }` | `200 { verified }`; rotaciona se `true` | Bearer, `Idempotency-Key`; `verification_pending` |
| `POST /api/v1/registration/contact-verification/confirm-link` | `{ token }` | `200 { verified }`; emite continuação se `true` | só o token do link (uso único) |
| `PUT /api/v1/registration/password` | `{ password, passwordConfirmation }` | `200 { stage, expiresAt }`; rotaciona | Bearer, `Idempotency-Key`; `contact_verified` |
| `PUT /api/v1/registration/required-data` | `{ displayName, region, usageIntents[] }` | `200 { stage, expiresAt }`; rotaciona | Bearer, `Idempotency-Key`; `registration_in_progress` |
| `GET /api/v1/registration` | — | `200 { stage, expiresAt, nextResendAt? }` | Bearer atual (o anterior não serve) |
| `DELETE /api/v1/registration` | — | `200 { cancelled: true }`: expira o cadastro provisório, anula dados retidos, revoga a continuação (ADR-030); `401` para token inválido, revogado ou rotacionado | continuação + credencial do BFF |
| `GET /api/v1/registration/legal-documents?locale=pt-BR` | — | `200 { documents[] }` com `id`, `kind`, `version`, `locale`, `effectiveAt` e `content` (Markdown sem frontmatter); só a versão vigente `approved` de cada tipo (ADR-028); `Cache-Control: no-store` | apenas credencial do BFF |
| `POST /api/v1/registration/complete` | `{ birthDate, documentIds[], interestIds[] }` | `200 { status: 'active' }`; revoga a sessão | Bearer, `Idempotency-Key`; `account_incomplete` |
| `GET /api/v1/catalog/interests?locale=pt-BR` | — | `200 { interests[] }` ativos, ordem estável | pública |

Headers internos BFF ↔ NestJS, nunca enviados ao navegador: `Authorization: Bearer <continuação>` (32 bytes em base64url), `X-EventMatch-Origin-Fingerprint` (HMAC da origem, 32 bytes em base64url; formato validado, jamais reconstruído a partir de `X-Forwarded-For`) e, na resposta, `X-Registration-Continuation`, que o BFF converte em cookie `HttpOnly` e remove (ADR-022). `Idempotency-Key` tem 16 a 128 caracteres `[A-Za-z0-9_-]`.

O smoke `email-delivery-test` usa o mesmo adapter e template de verificação da Brevo, mas não persiste contato, sessão ou desafio. O código recebido é fixo e inutilizável. A rota responde `404` em produção ou quando `VERIFICATION_DELIVERY_MODE` não é `brevo`; deve ser removida depois da validação operacional do provedor.

Erros: `400` forma/DTO (sem ecoar valores), `401` credencial do BFF ou continuação ausente/inválida/expirada, `409` estágio incompatível, chave em uso ou chave repetida com payload diferente, `422` regra semântica com `data.reason` ∈ {`invalid_contact`, `invalid_password`, `weak_password`, `invalid_birth_date`, `invalid_display_name`, `invalid_region`, `invalid_usage_intents`, `activation_unavailable`}; motivos que dependam de terceiros não existem. Pedido e reenvio de contato respondem `202` idênticos mesmo quando limitados, com contato retido ou falha de entrega.

Continuação e idempotência (ADR-021): a mesma chave com o mesmo payload devolve o resultado armazenado sem repetir efeito nem mensagem; se o comando original rotacionou a continuação, a repetição emite outra. O token anterior vale 60 s exclusivamente para essa repetição. O fingerprint do payload exclui senha e nascimento. Após a conclusão, os digests são anulados e qualquer repetição recebe `401`; o BFF deve tratá-lo como cadastro encerrado. O callback do link de e-mail é `GET {FRONTEND_PUBLIC_URL}/api/registration/contact-verification/confirm-link?token=…`, implementado pelo BFF da SDD-010 (abaixo).

### BFF do cadastro no Next.js (SDD-010, versão 0.10.0)

O navegador conversa apenas com a mesma origem. Cada Route Handler delega a exatamente uma rota v1 acima, sem retry implícito, com timeout (`BACKEND_TIMEOUT_MS`, padrão 8 s) e `Cache-Control: no-store`; respostas preservam o envelope `data`/`message`/`statusCode`.

| Navegador → BFF | NestJS | Observações |
|---|---|---|
| `POST /api/registration/eligibility` | `POST …/eligibility` | grava o cookie só quando a continuação vem na resposta |
| `POST /api/registration/contact-verification` | `POST …/contact-verification` | adiciona `X-EventMatch-Origin-Fingerprint` |
| `POST /api/registration/contact-verification/resend` | `POST …/resend` | corpo `{}` |
| `POST /api/registration/contact-verification/confirm` | `POST …/confirm` | rotaciona o cookie se `verified: true` |
| `GET /api/registration/contact-verification/confirm-link?token=…` | `POST …/confirm-link` | `303` para `/cadastro?email-verificado=1|0`, `Referrer-Policy: no-referrer`; cookie só em sucesso; o token nunca volta ao navegador nem aos logs |
| `PUT /api/registration/password` · `PUT /api/registration/required-data` | mesmas rotas | rotacionam o cookie |
| `GET /api/registration` | `GET /api/v1/registration` | snapshot mínimo |
| `DELETE /api/registration` | `DELETE /api/v1/registration` | cancelamento: expira o cadastro no backend e o cookie (ADR-030) |
| `GET /api/registration/legal-documents` | `GET …/legal-documents?locale=pt-BR` | — (propaga `content`; a página `/cadastro` renderiza o Markdown no servidor, ADR-029) |
| `POST /api/registration/complete` | `POST …/complete` | expira o cookie em sucesso |
| `GET /api/catalog/interests` | `GET /api/v1/catalog/interests?locale=pt-BR` | pública, sem credencial interna |

- Mutações exigem exatamente um `Origin` igual a `FRONTEND_PUBLIC_URL`, `Sec-Fetch-Site` ausente ou `same-origin` e `Content-Type: application/json`; caso contrário `403` sem chamada ao backend. CORS não é habilitado. Corpo acima de 8 KiB, propriedades fora do contrato ou `Idempotency-Key` malformada → `400`.
- Cookie `__Host-eventmatch_registration` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sem `Domain`), `Max-Age` limitado ao `expiresAt` recebido ou, quando a resposta não o traz (elegibilidade e confirmação), a 1 h; fora de produção o nome é `eventmatch_registration` sem `Secure`. `401` do backend ou continuação ausente expira o cookie.
- Tradução: sucesso só com `data` validado pelo schema esperado (senão `502`); `422` preserva apenas `reason` pública; `400/401/404/409` viram envelopes genéricos; `5xx`, timeout e falha de rede → `503`.
- Fingerprint: com `EDGE_PROVIDER=vercel`, somente um `x-vercel-forwarded-for` singular e IP válido gera `base64url(HMAC-SHA-256(ORIGIN_FINGERPRINT_KEY, ip))`; `X-Forwarded-For`/`X-Real-IP` são ignorados. `fixture` é aceito apenas fora de produção.
- Logs do BFF: somente `operation`, `status`, `durationMs` e `correlationId` gerado.
- Configuração server-only (`front/src/shared/config/bff-env.server.ts`): `BACKEND_INTERNAL_URL`, `FRONTEND_PUBLIC_URL`, `BFF_INTERNAL_TOKEN`, `ORIGIN_FINGERPRINT_KEY`, `EDGE_PROVIDER` e `BACKEND_TIMEOUT_MS`. Produção exige HTTPS público, `vercel` e segredos base64 de 32+ bytes; valores nunca são impressos.

### Contrato v1 de autenticação (SDD-013, backend/Swagger 0.11.0)

Interno ao BFF: todas as rotas de `/api/v1/auth` exigem `X-EventMatch-BFF-Token`, respondem `404` enquanto `AUTH_HTTP_ENABLED=false`, usam `Cache-Control: no-store`, nunca definem cookie nem CORS e seguem o envelope padrão. O token opaco (32 bytes em base64url) sai somente no header interno `X-EventMatch-Session`; entra como `Authorization: Bearer` (esquema OpenAPI `authenticated-session`).

| Método e rota | Entrada | Sucesso | Falhas |
|---|---|---|---|
| `POST /api/v1/auth/login` | `{ email (IsEmail, ≤320), password (1–256), rememberMe (boolean) }` + `X-EventMatch-Origin-Fingerprint` | `200 { authenticated: true, expiresAt, idleExpiresAt, remembered }` + `X-EventMatch-Session` | `400` forma; `401` neutro (inexistente, senha errada, estado sem sessão comum); `429` genérico, sem `Retry-After` nem escopo; `5xx` genérico, nunca `401` |
| `GET /api/v1/auth/session?capability=authenticated_home|logout&rotate=true|false` | Bearer | `200 { authenticated: true, expiresAt, idleExpiresAt, remembered, rotationDue }`; com `rotate=true` e rotação devida, novo token em `X-EventMatch-Session` | `401` neutro (ausente, expirada, revogada ou conta fora de `active`; a sessão é removida); `403` genérico (conta `active` com capacidade negada; sessão mantida) |
| `POST /api/v1/auth/logout` | Bearer | `200 { loggedOut: true }`, idempotente para token bem formado | `401` só para bearer ausente/malformado |

Os corpos de `401`, `403` e `429` são idênticos aos do filtro global (`Authentication is required.`, `You do not have permission to perform this action.`, `Too many requests.`) e não informam estado, motivo, tentativas restantes nem instante de liberação.

### BFF de autenticação no Next.js (SDD-013, frontend 0.12.0)

| Navegador → BFF | NestJS | Observações |
|---|---|---|
| `POST /api/auth/login` | `POST /api/v1/auth/login` | mesma origem + JSON (login CSRF); fingerprint de origem; em sucesso grava o cookie e responde só `{ authenticated: true }` |
| `GET /api/auth/session` | `GET /api/v1/auth/session?capability=authenticated_home&rotate=true` | manutenção chamada pela página no foco/visibilidade/bfcache; `Sec-Fetch-Site` ausente ou `same-origin`; troca o cookie quando rotaciona; `401` expira o cookie, `403` não |
| `POST /api/auth/logout` | `POST /api/v1/auth/logout` | mesma origem + JSON; sempre expira o cookie (inclusive sem cookie, com sessão já ausente, backend indisponível ou `AUTH_UI_ENABLED=false`) |

- Cookie `__Host-eventmatch_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sem `Domain`); sem “Manter conectado” não tem `Max-Age`/`Expires`; com ele, `Max-Age = min(expiresAt − agora, 30 dias)`. Fora de produção o nome é `eventmatch_session` sem `Secure`. O cookie de continuação do cadastro nunca é aceito aqui.
- Sem retry automático; timeout `BACKEND_TIMEOUT_MS`; o header interno e o token nunca voltam ao navegador; tradução conservadora (`400/401/429` genéricos, forma inesperada `502`, `5xx`/rede `503`); logs com `scope: "auth-bff"`, operação, status, duração e correlation id gerado.
- `/entrar` e `/inicio` validam a sessão no servidor com `GET /api/v1/auth/session` sem rotação (RSC não grava cookie) e nunca serializam principal, prazos ou token para o cliente. `AUTH_UI_ENABLED` (server-only, padrão `false`) oculta `/entrar`, `/inicio`, login e manutenção.

## 3. Exposição por audiência

| Audiência | Pode receber | Nunca recebe |
|---|---|---|
| Visitante | dados públicos do evento e anfitrião | ponto exato, contatos, lista de pessoas, conversa |
| Participante autenticado | dados permitidos por perfil/evento/estado | nascimento, contatos alheios, motivos internos, denúncias alheias |
| Confirmado | ponto exato, conversa e lista permitida de confirmados | anexos de denúncia, sinais internos de risco |
| Anfitrião | perfis públicos necessários, solicitações e estados | dados privados, denúncia/nota interna, poder de suspender conta |
| Profissional | somente dados necessários ao papel e caso atribuído | acesso irrestrito por ser funcionário/administrador |

Referência: RN021, RN025, RN075–RN077, RN152–RN159.

## 4. Integrações externas necessárias

### Cloudinary (foto principal)

Entrega `authenticated`, preset assinado, Strict Transformations, `fl_force_strip` e variantes WebP 512/128. O original não é servido. Produção exige avaliação jurídica/privacidade e configuração conforme `docs/runbooks/profile-media.md`; flags permanecem desligadas até essa validação.

| Integração | Finalidade | Requisitos/controles |
|---|---|---|
| Brevo (e-mail) | OTP, link de confirmação e recuperação | remetente individual verificado no MVP sem domínio, template em código, antienumeração, timeout de 5 s e até duas novas tentativas transitórias |
| WhatsApp Cloud API (Meta) | Integração futura de OTP e recuperação para celular no Brasil | adiada pela ADR-025; UI desabilitada como “Em breve” e contrato publicado não aceita o canal nesta etapa |
| Object storage | fotos, imagens de conversa, anexos e evidências | buckets/prefixos por classe, URLs assinadas, malware scan, retenção e exclusão |
| Geocodificação/mapas | região aproximada, distância e ponto de encontro | consentimento, minimização e não rastrear deslocamento |
| Push/web notification | avisos configuráveis e essenciais | preferências por categoria e ao menos um canal essencial |
| Observabilidade | logs, métricas, traces e alertas | redaction de PII/segredos; correlação sem conteúdo sensível |

Brevo é o único provedor ativo na primeira implementação de verificação. Antes de ativá-lo, é obrigatório verificar um remetente individual, configurar a API key em ambiente e revisar os termos e a cota gratuita vigentes. Sem domínio autenticado, a Brevo pode reescrever o remetente para um endereço técnico; isso é aceito apenas no MVP de testes. WhatsApp Cloud API continua como integração futura conforme ADR-025.

A entrega de verificação é a porta outbound `VerificationDeliveryPort`, chamada somente após o commit da unidade de trabalho. A requisição `verify` leva o OTP e o token do link em claro apenas em memória (nunca persistidos nem registrados em log) e a chave de idempotência persistida; reenvios usam `<chave>:resend:<n>` como identificador histórico interno e geram novo OTP e novo link. A requisição `recovery_notice` é enviada, pelo mesmo canal, quando o contato já pertence a um cadastro ou conta, sem alterar a resposta neutra e sem código ou link. Falhas de entrega não mudam a resposta e geram apenas o evento `registration.verification.delivery_failed`, com canal e id opaco.

`BrevoVerificationDeliveryAdapter` (ADR-026) usa o SDK oficial `@getbrevo/brevo` fixado em `6.0.3`, confinado à infraestrutura, com template pt-BR versionado (`verification-email/v2`) contendo OTP e link, layout em tabela, estilos inline e a paleta visual do EventMatch. O adapter desabilita retries automáticos do SDK e aplica uma única política: timeout cancelável de 5 s e no máximo duas novas tentativas, sempre com o mesmo UUID derivado em `headers.idempotencyKey` do corpo Brevo, para falhas transitórias, `408`, `429` e `5xx`; demais `4xx` são definitivos. `Retry-After` é limitado a 5 s. Configuração: `VERIFICATION_DELIVERY_MODE` (`brevo` | `noop`, obrigatório; `noop` recusado em produção), `BREVO_API_KEY`, `EMAIL_FROM`, `FRONTEND_PUBLIC_URL` (obrigatórios em `brevo`) e `BREVO_BASE_URL` (padrão oficial; `https` obrigatório em produção). Somente o adapter configurado é instanciado. O desenho do adapter WhatsApp por `fetch` da ADR-024 continua adiado pela ADR-025.

## 5. Arquivos e limites

| Fluxo | Limite |
|---|---|
| Imagem de conversa | até 5 por mensagem, 10 MB cada; sem documentos, vídeos ou áudio |
| Denúncia | até 10 anexos; imagem 10 MB, PDF 20 MB, vídeo 50 MB por arquivo |
| Documento excepcional | último recurso, voluntário, finalidade explícita e dados desnecessários ocultáveis |

Valide extensão, MIME real, tamanho, assinatura, malware e autorização tanto antes quanto depois do upload. Objetos não são públicos por padrão.

## 6. Segurança e abuso

- Rate limit por IP, conta, contato e operação sensível, com cuidado para não bloquear vítimas.
- Tokens de confirmação/recuperação têm finalidade, expiração, uso único e armazenamento seguro.
- Cada entrega de verificação usa chave de idempotência por desafio/entrega. Falhas definitivas não são repetidas automaticamente; falhas transitórias podem ter no máximo duas novas tentativas.
- OTP expira em 15 minutos, bloqueia por 20 minutos após cinco falhas e usa limites por contato e origem/IP; logs e métricas não incluem código, contato completo ou razão detalhada de bloqueio.
- O limite de dez desafios por origem/hora é aplicado no NestJS antes da unidade de negócio, em `verification_rate_window` com `scope = 'origin'`, usando somente a fingerprint recebida; nenhum IP chega ao backend, banco, logs ou telemetria (SDD-009).
- No deploy inicial direto na Vercel, somente `x-vercel-forwarded-for` alimenta o resolvedor server-only de origem. O BFF converte o IP em fingerprint HMAC e envia apenas essa fingerprint ao NestJS; headers genéricos do cliente são ignorados.
- Rotas de cadastro no NestJS exigem credencial interna opaca do BFF, separada da continuação da pessoa. Migração futura para Cloudflare troca apenas o resolvedor de origem e exige nova ADR; não habilita fallback simultâneo para múltiplos headers.
- Respostas de login/recuperação não confirmam existência da conta.
- Login (ADR-035): limites independentes em janela deslizante de 15 min, 5 falhas por contato (HMAC em domínio `auth:login:`) e 30 por fingerprint de origem, persistidos em `authentication_attempt` e reservados antes da consulta à conta; sucesso libera a reserva. Contato inexistente paga uma verificação Argon2id dummy. Telemetria `identity_access.*` registra só operação, resultado agregado, duração, correlation id e, no limite, o escopo.
- Downloads de cópia de dados usam autenticação reforçada, URL temporária e expiração de sete dias.
- Webhooks externos exigem assinatura, replay protection, idempotência e auditoria.
- Eventos de auditoria são separados de logs comuns e têm acesso restrito.

## 7. Observabilidade e SLOs

- Métricas de latência suportam RNF013 e RNF014, segmentadas por operação sem labels com PII.
- SLO de disponibilidade mensal: 99,5%, excluída manutenção comunicada com 24 h.
- Alertas para falha de confirmação, inconsistência de vagas, atraso em notificações essenciais, erro de upload e jobs de retenção.
- Logs de segurança não expõem relato, anexo, documento, contato completo ou sinais antifraude.
- Perfil emite somente eventos allowlisted `profile.read`, `profile.update`, `profile.conflict`, `profile.preview`, `profile.photo.grant`, `profile.photo.finalize`, `profile.photo.reject`, `profile.photo.remove` e `profile.media.cleanup`; o BFF emite `profile.invite.dismiss`. Os campos ficam limitados a resultado/status, duração, correlation id aleatório, provedor e contagens agregadas do cleanup, sem conteúdo, conta, fingerprint, URL, assinatura ou id do provedor.
- Resultados `invalid`, `conflict`, `rate_limited`, `rejected`, `provider_error` e `failed` permitem separar validação, concorrência, abuso, provedor, persistência e cleanup sem labels de alta cardinalidade. A operação deve alertar quando `profile.media.cleanup.failedCount > 0` persistir ou a fila `delete_pending` crescer entre execuções.

## 8. Pendência jurídica

Exportação de dados, documentos excepcionais e retenção permanecem condicionados à validação jurídica brasileira: RF068, RF073, RF074, RN068, RN080–RN083, RN093, RN096, RN100–RN104, RN115–RN122, RNF023 e RNF025.
### Perfil v1 e BFF (SDD-015, backend 0.12.0; frontend 0.13.0)

- `GET|PUT /api/v1/profiles/me`, `GET /api/v1/profiles/me/preview`, `POST /api/v1/profiles/me/photo/uploads`, `POST /api/v1/profiles/me/photo/uploads/:uploadId/finalize` e `DELETE /api/v1/profiles/me/photo` exigem credencial BFF, Bearer de sessão, capacidade live e `no-store`.
- BFFs equivalentes em `/api/profile/**` validam origem/JSON/tamanho, fazem uma chamada sem retry, expiram sessão em `401`, preservam em `403` e removem `invitationSubject`, ids/segredos do provedor e mensagens upstream.
- O grant retorna somente URL oficial, cloud name, API key pública, preset e parâmetros efêmeros assinados. O browser envia direto ao Cloudinary; a finalização revalida assinatura e consulta o recurso antes da transação curta de ativação.
- A foto retornada contém somente `deliveryUrl`, `width` e `height`. A URL do derivado é assinada, mas não possui nem promete expiração temporal; `expiresAt` existe somente no grant de upload (ADR-042).
- `POST /api/profile/invitation/dismiss` consulta o perfil e grava cookie HttpOnly de sete dias, por sujeito HMAC; não grava preferência de onboarding no banco.

### Identidade opcional do perfil (SDD-016, backend 0.13.0; frontend 0.14.0)

- `GET /api/v1/catalog/languages?locale=pt-BR` lista `{ code, label }` ativos em ordem estável, é público (sem sessão nem token BFF, como `/catalog/interests`) e, como ele, responde `Cache-Control: no-store`; `GET /api/catalog/languages` é o proxy Next.js filtrado.
- `GET/PUT /api/v1/profiles/me` acrescenta seleção de pronome, texto personalizado, profissão, idiomas e três visibilidades. O PUT recebe snapshot completo, no máximo cinco códigos únicos e responde `422` com somente `unknown_language` ou `inactive_language` em `data.reason`.
- Snapshot completo vale também para `presentation`: a chave passa a ser obrigatória no PUT (valor `string` de 1–500 ou `null`); omiti-la responde `400`. Antes o campo era opcional e, quando ausente, chegava indefinido ao domínio e resultava em `500`. Remover a apresentação continua sendo enviar `null`. No OpenAPI, `presentation` e `photo` de `OwnProfileResponseDto` passam a constar como obrigatórios e anuláveis, refletindo o que a API já devolvia.
- `GET /api/v1/profiles/me/preview` devolve apenas `pronouns`, `profession` e `languages` autorizados; não expõe seleção interna, recusa explícita, visibilidades ou estado do catálogo.
- Todas as respostas permanecem `no-store`; BFFs validam sessão/origem/JSON e nunca registram conteúdo dos novos campos.

### Preferências de atividades (SDD-017, backend 0.14.0; frontend 0.15.0)

- `GET /api/v1/catalog/activity-preferences?locale=pt-BR` lista `{ code, label }` ativos em ordem estável; público, `no-store`, `400` para locale inválido e `503` em indisponibilidade. `GET /api/catalog/activity-preferences` é o proxy Next.js filtrado (`internal: false`) que falha fechado em resposta inválida.
- `GET /api/v1/profiles/me` acrescenta `activityPreferences: { code, label, active }[]` e `activityPreferencesVisibility`.
- `PUT /api/v1/profiles/me` passa a exigir `activityPreferenceCodes` (0–5, únicos, `^[a-z][a-z0-9_]{1,39}$`) e `activityPreferencesVisibility` (`private | authenticated`); ausência responde `400`. Desconhecido/inativo novo responde `422` com somente `unknown_activity_preference` ou `inactive_activity_preference`, sem ecoar códigos. Clientes antigos recebem `400`: front e back são publicados de forma coordenada.
- `GET /api/v1/profiles/me/preview` acrescenta `activityPreferences?: { code, label }[]` somente quando a visibilidade é `authenticated` e a lista não é vazia; não expõe visibilidade nem `active`.

### Disponibilidade e distância preferida (SDD-018, backend 0.15.0; frontend/workspace 0.16.0)

- `GET /api/v1/profiles/me` acrescenta `availabilitySlots: AvailabilitySlot[]` em ordem canônica e `preferredDistance: PreferredDistance | null`. Os campos pertencem exclusivamente à visão própria.
- `PUT /api/v1/profiles/me` passa a exigir as chaves `availabilitySlots` (array único de zero a 28 códigos) e `preferredDistance` (uma das cinco faixas ou `null`) no snapshot completo. Ausência, código desconhecido, duplicidade ou faixa inválida responde `400`; a revisão continua protegida por `409`.
- `GET /api/v1/profiles/me/preview` não muda e nunca contém esses campos. O BFF encaminha o snapshot completo, valida a resposta estrita e falha fechado quando as chaves obrigatórias estão ausentes; nenhuma telemetria carrega valores ou contagens.
- Na interface, `preferredDistance` é escolhido por um `input[type="range"]` nativo com seis posições: `0` para `null`/“Não informar” e `1`–`5` para os enums de distância. A faixa `same_city` aparece visualmente como “Toda a cidade” e mantém “Qualquer lugar na minha cidade” como nome acessível. Um grupo de botões com as mesmas faixas é alternativa explícita de clique e usa `aria-pressed`; o valor atual continua anunciado por texto vivo/`aria-valuetext`. Essa conversão é somente de apresentação; o BFF e o contrato público continuam usando os códigos estáveis.
- Não há endpoint de localização, cálculo de distância ou filtro nesta entrega. A migration `0010_profile_availability_distance` é aditiva, com `CHECK`s, FK em cascata e índice por dia/período; rollback operacional desliga a UI e preserva schema/dados para correções forward-only.
