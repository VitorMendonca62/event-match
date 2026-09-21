# Task: Separar backend NestJS hexagonal e adotar Bun

- **Slug:** nestjs-hexagonal-bun
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-21
- **Status:** ready
- **Versão-alvo:** 0.2.0
- **Tipo:** refactor
- **Impacto público:** none

## 1. Contexto e Motivação

Evoluir a governança de uma aplicação Next.js full-stack para monorepo com frontend Next.js e backend NestJS hexagonal. Origem: `specs/tasks.txt`. Referências: `docs/01-visao-geral-arquitetura.md` e ADR-001.

## 2. Escopo

Inclui documentação, comandos Bun, estruturas-alvo de front/back, skills, limites do BFF, regras NestJS e ADR. Exclui scaffolding, dependências, endpoints, banco e código de produção.

## 3. Impacto Arquitetural e ADRs

```text
front/ Next.js -> back/ NestJS -> PostgreSQL
                         |
presentation -> application -> domain <- infrastructure
```

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Separar backend NestJS hexagonal e usar Bun | `docs/adrs/ADR-001-separar-backend-nestjs-hexagonal-e-adotar-bun.md` | accepted | Solicitação explícita e isolamento arquitetural. |

## 4. Contratos e Interfaces

Nenhum contrato runtime foi criado. A governança exige OpenAPI no NestJS; Route Handlers do frontend ficam limitados a BFF/proxy.

## 5. Regras de Negócio

Nenhuma regra de produto alterada.

## 6. Critérios de Aceitação

- `AGENTS.md` descreve `front/` conforme solicitado e `back/` hexagonal.
- Bun substitui npm como ferramenta principal.
- `nestjs-expert` é obrigatória no backend; Vercel permanece obrigatória no frontend.
- PostgreSQL é exclusivo dos adapters do backend.
- ADR-000 está `superseded` e aponta para ADR-001.

## 7. Plano de Testes

- Validar arquivos, referências e status dos ADRs.
- Buscar comandos npm residuais tratados como padrão e acesso PostgreSQL pelo frontend.
- Lint/build/test não se aplicam porque ainda não há manifests nem código.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Biblioteca NestJS incompatível com Bun | média | alto | Spike e ADR antes de escolher adapter/runtime de produção. |
| Regra duplicada no BFF | média | alto | Route Handler apenas compõe/delega; revisão bloqueia duplicação. |
| Acoplamento do domínio ao NestJS/ORM | média | alto | Portas/adapters, testes e skill hexagonal. |

## 9. Perguntas em Aberto (bloqueantes)

Nenhuma para a governança. ORM, autenticação, workspace root e deploy exigem ADRs futuros.

## 10. Checklist de Conformidade

- [x] ADR-001 criado e aceito; ADR-000 marcado como substituído.
- [x] Nenhum código de produção foi escrito.
- [x] Estruturas front/back e contratos estão explícitos.
- [x] Skills Vercel e NestJS foram integradas.
- [x] Comandos principais usam Bun.
- [x] Riscos de migrations, DI e compatibilidade foram considerados.
