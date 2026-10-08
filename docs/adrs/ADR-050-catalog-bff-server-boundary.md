# ADR-050: Centralizar proxies de catálogos e explicitar sua fronteira somente-servidor

- **Status:** accepted
- **Data:** 2026-10-07
- **Decisores:** frontend e arquitetura
- **Relacionado:** `specs/sdd-021-catalog-bff-testavel/tasks.md`; TASK 21; ADR-022, ADR-043, ADR-044
- **Substitui/Substituído por:** N/A

## Contexto

Os catálogos públicos de interesses, idiomas e preferências de atividades expõem contratos distintos, mas realizam o mesmo papel no BFF: uma única chamada pública ao NestJS, sem credencial interna ou sessão, filtro estrito do envelope e do `data`, e falha fechada. A implementação está dispersa entre o handler genérico de cadastro, uma rota inline e `profile-bff.ts`, embora este último pertença ao contexto de perfil.

A revisão da SDD-017 identificou que essa dispersão torna os filtros e os mapeamentos de indisponibilidade desiguais e dificulta testes equivalentes. Além disso, o workspace não resolve o pacote `server-only`: `bun --cwd front -e "import.meta.resolve('server-only')"` falha, e `front/package.json`/`bun.lock` não o declaram. Os módulos BFF que leem configuração privada ou chamam o backend não têm uma barreira de compilação contra importação acidental por Client Components.

Não há mudança de endpoint, schema, status, header, cache, autenticação, banco ou regra de domínio nesta decisão.

## Opções consideradas

1. **Criar `front/src/shared/server/catalog-bff.ts`, com uma função injetável por catálogo, e declarar `server-only` diretamente no frontend.**
2. Manter cada rota/proxy onde está e apenas acrescentar testes. Rejeitada: mantém duplicação e a divergência de coesão encontrada na revisão.
3. Generalizar o `registrationHandler` para todos os catálogos. Rejeitada: mistura catálogos de perfil com o ciclo/cookies/logs de cadastro e não representa os mapeamentos de mensagem já públicos.
4. Confiar no sufixo `.server` ou em convenção de diretório, sem dependência. Rejeitada: não faz o build recusar um import em componente cliente.
5. Copiar a implementação de `server-only` localmente. Rejeitada: cria manutenção e semântica de bundler próprias sem necessidade.

## Decisão proposta

- Adicionar `server-only` como dependência direta de `front`, atualizando `bun.lock`; o pacote é uma barreira de build, não um valor serializado nem runtime de negócio.
- Criar `catalog-bff.ts` como dono exclusivo de `proxyInterestCatalog`, `proxyLanguageCatalog` e `proxyActivityPreferenceCatalog`. Cada função recebe `Readonly<{ env: BffEnv; fetchImpl?: typeof fetch }>` para manter a chamada única testável e usa `internal: false`.
- Cada proxy valida estritamente o envelope e somente o schema público do catálogo antes de responder. Campo adicional, envelope inválido, timeout, erro de rede e qualquer status não explicitamente aceito falham fechados. A tabela de compatibilidade do plano preserva exatamente o status, envelope, mensagem e headers atualmente publicados por cada rota.
- As três rotas `/api/catalog/**` ficam em uma única delegação ao proxy correspondente. A operação `interests` deixa o handler genérico de cadastro; `profile-bff.ts` deixa de exportar o proxy de preferências.
- Inserir `import 'server-only'` nos módulos de `front/src/shared/server/` que leem `getBffEnv` diretamente ou chamam `callBackend` diretamente: `auth-route-handler`, `authenticated-view`, `authentication-bff`, `backend-client`, `bff-proxy`, `catalog-bff`, `confirm-link`, `profile-bff`, `profile-view`, `registration-view` e `route-handler`. A configuração em `shared/config/*.server.ts` continua protegida pelo sufixo e pela fronteira desses consumidores; qualquer ampliação posterior exige revisão explícita.

## Consequências

- Os contratos dos três catálogos permanecem inalterados e passam a ter uma bateria de testes homogênea, incluindo ausência de credencial interna.
- `server-only` passa a constar no manifesto e lockfile; a importação de um módulo BFF em Client Component falha no build, reduzindo risco de vazar configuração/cliente de backend ao bundle.
- Não há migration, alteração no NestJS, OpenAPI, cache, flag, telemetria nova, deploy coordenado ou rollback de dados. Rollback é reverter o frontend e a dependência; a API e o banco não são afetados.

## Evidências

- `specs/tasks.txt`, TASK 21
- `front/src/app/api/catalog/`, `front/src/shared/server/profile-bff.ts`, `front/src/shared/server/route-handler.ts`
- `front/tests/integration/bff-proxy.test.ts`, `front/tests/integration/profile-bff.test.ts`
- `docs/01-visao-geral-arquitetura.md`, `docs/04-integracoes-externas.md`
- ADR-022, ADR-043 e ADR-044

## Aceite

Aceita em 2026-10-07 pelo solicitante da TASK 21: adicionar `server-only` como dependência direta do frontend e centralizar os três proxies públicos em `catalog-bff.ts`, preservando integralmente os contratos atuais.
