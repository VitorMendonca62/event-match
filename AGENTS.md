# AGENTS.md

Fonte de verdade operacional para agentes de IA. Código e testes prevalecem sobre documentação; corrija divergências na mesma mudança.

## 1. Contexto do projeto

O **EventMatch** conecta pessoas com 18 anos ou mais por interesses e atividades locais, para amizade, companhia e descoberta da cidade; não é um aplicativo de namoro. O escopo funcional canônico é `docs/DER-EventMatch-MVP.md` v1.3. Requisitos de retenção, cópia de dados e documentos excepcionais destacados no DER dependem de validação jurídica brasileira antes do lançamento.

Monorepo TypeScript com:

- `front/`: Next.js App Router + React, incluindo Route Handlers apenas para BFF/proxy quando necessário.
- `back/`: NestJS com arquitetura hexagonal, responsável pela API de negócio e pelo PostgreSQL.
- Bun como runtime, gerenciador de pacotes e executor principal.

| Campo | Valor |
|---|---|
| Plataforma | Web full-stack |
| Produto | EventMatch MVP |
| Fonte funcional | `docs/DER-EventMatch-MVP.md` v1.3 |
| Frontend | Next.js + React + TypeScript |
| Backend | NestJS + TypeScript + arquitetura hexagonal |
| Banco | PostgreSQL, acessado somente pelo backend |
| API | NestJS; Route Handlers do frontend limitados a BFF/proxy |
| Runtime/package manager | Bun |
| Owners/versão/release | A definir nos manifests e pipeline |

## 2. Comandos do projeto

Ainda não existem manifests. Estes são os comandos-alvo e devem ser confirmados após a inicialização.

| Comando | Descrição | Quando usar |
|---|---|---|
| `bun install` | Instala dependências do workspace. | Setup ou mudança no lockfile. |
| `bun run --cwd front dev` | Inicia o Next.js. | Desenvolvimento do frontend. |
| `bun run --cwd back start:dev` | Inicia o NestJS em watch. | Desenvolvimento do backend. |
| `bun run --cwd front build` | Build do frontend. | Antes de commit/PR. |
| `bun run --cwd back build` | Build do backend. | Antes de commit/PR. |
| `bun run --cwd front test` | Testes do frontend. | Durante a implementação e antes de PR. |
| `bun run --cwd back test` | Testes unitários do backend. | Durante a implementação e antes de PR. |
| `bun run --cwd back test:e2e` | Testes E2E da API. | Antes de PR. |
| `bun run --cwd front lint` | Lint do frontend. | Após alterações. |
| `bun run --cwd back lint` | Lint do backend. | Após alterações. |
| `bun run --cwd front typecheck` | Checagem TypeScript do frontend. | Após mudanças de contrato. |
| `bun run --cwd back typecheck` | Checagem TypeScript do backend. | Após mudanças de contrato. |
| `bun run --cwd back db:migrate` | Aplica migrations PostgreSQL. | Após revisão da migration. |
| `bunx @nestjs/cli info` (em `back/`) | Inspeciona ambiente NestJS. | Diagnóstico de configuração/DI. |

Não use npm, pnpm ou yarn sem ADR aceito. Não crie scripts ausentes apenas para fazer validações passarem.

## 3. Arquitetura e padrões

| Área | Padrão |
|---|---|
| Frontend | App Router; React Server Components por padrão; Client Components só para interatividade. |
| BFF | `front/src/app/api/**/route.ts`, apenas para composição/proxy necessário ao frontend. |
| API de negócio | Controllers NestJS em adaptadores de entrada do backend. |
| Domínio backend | Entidades, value objects, serviços de domínio e portas; sem NestJS, ORM ou HTTP. |
| Aplicação backend | Casos de uso que dependem de portas do domínio; sem detalhes de infraestrutura. |
| Infraestrutura backend | Adaptadores PostgreSQL, mensageria e integrações externas. |
| Composição | Módulos NestJS conectam portas a adaptadores via tokens e injeção pelo construtor. |
| Decisões | Um ADR por decisão arquitetural material em `docs/adrs/`. |

Fluxos:

```text
Browser -> front/ Next.js -> back/ NestJS -> PostgreSQL
Browser -> front/ Route Handler (BFF opcional) -> back/ NestJS

back/presentation -> application/use-case -> domain/port
                                            <- infrastructure/adapter
```

Regras de negócio não vivem em controllers, Route Handlers, DTOs, ORM entities ou adapters.

### Estrutura de pastas

```text
front/
├── src/
│   ├── app/
│   │   ├── api/<recurso>/route.ts
│   │   ├── (routes)/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── server/
│   │   └── client/
│   └── shared/
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/

back/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── modules/
│   │   └── <bounded-context>/
│   │       ├── domain/
│   │       │   ├── entities/
│   │       │   ├── value-objects/
│   │       │   ├── services/
│   │       │   └── ports/
│   │       │       ├── inbound/
│   │       │       └── outbound/
│   │       ├── application/
│   │       │   ├── use-cases/
│   │       │   └── contracts/
│   │       ├── infrastructure/
│   │       │   ├── persistence/
│   │       │   └── integrations/
│   │       ├── presentation/
│   │       │   └── http/
│   │       │       ├── controllers/
│   │       │       └── dto/
│   │       └── <bounded-context>.module.ts
│   └── shared/
│       ├── domain/
│       ├── infrastructure/
│       └── presentation/
└── test/
    ├── unit/
    ├── integration/
    └── e2e/

docs/
├── 01-visao-geral-arquitetura.md
├── 02-regras-de-negocio.md
├── 03-modelos-de-dominio.md
├── 04-integracoes-externas.md
└── adrs/
specs/
├── tasks.txt
└── sdd-<NNN>-<slug>/tasks.md
```

## 4. Princípios de decisão e ADRs

- Tarefas não triviais exigem plano em `specs/`.
- Decisões sobre camadas, limites front/back, contratos, persistência, ORM, segurança, cache, observabilidade ou deploy exigem ADR próprio.
- Ciclo: `proposed` no planejamento; `accepted` antes da implementação; `rejected` se descartado; `superseded` quando substituído.
- Não edite silenciosamente ADR aceito. Crie outro e mantenha links bidirecionais.

| Alteração | Documentos obrigatórios |
|---|---|
| Arquitetura, dependências ou limites | `docs/01-*` + ADR |
| Regra de negócio | `docs/02-*` |
| Domínio ou schema PostgreSQL | `docs/03-*` + ADR quando material |
| Endpoint, BFF ou integração | `docs/04-*` + ADR quando material |
| Breaking change | anteriores + `CHANGELOG.md` + bump de versão |

## 5. Convenções de código

- TypeScript estrito; `any` apenas com justificativa documentada.
- Tipos/classes/componentes: `PascalCase`; funções/variáveis: `camelCase`; pastas/rotas: `kebab-case`; constantes/tokens: `UPPER_SNAKE_CASE`.
- PostgreSQL é acessado somente por adapters em `back/src/**/infrastructure/persistence`.
- Use queries parametrizadas/ORM, pool, migrations versionadas e transações por unidade de negócio.
- Portas são interfaces/tokens estáveis; adapters implementam portas. Domínio e aplicação não importam NestJS ou ORM.
- Configuração somente via `ConfigModule` e ambiente; nunca hardcode hosts, portas, credenciais ou segredos.
- Logs estruturados não incluem tokens, cookies, senhas, PII ou stack traces internos em respostas.
- Cache exige chave, escopo, TTL, invalidação, consistência, fallback e ADR/justificativa.

### NestJS obrigatório

- Use a skill [`nestjs-expert`](/home/vitor/.codex/skills/nestjs-expert/SKILL.md) em planejamento, implementação e revisão do backend.
- Serviços/adapters NestJS usam `@Injectable()` e constructor injection; nunca instancie serviços com `new`.
- Habilite `ValidationPipe` global. Todos os corpos/parâmetros HTTP usam DTOs com `class-validator`.
- Documente endpoints com Swagger: `@ApiTags`, `@ApiOperation` e decorators de resposta.
- Evite dependências circulares; `forwardRef()` é último recurso e exige justificativa.
- Erros de domínio/aplicação são tipados e independentes de HTTP; filters/adapters de apresentação os convertem em exceções/respostas HTTP tipadas.
- Teste cada caso de uso e adapter; use `Test.createTestingModule` para providers NestJS e Supertest para E2E.

### Next.js obrigatório

- Use [`vercel-react-best-practices`](/home/vitor/.agents/skills/vercel-react-best-practices/SKILL.md).
- Priorize regras `async-*`, `bundle-*` e `server-*`; cite IDs aplicáveis no plano/revisão.
- Route Handlers não duplicam a API NestJS nem acessam PostgreSQL. Quando existirem, autenticam/autorizam e delegam ao backend.
- Não mantenha estado mutável de requisição em módulos e minimize dados serializados para Client Components.

### Paleta visual obrigatória

Toda interface do EventMatch deve utilizar os tokens abaixo como paleta padrão. Centralize-os no tema global do frontend e use as variáveis semânticas, evitando valores hexadecimais avulsos em componentes.

```css
:root {
  --background: #09090b;
  --surface: #111113;
  --card: #18181b;
  --border: #2a2a2e;

  --primary: #e11d48;
  --primary-hover: #fb3c5a;
  --primary-active: #be123c;
  --primary-muted: rgba(225, 29, 72, 0.15);

  --foreground: #fafafa;
  --muted-foreground: #a1a1aa;
  --disabled: #71717a;

  --success: #22c55e;
  --warning: #f59e0b;
  --error: #f87171;
}
```

## 6. Contratos públicos

Ao alterar DTOs, OpenAPI, models exportados, enums, rotas, portas, eventos ou schema:

1. Validar necessidade no código/docs.
2. Marcar visibilidade/export explicitamente.
3. Atualizar testes unitários, integração, contratos e E2E.
4. Atualizar `docs/03-*` e/ou `docs/04-*`.
5. Criar ADR se houver decisão arquitetural.
6. Atualizar `CHANGELOG.md` e versão quando aplicável.
7. Solicitar revisão de maintainer.

## 7. Instruções para agentes

Use Conventional Commits (`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`). Inclua somente agentes que contribuíram:

| Agente | Trailer |
|---|---|
| Claude | `Co-authored-by: Claude <noreply@anthropic.com>` |
| GitHub Copilot | `Co-authored-by: GitHub Copilot <copilot@github.com>` |
| OpenAI Codex/ChatGPT | `Co-authored-by: OpenAI Codex <noreply@openai.com>` |
| Devin | `Co-authored-by: Devin AI <devin-ai-integration[bot]@users.noreply.github.com>` |

Nunca exponha segredos. Cite arquivos e linhas. Preserve alterações do usuário. Não faça commit, push ou PR sem solicitação.

## 8. Fluxo SDD

1. Registre a demanda em `specs/tasks.txt`.
2. Use `code-planner` e crie ADRs `proposed` para cada decisão material.
3. Resolva perguntas e aceite ADRs; só então marque o plano `ready`.
4. Use `code-implementer`, carregando `nestjs-expert` para backend e `vercel-react-best-practices` para frontend.
5. Use `code-reviewer`; valide arquitetura hexagonal, contratos front/back, Bun, lint, tipos, testes e builds.
6. Use `open-pull-request` somente quando explicitamente solicitado.

## 9. Skills

| Skill | Quando usar |
|---|---|
| `code-planner` | Toda tarefa não trivial. |
| `code-implementer` | Implementar plano `ready`. |
| `code-reviewer` | Revisar antes de commit/PR. |
| `nextjs-architecture` | Arquitetura do frontend/BFF. |
| `nestjs-hexagonal-architecture` | Camadas, portas e adapters do backend. |
| `vercel-react-best-practices` | Trabalho em React/Next.js. |
| `nestjs-expert` | Trabalho em NestJS. |
| `open-pull-request` | Somente por pedido explícito. |

## 10. Proibições

- Não versionar `.env`, tokens, credenciais, certificados ou dados sensíveis.
- Não acessar PostgreSQL pelo frontend.
- Não colocar regras de domínio em controllers, DTOs, ORM entities ou Route Handlers.
- Não introduzir npm/pnpm/yarn sem ADR.
- Não commitar código sem testes nem ignorar lint/typecheck sem justificativa.
- Não alterar contratos sem documentação, changelog e versionamento aplicável.
- Não decidir arquitetura sem ADR.
- Não usar `rm -rf`, `git reset --hard`, `git push -f` ou reescrever histórico sem confirmação.
- Não excluir `specs/` do Git nem carregar `open-pull-request` automaticamente.

## 11. Dependências externas

| Dependência | Versão mínima | Uso | Referência |
|---|---:|---|---|
| Bun | A definir | Runtime, pacotes, scripts e workspaces | `package.json`/`bun.lock` |
| Next.js/React | A definir | Frontend e BFF | `front/package.json` |
| NestJS | A definir | Backend/API | `back/package.json` |
| TypeScript | A definir | Tipagem full-stack | manifests |
| PostgreSQL | A definir | Persistência do backend | ambiente/migrations |
| Driver/ORM | A decidir por ADR | Adapter de persistência | `back/package.json` |
