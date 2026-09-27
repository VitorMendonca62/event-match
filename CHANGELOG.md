# Changelog

## 0.9.0 — 2026-09-26

Primeira fatia HTTP pública do cadastro (SDD-009; ADR-019 a ADR-026). Mudança aditiva.

- Contrato v1 em `/api/v1/registration`: elegibilidade por nascimento antes do contato, pedido/reenvio/confirmação de e-mail por OTP ou link de uso único, senha, dados obrigatórios, snapshot de retomada, documentos aprovados e conclusão; `GET /api/v1/catalog/interests` público. OpenAPI com DTOs, headers internos e exemplos fictícios; versão Swagger `0.9.0`.
- Continuação opaca de 32 bytes, persistida só como HMAC (`REGISTRATION_FLOW_SECRET`), com estágios, TTL por etapa, rotação nas mudanças de privilégio, token anterior por 60 s somente para repetir a mesma requisição idempotente e revogação na conclusão. IDs internos nunca vêm do navegador.
- Idempotência por `Idempotency-Key`: repetição devolve o resultado armazenado sem repetir efeito ou mensagem; payload diferente → `409`. Senha e nascimento ficam fora do fingerprint. Transição da sessão e resultado são gravados na mesma transação do efeito de negócio.
- Rotas de cadastro exigem `X-EventMatch-BFF-Token` (`BFF_INTERNAL_TOKEN`), respondem `Cache-Control: no-store` e ficam desligadas por `REGISTRATION_HTTP_ENABLED=false` até o BFF da TASK 07.
- Limite de dez desafios por origem/hora com fingerprint HMAC vinda do BFF (`X-EventMatch-Origin-Fingerprint`), sem IP no backend.
- Entrega real por e-mail com o SDK oficial `@getbrevo/brevo@6.0.3`: template `verification-email/v2` estilizado com a paleta do EventMatch, OTP e link, timeout cancelável de 5 s, até duas novas tentativas classificadas e UUID estável em `headers.idempotencyKey`. O plano gratuito com remetente individual viabiliza o MVP sem domínio (ADR-026). `VERIFICATION_DELIVERY_MODE` passa a ser obrigatório; `noop` é recusado em produção. WhatsApp é rejeitado pela validação (ADR-025).
- Smoke temporário `POST /api/v1/registration/email-delivery-test`, protegido pelo token do BFF e idempotência, disponível somente fora de produção com Brevo ativo; não persiste contato nem cria desafio.
- Migration `0003_registration_flow_session` (aditiva): `registration_flow_session`, `registration_idempotency` e índice único parcial de `contact_verification.link_token_digest`. `ExpireStaleRegistrations` anula digests de sessões vencidas.
- Erros de domínio mapeados para `400`/`401`/`409`/`422` com `data.reason` seguro nos `422`.
- Testes: fluxo de aplicação, HTTP in-process com snapshot do contrato OpenAPI, contrato do adapter Brevo contra transporte fake (incluindo cancelamento real por `AbortSignal`), integração PostgreSQL (constraints, upgrade `0002`→`0003`, concorrência entre réplicas, limite por origem) e E2E em container com Brevo fake.
- **Ação necessária:** defina `REGISTRATION_FLOW_SECRET`, `BFF_INTERNAL_TOKEN` e `VERIFICATION_DELIVERY_MODE` nos `.env` locais (veja `back/.env.example`). O Compose de produção passa a repassar também as chaves `CONTACT_*`/`VERIFICATION_SECRET_KEY`, antes ausentes.

## 0.8.1 — 2026-09-26

Correções da revisão de código da SDD-007 (sem contrato HTTP público).

- Data de nascimento sai de `SaveRequiredData` (RF004 exige apenas nome, região e intenção) e passa a ser informada em `CompleteRegistration`; nascimento de menor não é persistido.
- Pedido de verificação: novo pedido substitui o desafio aberto em vez de falhar no índice único; desafio bloqueado impede novo desafio; consentimento de WhatsApp é persistido; contato retido recebe `recovery_notice` neutro; corrida de pedidos responde de forma neutra.
- Reenvio: limite por contato/hora aplicado ao dono do desafio, novo OTP a cada reenvio e entrega com chave de idempotência própria.
- Verificação: tentativa após a quinta falha não é contada (antes violava `CHECK`); apenas erros de domínio viram resposta neutra.
- Expiração lazy (ADR-017) em pedido, início de cadastro, dados obrigatórios e ativação; expiração anula credencial, perfil, intenções e interesses.
- Ativação condicional a `account_incomplete`; unicidade `23505` traduzida para erro tipado; IDs malformados tratados como inexistentes.
- Migration `0002_registration_hardening`: estado `converted`, `registration.key_version`, `CHECK`s de coerência com ramos explícitos (linhas terminais e contatos liberados não retêm nenhum campo), normalização de dados anteriores à `0002` e colunas anuláveis para minimização (ADR-018).
- Ativação lê documentos aprovados com `FOR SHARE`, impedindo sua retirada até o commit (ADR-013).
- Segredos exigem base64 padrão; `CONTACT_ENCRYPTION_KEY` com exatamente 32 bytes. Placeholders passam a ser rejeitados: **gere novas chaves nos arquivos `.env` locais**.
- Lista de senhas comuns com origem, licença e SHA-256 registrados (ADR-018) e copiada para `dist/` no build.
- Eventos estruturados de telemetria sem PII, registrando apenas ids de desafios existentes (nunca a entrada de quem chama); regra dos três documentos obrigatórios movida para o domínio; erros de domínio tipados; casos de uso, repositórios e mapeadores separados por arquivo.
- Testes: unitários de domínio, casos de uso, adapters, mapeadores e DI; integração PostgreSQL em banco efêmero com concorrência entre dois pools; readiness 503 em processo.
- Runners de teste aguardam o healthcheck do Compose (`up --wait`) e codificam usuário e senha na URL do banco; o setup do banco efêmero libera conexões e remove o banco em qualquer falha.

## 0.8.0 — 2026-09-26

- Adiciona o schema PostgreSQL do cadastro, migration revisável e seed idempotente do catálogo de interesses.
- Adiciona a base de proteção criptográfica de contatos, OTP/link e hash Argon2id de senha.

## 0.7.0 — 2026-09-25

- Documenta a modelagem conceitual do fluxo de cadastro.
