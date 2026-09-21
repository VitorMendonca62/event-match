# ADR-001: Separar backend NestJS hexagonal e adotar Bun

- **Status:** accepted
- **Data:** 2026-09-21
- **Decisores:** solicitante e mantenedores do repositório
- **Relacionado:** `specs/sdd-001-nestjs-hexagonal-bun/tasks.md`
- **Substitui/Substituído por:** substitui `ADR-000-arquitetura-base-nextjs-postgresql.md`

## Contexto

O desenho anterior colocava UI, API e persistência dentro do Next.js. O projeto agora requer frontend e backend separados no mesmo repositório, backend NestJS hexagonal e Bun como ferramenta principal.

## Drivers da decisão

- Isolar a API de negócio e o PostgreSQL do frontend.
- Proteger o domínio de NestJS, HTTP e ORM.
- Permitir adapters substituíveis e testes de casos de uso sem infraestrutura.
- Padronizar runtime, instalação e scripts com Bun.

## Opções consideradas

1. Manter API de negócio em Route Handlers.
2. Criar NestJS em camadas tradicionais acopladas ao framework.
3. Criar NestJS com arquitetura hexagonal e manter Route Handlers apenas como BFF opcional.

## Decisão

Adotar monorepo com `front/` Next.js e `back/` NestJS. O backend usa bounded contexts com `domain`, `application`, `presentation` e `infrastructure`. PostgreSQL fica exclusivamente em adapters do backend. Bun é o runtime, package manager e executor padrão.

## Consequências positivas

- Fronteiras front/back e domínio/infraestrutura explícitas.
- Melhor isolamento, testabilidade e substituição de adapters.
- API documentada pelo Swagger/OpenAPI do NestJS.

## Consequências negativas e riscos

- Mais projetos, processos e contratos para coordenar.
- Possível duplicação se BFF e NestJS não tiverem responsabilidades claras.
- Compatibilidade de dependências com Bun deve ser validada antes da adoção.

## Plano de adoção e rollback

Inicializar workspaces `front/` e `back/` somente em tarefa futura planejada. Validar dependências NestJS no Bun e manter contrato OpenAPI. Para rollback, criar novo ADR e consolidar a API, sem reativar silenciosamente o ADR-000.

## Evidências e referências

- `AGENTS.md §1-5`
- `docs/01-visao-geral-arquitetura.md`
- `/home/vitor/.codex/skills/nestjs-expert/SKILL.md`
- `/home/vitor/.agents/skills/vercel-react-best-practices/SKILL.md`
