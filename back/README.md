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

O preflight Zod roda antes de iniciar o processo. Em falha, o processo encerra sem abrir porta e informa apenas a chave e o motivo da validação, nunca o valor recebido.

## Contratos técnicos

`GET /health` não exige autenticação e retorna:

```json
{
  "data": { "status": "ok" },
  "message": "API disponível",
  "statusCode": 200
}
```

Todas as respostas HTTP com corpo usam `data` (objeto), `message` (string) e `statusCode` (valor numérico de `HttpStatus`). Não há banco, ORM, migration ou integração externa nesta fundação.

## Validação

```bash
bun run --cwd back lint
bun run --cwd back typecheck
bun run --cwd back test
bun run --cwd back test:e2e
bunx @nestjs/cli info
```

## Docker

Desenvolvimento com watch:

```bash
docker compose -f docker-compose.back.dev.yml up --build
```

Produção:

```bash
docker compose -f docker-compose.back.yml up --build
```

A imagem de produção é multi-stage, usa instalação congelada, não monta código-fonte e executa como usuário sem privilégios de root.
