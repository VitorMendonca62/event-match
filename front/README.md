# Frontend EventMatch

Aplicação Next.js App Router do EventMatch. A base usa React Server Components por padrão, TanStack Query somente por meio do provider raiz, Tailwind CSS v4 sobre os tokens semânticos de `src/app/globals.css` (ADR-027) e validação de ambiente com Zod.

## Rotas

| Rota | Tipo | Uso |
|---|---|---|
| `/` | RSC | Apresentação do EventMatch e início do cadastro. |
| `/cadastro` | RSC + ilha cliente | Jornada de cadastro (SDD-010). |
| `/cadastro/concluido` | RSC | Confirmação sem dados da conta. |
| `/api/registration/**`, `/api/catalog/interests` | Route Handlers | BFF fino para o NestJS; detalhes em `docs/04-integracoes-externas.md`. |

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
| `BACKEND_INTERNAL_URL` | — | URL do NestJS vista pelo servidor Next.js. |
| `FRONTEND_PUBLIC_URL` | — | Origem pública exata aceita pelo BFF; HTTPS em produção. |
| `BFF_INTERNAL_TOKEN` | — | Segredo base64 (32+ bytes) igual ao do backend. |
| `ORIGIN_FINGERPRINT_KEY` | — | Segredo base64 (32+ bytes) do HMAC da origem. |
| `EDGE_PROVIDER` | — | `vercel` (obrigatório em produção) ou `fixture` (local/testes). |
| `BACKEND_TIMEOUT_MS` | `8000` | Timeout de cada chamada ao backend, sem retry. |

Nenhuma dessas variáveis usa o prefixo `NEXT_PUBLIC_`. O servidor valida as variáveis em `dev`, `start` e na inicialização do container de produção. Configuração inválida encerra o processo com erro sem exibir valores recebidos.

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

## Documentos legais no cadastro (SDD-011)

O passo de documentos exibe o texto vigente de Termos de Uso, Política de Privacidade e Regras de Convivência, entregue pelo backend em `content` (Markdown). `app/cadastro/page.tsx` renderiza cada texto no servidor com `LegalMarkdown` (`react-markdown`, ADR-029) e envia à ilha cliente só elementos prontos: o Markdown bruto e a biblioteca não entram no bundle do navegador. HTML embutido e imagens são descartados; apenas links `https:` (nova aba, com `rel="noopener noreferrer"`) e `mailto:` ficam ativos. Aceites ficam só em memória. “Não aceito” mostra o aviso, “Rever documentos” devolve o foco ao primeiro texto sem aceite e “Sair do cadastro” limpa o rascunho local e volta a `/`, sem chamar o backend.
