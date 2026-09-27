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

### Contrato v1 do cadastro (SDD-009, versão 0.9.0)

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
| `GET /api/v1/registration/legal-documents?locale=pt-BR` | — | `200 { documents[] }` só `approved` (hoje vazio) | apenas credencial do BFF |
| `POST /api/v1/registration/complete` | `{ birthDate, documentIds[], interestIds[] }` | `200 { status: 'active' }`; revoga a sessão | Bearer, `Idempotency-Key`; `account_incomplete` |
| `GET /api/v1/catalog/interests?locale=pt-BR` | — | `200 { interests[] }` ativos, ordem estável | pública |

Headers internos BFF ↔ NestJS, nunca enviados ao navegador: `Authorization: Bearer <continuação>` (32 bytes em base64url), `X-EventMatch-Origin-Fingerprint` (HMAC da origem, 32 bytes em base64url; formato validado, jamais reconstruído a partir de `X-Forwarded-For`) e, na resposta, `X-Registration-Continuation`, que o BFF converte em cookie `HttpOnly` e remove (ADR-022). `Idempotency-Key` tem 16 a 128 caracteres `[A-Za-z0-9_-]`.

O smoke `email-delivery-test` usa o mesmo adapter e template de verificação da Brevo, mas não persiste contato, sessão ou desafio. O código recebido é fixo e inutilizável. A rota responde `404` em produção ou quando `VERIFICATION_DELIVERY_MODE` não é `brevo`; deve ser removida depois da validação operacional do provedor.

Erros: `400` forma/DTO (sem ecoar valores), `401` credencial do BFF ou continuação ausente/inválida/expirada, `409` estágio incompatível, chave em uso ou chave repetida com payload diferente, `422` regra semântica com `data.reason` ∈ {`invalid_contact`, `invalid_password`, `weak_password`, `invalid_birth_date`, `invalid_display_name`, `invalid_region`, `invalid_usage_intents`, `activation_unavailable`}; motivos que dependam de terceiros não existem. Pedido e reenvio de contato respondem `202` idênticos mesmo quando limitados, com contato retido ou falha de entrega.

Continuação e idempotência (ADR-021): a mesma chave com o mesmo payload devolve o resultado armazenado sem repetir efeito nem mensagem; se o comando original rotacionou a continuação, a repetição emite outra. O token anterior vale 60 s exclusivamente para essa repetição. O fingerprint do payload exclui senha e nascimento. Após a conclusão, os digests são anulados e qualquer repetição recebe `401`; o BFF deve tratá-lo como cadastro encerrado. O callback do link de e-mail é `GET {FRONTEND_PUBLIC_URL}/api/registration/contact-verification/confirm-link?token=…`, a ser implementado pelo BFF na TASK 07.

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
- Downloads de cópia de dados usam autenticação reforçada, URL temporária e expiração de sete dias.
- Webhooks externos exigem assinatura, replay protection, idempotência e auditoria.
- Eventos de auditoria são separados de logs comuns e têm acesso restrito.

## 7. Observabilidade e SLOs

- Métricas de latência suportam RNF013 e RNF014, segmentadas por operação sem labels com PII.
- SLO de disponibilidade mensal: 99,5%, excluída manutenção comunicada com 24 h.
- Alertas para falha de confirmação, inconsistência de vagas, atraso em notificações essenciais, erro de upload e jobs de retenção.
- Logs de segurança não expõem relato, anexo, documento, contato completo ou sinais antifraude.

## 8. Pendência jurídica

Exportação de dados, documentos excepcionais e retenção permanecem condicionados à validação jurídica brasileira: RF068, RF073, RF074, RN068, RN080–RN083, RN093, RN096, RN100–RN104, RN115–RN122, RNF023 e RNF025.
