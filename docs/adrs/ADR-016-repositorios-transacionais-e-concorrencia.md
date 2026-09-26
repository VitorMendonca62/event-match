# ADR-016: Vincular repositórios à unidade de trabalho e controlar concorrência do cadastro

- **Status:** accepted
- **Data:** 2026-09-25
- **Aceita em:** 2026-09-26
- **Decisores:** backend e arquitetura
- **Relacionado:** `specs/sdd-007-persistencia-postgresql-cadastro/tasks.md`; ADR-007, ADR-009
- **Substitui/Substituído por:** N/A

## Contexto

`UnitOfWorkPort.execute(work: (context: TransactionContext) => …)` entrega um `TransactionContext` opaco (`object`), e hoje o teste de integração faz cast para `DrizzleDatabase`. O cadastro precisa de várias portas (registration, profiles, catalog) na mesma transação, e de proteção contra corrida em tentativas OTP, confirmação de contato e ativação. O pool está limitado a uma conexão (ADR-007).

## Drivers da decisão

- Nenhum tipo Drizzle em aplicação/domínio.
- Mesma conexão para todas as portas da unidade de negócio.
- Correção sob concorrência entre réplicas.

## Opções consideradas

1. **Repositórios recebem `TransactionContext` como parâmetro** e o adapter resolve internamente o executor Drizzle via helper de infraestrutura. Explícito e testável.
2. Contexto implícito via `AsyncLocalStorage` — menos parâmetros, mas acoplamento oculto e testes mais frágeis.
3. Isolamento `SERIALIZABLE` com retry global — simples de raciocinar, com custo de retries e ruído.

## Decisão

- Opção 1, confirmada pelo produto em 2026-09-26: métodos de portas outbound aceitam `context: TransactionContext`; `resolveExecutor(context)` em `shared/infrastructure/persistence` converte para o executor Drizzle, falhando com erro tipado se o contexto não veio do `DrizzleUnitOfWork`. Casos de uso abrem a unidade de trabalho; repositórios nunca abrem transações.
- `READ COMMITTED` com locks explícitos, confirmado pelo produto em 2026-09-26:
  - verificação de OTP: `SELECT ... FOR UPDATE` do desafio; incremento de falha, bloqueio e consumo na mesma transação; sucesso marca `consumed_at` com condição `consumed_at IS NULL`.
  - contagem de tentativas: upsert condicional de limites (ADR-015) em unidade de trabalho própria e curta, com commit antes da unidade de negócio; as duas nunca são aninhadas.
  - criação de desafio: índice único parcial de um desafio aberto por `(contact_hash, purpose)`, na unidade de negócio.
  - ativação: `SELECT ... FOR UPDATE` da `account`; revalidação de invariantes e `UPDATE ... WHERE status = 'account_incomplete'`; unicidade de contato garantida por índice parcial, com violação `23505` traduzida para erro de domínio neutro.
- Nenhum I/O externo (envio de mensagem) dentro da transação; entrega ocorre após commit, usando a chave de idempotência gravada.
- Erros de driver (`23505`, `40001`, `40P01`) mapeados para erros tipados de aplicação no adapter; nunca propagam SQL ou parâmetros.
- `lock_timeout` local de 2 segundos por transação curta, confirmado pelo produto em 2026-09-26, para evitar espera longa com pool de uma conexão.

## Consequências positivas

- Fronteira hexagonal preservada; testes unitários usam contexto falso.
- Invariantes críticos protegidos por lock e constraint.

## Consequências negativas e riscos

- Assinaturas de portas mais verbosas.
- Pool de uma conexão serializa requisições; testes de concorrência usam pools separados.

## Plano de adoção e rollback

Adicionar `resolveExecutor`; `DrizzleDatabase` permanece sem tipo de schema (ADR-013), e adapters usam o query builder do core. Rollback: versão anterior.

## Evidências e referências

- ADR-007, ADR-009; `back/src/shared/application/ports/unit-of-work.port.ts`
