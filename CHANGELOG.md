# Changelog

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
