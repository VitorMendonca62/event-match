# Task: Criar a fundação PostgreSQL do backend

- **Slug:** fundacao-postgresql-backend
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-21
- **Status:** ready
- **Versão-alvo:** 0.6.0
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A Task 03 de `specs/tasks.txt` solicita a fundação PostgreSQL do EventMatch no backend: configuração por ambiente, pool, portas e adapters; migrations ficam para o primeiro bounded context. O plano concretiza a fronteira definida em `AGENTS.md` §§1, 3 e 5, em `docs/01-visao-geral-arquitetura.md` §2 e no ADR-001, preservando o modelo de `docs/03-modelos-de-dominio.md` como conceitual.

O backend da SDD-004 já foi implementado em `back/`. O ADR-007 foi aceito. Não haverá migration inicial nesta tarefa e será usada uma única credencial PostgreSQL, inclusive quando migrations futuras forem introduzidas.

## 2. Escopo

Inclui:

- validar e fixar uma combinação estável compatível de Bun, NestJS, PostgreSQL, Drizzle ORM, Drizzle Kit e `pg` após aceitação do ADR-007;
- estender o schema Zod/configuração do backend com `DATABASE_URL`, TLS e parâmetros limitados do pool, sem defaults para credenciais;
- criar módulo técnico de persistência, tokens de DI, providers singleton do pool `pg` e da instância Drizzle, com encerramento gracioso;
- criar porta técnica estreita para disponibilidade do banco e adapter PostgreSQL correspondente;
- integrar a dependência ao readiness/health do backend sem vazar detalhes internos;
- definir uma porta de unidade de trabalho independente de tipos Drizzle e composição sobre `db.transaction()` para casos de uso futuros, sem criar repositório genérico;
- configurar schema Drizzle, Drizzle Kit e comandos Bun para uso futuro, sem executar nem criar migration nesta tarefa;
- fornecer ambiente PostgreSQL descartável para desenvolvimento/testes, healthcheck de container e documentação operacional;
- atualizar `docs/01-visao-geral-arquitetura.md` e `docs/03-modelos-de-dominio.md` apenas com a fundação efetivamente aprovada, sem transformar o modelo conceitual em schema físico;
- atualizar exemplos de ambiente, README do backend e CHANGELOG/versão por se tratar de capacidade pública operacional aditiva.

Exclui:

- tabelas, enums, seeds e repositórios de `Account`, `Profile`, `Event` ou qualquer bounded context;
- tabelas Drizzle de entidades do DER e adoção de qualquer ORM/query builder adicional;
- PostgreSQL acessado por `front/`, Route Handler ou código fora de adapters do backend;
- regras de concorrência específicas de vagas, idempotência de negócio ou retenção;
- execução automática de migrations no bootstrap ou por cada réplica da API;
- provisionamento de produção, backup/PITR, alta disponibilidade, proxy de conexão e gestão externa de segredos.

Não serão criadas migrations iniciais, baseline, tabelas ou objetos de domínio nesta tarefa. A primeira migration será planejada junto do primeiro bounded context e seu modelo físico aprovado.

## 3. Impacto Arquitetural e ADRs

```text
release job futuro -> Drizzle Kit -> PostgreSQL (mesma credencial da aplicação)

NestJS AppModule
  -> PersistenceModule (composition root técnico)
      -> ConfigModule/Zod
      -> token PG_POOL -> Pool pg singleton (max 1)
      -> token DRIZZLE_DB -> Drizzle singleton sobre o pool
      -> DatabaseReadinessAdapter (@Injectable)

presentation /health/readiness
  -> application health use case
      -> DatabaseReadinessPort
          <- infrastructure PostgreSQL adapter -> Pool -> PostgreSQL

future use case -> UnitOfWorkPort -> transaction-scoped adapters -> Drizzle transaction
domain/application -X-> NestJS | Drizzle | pg | SQL | migrations
front/BFF          -X-> PostgreSQL
```

Arquivos previstos após a existência do backend: `back/package.json`, `back/.env.example`, configuração em `back/src/shared/infrastructure/config/**`, módulo/adapters em `back/src/shared/infrastructure/persistence/**`, porta/caso técnico de health nas camadas já definidas pela SDD-004, migrations e configuração em `back/migrations/**`, testes em `back/test/**`, README e Compose PostgreSQL de desenvolvimento/teste. Os caminhos exatos devem respeitar a estrutura efetivamente criada pela SDD-004.

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Backend NestJS hexagonal separado e executado com Bun | `docs/adrs/ADR-001-separar-backend-nestjs-hexagonal-e-adotar-bun.md` | accepted | Define fronteiras, DI e exclusividade do backend sobre PostgreSQL. |
| Bounded contexts e ownership futuro das portas de repositório | `docs/adrs/ADR-002-contextos-de-dominio-eventmatch.md` | accepted | Impede repositórios genéricos e schema compartilhado sem ownership. |
| Validação fail-fast da configuração com Zod | `docs/adrs/ADR-004-validacao-fail-fast-de-ambiente-com-zod.md` | accepted | Rege validação e redação segura de variáveis. |
| Drizzle ORM, pool `pg`, transações e Drizzle Kit | `docs/adrs/ADR-007-acesso-postgresql-pool-e-migrations.md` | accepted | Escolha explicitamente aceita para a fundação. |

O ADR-007 está `accepted` e a SDD-004 está implementada; o plano está pronto para implementação.

## 4. Contratos e Interfaces

### Configuração operacional

Assinatura proposta, sujeita à aceitação do ADR-007:

```text
DATABASE_URL: secret string, obrigatório, nunca logado
DATABASE_POOL_MAX: integer fixo em 1 nesta fundação
DATABASE_IDLE_TIMEOUT_MS: integer não negativo
DATABASE_CONNECTION_TIMEOUT_MS: integer positivo
DATABASE_STATEMENT_TIMEOUT_MS: integer positivo
DATABASE_SSL_MODE: enum documentado, default seguro por ambiente
```

- O schema Zod converte e valida tipos antes de criar o pool; mensagens de erro contêm chave e motivo, nunca valor.
- O `.env.example` usa somente valores locais fictícios e não contém segredo real.
- A configuração consumida pelo provider é tipada; nenhum adapter lê `process.env` diretamente.
- O pool desta fundação terá exatamente 1 conexão por processo; qualquer aumento exigirá revisão explícita do plano/ADR.

### Portas e DI

Pseudocódigo, sem tipos do driver:

```typescript
export interface DatabaseReadinessPort {
  check(): Promise<Readonly<{ status: 'up'; latencyMs: number }>>;
}

export interface UnitOfWorkPort {
  execute<T>(work: (context: TransactionContext) => Promise<T>): Promise<T>;
}

export type TransactionContext = object; // opaco; não expõe o tipo transacional Drizzle
```

- Tokens de DI são constantes explícitas e ficam no composition boundary; interfaces não são usadas como token runtime.
- A porta de readiness pertence ao caso técnico que a consome; o adapter usa consulta constante parametrizada/sem entrada (`SELECT 1`) e timeout curto.
- `UnitOfWorkPort` não aceita builders/filtros Drizzle, não retorna a instância do ORM e não é repositório genérico. Repositórios futuros são portas dos bounded contexts e recebem implementação vinculada ao contexto transacional.
- Pool e instância Drizzle são singletons no processo, fornecidos por providers `@Injectable()`/factories do módulo; `pool.end()` roda no shutdown. Não existe pool ou banco por requisição.

### Health/readiness e HTTP/OpenAPI

- Preservar `GET /health` como liveness se esse for o contrato implementado pela SDD-004.
- Introduzir readiness separada ou especializar a rota somente após conferir o contrato real; resposta pública segue o envelope do ADR-006 e não revela host, database, usuário, versão, contagem do pool, SQL ou erro do driver.
- Estado saudável retorna `200`; indisponibilidade de dependência retorna `503`. A resposta e os schemas Swagger usam DTOs tipados com `@ApiTags`, `@ApiOperation` e decorators de resposta.
- O probe não executa migration, não faz retry longo e não consome conexão indefinidamente.

### Migrations e schema

- Scripts-alvo: `db:generate`, `db:migrate`, `db:check` e `db:studio` somente para desenvolvimento autorizado; nomes finais devem ser confirmados contra o manifesto real.
- Drizzle Kit gera SQL e metadados versionados; `drizzle-kit migrate` mantém o ledger `drizzle.__drizzle_migrations`. Rollback destrutivo não é automatizado.
- A aplicação e migrations futuras usam a mesma credencial PostgreSQL, configurada uma única vez; permissões e exposição devem ser minimizadas e auditadas.
- Não haverá migration, baseline, ledger, namespace, extensão, seed ou tabela nesta tarefa. Drizzle Kit será apenas configurado/documentado para o primeiro vertical slice.
- Nenhum contrato HTTP de negócio, DTO, enum exportado ou tabela de domínio muda nesta tarefa.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | PostgreSQL é responsabilidade exclusiva do backend, mas ainda não há adapter de negócio. | Somente adapters de infraestrutura do backend acessam o pool. | `AGENTS.md` §§1, 3 e 5; ADR-001 |
| 2 | Entidades de domínio não são modelos do ORM. | Drizzle é infraestrutura; schema, tipos inferidos e query builders não entram em domínio/aplicação. | `docs/03-modelos-de-dominio.md` §1 |
| 3 | Operações críticas futuras exigem atomicidade. | Uma fronteira de unidade de trabalho independente do driver fica planejada; locks e isolamento serão definidos por caso de uso. | `docs/03-modelos-de-dominio.md` §4 |
| 4 | Configuração usada pela aplicação deve falhar cedo e não vazar valores. | Configuração PostgreSQL é validada antes de o pool ser disponibilizado e é redigida em logs/erros. | ADR-004 |
| 5 | Não existe autorização para tabelas do DER. | Nenhuma migration ou tabela é criada sem plano de vertical slice. | `docs/03-modelos-de-dominio.md` §§1–3 |

Nenhuma regra funcional RF/RN é alterada. A mudança é infraestrutura técnica necessária a implementações futuras.

## 6. Critérios de Aceitação

- A SDD-004 está implementada, e o ADR-007 foi explicitamente aceito antes de qualquer código desta tarefa.
- Instalação e execução usam somente Bun e o lockfile raiz; versões estáveis de Drizzle ORM/Kit e `pg` são fixadas e testadas. Drizzle 1.0 pré-estável e tags `@rc`/beta não são autorizados.
- `front/` e Route Handlers não importam driver, configuração de banco nem adapters de persistência.
- Domínio e aplicação não importam NestJS, Drizzle, `pg`, SQL, migrations ou infraestrutura; teste arquitetural ou lint automatizado protege a direção.
- Existe exatamente um pool de 1 conexão e uma instância Drizzle por processo, injetados por tokens/providers, com timeout configurável e shutdown gracioso comprovado.
- Nenhum provider/adaptor é instanciado manualmente nos fluxos de produção; NestJS usa `@Injectable()` e constructor injection.
- Configuração inválida impede inicialização antes de conexão/listener, com diagnóstico seguro e sem imprimir `DATABASE_URL` ou `process.env`.
- Readiness retorna `200` quando PostgreSQL responde dentro do limite e `503` seguro quando indisponível; liveness não passa a depender acidentalmente do banco.
- Swagger/OpenAPI documenta os status de readiness conforme ADR-006; não existe nova entrada HTTP sem DTO/class-validator.
- Pool exaurido, timeout, erro TLS e credencial inválida não expõem detalhes ao consumidor nem deixam conexões penduradas.
- Transação Drizzle confirma em sucesso e faz rollback em erro; o callback de aplicação não recebe o tipo transacional do ORM, e não há I/O externo dentro da transação.
- Não há migrations nesta tarefa; nenhum job de migration é criado ou executado. O primeiro vertical slice deverá definir `drizzle-kit generate`/`migrate`, ledger, rollout e rollback.
- A mesma credencial será usada pela aplicação e por migrations futuras; não haverá secret adicional ou credencial DDL separada.
- Logs e métricas registram aquisição/espera/erro/latência em agregados seguros, sem SQL, parâmetros, URL, credenciais ou PII; labels têm cardinalidade limitada.
- Não há cache nesta tarefa; se algum for proposto durante implementação, exige chave, TTL, invalidação, fallback e ADR.
- `vercel-react-best-practices` não gera ação por ausência de frontend. `nestjs-expert` rege módulos, DI, configuração, Swagger e testes, adaptado à regra superior do projeto de manter erros de aplicação independentes de HTTP.

## 7. Plano de Testes

- Unitários de configuração: variáveis ausentes, conversão, limites, enum TLS e redação de falhas.
- Unitários NestJS: `Test.createTestingModule` resolve pool/token/adapters, comprova singleton e executa lifecycle hooks com doubles tipados.
- Unitários de transação: commit no sucesso, rollback no erro, timeout e preservação do erro tipado de aplicação sem expor tipos Drizzle.
- Unitários do adapter de readiness: sucesso, timeout e erro do driver mapeados sem vazar detalhes.
- Integração PostgreSQL real/descartável: pool, consulta, isolamento entre testes, indisponibilidade, encerramento e recuperação após falha transitória permitida.
- Drizzle Kit: validar apenas configuração, descoberta do schema e geração determinística em diretório de trabalho; não aplicar migration.
- Segurança: única credencial configurada por ambiente; permissões auditadas e busca automatizada confirma ausência de URL/segredo em logs e artefatos.
- Arquitetura: imports Drizzle/driver proibidos em `domain`/`application`, acesso PostgreSQL fora de `infrastructure/persistence` e qualquer dependência Drizzle/PostgreSQL no frontend.
- E2E/Supertest: liveness preservada, readiness `200` com banco disponível e `503` com banco indisponível, envelope e OpenAPI exatos.
- Capacidade: teste controlado confirma limite fixo de 1 conexão, timeout de aquisição e ausência de crescimento ilimitado.
- Comandos previstos após a SDD-004 existir: `bun run --cwd back lint`, `bun run --cwd back typecheck`, `bun run --cwd back test`, `bun run --cwd back test:e2e`, `bun run --cwd back build`, `bun run --cwd back db:generate`, `bun run --cwd back db:check` e `bunx nest info`.
- Docker: subir PostgreSQL de versão fixada com volume descartável em teste e API; validar healthcheck e shutdown sem abandonar a única conexão.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| ADR-007 ainda não foi formalmente aceito | média | bloqueante | Aceitar o ADR antes da implementação. |
| Drizzle ORM/Kit ou `pg` incompatível com Bun fixado | média | alto | Fixar versões estáveis e fazer spike antes da aceitação final/implementação. |
| Pool de uma conexão limitar operações concorrentes | média | médio | Manter timeout explícito e registrar aumento somente em ADR/revisão futura. |
| Rollback destrutivo causar perda de dados | baixa nesta tarefa | crítico | Não criar migration agora; migrations futuras usarão expand/contract e forward fix. |
| Credencial ou URL aparecer em logs | baixa | crítico | Configuração tipada, redaction, testes de captura e proibição de log de objetos do driver. |
| Schema/tipos/builders Drizzle vazarem para domínio ou contratos públicos | média | alto | Mapeamento nos adapters, contexto transacional opaco e testes de arquitetura. |
| Readiness derrubar serviço por falha transitória curta | média | médio | Timeout curto, sem retries longos e política de orquestração documentada/testada. |

Rollout: aceitar ADR; executar spike; adicionar ambiente PostgreSQL descartável; validar configuração e pool de uma conexão; validar readiness; promover a API. Não executar migration nesta tarefa.

Rollback: interromper promoção e manter/reimplantar a versão anterior da API. Não há estado de banco criado por esta tarefa. Migrations futuras usarão expand/contract e forward fix.

## 9. Perguntas em Aberto (bloqueantes)

- Nenhuma. ADR-007 aceito; SDD-004 implementada; sem migration inicial; uma única credencial; pool máximo de 1 conexão.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] O ADR material desta fundação foi criado e aceito.
- [x] Código de produção foi implementado conforme este plano.
- [x] Contratos front/back, OpenAPI, Drizzle e PostgreSQL estão explícitos.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `nestjs-expert` foi aplicada; `vercel-react-best-practices` foi avaliada e não se aplica ao escopo sem frontend.
- [x] Testes, ausência de migration, rollout e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.
