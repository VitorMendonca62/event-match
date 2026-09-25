# Backend EventMatch

API NestJS do EventMatch. A fundação implementa apenas o health check técnico e mantém domínio/aplicação independentes do framework e da persistência.

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
| `DATABASE_URL` | — | URL PostgreSQL única, obrigatória e nunca registrada em logs; não aceita parâmetros TLS/SSL na query string. |
| `DATABASE_POOL_MAX` | `1` | Limite fixo de uma conexão nesta fundação. |
| `DATABASE_IDLE_TIMEOUT_MS` | `10000` | Tempo de ociosidade do pool. |
| `DATABASE_CONNECTION_TIMEOUT_MS` | `2000` | Timeout para adquirir conexão. |
| `DATABASE_STATEMENT_TIMEOUT_MS` | `5000` | Timeout de statement PostgreSQL. |
| `DATABASE_SSL_MODE` | conforme ambiente | `disable` em desenvolvimento/teste; `require` em produção, sempre com validação de certificado. |

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

Todas as respostas HTTP com corpo usam `data` (objeto), `message` (string) e `statusCode` (valor numérico de `HttpStatus`). Drizzle ORM e `pg` ficam restritos à infraestrutura; não há migration inicial nem schema físico nesta fundação.

## Persistência

O módulo técnico cria um pool `pg` singleton com no máximo uma conexão e uma instância Drizzle sobre ele. Erros de clientes ociosos do pool são consumidos e registrados somente como evento estruturado redigido; eles não derrubam a liveness e a readiness volta a refletir uma conexão recuperada. A configuração do Drizzle Kit fica em `src/shared/infrastructure/persistence/drizzle.config.ts` para o primeiro bounded context; esta tarefa não executa `generate`, `migrate` ou `push`.

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
