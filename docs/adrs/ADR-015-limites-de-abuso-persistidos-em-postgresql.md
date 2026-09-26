# ADR-015: Persistir limites de abuso da verificação em PostgreSQL

- **Status:** accepted
- **Data:** 2026-09-25
- **Decisores:** segurança, backend e operação
- **Relacionado:** `specs/sdd-007-persistencia-postgresql-cadastro/tasks.md`; ADR-009, ADR-016, ADR-017
- **Substitui/Substituído por:** adia parcialmente o limite por origem/IP da ADR-009 até existir origem confiável; os demais limites da ADR-009 permanecem vigentes

## Contexto

A ADR-009 fixou: cinco desafios por contato/hora, dez por origem/IP/hora, três reenvios por contato/hora e reenvio após 60 s. O limite precisa ser consistente entre réplicas. Não há Redis nem cache aprovado; `AGENTS.md` exige ADR para cache.

Dois fatos do repositório afetam a decisão:

- O caminho previsto é Browser → Next.js (Server Component ou BFF) → NestJS. O IP visto pelo NestJS seria o do Next.js, não o da pessoa; `trust proxy` não está configurado em `back/src/main.ts` e não há proxy reverso nem deploy definido.
- O pool PostgreSQL tem uma única conexão (`DATABASE_POOL_MAX` fixo em `1`, ADR-007), e a ADR-017 exclui jobs destrutivos nesta task.

## Drivers da decisão

- Consistência entre réplicas sem nova infraestrutura.
- Atomicidade sob concorrência.
- Não guardar IP nem contato em claro.
- O limite deve contar **tentativas**, inclusive as que terminam em resposta neutra, para não permitir enumeração de contatos sem consumo de cota.
- Sem job agendado, nova dependência ou lock de longa duração nesta task.

## Opções consideradas

1. **Tabela de janelas horárias fixas com upsert atômico** — simples, uma linha por chave/janela.
2. Contagem por `COUNT(*)` sobre desafios da última hora — sem tabela extra, mas sujeita a corrida, não cobre tentativas sem desafio criado e não cobre origem.
3. Janela deslizante aproximada — hora atual somada à hora anterior ponderada pelo tempo restante; mesma tabela, quase sem rajada, cálculo e limite aproximados.
4. Log de pedidos com janela deslizante exata — uma linha por pedido; exige advisory lock por sujeito e mais armazenamento.
5. Redis/token bucket — exige nova infraestrutura, decisão de fail-open/fail-closed e ADR de cache.

Para a limpeza das janelas antigas:

- **A. Remoção oportunista no próprio upsert** (escolhida).
- B. Job em processo com `@nestjs/schedule`, lotes e advisory lock — rejeitado: nova dependência, primeiro cron do backend, disputa pela conexão única e conflito de princípio com a ADR-017.

## Decisão proposta

### Tabela e contadores

Opção 1, confirmada pelo produto em 2026-09-25.

`verification_rate_window(scope text, subject_hash bytea, window_start timestamptz, request_count int, resend_count int, PRIMARY KEY (scope, subject_hash, window_start))`, com `CHECK (scope IN ('contact', 'origin'))` e `CHECK (request_count >= 0 AND resend_count >= 0)`.

- `request_count` conta **pedidos** de novo desafio (limite 5 por contato/hora), não desafios criados. `resend_count` conta pedidos de reenvio (limite 3 por contato/hora).
- `subject_hash` é HMAC do contato normalizado (chave `CONTACT_HASH_KEY`, domínio separado por prefixo, por exemplo `rate:contact:`). Não há novo segredo.
- Janela = hora cheia UTC (fixed window), aceitando rajada de até 2× na fronteira — registrado como risco.

### Contagem em transação própria

O incremento roda em uma **unidade de trabalho própria e curta, antes** da unidade de trabalho de negócio, e faz commit sozinho:

```text
UoW 1 (curta):   limpeza oportunista + upsert condicional do contador  -> commit
                 sem linha retornada = limite atingido -> resposta neutra, sem UoW 2
UoW 2 (negócio): retenção de contato, desafio aberto, criação do desafio, ... -> commit ou rollback
```

Motivo: numa transação única, um rollback ou uma resposta neutra sem desafio novo (contato já retido, violação `23505`, falha posterior) desfaria o incremento. Quem tenta enumerar contatos cadastrados nunca consumiria cota, e a diferença de comportamento vazaria a existência do contato. Contando antes, toda tentativa fica registrada, qualquer que seja o desfecho.

O caso de uso abre as duas unidades de trabalho em sequência, nunca aninhadas (pool de uma conexão, ADR-016). Repositórios não abrem transações. Nenhum I/O externo ocorre em qualquer das duas.

Upsert (parametrizado, `$4` vindo de `VerificationPolicy`):

```sql
INSERT INTO verification_rate_window (scope, subject_hash, window_start, request_count, resend_count)
VALUES ($1, $2, $3, 1, 0)
ON CONFLICT (scope, subject_hash, window_start)
DO UPDATE SET request_count = verification_rate_window.request_count + 1
WHERE verification_rate_window.request_count < $4
RETURNING request_count;
```

O pedido de reenvio usa o mesmo comando sobre `resend_count`, com limite 3. Ausência de linha retornada significa limite atingido.

### Intervalo mínimo de 60 s

Verificado na UoW 2 em `contact_verification.last_sent_at` com `SELECT ... FOR UPDATE`. Um reenvio recusado por estar dentro dos 60 s já consumiu uma unidade de `resend_count`; é o comportamento desejado.

### Limpeza oportunista

Na mesma UoW 1, antes do upsert, o adapter executa:

```sql
DELETE FROM verification_rate_window
WHERE scope = $1 AND subject_hash = $2 AND window_start < $3 - interval '2 hours';
```

Usa a chave primária e afeta no máximo algumas linhas do próprio sujeito, sem varredura da tabela. Sujeitos que nunca voltam deixam de uma a duas linhas de hash, contador e hora, sem dado legível de cadastro. A remoção física desse resíduo, junto com os tombstones da ADR-017, fica para a task futura de jobs (métricas, janela operacional e revisão). Não são criados `@nestjs/schedule`, `PurgeRateWindows` nem `RATE_WINDOW_PURGE_ENABLED`.

### Limite por origem adiado

O escopo `origin` existe na tabela e na porta `RateLimitRepositoryPort` (o adapter aceita `scope`), mas **não é incrementado nesta task**:

- Nenhum controller resolve origem; os casos de uso recebem `RequestOrigin | null` opaco e, com `null`, não contam por origem.
- Sem origem confiável, o IP visto pelo backend seria o do frontend, e o limite de dez por hora viraria um limite global para todas as pessoas, bloqueando usuários legítimos.
- O limite por contato continua ativo, e a ADR-009 já estabelece que o limite por origem não pode ser a única barreira.

Condição para ativar: nova ADR que defina o encaminhamento do IP do cliente pelo BFF/proxy (lista de proxies confiáveis via `ConfigModule`, `trust proxy` e cabeçalhos aceitos) e o deploy correspondente. A ativação não exige migration de schema. Enquanto isso, a exigência de dez por origem/IP da ADR-009 fica **não atendida por decisão explícita**, registrada aqui e no plano.

### Motivos da janela fixa no MVP

Confirmados pelo produto em 2026-09-25:

- O pior caso é limitado: no máximo 2× o limite em qualquer intervalo de 60 minutos, uma vez por virada de hora; a média de longo prazo permanece no limite configurado.
- O risco de adivinhação do OTP permanece desprezível (até 50 palpites de 1 em 10⁶ por contato/hora), e o bloqueio de 20 minutos e o intervalo de 60 s continuam valendo.
- É a implementação mais simples: um comando atômico, sem lock explícito e com uma linha por sujeito/hora.
- Redis não se justifica no volume do MVP; a porta permite trocar o adapter se surgir limite em login/API, tempo real ou cache.

Próximo passo condicional: migrar para a janela deslizante aproximada (opção 3) se as métricas de limite atingido mostrarem abuso concentrado nas viradas de hora. A troca altera apenas o adapter e é registrada em nova ADR que substitui esta.

## Consequências positivas

- Limites corretos sob concorrência e entre réplicas.
- Enumeração de contatos limitada: tentativas com resposta neutra também consomem cota.
- Contato não fica em claro; não há IP armazenado nesta task.
- Sem job, dependência nova, advisory lock ou variável de ambiente adicional.

## Consequências negativas e riscos

- Duas unidades de trabalho por pedido e uma escrita extra; aceitável no volume do MVP e com pool de uma conexão, pois são sequenciais.
- Uma falha nossa na UoW 2 já consumiu uma unidade da cota da pessoa (uma de cinco por hora).
- Janela fixa permite rajada de até 2× na virada da hora; mitigada por métricas de limite atingido e pela evolução condicional para a opção 3.
- Sem limite por origem, um atacante que troque de contato contorna o limite por contato; cobertura pendente até a ADR de origem confiável.
- Linhas de contador de sujeitos que não voltam acumulam até a task futura de jobs.

## Plano de adoção e rollback

Integrado à migration do cadastro. Rollback: API anterior; tabela aditiva. Verificar em teste de integração, com pools separados, que a tentativa é contada quando a UoW 2 termina em rollback ou em resposta neutra.

## Evidências e referências

- ADR-009; ADR-016 (unidade de trabalho e pool único); ADR-017; DER RNF003–RNF004
- `back/src/shared/infrastructure/config/env.ts` (`DATABASE_POOL_MAX`); `back/src/main.ts` (sem `trust proxy`)
