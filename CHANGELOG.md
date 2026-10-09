# Changelog

## Backend 0.18.0 — 2026-10-08

Fundação backend de Eventos (SDD-025; ADR-054 a ADR-058, ADR-060 e ADR-061). Mudança aditiva; workspace/frontend permanecem sem alteração nesta entrega. O HTTP começa desligado com `EVENTS_HTTP_ENABLED=false`.

- Novo `EventsModule` hexagonal para criar, recuperar, editar, pré-visualizar e publicar rascunhos de eventos presenciais, gratuitos e informais.
- Publicação valida anfitriã elegível, catálogo de atividade, local não residencial, fuso IANA do município, janela de 24 horas a 30 dias, duração máxima de oito horas, capacidade até 12 e limites concorrentes por anfitriã.
- Migration `0014_events` cria catálogo, evento, ponto exato cifrado e auditoria; a área aproximada pública é estável e o ponto exato não é incluído em projeções públicas.
- OpenAPI, DTOs, filtros, telemetria allowlisted, testes unitários/HTTP/DI e documentação de arquitetura, domínio e integração foram atualizados. A retenção jurídica do ponto exato continua gate de lançamento.

## 0.19.1 — 2026-10-08

Dispensa do convite delegada ao BFF de perfil (SDD-024; ADR-040 e ADR-050). Refactor interno do frontend/workspace; backend permanece em `0.17.0`, sem migration ou alteração de contrato.

- A rota `POST /api/profile/invitation/dismiss` agora delega para `profile-bff.ts`, preservando autenticação, proteção same-origin/JSON, envelope, cookies, mapeamento de erros e telemetria allowlisted.
- A cobertura de integração valida sucesso, bloqueios locais, sessão, respostas upstream, privacidade e regressão dos proxies de catálogo da SDD-021.
- Rollback operacional: reverter o artefato frontend para `0.19.0` ou desligar `PROFILE_UI_ENABLED`; não há dados ou schema a reverter.

## 0.19.0 — 2026-10-08

Localização estruturada por UF e município (SDD-023; ADR-052 e ADR-053). Breaking change coordenada: frontend/workspace `0.19.0`, backend `0.17.0`, contrato v1.

- Cadastro e perfil deixam de aceitar `region` textual e passam a exigir `ufCode` + `municipalityCode` IBGE. `GET /profiles/me` e a prévia projetam `location` com município, UF e códigos estáveis; completude passa a exigir localização.
- Migration `0013_structured_location_catalog` cria o catálogo local versionado das 27 UFs e 5.571 municípios oficiais do IBGE, com checksum, fonte, busca normalizada limitada a 20 resultados e Brasília (`5300108`) em `DF`. O runtime não consulta o IBGE.
- Novos endpoints públicos `/api/v1/catalog/federative-units` e `/api/v1/catalog/municipalities?uf=XX&q=...`, além dos proxies BFF sem credencial, cookie ou sessão. A UI usa seleção UF → combobox de município com debounce, cancelamento, estados de erro e suporte a teclado.
- A troca é forward-only e destrutiva para dados legados de desenvolvimento/teste: `profile.region` é removido sem inferência e a migration falha fechada se houver perfil legado, exigindo ambiente limpo. Rollback antes de produção é operacional, restaurando schema/seed anterior; correções posteriores exigem nova migration/ADR.

## 0.18.0 — 2026-10-07

Padronização dos proxies BFF de catálogos (SDD-021; ADR-050). Refactor interno do frontend/workspace; backend permanece em `0.16.0` e não há migration ou alteração de contrato NestJS.

- Interesses, idiomas e preferências de atividades agora delegam para `front/src/shared/server/catalog-bff.ts`, com dependências injetáveis, uma chamada pública por requisição, filtros estritos e falha fechada.
- As três rotas mantêm query, envelope, mensagens, status e headers públicos; nenhum token, cookie, sessão ou dado extra é enviado ao backend.
- `server-only` passa a ser dependência direta do frontend e protege os módulos server-side que leem ambiente ou chamam o backend. Uma fixture de build cobre a tentativa de importação por Client Component.
- Não há migration nem rollback de dados. Rollback operacional: reverter o frontend/workspace para `0.17.0`; a API e o banco permanecem inalterados.

## 0.17.0 — 2026-10-07

Presença social opcional no perfil (SDD-020; ADR-049). Mudança aditiva coordenada: frontend/workspace `0.17.0`, backend `0.16.0`. Rollout: desligar `PROFILE_UI_ENABLED`, aplicar `0012_profile_social_links`, publicar backend e depois frontend, executar smoke de perfil/prévia e religar a UI.

- Perfil aceita zero a três vínculos, um por Instagram, LinkedIn ou X, com posição e audiência independente privada por padrão. A edição aceita identificador ou URL HTTPS allowlisted, normaliza e persiste somente o identificador canônico; a URL é derivada sem fetch, OAuth, verificação ou redirecionamento.
- `PUT /api/v1/profiles/me` exige `socialLinks[]` no snapshot completo; `GET` próprio expõe os vínculos e a prévia própria expõe apenas os `authenticated`, sem ids ou audiência. Completude, interesses, preferências, capacidades e eventos não mudam.
- `/perfil` ganha seção acessível após “Identidade e comunicação”, com três campos fixos (Instagram, LinkedIn e X), marca visual, ajuda por provedor, um toggle global de compartilhamento futuro e cópia explícita de não verificação. Não há inclusão, remoção ou ordenação manual; os links são apresentados como links externos simples, sem preview remoto.
- Migration `0012` é forward-only, com `CHECK`s, unicidades por conta e FK em cascata. Purga e exclusão de dados removem a relação. Rollback operacional desliga a UI e preserva schema/dados para correções forward-only.

## 0.16.0 — 2026-10-06

Disponibilidade e distância preferida no perfil (SDD-018; ADR-045). Mudança aditiva na leitura: frontend/workspace `0.16.0`, backend `0.15.0`. Rollout coordenado: desligar `PROFILE_UI_ENABLED`, aplicar `0010_profile_availability_distance`, publicar backend e depois frontend, executar smoke de perfil/prévia e religar a UI.

- Perfil aceita zero a 28 combinações únicas de dia da semana e período fixo (madrugada, manhã, tarde e noite) e uma faixa opcional de distância (até 2/5/10/25 km ou mesma cidade). Os campos são removíveis, privados e não alteram completude, capacidades ou eventos.
- **Contrato:** `GET /api/v1/profiles/me` devolve os novos campos; `PUT /api/v1/profiles/me` exige `availabilitySlots` e `preferredDistance` no snapshot completo. A prévia permanece sem eles e o BFF falha fechado diante de resposta inválida.
- `/perfil` ganha uma grade acessível de disponibilidade e um `input[type="range"]` discreto para distância após as preferências de atividades, com botões equivalentes para clique entre navegadores, presets, limpeza explícita, texto anunciado da faixa atual, alvos de toque ≥44 px e comportamento responsivo/zoom 200%.
- Não há localização do aparelho, cálculo geográfico, filtro ou recomendação nesta entrega. Os campos não são registrados em telemetria.
- Migration `0010` é aditiva, com `CHECK`s, FK em cascata e índice; purga de expiração e exclusão removem os slots e anulam a distância. Rollback operacional preserva schema e dados.

## 0.15.0 — 2026-10-06

Preferências de atividades no perfil (SDD-017; ADR-044). Mudança aditiva na leitura: frontend/workspace `0.15.0`, backend `0.14.0`. Rollout coordenado: desligar `PROFILE_UI_ENABLED`, aplicar `0009_profile_activity_preferences`, publicar backend e depois frontend, executar o smoke de catálogo/perfil/prévia e religar a UI.

- Novo catálogo versionado `activity_preference` com as 12 opções do DER §3.10, endpoint público `GET /api/v1/catalog/activity-preferences` (`no-store`) e proxy BFF filtrado.
- Perfil aceita de zero a cinco preferências únicas, sem prioridade (ordem do catálogo), com visibilidade própria privada por padrão; item desativado já escolhido é preservável e não readicionável. Interesses, completude e capacidades não mudam.
- **Contrato:** `PUT /api/v1/profiles/me` passa a exigir `activityPreferenceCodes` e `activityPreferencesVisibility` (ausência → `400`); novos reasons `422` `unknown_activity_preference` e `inactive_activity_preference`. Leitura e prévia são aditivas.
- `/perfil` ganha a seção “Como você gosta dos encontros”, carregada em paralelo e degradada isoladamente se o catálogo falhar; `/perfil/previa` mostra a lista somente quando autorizada.
- Migration `0009` é aditiva e forward-only; purga de expiração e exclusão de conta removem a relação. Rollback operacional preserva schema e dados.

## 0.14.0 — 2026-10-03

Identidade opcional no perfil (SDD-016; ADR-043). Mudança aditiva: frontend/workspace `0.14.0`, backend `0.13.0`. Rollout coordenado: desligar `PROFILE_UI_ENABLED`, aplicar `0008_profile_optional_identity`, publicar o backend e depois o frontend, executar o smoke conjunto e somente então religar a UI; não há compatibilidade cruzada durante essa janela controlada.

- Pronomes controlados/personalizados, profissão textual e até cinco idiomas, todos opcionais, removíveis e com visibilidade independente privada por padrão; completude e capacidades permanecem inalteradas.
- Novo catálogo versionado de idiomas com endpoint público, seed de 13 itens incluindo Libras (`bzs`) e preservação de seleção histórica inativa.
- `GET /api/v1/catalog/interests` e `GET /api/v1/catalog/languages` passam a responder `Cache-Control: no-store`, como as rotas de perfil.
- Atualização do perfil mantém revisão otimista e substitui campos/relação `profile_language` atomicamente; prévia omite campos privados e `prefer_not_to_say`.
- **Contrato mais estrito:** `PUT /api/v1/profiles/me` passa a exigir a chave `presentation` (`string` ou `null`) como parte do snapshot completo; omiti-la responde `400` em vez do `500` anterior. O BFF já enviava a chave, então não há impacto no frontend. OpenAPI marca `presentation` e `photo` da visão própria como obrigatórios e anuláveis.
- `/perfil` carrega perfil, interesses e idiomas em paralelo e adiciona seção acessível “Identidade e comunicação”; `/perfil/previa` mostra somente a projeção autorizada.
- Migration `0008` é aditiva e forward-only. Rollback operacional remove a UI/rotas da publicação anterior e preserva schema/dados.
- OpenAPI versionada inclui o catálogo de idiomas; integração PostgreSQL cobre as novas tabelas, as nove migrations e a reaplicação idempotente do migrator.

## 0.13.0 — 2026-10-01

Primeiro acesso com convite e edição do perfil (SDD-015; ADR-038 a ADR-040). Mudança aditiva: frontend/workspace `0.13.0`, backend `0.12.0`; aplicar `0007_profile_completion` e publicar inicialmente com `PROFILE_HTTP_ENABLED=false`, `PROFILE_MEDIA_ENABLED=false` e `PROFILE_UI_ENABLED=false`.

- O contexto `profiles` passa a oferecer agregado editável, completude derivada, projeção autenticada, visibilidade privada/autenticada e revisão otimista; atualizações de nome, região, intenções, interesses e apresentação são atômicas.
- API interna `/api/v1/profiles/me`, `/preview` e subrotas de foto com sessão/capacidades, DTOs validados, Swagger, `no-store` e erros allowlisted. BFFs Next.js filtram respostas, aplicam same-origin/JSON e nunca expõem o sujeito do convite nem segredos do provedor.
- Foto principal privada no Cloudinary por upload direto assinado: grant curto, verificação server-side, consulta autoritativa, variantes autenticadas, substituição/remoção e cleanup operacional `bun run --cwd back profile-media:cleanup`.
- A ADR-041 foi rejeitada e a ADR-042 remove `expiresAt` da foto e `PROFILE_PHOTO_DELIVERY_TTL_SECONDS`: a URL de entrega permanece assinada e restrita à titular, mas não promete expiração; o prazo de cinco minutos continua somente no grant de upload.
- `/inicio` mostra progresso real e permite adiar por sete dias em cookie HttpOnly vinculado a um sujeito HMAC da conta. `/perfil` edita o perfil e recorta a foto; `/perfil/previa` exibe somente a projeção permitida.
- Migration `0007` amplia `profile` e cria `profile_photo_asset`/`profile_media_attempt`, com unicidade parcial e índices de lifecycle. Rollback é operacional por flags; schema e assets são preservados para correção forward-only.
- **Ação necessária:** concluir avaliação jurídica/privacidade do Cloudinary, configurar preset assinado com entrega autenticada, Strict Transformations, `fl_force_strip` e variantes 512/128 antes de ligar mídia em produção.

## 0.12.0 — 2026-09-29

Login, sessão e primeiro acesso após o cadastro (SDD-013; ADR-033 a ADR-037). Mudança aditiva: o backend e o Swagger passam a `0.11.0`; a raiz e o frontend, a `0.12.0`. Rollout: aplicar a migration `0006` antes do backend, publicar com `AUTH_HTTP_ENABLED=false` e `AUTH_UI_ENABLED=false`, validar e ligar primeiro o backend e depois a UI.

- Novo bounded context `identity-access` (`IdentityAccessModule`, hexagonal): `AuthenticateAccount`, `ResolveAuthenticatedSession` e `Logout`; entidade `AuthenticatedSession` com 12 h/30 min (padrão) ou 30 d/7 d (“Manter conectado”), atividade gravada no máximo a cada 5 min, rotação a cada 24 h só no modo lembrado, digest anterior válido por 60 s, até cinco sessões com remoção da menos recentemente usada, e revogação no logout. Somente conta `active` recebe sessão; estado e capacidade são reavaliados em cada requisição (`401` com revogação quando a conta deixa de estar ativa, `403` genérico para capacidade negada).
- Contrato interno `POST /api/v1/auth/login`, `GET /api/v1/auth/session` e `POST /api/v1/auth/logout` com DTOs `class-validator`, Swagger, envelope padrão e `no-store`. O token opaco de 256 bits sai só no header interno `X-EventMatch-Session`; apenas o HMAC (`AUTH_SESSION_SECRET`) é persistido. `401` idêntico para contato inexistente, senha errada e estados sem sessão comum; o caminho inexistente executa Argon2id dummy.
- Limites de login (ADR-035): 5 falhas por contato e 30 por origem em janela deslizante de 15 min, persistidos em PostgreSQL com advisory locks em ordem fixa; reserva antes da consulta e liberação em sucesso; `429` genérico, sem bloqueio permanente.
- Migration `0006_authenticated_session` (aditiva): amplia `account_status_check` para os dez estados canônicos e cria `authenticated_session` e `authentication_attempt`; snapshot/journal Drizzle atualizados. Sem downgrade destrutivo.
- Refatorações compartilhadas: `BffInternalGuard`, headers internos e `NoStoreMiddleware` extraídos para `back/src/shared/presentation/http/` (registro inalterado para o cliente); índice cego do contato em `back/src/shared/infrastructure/security/contact-blind-index.ts`. `identity-access` lê a conta por projeção somente leitura, sem importar `registration`.
- BFF `front/src/app/api/auth/{login,session,logout}`: origem/`Sec-Fetch-Site`/JSON, fingerprint de origem, cookie `__Host-eventmatch_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, sem `Domain`; não persistente por padrão, `Max-Age` até o prazo absoluto no modo lembrado), rotação transparente na manutenção, logout que sempre expira o cookie e logs `auth-bff` sem PII.
- UI (“Convite Cívico”, sem mudança em `DESIGN.md`): `/entrar` com labels persistentes, `autocomplete` de credenciais, “Manter conectado” desmarcado, envio protegido contra duplo clique, erro neutro focado e navegação por substituição para `/inicio`; `/inicio` validada no servidor, sem dados privados, com “Sair” e os próximos passos “Completar perfil” e “Descobrir encontros” marcados “Em breve”; revalidação ao focar, ficar visível ou voltar pelo histórico. `/cadastro/concluido` oferece “Entrar no EventMatch” sem autenticação automática.
- Testes: domínio, casos de uso, adapters, DI/arquitetura, HTTP/Swagger (backend unitário); upgrade `0005 → 0006`, concorrência entre duas réplicas (limites exatos, cinco sessões, rotação com um vencedor), mudança de estado e capacidade (integração PostgreSQL); login → sessão → logout, respostas neutras, `429` e recuperação, rotação só em header (E2E backend); cookie, CSRF, tradução e visão server-side (BFF); formulário e fronteiras RSC (frontend); e o E2E Playwright `tests/e2e/entrar.e2e.ts`.
- **Ação necessária:** gere `AUTH_SESSION_SECRET` (`openssl rand -base64 32`, diferente de `REGISTRATION_FLOW_SECRET`) no backend antes de ligar `AUTH_HTTP_ENABLED`; depois ligue `AUTH_UI_ENABLED` no frontend. Os runners de teste geram segredos descartáveis.

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
- Acessibilidade: novo token `--primary-foreground` (`#ffffff`, 4,7:1 sobre `--primary`; o `#fafafa` dava exatamente 4,5:1 e o axe no Firefox o reprovava) para o texto do botão primário (`DESIGN.md`, `.impeccable/design.json`). O `Dialog` ganhou `returnFocus`: ao fechar um documento reaberto por “Rever documentos”, o foco volta ao link do documento em vez de se perder.
- E2E full-stack do cadastro no navegador (SDD-012; ADR-032), só ferramentas de desenvolvimento e testes: `@playwright/test` `1.63.0` e `@axe-core/playwright` `4.13.0`; `bun run --cwd front test:e2e` (`scripts/test-front-e2e.sh`) em Chromium desktop e móvel, mais o projeto `destructive`; Firefox foi retirado da matriz em 2026-10-03 para reduzir o tempo da suíte; `FRONTEND_PUBLIC_URL` parametrizável em `docker-compose.back.test.yml`. A revisão manual com leitor de tela real foi retirada do escopo da SDD-012 (2026-09-29).
- Snapshot do Drizzle `0005_snapshot.json` adicionado e schema de `terms_document` alinhado à migration `0005` (`CHECK` de digest e índice `terms_document_current_idx`): `db:generate` não gera mais uma migration que tentava recriar `content`. Sem mudança de banco.
- “Sim, cancelar” fica desabilitado, com indicação “Cancelando…”, enquanto o cancelamento está pendente; “Continuar cadastro” também.
- Paleta obrigatória do `AGENTS.md` §5 inclui `--primary-foreground`.

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
