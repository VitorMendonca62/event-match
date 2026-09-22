# Frontend EventMatch

Aplicação Next.js App Router do EventMatch. A base usa React Server Components por padrão, TanStack Query somente por meio do provider raiz e validação de ambiente com Zod.

## Pré-requisitos

- Bun 1.3.14 ou compatível
- Docker e Docker Compose (opcional)

## Instalação e execução local

Na raiz do repositório:

```bash
cp front/.env.example front/.env.local
bun install
bun run --cwd front dev
```

A aplicação fica disponível em `http://localhost:3000` por padrão.

## Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---:|---|
| `NODE_ENV` | `development` | Ambiente de execução: `development`, `test` ou `production`. |
| `PORT` | `3000` | Porta HTTP entre 1 e 65535. |
| `HOSTNAME` | `0.0.0.0` | Interface de escuta não vazia. |

O servidor valida essas variáveis antes de iniciar. Configuração inválida encerra o processo com erro sem exibir valores recebidos.

## Validação

```bash
bun run --cwd front lint
bun run --cwd front typecheck
bun run --cwd front test
bun run --cwd front build
```

## Docker

Desenvolvimento com hot reload:

```bash
docker compose -f docker-compose.front.dev.yml up --build
```

Produção:

```bash
docker compose -f docker-compose.front.yml up --build
```

A imagem de produção é multi-stage, executa sem volume de código-fonte e usa usuário sem privilégios de root.
