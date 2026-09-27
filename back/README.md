# Backend EventMatch

API NestJS do EventMatch. Expõe o health check técnico e contém a persistência interna do fluxo de cadastro (casos de uso sem rotas HTTP), mantendo domínio/aplicação independentes do framework e da persistência.

## Pré-requisitos

- Bun 1.3.14 ou compatível
- Docker e Docker Compose (opcional)

## Instalação e execução local

Na raiz do repositório:

```bash
cp back/.env.example back/.env
bun install
bun run --cwd back start:dev
```

A API responde em `http://localhost:3001`. O Swagger fica disponível em `http://localhost:3001/docs` quando habilitado.

## Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---:|---|
| `NODE_ENV` | `development` | Ambiente: `development`, `test` ou `production`. |
| `PORT` | `3001` | Porta HTTP entre 1 e 65535. |
| `HOSTNAME` | `0.0.0.0` | Interface de escuta não vazia. |
| `SWAGGER_ENABLED` | `true` | Habilita ou desabilita o Swagger (`true`/`false`). |
| `SWAGGER_PATH` | `docs` | Caminho do Swagger. |
| `DATABASE_URL` | — | URL PostgreSQL `postgres://` ou `postgresql://`, obrigatória e nunca registrada em logs; não aceita parâmetros TLS/SSL na query string. |
| `DATABASE_POOL_MAX` | `1` | Limite fixo de uma conexão nesta fundação. |
| `DATABASE_IDLE_TIMEOUT_MS` | `10000` | Tempo de ociosidade do pool. |
| `DATABASE_CONNECTION_TIMEOUT_MS` | `2000` | Timeout para adquirir conexão. |
| `DATABASE_STATEMENT_TIMEOUT_MS` | `5000` | Timeout de statement PostgreSQL. |
| `DATABASE_SSL_MODE` | conforme ambiente | `disable` em desenvolvimento/teste; `require` em produção, sempre com validação de certificado. |
| `CONTACT_HASH_KEY` | — | Base64 padrão com ao menos 32 bytes; índice cego HMAC dos contatos e limites de abuso. |
| `CONTACT_ENCRYPTION_KEY` | — | Base64 padrão com exatamente 32 bytes; cifra AES-256-GCM dos contatos. |
| `VERIFICATION_SECRET_KEY` | — | Base64 padrão com ao menos 32 bytes; digest HMAC de OTP e links. |
| `REGISTRATION_FLOW_SECRET` | — | Base64 padrão com ao menos 32 bytes; digest HMAC das continuações, chaves de idempotência e payloads (ADR-021). |
| `BFF_INTERNAL_TOKEN` | — | Base64 padrão com ao menos 32 bytes, compartilhado apenas com o BFF Next.js; exigido em `X-EventMatch-BFF-Token` (ADR-023). |
| `REGISTRATION_HTTP_ENABLED` | `false` | Liga as rotas `/api/v1/registration`; desligadas respondem `404` até o BFF da TASK 07 existir. |
| `VERIFICATION_DELIVERY_MODE` | — | `brevo` ou `noop`, sempre explícito. `noop` não envia nada e é recusado com `NODE_ENV=production`. |
| `BREVO_API_KEY` | — | Obrigatória em `brevo`. Guarde somente em `.env` local ou no cofre da plataforma. |
| `EMAIL_FROM` | — | Obrigatório em `brevo`, por exemplo `EventMatch <remetente-verificado@example.com>`. Para o MVP sem domínio, verifique esse remetente individual na Brevo. |
| `FRONTEND_PUBLIC_URL` | — | Obrigatória em `brevo`; base do link de confirmação (`/api/registration/contact-verification/confirm-link`). `https` em produção. |
| `BREVO_BASE_URL` | `https://api.brevo.com/v3` | Só muda em testes contratuais/E2E com servidor fake; `https` em produção. |

Gere cada chave com `openssl rand -base64 32`. Valores vazios, placeholders ou base64 inválido fazem o preflight falhar. Perder `CONTACT_ENCRYPTION_KEY` torna os contatos cifrados ilegíveis; trocar `CONTACT_HASH_KEY` invalida a unicidade dos contatos existentes. Mantenha as chaves em cofre e não as rotacione sem migration de reprocessamento.

O preflight Zod roda antes de iniciar o processo. Em falha, o processo encerra sem abrir porta e informa apenas a chave e o motivo da validação, nunca o valor recebido. A política TLS vem exclusivamente de `DATABASE_SSL_MODE`; parâmetros TLS/SSL em `DATABASE_URL` são rejeitados para impedir que sobrescrevam a validação de certificado do pool.

## Contratos técnicos

`GET /health` não exige autenticação e verifica apenas a disponibilidade do processo. `GET /health/readiness` consulta PostgreSQL e retorna `503` com envelope seguro quando a dependência está indisponível.

`GET /health` retorna:

```json
{
  "data": { "status": "ok" },
  "message": "API disponível",
  "statusCode": 200
}
```

Todas as respostas HTTP com corpo usam `data` (objeto), `message` (string) e `statusCode` (valor numérico de `HttpStatus`). Drizzle ORM e `pg` ficam restritos à infraestrutura.

O contrato v1 do cadastro (`/api/v1/registration/*` e `GET /api/v1/catalog/interests`) está descrito em `docs/04-integracoes-externas.md` e no OpenAPI (`/docs`). As rotas de cadastro são internas ao BFF: exigem `X-EventMatch-BFF-Token` e ficam desligadas até `REGISTRATION_HTTP_ENABLED=true`. No MVP gratuito, verifique um remetente individual na Brevo e use-o em `EMAIL_FROM`; sem domínio autenticado, a Brevo pode reescrever o remetente para um endereço técnico próprio. Antes de um lançamento comercial, configure um domínio com SPF/DKIM.

Para o smoke operacional da Brevo, `POST /api/v1/registration/email-delivery-test` aceita `{ "contact": "destino@example.com" }` com `X-EventMatch-BFF-Token` e `Idempotency-Key`. A rota existe somente fora de produção quando `VERIFICATION_DELIVERY_MODE=brevo`, não grava contato nem cria desafio e envia um código ilustrativo `000000`. Remova-a após validar o ambiente.

## Persistência

O módulo técnico cria um pool `pg` singleton com no máximo uma conexão e uma instância Drizzle sobre ele. Os schemas pertencem aos módulos `registration`, `profiles` e `catalog`; migrations são versionadas em `back/drizzle/`. Não use `drizzle-kit push`.

Antes do deploy, execute uma única vez `bun run --cwd back db:migrate`. O rollout é aditivo; rollback consiste em reimplantar a API anterior mantendo as tabelas e os segredos para preservar a legibilidade dos dados. Correções de schema são sempre forward-fix por nova migration.

A migration `0002_registration_hardening.sql` (ADR-018) altera `CHECK`s de `registration`, adiciona `registration.key_version` com backfill e torna anuláveis colunas que a expiração anula. Ela precisa rodar antes do deploy da versão que a usa; a versão anterior da API continua compatível com o schema novo.

`bun run --cwd back build` compila e copia `common-passwords.txt` para `dist/` (`build:assets`), pois o adapter de senhas comuns lê o arquivo na inicialização. A origem da lista está em `src/modules/registration/infrastructure/security/data/SOURCE.md`.

Os casos de uso do cadastro registram um evento JSON por resultado no contexto `Registration` (`registration.verification.requested`, `registration.account.activation` etc.), apenas com ids opacos, canal e código de resultado. Contato, OTP, senha e URL de banco nunca aparecem em logs.

## Validação

```bash
bun run --cwd back lint
bun run --cwd back typecheck
bun run --cwd back test
bun run --cwd back test:e2e
bun run --cwd back test:integration # requer DATABASE_INTEGRATION_URL
bunx @nestjs/cli info
bun run --cwd back db:check
```

Para executar a integração com PostgreSQL descartável, sem manter containers, volumes ou rede ao final:

```bash
./scripts/test-back-integration.sh
```

Os E2E validam os containers `back` e `postgres` com HTTP real:

```bash
./scripts/test-back-e2e.sh
```

O teste de integração do cadastro cria um banco efêmero `eventmatch_it_<aleatório>` no PostgreSQL de `DATABASE_INTEGRATION_URL` (o usuário precisa de `CREATEDB`), aplica as migrations com o migrator do Drizzle, usa dois pools independentes para os cenários de concorrência e remove o banco ao final.

O E2E do cadastro sobe também o serviço `fake-brevo` (`back/test/support/fake-brevo-server.ts`), apontado por `BREVO_BASE_URL`; nenhuma mensagem sai da rede do Compose. `REGISTRATION_FLOW_SECRET` e `BFF_INTERNAL_TOKEN` são gerados por execução quando ausentes de `back/.env.test.local`.

Os runners usam `docker-compose.back.test.yml` e carregam obrigatoriamente `back/.env.test.local`, isolado dos ambientes de desenvolvimento e produção e sem volumes persistentes. Crie-o a partir de `back/.env.test.example` e gere chaves próprias para teste.

Para validar PostgreSQL real sem criar schema persistente, suba somente o serviço descartável e execute o teste de integração:

```bash
export POSTGRES_PASSWORD='local-only-password'
docker compose -f docker-compose.back.dev.yml up -d postgres
export DATABASE_INTEGRATION_URL="postgresql://eventmatch:${POSTGRES_PASSWORD}@localhost:5432/eventmatch"
bun run --cwd back test:integration
docker compose -f docker-compose.back.dev.yml down
```

## Docker

Desenvolvimento com watch:

```bash
export POSTGRES_PASSWORD='local-only-password'
export DATABASE_URL="postgresql://eventmatch:${POSTGRES_PASSWORD}@postgres:5432/eventmatch"
docker compose -f docker-compose.back.dev.yml up --build
```

Produção:

```bash
docker compose -f docker-compose.back.yml up --build
```

A imagem de produção é multi-stage, usa instalação congelada, não monta código-fonte e executa como usuário sem privilégios de root.
