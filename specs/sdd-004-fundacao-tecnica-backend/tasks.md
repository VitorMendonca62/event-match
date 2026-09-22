# Task: Inicializar a fundação técnica do backend

- **Slug:** fundacao-tecnica-backend
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-21
- **Status:** ready
- **Versão-alvo:** 0.5.0
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A Task 02 de `specs/tasks.txt` solicita a primeira API executável do EventMatch em `back/`, com NestJS, TypeScript estrito, Bun e arquitetura hexagonal. O escopo concretiza `AGENTS.md` §§1–5, `docs/01-visao-geral-arquitetura.md` §2 e o ADR-001, mas deliberadamente não implementa os contextos de negócio do ADR-002 nem requisitos funcionais do DER v1.3.

A Task 02 depende do manifesto e lockfile do workspace raiz previstos na Task 01. Ela pode ser implementada separadamente somente se essa fundação compartilhada já existir de forma equivalente e validada.

## 2. Escopo

Inclui:

- criar `back/` como workspace NestJS compatível com Bun e TypeScript estrito;
- criar `main.ts`, `app.module.ts`, `modules/health` nas quatro camadas previstas e `shared` sem antecipar abstrações de negócio;
- adicionar Zod e configurar `ConfigModule` para validar `NODE_ENV`, `PORT` e host de escuta durante o bootstrap, encerrando o processo antes de abrir a porta quando a configuração for inválida;
- configurar `ValidationPipe` global e Swagger/OpenAPI;
- implementar somente `GET /health`, com controller documentado, caso de uso/porta de entrada independentes do NestJS e provider conectado por constructor injection;
- criar, na apresentação compartilhada, envelopes/DTOs reutilizáveis para respostas HTTP com `data`, `message` e `statusCode`, e filter global que preserve esse formato em erros;
- configurar lint, typecheck, testes unitários e E2E e os scripts exigidos;
- criar Dockerfile multi-stage, `.dockerignore` e composições de desenvolvimento e produção;
- documentar instalação, execução, validação, Swagger, health check e Docker em `back/README.md`;
- atualizar `docs/01-visao-geral-arquitetura.md` e `docs/04-integracoes-externas.md` com o contrato técnico concretizado.

Exclui:

- entidades, casos de uso ou políticas do EventMatch;
- PostgreSQL, ORM, migrations, mensageria, cache e integrações externas;
- autenticação, autorização de negócio, rate limiting e endpoints além de health/Swagger;
- probes de dependências inexistentes e lógica de readiness para serviços futuros;
- implementação do frontend da Task 01.

## 3. Impacto Arquitetural e ADRs

```text
GET /health
    -> presentation/http/HealthController (NestJS + Swagger)
    -> application/use-cases/GetHealthUseCase (sem NestJS/HTTP)
    -> resultado técnico estático -> ApiResponseDto

bootstrap -> schema Zod -> ConfigModule ou stderr + exit != 0
exceção HTTP/inesperada -> presentation filter -> ApiResponseDto

AppModule
    -> ConfigModule
    -> HealthModule
        -> token da porta de entrada -> provider @Injectable()

Docker dev      -> fonte montada + watch
Docker produção -> build multi-stage + artefato compilado
```

Arquivos previstos: `back/package.json`, configurações TypeScript/Nest/ESLint/testes, `back/src/**`, `back/test/**`, `back/Dockerfile`, `back/.dockerignore`, `back/README.md`, `docker-compose.back.yml` e `docker-compose.back.dev.yml`.

Domínio e aplicação não importam NestJS, decorators HTTP, Swagger, ORM ou infraestrutura. O módulo NestJS é o composition root; controllers só traduzem HTTP. Não haverá adapter PostgreSQL nem migration nesta tarefa.

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Backend NestJS hexagonal separado e executado com Bun | `docs/adrs/ADR-001-separar-backend-nestjs-hexagonal-e-adotar-bun.md` | accepted | Define stack, camadas, DI e fronteira de persistência. |
| Bounded contexts e módulos futuros do EventMatch | `docs/adrs/ADR-002-contextos-de-dominio-eventmatch.md` | accepted | Impede que o módulo técnico `health` antecipe ou concentre domínio. |
| Imagem multi-stage e Compose separados por serviço/ambiente | `docs/adrs/ADR-003-containerizacao-dos-servicos-web.md` | accepted | Define build, runtime, volumes e isolamento operacional. |
| Validação fail-fast de ambiente com Zod | `docs/adrs/ADR-004-validacao-fail-fast-de-ambiente-com-zod.md` | accepted | Evita iniciar com configuração inválida e preserva valores sensíveis. |
| Envelope HTTP único para respostas com corpo | `docs/adrs/ADR-006-envelope-padrao-de-respostas-http.md` | accepted | Estabiliza contrato OpenAPI e tratamento seguro de erros. |

Todos os ADRs necessários estão `accepted`; a Task 02 só inicia após a conclusão validada da Task 01.

## 4. Contratos e Interfaces

### HTTP/OpenAPI

```text
GET /health
Autenticação: nenhuma
Entrada: sem path params, query ou body
200 application/json:
{
  "data": { "status": "ok" },
  "message": "API disponível",
  "statusCode": 200
}
400, 401, 403, 404, 409, 422, 429, 500 e 503 application/json:
{
  "data": {},
  "message": "mensagem segura para o consumidor",
  "statusCode": <HttpStatus numérico>
}
```

- O endpoint é técnico, idempotente e não vaza versão, hostname, uptime, configuração, stack trace ou detalhes de dependências.
- Swagger usa `@ApiTags`, `@ApiOperation` e decorators explícitos para os DTOs tipados de sucesso e erro.
- Como não há entrada no endpoint, não se cria DTO vazio artificial. Futuras entradas HTTP deverão usar DTOs com `class-validator`.
- `ValidationPipe` global usa whitelist, rejeição de propriedades não permitidas e transformação controlada; a configuração deve ser reutilizada nos testes E2E para não divergir do bootstrap.
- O schema Zod, integrado ao `ConfigModule`, valida `NODE_ENV`, `PORT` e host antes do listener. Erros mostram somente chaves e motivos em stderr, nunca valores, e finalizam o processo com código não zero.
- `ApiResponse<TData extends Record<string, unknown>>` contém sempre `data` objeto, `message` string e `statusCode: HttpStatus`; no JSON, `statusCode` é número. Especializações cobrem no mínimo 200, 201, 400, 401, 403, 404, 409, 422, 429, 500 e 503. Respostas 204 futuras não terão envelope pois o protocolo não admite corpo.
- Controllers adaptam sucesso; um exception filter global da apresentação adapta erros conhecidos e inesperados. Domínio e aplicação não importam DTOs, `HttpStatus` ou NestJS.
- Swagger deve ter caminho configurável/explicitamente documentado e poder ser desabilitado por ambiente sem alterar o contrato de `/health`.
- O plano não introduz prefixo/versionamento global sem requisito, preservando exatamente `GET /health`.

### Porta de aplicação

```typescript
interface GetHealth {
  execute(): Promise<HealthResult> | HealthResult;
}

type HealthResult = Readonly<{ status: 'ok' }>;

type ApiResponse<TData extends Record<string, unknown>> = Readonly<{
  data: TData;
  message: string;
  statusCode: HttpStatus;
}>;
```

A porta/token exportado pelo módulo deve ser estável e o provider ligado no composition root. Não há porta outbound enquanto nenhuma dependência externa é consultada.

### Persistência e compatibilidade

Não existem tabelas, índices, constraints, pool, transações ou migrations. `GET /health` é um contrato público aditivo e sua forma deve ser registrada em `docs/04-integracoes-externas.md`; mudanças futuras incompatíveis exigirão versionamento/changelog conforme `AGENTS.md` §6.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Não existe API executável. | Existe somente uma API técnica de disponibilidade do processo. | `specs/tasks.txt`, Task 02 |
| 2 | Domínio/aplicação devem ser independentes do framework. | O health case preserva a direção presentation → application e não importa NestJS fora da composição/apresentação. | ADR-001; `AGENTS.md` §3 |
| 3 | PostgreSQL pertence a adapters do backend. | Nenhuma conexão, ORM ou adapter de persistência é criado nesta fundação. | `specs/tasks.txt`, Task 02 |
| 4 | Configuração pode falhar depois do bootstrap. | Variáveis usadas são validadas antes do listener HTTP; falha não permite subir o servidor. | Solicitação complementar; ADR-004 |
| 5 | Formatos de resposta ainda não são padronizados. | Toda resposta com corpo usa `data`, `message` e `statusCode`; erros são convertidos na apresentação. | Solicitação complementar; ADR-006 |

## 6. Critérios de Aceitação

- Todos os critérios da Task 02 em `specs/tasks.txt` são demonstrados.
- `back/` participa do workspace Bun existente e não cria lockfile ou ferramenta de pacote concorrente.
- TypeScript é estrito; lint, typecheck, testes e build não mascaram falhas.
- `ValidationPipe` global, `ConfigModule` validado por Zod e Swagger são inicializados no bootstrap sem segredos hardcoded.
- Ambiente inválido gera diagnóstico seguro em stderr, exit não zero e nenhum listener HTTP; nenhum valor de variável ou `process.env` é logado.
- `GET /health` retorna o envelope 200 com `data.status = "ok"`, está documentado no OpenAPI e não contém regra de negócio nem consulta externa.
- DTOs/classes compartilhados cobrem ao menos 200, 201, 400, 401, 403, 404, 409, 422, 429, 500 e 503; todas as respostas com corpo possuem `data` objeto, `message` string e `statusCode` `HttpStatus`/número serializado.
- Um filter global converte erros HTTP e inesperados em envelope seguro; 500 não inclui stack trace, detalhe de dependência ou erro bruto de validação.
- Serviços/providers NestJS usam `@Injectable()` e constructor injection; não há instanciação manual com `new` fora do bootstrap/test doubles apropriados.
- Controllers permanecem finos; aplicação e domínio não importam NestJS, HTTP ou infraestrutura; não há dependência circular ou `forwardRef()`.
- Erros internos não expõem stack trace; logs estruturados evitam ambiente completo, tokens, cookies e PII.
- O processo trata encerramento gracioso e sinais do container; o health endpoint não promete saúde de dependências inexistentes.
- O Dockerfile tem stages explícitos, instalação congelada, runtime não privilegiado e apenas artefatos necessários no stage final.
- Compose dev comprova watch sem rebuild; Compose produção não usa volume de fontes.
- `nestjs-expert` é aplicado a controller/Swagger, DI, validação e testes; as orientações que colocam exceções HTTP em services são adaptadas à regra superior do projeto: erros de aplicação permanecem independentes de HTTP e seriam traduzidos na apresentação.

## 7. Plano de Testes

- Unitário da aplicação: `GetHealthUseCase` retorna o resultado imutável esperado sem NestJS.
- Unitário NestJS: compilar `HealthModule` com `Test.createTestingModule`, resolver providers por token e testar o controller com dependência injetada.
- Arquitetura: teste/lint que detecte imports proibidos de `@nestjs/*`, Swagger, HTTP ou infraestrutura dentro de `domain` e `application`, se puder ser feito sem dependência desproporcional; no mínimo, revisão automatizada por busca no CI.
- E2E com Supertest: subir `AppModule` com o mesmo bootstrap relevante, validar `GET /health` 200, content type e corpo exato, e verificar rota inexistente.
- Ambiente: testes unitários do schema Zod para defaults permitidos, enum/tipo/faixa válidos e cada erro representativo; smoke de bootstrap inválido confirma stderr redigido, exit não zero e ausência de porta aberta.
- Respostas: testes unitários das factories/DTOs e filter para 400, 401, 403, 404, 409, 422, 429, 500 e 503, incluindo `data: {}`, `message` seguro e valor de `HttpStatus`; falhas inesperadas nunca retornam stack trace.
- OpenAPI: gerar documento e confirmar path, operação e schemas de sucesso/erro do health check.
- Validações: `bun run --cwd back lint`, `bun run --cwd back typecheck`, `bun run --cwd back test`, `bun run --cwd back test:e2e` e `bun run --cwd back build`.
- DI/ambiente: executar `bunx nest info` e compilar o módulo em ambiente limpo para detectar provider ausente ou incompatibilidade com Bun.
- Runtime: iniciar `bun run --cwd back start:dev` e confirmar watch; executar o artefato de produção com `bun run --cwd back start`.
- Docker dev: `docker compose -f docker-compose.back.dev.yml up --build`, alterar código técnico e confirmar reload sem rebuild da imagem.
- Docker produção: `docker compose -f docker-compose.back.yml up --build`, verificar `/health`, encerramento gracioso, usuário não privilegiado e ausência de bind mount.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| NestJS, Swagger ou runner de testes apresentar incompatibilidade com Bun | média | alto | Fixar versões após spike, executar build/unit/E2E e registrar qualquer fallback antes de aceitar implementação. |
| Scaffolding acoplar aplicação/domínio ao NestJS | média | alto | Criar boundaries manualmente, usar tokens/DI no módulo e testar imports. |
| Health check superficial ser interpretado como readiness de PostgreSQL | média | médio | Documentar como liveness/disponibilidade do processo e reservar evolução após integrações reais. |
| Swagger exposto indevidamente em produção | baixa | alto | Configuração por ambiente e decisão explícita no deploy; nunca incluir segredo ou schema interno. |
| Watch em bind mount falhar em algum host | média | médio | Volume de dependências e polling configurável somente quando necessário. |
| Erro de Zod expor valor sensível | baixa | alto | Formatter permite somente chave e motivo; proibir log de `process.env` e cobrir com teste. |
| Envelope mascarar diagnóstico de operação | média | médio | Log estruturado e redigido com correlação no servidor; cliente recebe mensagem segura. |

Rollout: executar e validar a Task 01/workspace; fixar dependências compatíveis; compor bootstrap, schema, módulos e envelopes; validar configuração válida/inválida; validar localmente; validar Docker dev e produção; atualizar docs do contrato. Não há migration, pool ou transação.

Rollback: como o endpoint não persiste estado, retornar à imagem anterior ou remover a implantação técnica em mudança posterior. A remoção de `/health` após consumo externo passa a ser breaking change e exige o processo do `AGENTS.md`; não há rollback de banco.

## 9. Perguntas em Aberto (bloqueantes)

Nenhuma. ADRs 004 e 006 foram aceitos; a ordem de execução foi confirmada: Task 01 antes da Task 02.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material ainda não coberta.
- [x] Nenhum código de produção foi escrito.
- [x] Contrato OpenAPI, envelope HTTP, configuração e ausência de PostgreSQL estão explícitos; o frontend não participa desta tarefa.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `nestjs-expert` foi aplicada; `vercel-react-best-practices` não se aplica ao código desta Task 02.
- [x] Testes, ausência de migration e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.
