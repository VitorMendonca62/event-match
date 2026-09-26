# ADR-017: Expirar cadastros e liberar contatos sem job destrutivo automático

- **Status:** accepted
- **Data:** 2026-09-25
- **Aceita em:** 2026-09-26
- **Decisores:** produto, privacidade, backend e operação
- **Relacionado:** `specs/sdd-007-persistencia-postgresql-cadastro/tasks.md`; ADR-008
- **Substitui/Substituído por:** N/A

## Contexto

A ADR-008 define: `Registration` expira após 24 h sem atualização; `Account` incompleta é removida após 15 dias e libera o contato. A Task 04 exclui exclusão automática destrutiva em produção sem job, observabilidade e janela operacional. Índices parciais não podem usar `now()`, então a liberação do contato depende de transição persistida.

## Drivers da decisão

- Contato não pode ficar preso por registro abandonado.
- Nenhuma exclusão agendada nesta task.
- Minimização de dados de registros expirados.

## Opções consideradas

1. **Expiração preguiçosa (lazy) + caso de uso de expiração em lote não agendado.** Ao iniciar verificação/registro para um contato, a transação expira registros vencidos daquele contato antes de verificar unicidade. `ExpireStaleRegistrations` existe e é testado, mas não é agendado.
2. Job agendado de exclusão — fora do escopo.
3. Apenas filtrar por `expires_at` nas consultas — não libera índice único.

## Decisão

Opção 1, confirmada pelo produto e aceita em 2026-09-26. Registro em progresso retém o contato por até 24 h e conta `account_incomplete` por até 15 dias; nova tentativa com contato retido recebe a resposta neutra de recuperação.

- Expirar = `status = 'expired'`, `expired_at = now()` e anulação imediata de dados sensíveis (hash de senha, contato cifrado, nascimento, dados obrigatórios), mantendo apenas id, datas e estado para auditoria mínima. O `contact_hash` é anulado, liberando o índice parcial.
- Índices únicos parciais consideram apenas estados que retêm contato: `registration.status = 'registration_in_progress'` e `account.status IN ('account_incomplete','active')`.
- Remoção física das linhas expiradas fica para task futura com job, métricas, janela e revisão.

## Consequências positivas

- Contato liberado deterministicamente, sem job.
- Dados sensíveis minimizados no momento da expiração.

## Consequências negativas e riscos

- Linhas-tombstone acumulam até existir job de purga.
- Registro vencido sem nova tentativa do mesmo contato mantém dados sensíveis até a execução manual de `ExpireStaleRegistrations`.

## Plano de adoção e rollback

Casos de uso e queries entram com a migration. Rollback: versão anterior; nenhuma exclusão executada.

## Evidências e referências

- ADR-008; `docs/03-modelos-de-dominio.md` §4; Task 04 (fora de escopo)
