# Task: Inicializar a fundação técnica do frontend

- **Slug:** fundacao-tecnica-frontend
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-21
- **Status:** ready
- **Versão-alvo:** 0.4.0
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A Task 01 de `specs/tasks.txt` solicita a primeira aplicação executável do EventMatch em `front/`, sem regra de negócio ou integração. A fundação concretiza o frontend previsto em `AGENTS.md` §§1–5, `docs/01-visao-geral-arquitetura.md` §2 e ADR-001, mantendo o DER v1.3 apenas como contexto do produto, sem implementar RFs.

## 2. Escopo

Inclui:

- criar o workspace Bun na raiz com manifesto privado, declaração explícita de `front` e um único lockfile versionado;
- inicializar `front/` com Next.js App Router, React e TypeScript estrito, fixando versões compatíveis nos manifests;
- criar `src/app`, `src/components/server`, `src/components/client`, `src/shared` e as árvores de testes unitários, de integração e E2E;
- manter `layout.tsx` e uma página técnica mínima como React Server Components;
- adicionar Zod e um módulo server-only que valida `NODE_ENV`, `PORT` e host de escuta antes de o Next.js aceitar requisições, encerrando o processo ao encontrar configuração inválida;
- adicionar `@tanstack/react-query` e um provider client-only mínimo no root, sem criar query, mutation, persistência ou consumo da API;
- configurar lint, typecheck, build, start e testes por scripts Bun, sem criar scripts artificiais apenas para satisfazer validação;
- criar Dockerfile multi-stage, `.dockerignore` e as composições de desenvolvimento e produção definidas na Task 01;
- documentar instalação, execução, validação e Docker em `front/README.md`;
- atualizar `docs/01-visao-geral-arquitetura.md` e o registro de dependências/versões quando a fundação concretizar detalhes hoje descritos apenas como alvo.

Exclui:

- autenticação, domínio do EventMatch, consumo da API, PostgreSQL e integrações externas;
- Route Handlers, Server Actions, estado global, biblioteca visual, analytics e cache;
- decisões sobre deploy, proxy reverso, TLS ou composição conjunta dos serviços;
- implementação do backend da Task 02.

## 3. Impacto Arquitetural e ADRs

```text
Browser -> Next.js App Router
              |
              +-> Server Components por padrão
              +-> Client Components somente para QueryProvider

bootstrap server-only -> schema Zod -> configuração tipada ou exit != 0
layout Server Component -> QueryProvider Client Component -> children

workspace Bun raiz -> front/package.json -> build/test/lint/typecheck
Docker dev          -> fonte montada + hot reload
Docker produção     -> build multi-stage + artefato autocontido
```

Arquivos previstos: `package.json` e lockfile na raiz; `front/package.json`, configurações TypeScript/Next/ESLint/testes, `front/src/**`, `front/tests/**`, `front/Dockerfile`, `front/.dockerignore`, `front/README.md`, `docker-compose.front.yml` e `docker-compose.front.dev.yml`.

Não há BFF nesta fundação. Não há DI, NestJS, persistência ou migration. A imagem recebe configuração somente por ambiente e não incorpora segredos.

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Monorepo Bun com frontend Next.js separado | `docs/adrs/ADR-001-separar-backend-nestjs-hexagonal-e-adotar-bun.md` | accepted | Define stack, fronteira e ferramenta principal. |
| Imagem multi-stage e Compose separados por serviço/ambiente | `docs/adrs/ADR-003-containerizacao-dos-servicos-web.md` | accepted | Define build, runtime, volumes e isolamento operacional. |
| Validação fail-fast de ambiente com Zod | `docs/adrs/ADR-004-validacao-fail-fast-de-ambiente-com-zod.md` | accepted | Evita iniciar com configuração inválida e preserva valores sensíveis. |
| Query client único exposto por provider client-only | `docs/adrs/ADR-005-query-client-no-root-do-frontend.md` | accepted | Estabelece cache futuro sem converter a árvore App Router em cliente. |

Todos os ADRs necessários estão `accepted`; o plano está pronto para implementação quando ela for autorizada.

## 4. Contratos e Interfaces

- Scripts públicos de `front/package.json`: `dev`, `build`, `start`, `lint`, `typecheck` e `test`; scripts adicionais somente se suportarem objetivamente integração/E2E ou Docker.
- Comandos da raiz: `bun install` deve resolver o workspace e atualizar somente o lockfile Bun.
- O schema Zod de ambiente é server-only e valida `NODE_ENV`, `PORT` e host; valores ausentes só recebem default quando o ADR-004 o permitir. Falhas mostram nomes/chaves e motivos, nunca valores recebidos, e impedem `dev`, `build` ou `start` de subir.
- Arquivo de exemplo de ambiente documenta somente nomes e valores seguros; `.env*` com valores reais permanece fora do Git.
- `QueryProvider` é um Client Component sob o layout RSC. Ele cria um `QueryClient` estável por montagem, não recebe dados serializados, não cria estado mutável em módulo e não inclui Devtools nesta fundação.
- Porta HTTP e hostname são configuráveis por ambiente; o container deve escutar em interface acessível ao Compose, sem hardcode de endereço de produção.
- A página inicial técnica deve responder HTTP com conteúdo estático identificando o frontend, sem dados do DER ou chamada ao backend.
- Não haverá rota `front/src/app/api/**`, contrato BFF, DTO compartilhado, tabela, índice, constraint ou migration.
- A composição de produção constrói `front/Dockerfile` e não monta fontes; a de desenvolvimento monta fontes e preserva dependências do container.
- Compatibilidade: mudança aditiva em repositório sem runtime anterior; não há contrato público preexistente a quebrar.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Não existe frontend executável. | Existe somente uma superfície técnica mínima, sem regra de produto. | `specs/tasks.txt`, Task 01 |
| 2 | Frontend é uma arquitetura-alvo. | RSC permanece o padrão e Client Components só surgem por interatividade comprovada. | `AGENTS.md` §§3 e 5 |
| 3 | PostgreSQL pertence ao backend. | Nenhuma dependência ou acesso a banco é incluído no frontend. | ADR-001; `AGENTS.md` §5 |
| 4 | Não há cache de queries no cliente. | Existe apenas infraestrutura de provider; nenhuma query/mutation ou regra de dados é criada. | `specs/tasks.txt`; ADR-005 |
| 5 | Configuração pode falhar tardiamente. | Variáveis usadas pela fundação são validadas antes de o processo servir tráfego. | Solicitação complementar; ADR-004 |

## 6. Critérios de Aceitação

- Todos os critérios da Task 01 em `specs/tasks.txt` são demonstrados.
- `bun install` na raiz usa workspaces e lockfile Bun; nenhum artefato npm, pnpm ou yarn é criado.
- TypeScript usa modo estrito e lint/typecheck não mascaram erros.
- Zod valida todas as variáveis usadas pela fundação no bootstrap; configuração inválida gera diagnóstico seguro em stderr, exit não zero e nenhum listener HTTP.
- A página e o layout iniciais são Server Components; não existe diretiva `'use client'` sem interação real.
- O único boundary de cliente inicial é `QueryProvider`; o `QueryClient` não é singleton mutável de módulo nem é serializado pelos RSCs.
- O bundle inicial não recebe biblioteca de componentes, ícones, estado ou fetch desnecessário.
- Regras Vercel aplicadas: `bundle-barrel-imports`, `bundle-analyzable-paths`, `server-no-shared-module-state`, `server-serialization` e `rerender-lazy-state-init`; `async-parallel` fica registrada para futuras operações independentes, sem criar async artificial nesta fundação.
- O Dockerfile tem stages explícitos, instalação congelada, runtime não privilegiado, sinais/encerramento corretos e somente artefatos necessários no stage final.
- O Compose de desenvolvimento comprova hot reload sem rebuild manual; o de produção não usa volume de fontes.
- README informa pré-requisitos, comandos locais, validações, variáveis não secretas, desenvolvimento e produção em Docker.
- Não há Route Handler, autenticação, banco, segredo, telemetria com PII ou regra do EventMatch.
- Logs técnicos de inicialização não incluem ambiente completo, tokens ou dados pessoais.

## 7. Plano de Testes

- Unitário: smoke test do componente técnico inicial, sem acoplá-lo a detalhes frágeis do framework.
- Integração: renderização do App Router e metadados/layout básicos, se a ferramenta escolhida suportar o boundary sem simulação excessiva.
- E2E/smoke: iniciar a aplicação, acessar `/`, verificar resposta bem-sucedida e conteúdo técnico esperado.
- Configuração: testes unitários do schema Zod com defaults permitidos, enum/tipo/faixa válidos e cada erro representativo; smoke de `dev`, `build` e `start` com ambiente inválido confirma stderr redigido, exit não zero e ausência de porta aberta.
- Provider: renderizar o root e verificar que o provider está disponível a um componente de teste; montar/remontar sem recriar o cliente em cada renderização e sem criar query de rede.
- Workspace: executar `bun install` na raiz e confirmar ausência de lockfiles concorrentes.
- Validações: `bun run --cwd front lint`, `bun run --cwd front typecheck`, `bun run --cwd front test` e `bun run --cwd front build`.
- Runtime: iniciar com `bun run --cwd front dev` e, separadamente, `bun run --cwd front start` sobre build concluído.
- Docker dev: `docker compose -f docker-compose.front.dev.yml up --build`, alterar um arquivo de apresentação e confirmar atualização sem rebuild da imagem.
- Docker produção: `docker compose -f docker-compose.front.yml up --build`, verificar `/`, usuário não privilegiado e ausência de bind mount de fontes.
- Revisar o build para imports amplos e file tracing inesperado conforme `bundle-barrel-imports` e `bundle-analyzable-paths`.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Versões recentes de Next.js ou ferramentas não funcionarem integralmente no Bun | média | alto | Fixar versões após spike de compatibilidade, instalar pelo Bun e executar toda a matriz antes de consolidar o lockfile. |
| Saída de produção omitir arquivos do monorepo | média | alto | Usar caminhos estaticamente analisáveis e testar a imagem em diretório limpo. |
| Bind mount ocultar dependências ou hot reload falhar | média | médio | Volume separado para dependências e polling configurável somente quando necessário. |
| Scaffolder adicionar dependências ou configurações fora do escopo | média | médio | Revisar diff, remover extras conscientemente e registrar as versões efetivamente adotadas. |
| Imagem carregar segredos ou executar como root | baixa | alto | Build args sem segredos, configuração runtime e verificação do usuário final. |
| Erro de Zod expor valor sensível | baixa | alto | Formatter permite somente chave e motivo; proibir log de `process.env` e cobrir com teste. |
| Provider introduzir bundle/estado antes de existir API | média | médio | Provider mínimo, sem Devtools/queries/persistência e revisão de bundle; remoção simples enquanto não houver consumidor. |

Rollout: criar/fixar workspace; inicializar frontend, schema e provider; validar ambiente válido/inválido; validar localmente; validar Docker dev; validar imagem de produção; atualizar documentação. Não há migration nem dados persistidos.

Rollback: como não há estado, remover em mudança posterior os artefatos da fundação ainda não publicados ou reverter a versão implantada da imagem. Preservar o lockfile coerente com qualquer pacote remanescente; não usar reset destrutivo.

## 9. Perguntas em Aberto (bloqueantes)

Nenhuma. ADRs 004 e 005 foram aceitos.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material ainda não coberta.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos como ausentes desta fundação; configuração e boundary React Query estão especificados.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices` foi aplicada; `nestjs-expert` não se aplica ao código desta Task 01.
- [x] Testes, ausência de migration e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.
