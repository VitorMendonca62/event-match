# ADR-007: Padronizar acesso PostgreSQL, pool e migrations no backend

- **Status:** accepted
- **Data:** 2026-09-21
- **Decisores:** mantenedores de backend, arquitetura e operação
- **Relacionado:** `specs/sdd-005-fundacao-postgresql-backend/tasks.md`
- **Substitui/Substituído por:** N/A

## Contexto

O EventMatch precisa introduzir PostgreSQL no backend NestJS sem permitir acesso pelo frontend nem acoplar domínio e aplicação a driver, SQL, ORM ou NestJS. A fundação também precisa controlar conexões, transações e evolução do schema de modo reproduzível com Bun. O modelo em `docs/03-modelos-de-dominio.md` ainda é conceitual e não autoriza a criação antecipada de tabelas dos bounded contexts.

O backend da SDD-004 já existe e fornece o composition root NestJS sobre o qual esta fundação será acoplada.

## Drivers da decisão

- Manter PostgreSQL exclusivamente em `back/src/**/infrastructure/persistence`.
- Preservar domínio e aplicação independentes de NestJS, Drizzle ORM, driver e schema Drizzle.
- Usar pool único por processo, limitado a uma conexão nesta fundação, com ciclo de vida administrado pelo container NestJS.
- Permitir transações explícitas por unidade de negócio e uso da mesma conexão durante toda a unidade.
- Executar migrations versionadas, ordenadas, auditáveis e reversíveis quando tecnicamente seguro.
- Falhar cedo com configuração inválida sem registrar credenciais ou URLs completas.
- Usar Bun como instalador e executor, com compatibilidade comprovada por testes.
- Adotar Drizzle como ORM solicitado sem antecipar modelos físicos dos bounded contexts.

## Opções consideradas

1. **Drizzle ORM com `node-postgres` e Drizzle Kit.** Mantém schema TypeScript e SQL gerado revisável, permite pool explícito e atende à escolha solicitada; exige impedir que tipos inferidos e expressões Drizzle vazem para o domínio.
2. **Drizzle ORM com Bun SQL.** Reduz dependências e tem integração nativa, mas acopla a persistência diretamente ao runtime e oferece menos portabilidade operacional que `node-postgres` nesta fundação.
3. **Prisma ORM e Prisma Migrate.** Oferece client gerado e migrations integradas, mas foi descartado pela mudança explícita para Drizzle.
4. **`pg` com SQL explícito e runner separado.** Mantém controle máximo, mas exige mais mapeamento manual e não atende à escolha explícita do ORM.

## Decisão proposta

Adotar Drizzle ORM com PostgreSQL, `node-postgres` (`pg`) e Drizzle Kit, executados com Bun. Usar versões estáveis e compatíveis no momento da implementação; em 2026-09-21, os releases oficiais identificam `drizzle-orm` 0.45.3 e `drizzle-kit` 0.31.11 como linhas estáveis, enquanto Drizzle 1.0 permanece release candidate. O plano não autoriza dependências `@rc`, beta ou outra linha pré-estável.

Criar um módulo técnico de persistência no backend, fora dos bounded contexts de negócio. O módulo fornece um único `Pool` de `pg` e uma única instância Drizzle vinculada a esse pool por processo, ambos por tokens explícitos e providers `@Injectable()`. A configuração vem do `ConfigModule`; o provider implementa hooks para verificar disponibilidade conforme o rollout e chamar `pool.end()` no shutdown. Providers e adapters recebem dependências por constructor injection; nenhum caso de uso instancia pool, banco Drizzle ou adapter com `new`.

Configuração mínima proposta:

- `DATABASE_URL`, obrigatória e secreta, sem default;
- limites e tempos do pool em variáveis separadas, validados com Zod e com defaults conservadores documentados;
- TLS configurável por ambiente sem desabilitar verificação de certificado por padrão;
- logs e erros exibem apenas nomes de chaves, códigos seguros e identificadores de correlação, nunca URL, usuário, senha, parâmetros SQL ou dados pessoais.

O schema TypeScript do Drizzle, as migrations SQL, snapshots e journal são artefatos de infraestrutura. Adapters concretos ficam em `infrastructure/persistence`, traduzem registros Drizzle para entidades/value objects do domínio e implementam portas outbound do contexto consumidor. Tipos inferidos, builders, filtros, expressões SQL e erros do Drizzle/driver não atravessam essa fronteira. Não haverá porta genérica que aceite a instância Drizzle ou SQL arbitrário na aplicação. Para a fundação, a única porta permitida é uma porta técnica estreita de disponibilidade; repositórios e tabelas Drizzle surgem somente com casos de uso e modelo físico aprovados.

Transações usam `db.transaction()` do Drizzle sobre `node-postgres`, com isolamento e opções explicitamente definidos por caso de uso quando necessários. A fronteira transacional pertence à unidade de negócio e é exposta por porta que não revela o tipo transacional do Drizzle; adapters participantes recebem repositórios vinculados ao contexto opaco. Não fazer I/O de rede nem trabalho lento dentro da transação, nem criar transações aninhadas implicitamente. Concorrência de vagas e operações semelhantes deverão definir locking, retry e isolamento no vertical slice correspondente.

O schema Drizzle e a configuração do Drizzle Kit ficam versionados, mas esta tarefa não cria nem executa migration. O primeiro vertical slice usará `drizzle-kit generate` e `drizzle-kit migrate`, com revisão humana do SQL e ledger `__drizzle_migrations`. O job futuro usará a mesma credencial da aplicação; não haverá credencial DDL separada. Não usar `drizzle-kit push` como mecanismo de release. Mudanças incompatíveis seguem expand/contract e forward fix.

Não haverá migration inicial, baseline, tabela, enum, catálogo, extensão ou dado de domínio nesta tarefa. O modelo físico será definido no plano do primeiro bounded context.

## Consequências positivas

- Domínio e aplicação permanecem independentes da tecnologia de persistência.
- Pool, shutdown, transações e migrations têm ownership explícito.
- A escolha inicial é pequena e pode receber ORM/query builder depois, mediante evidência.
- Migrations não disputam execução entre réplicas da API nem exigem privilégio DDL no runtime.
- Nenhum schema físico é congelado antes do primeiro bounded context.

## Consequências negativas e riscos

- O schema Drizzle duplica parte do modelo conceitual e exige mapeamento explícito nos adapters.
- A compatibilidade efetiva de Drizzle ORM, Drizzle Kit e `pg` com a versão fixada do Bun precisa ser comprovada.
- A ausência de separação de credenciais reduz a configuração, mas exige auditoria cuidadosa das permissões da conta única.
- A porta de unidade de trabalho exige disciplina para não vazar tipos transacionais do Drizzle.

## Plano de adoção e rollback

1. Usar a SDD-004 implementada como composition root.
2. Fixar a última versão estável compatível de Drizzle ORM/Kit e executar spike com Bun para pool de uma conexão, queries tipadas, transação e shutdown.
3. Adicionar configuração validada, módulo de persistência e probe/readiness, sem migration.
4. Validar em PostgreSQL descartável e em container, incluindo indisponibilidade, exaustão do pool e encerramento.

Rollback de aplicação restaura a versão anterior. Não há estado de banco criado por esta tarefa. Migrations futuras usam expand/contract; não executar `down` destrutivo automaticamente.

## Evidências e referências

- `specs/tasks.txt`, Task 03
- `AGENTS.md` §§3–6 e 8–11
- `docs/01-visao-geral-arquitetura.md` §§2, 5 e 6
- `docs/03-modelos-de-dominio.md` §§1, 4–6
- `docs/adrs/ADR-001-separar-backend-nestjs-hexagonal-e-adotar-bun.md`
- `docs/adrs/ADR-002-contextos-de-dominio-eventmatch.md`
- `docs/adrs/ADR-004-validacao-fail-fast-de-ambiente-com-zod.md`
- `/home/vitor/.codex/skills/nestjs-expert/SKILL.md`
- Documentação oficial: Drizzle ORM com PostgreSQL/`node-postgres`, Bun, transações e Drizzle Kit migrations
