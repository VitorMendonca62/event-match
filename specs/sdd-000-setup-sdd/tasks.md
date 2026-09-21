# Task: Configurar governança SDD para Next.js

- **Slug:** setup-sdd
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-21
- **Status:** ready
- **Versão-alvo:** 0.1.0
- **Tipo:** chore
- **Impacto público:** none

## 1. Contexto e Motivação

Criar a governança inicial para um futuro projeto Next.js/PostgreSQL, antes de existir código de produção. Origem: `specs/tasks.txt`. Referências: `docs/01-visao-geral-arquitetura.md §1-2` e `docs/adrs/README.md`.

## 2. Escopo

**Inclui:** `AGENTS.md`, instruções do Copilot, docs-base, skills SDD, diretório `specs/`, política de ADR e aplicação obrigatória das boas práticas Vercel.

**Exclui:** inicialização do Next.js, escolha de ORM/driver, criação de schema, endpoints e código de produção.

## 3. Impacto Arquitetural e ADRs

Define somente governança e uma arquitetura-alvo ainda sujeita a ADRs quando decisões concretas forem tomadas.

```text
Demanda -> Plano SDD -> ADR(s) proposed -> revisão/accepted
        -> implementação -> code-reviewer -> PR opcional
```

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Arquitetura-base com App Router, Route Handlers, camadas e PostgreSQL server-only | `docs/adrs/ADR-000-arquitetura-base-nextjs-postgresql.md` | accepted | Formalizar a estrutura solicitada e seus limites. |
| Exigir ADR por decisão material | `docs/adrs/README.md` (política de governança) | accepted por este setup | Garantir rastreabilidade sem escolher tecnologias adicionais. |

ORM, estratégia de deploy, autenticação, cache e modelo de dados permanecem deliberadamente sem decisão e exigirão ADRs próprios quando entrarem no escopo.

## 4. Contratos e Interfaces

Nenhum contrato de runtime. Artefatos públicos de governança: `AGENTS.md`, skills, docs e template SDD.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Não havia processo | Tarefas não triviais exigem plano e revisão | `AGENTS.md §9` |
| 2 | Não havia registro | Decisão arquitetural material exige ADR | `AGENTS.md §4` |

## 6. Critérios de Aceitação

- Estrutura SDD existe e `specs/` permanece versionável.
- Skills separam planejamento, implementação, revisão, arquitetura e PR.
- `vercel-react-best-practices` é obrigatória nas etapas pertinentes.
- Nenhum código de produção ou dependência é criado.
- ADRs possuem template e ciclo de status explícito.

## 7. Plano de Testes

- Conferir presença e links dos arquivos.
- Buscar placeholders `[STACK]` e referências iOS/Swift residuais.
- Verificar que `.gitignore`, se criado, não exclui `specs/`.
- Lint/build/test não se aplicam: não há `package.json` nem código.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Comandos divergirem do projeto futuro | média | médio | Confirmar após inicialização e atualizar `AGENTS.md`. |
| Escolha prematura de ORM | baixa | alto | Adiar e exigir ADR específico. |
| ADRs virarem burocracia | média | médio | Restringir a decisões materiais e manter um ADR por decisão. |

## 9. Perguntas em Aberto (bloqueantes)

Nenhuma para a criação da governança. Owners, versões e ORM permanecem explicitamente “a definir” e devem ser decididos antes da implementação correspondente.

## 10. Checklist de Conformidade

- [x] Decisões citam docs e política de ADR.
- [x] A arquitetura-base está registrada no ADR-000.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos HTTP/PostgreSQL futuros têm orientação explícita.
- [x] Performance, segurança e observabilidade constam das skills.
- [x] `vercel-react-best-practices` foi integrada.
- [x] Testes e migrations são exigidos nas futuras implementações.
- [x] Não há perguntas bloqueantes para este setup.
