# ADR-000: Adotar arquitetura base Next.js com PostgreSQL

- **Status:** superseded
- **Data:** 2026-09-21
- **Decisores:** solicitante e mantenedores do repositório
- **Relacionado:** `specs/sdd-000-setup-sdd/tasks.md`
- **Substitui/Substituído por:** substituído por `ADR-001-separar-backend-nestjs-hexagonal-e-adotar-bun.md`

## Contexto

O repositório precisa de uma arquitetura-base para orientar o fluxo SDD antes do início do código de produção. A stack solicitada é Next.js, PostgreSQL e API do próprio Next.js.

## Drivers da decisão

- Uma única aplicação full-stack e um único modelo operacional.
- Separação entre transporte HTTP, casos de uso, domínio e persistência.
- Segurança para impedir acesso ao PostgreSQL em código enviado ao browser.
- Aderência às práticas de performance de React e Next.js da Vercel.

## Opções consideradas

1. App Router com Route Handlers e camadas internas.
2. Pages Router com API Routes legadas.
3. Backend separado do Next.js.

## Decisão

Adotar Next.js App Router. Usar React Server Components por padrão e Route Handlers em `src/app/api/**/route.ts`. Delegar regras para casos de uso e manter domínio independente de framework. Isolar PostgreSQL em infraestrutura server-only, acessada por portas de repositório.

A escolha de driver/ORM, autenticação, hospedagem, cache e schema permanece fora deste ADR e exigirá decisões próprias.

## Consequências positivas

- Contratos HTTP e UI convivem no mesmo projeto sem misturar responsabilidades.
- Menor JavaScript no cliente e acesso ao banco protegido pela fronteira do servidor.
- Casos de uso e domínio testáveis sem runtime HTTP.

## Consequências negativas e riscos

- Mais estrutura inicial que uma organização puramente por rotas.
- A equipe deve vigiar imports para não incluir módulos server-only no bundle do cliente.
- Deploys serverless podem exigir configuração cuidadosa do pool PostgreSQL.

## Plano de adoção e rollback

Adotar a estrutura conforme as features forem criadas. Se requisitos futuros exigirem backend independente, criar novo ADR que substitua este e planejar migração incremental dos contratos e casos de uso.

## Evidências e referências

- `AGENTS.md §3-6`
- `docs/01-visao-geral-arquitetura.md §1-2`
- `/home/vitor/.agents/skills/vercel-react-best-practices/SKILL.md`
