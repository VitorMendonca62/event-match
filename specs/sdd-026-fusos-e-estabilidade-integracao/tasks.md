# Task: Corrigir fusos municipais e estabilizar a integração

- **Slug:** fusos-e-estabilidade-integracao
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-09
- **Status:** implemented
- **Versão-alvo:** back `0.18.0`
- **Tipo:** fix
- **Impacto público:** none

## 1. Contexto e Motivação

A revisão da SDD-025 identificou que a migration `0014_events` preenche `municipality.time_zone` por UF, contrariando a ADR-060 para municípios situados em zonas distintas, como Eirunepé/AM. A execução completa de integração também apresentou esgotamento de conexões enquanto suites independentes criavam bancos e pools simultaneamente.

## 2. Escopo

- Corrigir a seed da migration `0014_events` para usar a zona IANA apropriada aos municípios de fusos não homogêneos e os identificadores IANA das demais UFs.
- Cobrir municípios representativos de zonas distintas nos testes de integração.
- Garantir que a execução de integração use concorrência compatível com os pools e o PostgreSQL descartável.

Fora de escopo: novos endpoints, contratos HTTP, alterações no agregado de Eventos ou mudança da política da ADR-060.

## 3. Impacto Arquitetural e ADRs

Não há decisão arquitetural material: a mudança implementa corretamente a ADR-060 já aceita. A migration permanece forward-only; o rollback operacional continua desligar a feature, e correções posteriores de dados serão forward-only.

## 4. Contratos e Interfaces

Nenhum contrato público ou porta é alterado. A coluna `municipality.time_zone` continua `text NOT NULL` com identificador IANA.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | O fuso é inferido por UF, com exceções incorretas. | Cada município recebe o identificador IANA aplicável. | ADR-060 |
| 2 | Suites podem exceder a capacidade de conexões do banco descartável. | A execução serializa os arquivos de integração. | Estabilidade de testes |

## 6. Critérios de Aceitação

- Eirunepé usa `America/Eirunepe`; municípios do oeste do Pará usam `America/Santarem` quando aplicável.
- Municípios em zonas IANA diferentes são exercitados pela integração.
- A suíte de integração completa passa com PostgreSQL descartável.
- `lint`, `typecheck`, build e testes do backend passam.

## 7. Plano de Testes

```text
bun run --cwd back lint
bun run --cwd back typecheck
bun run --cwd back test
scripts/test-back-integration.sh
scripts/test-back-e2e.sh
bun run --cwd back build
```

## 8. Dependências e Riscos

| Risco | Mitigação |
|---|---|
| Mapa municipal incompleto | Cobrir explicitamente zonas de fronteira e manter seed por código municipal. |
| Testes mais lentos ao serializar | Priorizar estabilidade e manter isolamento por banco. |

## 9. Perguntas em Aberto

Nenhuma.

## 10. Checklist de Conformidade

- [x] ADR-060 aplicada sem alteração de decisão aceita.
- [x] Nenhum contrato público alterado.
- [x] Migration e rollback foram considerados.
- [x] Critérios de NestJS aplicáveis permanecem inalterados; não há controller, DTO ou DI novo.
