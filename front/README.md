# Frontend EventMatch

Aplicação Next.js App Router do EventMatch. A base usa React Server Components por padrão, TanStack Query somente por meio do provider raiz, Tailwind CSS v4 sobre os tokens semânticos de `src/app/globals.css` (ADR-027) e validação de ambiente com Zod.

## Rotas

| Rota | Tipo | Uso |
|---|---|---|
| `/` | RSC | Apresentação do EventMatch e início do cadastro. |
| `/cadastro` | RSC + ilha cliente | Jornada de cadastro (SDD-010). |
| `/cadastro/concluido` | RSC | Confirmação sem dados da conta; oferece “Entrar no EventMatch” quando `AUTH_UI_ENABLED=true`. |
| `/entrar` | RSC + ilha `LoginForm` | Login por e-mail e senha (SDD-013); pessoa conectada é redirecionada a `/inicio`. |
| `/inicio` | RSC + ilhas `LogoutButton`/`SessionKeeper` | Primeira área autenticada, validada no servidor antes do render; sem dados privados. |
| `/api/registration/**`, `/api/catalog/interests`, `/api/auth/**` | Route Handlers | BFF fino para o NestJS; detalhes em `docs/04-integracoes-externas.md`. |

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
| `AUTH_UI_ENABLED` | `false` | Expõe `/entrar`, `/inicio`, login e manutenção de sessão (SDD-013). Ligue só depois de `AUTH_HTTP_ENABLED=true` no backend; o logout segue expirando o cookie mesmo desligado. |

Nenhuma dessas variáveis usa o prefixo `NEXT_PUBLIC_`. O servidor valida as variáveis em `dev`, `start` e na inicialização do container de produção. Configuração inválida encerra o processo com erro sem exibir valores recebidos.

## Validação

```bash
bun run --cwd front lint
bun run --cwd front typecheck
bun run --cwd front test
bun run --cwd front build
```

## E2E no navegador (SDD-012, ADR-032)

Pré-requisitos: Docker, `back/.env.test.local` (o mesmo do E2E do backend) e, uma vez por máquina, `bunx playwright install chromium firefox`.

```bash
bun run --cwd front test:e2e            # tudo
bun run --cwd front test:e2e --project=chromium-desktop -g "caminho feliz"
```

O script `scripts/test-front-e2e.sh` sobe PostgreSQL, Brevo falso e NestJS em containers, faz `next build` + `next start` no host (`NODE_ENV=test`, `EDGE_PROVIDER=fixture`, porta `FRONT_E2E_PORT`, padrão `3100`), roda o Playwright com Bun e derruba tudo ao final. Os projetos são `chromium-desktop`, `chromium-mobile`, `firefox-desktop` e `destructive` (por último; aposenta os documentos legais do banco descartável). Traces e capturas só em falha, em `test-results/` e `playwright-report/` (ignorados pelo Git).

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

## Documentos legais no cadastro (SDD-011, ADR-031)

Os aceites ficam na tela da senha. O backend entrega o texto vigente de Termos de Uso, Política de Privacidade e Regras de Convivência em `content` (Markdown); `app/cadastro/page.tsx` renderiza cada texto no servidor com `LegalMarkdown` (`react-markdown`, ADR-029) e envia à ilha cliente só elementos prontos: o Markdown bruto e a biblioteca não entram no bundle do navegador. HTML embutido e imagens são descartados; apenas links `https:` (nova aba, com `rel="noopener noreferrer"`) e `mailto:` ficam ativos.

`TermsConsent` mostra “Li e concordo com os **Termos de Uso**” (e as outras duas linhas), em que o nome do documento abre o texto num `<dialog>` nativo (`components/client/ui/dialog.tsx`) com **Aceitar** e **Recusar**. Aceitar marca a caixa; a caixa sozinha nunca marca (clicar nela abre o documento). Recusar abre o aviso “Sem os três aceites, sua conta não é ativada”, com **Rever documentos** e **Cancelar cadastro**. Versão e vigência não são exibidas. Os aceites ficam só em memória e são enviados na conclusão.

“Cancelar cadastro” (cabeçalho e aviso de recusa) chama `DELETE /api/registration`, que o BFF encaminha ao backend para expirar o cadastro na hora (ADR-030); só depois o rascunho local é apagado e a pessoa volta a `/`. Se o backend estiver indisponível, a pessoa permanece na tela com um aviso e pode tentar de novo.
