# Changelog

## 0.11.0 — 2026-09-28

Conteúdo dos documentos legais e aceite ou recusa no cadastro (SDD-011; ADR-028, ADR-029). Mudança aditiva: o backend passa a `0.10.0` e o frontend a `0.11.0`. Rollout: aplicar a migration `0005` antes do backend `0.10.0` e depois publicar o frontend.

- O jurídico autorizou os documentos v1.0.0 e o registro de aceites em 2026-09-28 (registrado em `docs/legal/README.md` e na ADR-028). A ativação real da conta fica habilitada com os três documentos vigentes.
- Migration `0005_legal_document_content`: coluna `terms_document.content` com o texto integral dos três arquivos de `docs/legal/pt-BR/`, `CHECK` de `sha256(content) = content_digest`, `CHECK` de texto obrigatório em linhas `approved`, trigger de imutabilidade e índice de vigência. A `0004` não foi alterada.
- `GET /api/v1/registration/legal-documents` devolve o Markdown sem frontmatter em `content`, apenas a versão vigente de cada tipo, com `Cache-Control: no-store`; exemplo de `version` corrigido para `1.0.0`. `TermsRepositoryPort.listApproved/findApproved` foram substituídos por `listCurrent/findCurrent`; `CompleteRegistration` rejeita ids inexistentes, não aprovados, futuros ou de versão superada.
- Frontend: `LegalMarkdown` (Server Component, `react-markdown`) renderiza o texto no servidor. Os aceites saíram do passo “Documentos” (removido; agora sete etapas) e foram para a tela da senha (ADR-031): “Li e concordo com os Termos de Uso…”, em que o nome do documento é um link que abre o texto num diálogo com Aceitar e Recusar; a recusa abre um aviso com “Rever documentos” e “Cancelar cadastro”. Versão e vigência não são mais exibidas (a linha de versão do texto é ocultada só na exibição). Título “Regras de Convivência”. Uma nova versão durante o fluxo recarrega os documentos e descarta os aceites.
- Cancelar o cadastro executa a expiração no backend (ADR-030): novo `DELETE /api/v1/registration` (e `DELETE /api/registration` no BFF) anula o e-mail e a senha retidos, expira a conta incompleta, libera o contato e revoga a continuação. “Cancelar cadastro” (cabeçalho e aviso de recusa) usa essa chamada; com o backend indisponível a pessoa permanece na tela com um aviso.
- Testes: unidade (`LegalDocumentText`, caso de uso, controller, renderização do Markdown, estados de aceite e recusa), integração PostgreSQL (bytes, digest, `CHECK`s, trigger, vigência) e E2E (lista, recusa sem documento vigente, troca de versão).
- `baseUrl` do cliente Brevo reativado em `brevo-verification-delivery.adapter.ts`: o E2E volta a receber o OTP e o link pelo Brevo falso e passa integralmente.
- `react-markdown` fixado em `10.1.0` e `LegalMarkdown` restrito à lista de elementos e ao `urlTransform` da ADR-029.

## 0.10.0 — 2026-09-27

Jornada de cadastro no Next.js e BFF do navegador (SDD-010; ADR-011, ADR-012, ADR-019 a ADR-027). Mudança aditiva; o contrato do backend não muda (permanece em `0.9.0`).

- `/` passa a ser a apresentação “Convite Cívico”: amizade, companhia e descoberta da cidade, 18+, “Não é app de namoro” e a única ação “Começar meu cadastro”, antes de qualquer dado.
- `/cadastro` (RSC + ilha cliente) conduz nascimento → e-mail (WhatsApp desabilitado “Em breve”) → código de 6 dígitos com prazo e reenvio → senha → dados obrigatórios → documentos → interesses (mínimo 3) → revisão com novo nascimento; `/cadastro/concluido` confirma sem exibir dados da conta. Máquina de etapas explícita com estágio remoto autoritativo, ressincronização única em `409` e reinício em `401`; foco no título a cada etapa e no resumo de erro.
- Documentos sem conteúdo aprovado bloqueiam a ativação (o contrato v1 publica só metadados); nenhum placeholder jurídico é exibido fora de fixtures de teste.
- Seed jurídico `0004_seed_legal_documents`: Termos de Uso, Política de Privacidade e Regras de Convivência `pt-BR` v1.0.0 foram publicados como documentos aprovados, com UUIDs estáveis e SHA-256 dos artefatos em `docs/legal/`.
- Progresso mínimo em `sessionStorage` (schema v1, allowlist, TTL deslizante de 30 min); contato, código, senha, nascimento, aceites, tokens e chaves de idempotência nunca são gravados.
- BFF em `front/src/app/api/registration/**` e `front/src/app/api/catalog/interests`: origem/`Content-Type`/idempotência validados antes do backend, cookie `__Host-` `HttpOnly`, credencial interna, fingerprint de origem Vercel via HMAC, timeout sem retry implícito, tradução conservadora de erros, callback do link com `303` para URL limpa e logs sem PII.
- Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/postcss`, `postcss`) com a paleta padrão desativada e os tokens do `AGENTS.md` expostos como utilitários (ADR-027). Primitives reutilizáveis: `Button`/`ButtonLink`, `TextField`, `Choice`, `Notice`, `BrandMark`, ícones autorais, `StepFrame`, `ProgressRail` e `PosterHeadline`. Fontes Archivo e Figtree auto-hospedadas por `next/font`.
- `bun run --cwd front build` não executa mais `validate:env`: a configuração do BFF é validada em `dev`/`start` e no início do container de produção, e a base continua validada pelo `next.config.ts`.
- Testes: contratos, máquina de etapas, storage, countdown, cliente HTTP, renderização (copy não romântica, WhatsApp desabilitado, progresso textual, bloqueio de documentos, contador de interesses) e integração do BFF contra backend fake (origem, idempotência, cookie, 401/completo, 422/5xx/timeout, fingerprint, callback, configuração e carregamento paralelo do RSC).
- **Ação necessária:** configure `BACKEND_INTERNAL_URL`, `FRONTEND_PUBLIC_URL`, `BFF_INTERNAL_TOKEN` (igual ao do backend), `ORIGIN_FINGERPRINT_KEY` (base64, 32+ bytes) e `EDGE_PROVIDER` no `front/.env` (veja `front/.env.example`) e só então ligue `REGISTRATION_HTTP_ENABLED` no backend.

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
