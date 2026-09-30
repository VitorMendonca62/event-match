# Task: Padronizar a operação Docker local com Makefile

- **Slug:** makefile-operacao-docker
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-30
- **Status:** ready
- **Versão-alvo:** 0.12.0
- **Tipo:** chore
- **Impacto público:** none

## 1. Contexto e Motivação

O repositório possui Compose separados para backend em desenvolvimento, produção e teste, e para frontend em desenvolvimento e produção. Os comandos existem nos READMEs, mas a operação cotidiana exige lembrar nomes de arquivos e o ambiente de teste precisa carregar `back/.env.test.local`.

## 2. Escopo

Inclui um `Makefile` na raiz com comandos explícitos para subir e descer cada Compose e uma seção curta no README raiz. O ambiente de teste sobe com o arquivo de ambiente isolado e é derrubado com volumes e órfãos removidos. Desenvolvimento e produção não removem volumes.

Exclui Compose novo, mudança de imagens, containers, variáveis, migrations, scripts Bun, deploy, CI e execução automática de testes.

## 3. Impacto Arquitetural e ADRs

O Makefile é somente uma fachada para os Compose existentes; não altera limites front/back, DI, BFF, NestJS, Next.js, PostgreSQL ou contratos públicos. Não há decisão arquitetural material e nenhum ADR é necessário.

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Reutilizar os cinco Compose existentes | — | n/a | Evita duplicar configuração operacional. |
| Remover volumes somente no ambiente de teste | — | n/a | Mantém o isolamento descartável previsto pela SDD-008. |

## 4. Contratos e Interfaces

Alvos públicos do repositório:

- `back-dev-up`, `back-dev-down`
- `back-prod-up`, `back-prod-down`
- `back-test-up`, `back-test-down`
- `front-dev-up`, `front-dev-down`
- `front-prod-up`, `front-prod-down`

Cada alvo chama exclusivamente `docker compose` com o arquivo correspondente. `back-test-*` usa `--env-file back/.env.test.local`.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Ambientes usam Compose separados. | O Makefile apenas seleciona o Compose correto. | READMEs existentes. |
| 2 | Testes usam infraestrutura descartável. | `back-test-down` remove volumes e órfãos. | SDD-008. |

## 6. Critérios de Aceitação

- `make help` lista todos os alvos e sua finalidade.
- Cada alvo `*-up` usa `--build` e permanece anexado aos logs.
- Cada alvo `*-down` remove órfãos; somente o alvo de teste remove volumes.
- O Compose de teste recebe `back/.env.test.local` explicitamente.
- Nenhum segredo é incluído no Makefile ou na documentação.

## 7. Plano de Testes

- `make help` retorna os alvos documentados.
- `make -n` confirma o Compose e as flags usados por cada alvo, sem subir containers.
- `docker compose ... config` valida a expansão dos arquivos que não exigem segredo; o Compose de teste é verificado somente com seu arquivo de ambiente local.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| `back/.env.test.local` ausente | média | baixo | O Docker Compose informa o arquivo inexistente antes de subir serviços. |
| Confundir ambiente persistente e descartável | baixa | médio | Nomes explícitos e remoção de volumes exclusiva do alvo de teste. |

Não há migration, rollout de aplicação ou rollback de schema. Remover o Makefile restaura a operação manual já documentada.

## 9. Perguntas em Aberto (bloqueantes)

Nenhuma.

## 10. Checklist de Conformidade

- [x] Decisões citam os documentos operacionais existentes.
- [x] Nenhum ADR é necessário.
- [x] Nenhum código de produção é alterado.
- [x] Contratos front/back e PostgreSQL não mudam.
- [x] Segurança: nenhum segredo é declarado.
- [x] `nestjs-expert` e `vercel-react-best-practices` foram avaliadas; não há código NestJS ou Next.js nesta tarefa.
- [x] Testes e comportamento de rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.
