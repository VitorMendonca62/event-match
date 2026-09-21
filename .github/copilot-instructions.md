# Instruções para Copilot e agentes

- Leia `AGENTS.md`, plano ativo, docs e ADRs antes de editar.
- Monorepo Bun: `front/` usa Next.js; `back/` usa NestJS hexagonal e PostgreSQL.
- Não use npm, pnpm ou yarn sem ADR aceito.
- Frontend: RSC por padrão; aplique `/home/vitor/.agents/skills/vercel-react-best-practices/SKILL.md`.
- Route Handlers em `front/src/app/api` são BFF/proxy opcional e nunca acessam PostgreSQL ou duplicam regras do backend.
- Backend: carregue `/home/vitor/.codex/skills/nestjs-expert/SKILL.md`; domínio/aplicação não importam NestJS nem ORM.
- Controllers/DTOs ficam em `presentation`; casos de uso em `application`; portas/entidades em `domain`; adapters em `infrastructure`.
- Use DI por construtor, DTOs validados, `ValidationPipe`, Swagger, erros tipados, testes unitários e E2E.
- Cada decisão arquitetural material exige ADR `proposed`, aceito antes da implementação.
- Rode comandos Bun de lint, typecheck, testes e build disponíveis. Nunca exponha segredos.
- Não abra PR sem invocação explícita de `open-pull-request`.
