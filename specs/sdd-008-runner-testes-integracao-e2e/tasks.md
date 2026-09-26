# Task: Criar runner descartável para testes de integração e E2E

- **Slug:** runner-testes-integracao-e2e
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-26
- **Status:** ready
- **Versão-alvo:** 0.8.0
- **Tipo:** chore
- **Impacto público:** none

## 1. Contexto e Motivação

O SDD-007 exige PostgreSQL descartável para testes de integração e a execução de E2E. O repositório agora possui `docker-compose.back.test.yml`, isolado dos composes de desenvolvimento e produção, para evitar volumes, portas e serviços persistentes fora do escopo dos testes.

## 2. Escopo

Inclui dois scripts Bash em `scripts/`: `test-back-integration.sh` cria um projeto Compose exclusivo, sobe somente `postgres`, espera o healthcheck, aplica migrations, executa `test:integration` e remove recursos com `down --volumes --remove-orphans` em `EXIT`, `INT` ou `TERM`; `test-back-e2e.sh` sobe `postgres` e `back`, aplica migrations dentro da rede Docker, aguarda `/health`, executa `test:e2e` contra a URL publicada e remove os recursos com a mesma garantia.

Exclui container do frontend, alterações de rotas, schema e credenciais persistentes. O container `back` é usado somente pelo runner E2E.

## 3. Impacto Arquitetural e ADRs

```text
scripts/test-back-integration.sh
  -> docker compose (postgres temporário)
  -> bun db:migrate
  -> bun test:integration
  -> docker compose down --volumes

scripts/test-back-e2e.sh
  -> docker compose (postgres + back)
  -> bun db:migrate (no container back)
  -> HTTP contra back publicado
  -> bun test (E2E direto, sem recursão)
  -> docker compose down --volumes
```

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Compose exclusivo de testes e execução Bun no host | Nenhum ADR novo | accepted (ADR-003/ADR-007) | Reutiliza as imagens/serviços aceitos, sem criar dependência ou limite arquitetural novo. |

## 4. Contratos e Interfaces

Os scripts carregam obrigatoriamente `back/.env.test.local` e passam o mesmo arquivo ao Compose. O de integração exporta `DATABASE_URL`/`DATABASE_INTEGRATION_URL`; o E2E exporta `E2E_BASE_URL` apenas para o processo de teste. Nenhum imprime URL ou senha.

## 5. Regras de Negócio

| # | Regra | Origem |
|---|---|---|
| 1 | Recursos de teste são sempre removidos ao encerrar. | Pedido do usuário |
| 2 | Migration é aplicada antes da integração. | SDD-007 §8 |

## 6. Critérios de Aceitação

- Integração inicia somente `postgres`; E2E inicia `postgres` e `back`.
- A porta é descoberta pelo Compose após o healthcheck (`up --wait`).
- Cleanup roda mesmo se qualquer teste falhar ou o processo receber `INT`/`TERM`.
- O script não exibe senha ou URL de banco.

## 7. Plano de Testes

- `shellcheck`, quando disponível.
- Executar o script e confirmar que `docker compose ps` não lista o projeto após o término.
- Validar `bun run --cwd back test:integration` e `test:e2e` pelos comandos do runner.

## 8. Dependências e Riscos

| Risco | Mitigação |
|---|---|
| Docker indisponível | Falha antecipada com diagnóstico seguro. |
| Falha/interrupção deixa recursos | `trap` de cleanup com projeto Compose exclusivo. |

Rollback: remover o script; não há migration nem dado persistente.

## 9. Perguntas em Aberto (bloqueantes)

Nenhuma.

## 10. Checklist de Conformidade

- [x] Decisões citam docs e ADRs aplicáveis.
- [x] Nenhum ADR material novo é necessário.
- [x] Contratos, segurança e cleanup estão explícitos.
- [x] Testes e rollback estão planejados.
