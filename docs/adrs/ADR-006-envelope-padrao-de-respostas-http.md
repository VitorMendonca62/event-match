# ADR-006: Padronizar envelopes de resposta HTTP do backend

- **Status:** accepted
- **Data:** 2026-09-21
- **Decisores:** mantenedores de backend e arquitetura
- **Relacionado:** `specs/sdd-004-fundacao-tecnica-backend/tasks.md`
- **Substitui/Substituído por:** N/A

## Contexto

A Task 02 exige tipos reutilizáveis para respostas HTTP de sucesso e erro, com `data`, `message` e `statusCode`. Sem uma convenção desde o primeiro endpoint, cada controller/filter poderá expor formatos diferentes e o frontend terá de tratar respostas de forma inconsistente.

## Drivers da decisão

- Fornecer contrato previsível e documentável no OpenAPI.
- Separar resultado da aplicação de sua representação HTTP.
- Garantir envelope seguro para exceções conhecidas, validação e falhas inesperadas.
- Evitar stack traces, detalhes de infraestrutura e dados pessoais em erros.
- Permitir especialização de DTOs mantendo o mesmo formato público.

## Opções consideradas

1. Retornar objetos ad hoc em cada controller e usar exceções padrão do NestJS.
2. Usar somente RFC 9457 Problem Details, com formato diferente para sucesso.
3. Usar envelope único para respostas que tenham corpo, mapeado por filter de apresentação.

## Decisão

Adotar envelope público para toda resposta com corpo:

```typescript
type ApiResponse<TData extends Record<string, unknown>> = {
  data: TData;
  message: string;
  statusCode: HttpStatus;
};
```

`HttpStatus` é o enum do NestJS no tipo TypeScript; no JSON, `statusCode` é seu valor numérico. `data` sempre é objeto — `{}` para erros sem detalhes seguros — e `message` sempre é texto seguro ao consumidor. Não retornar `null`, string isolada, `any`, stack trace, erro bruto do Zod ou detalhes internos.

Criar DTO/base/factories reutilizáveis na camada `shared/presentation`, com especializações documentáveis para pelo menos 200, 201, 400, 401, 403, 404, 409, 422, 429, 500 e 503. Não criar DTO de 204: pela semântica HTTP, respostas 204 não possuem corpo; quando uma rota futura usá-la, será a exceção documentada ao envelope.

Controllers adaptam resultados de casos de uso para envelopes de sucesso. Um exception filter global da apresentação converte `HttpException` e falhas inesperadas em envelopes de erro, com 500 genérico para erros não tratados. Domínio e aplicação não importam NestJS, DTOs nem `HttpStatus`. Swagger descreve o envelope e seus status para cada rota.

## Consequências positivas

- Frontend recebe forma uniforme em respostas de sucesso e erro.
- OpenAPI, logs e testes podem verificar contratos estáveis.
- Evita exposição involuntária de exceções internas.

## Consequências negativas e riscos

- O envelope aumenta a verbosidade de respostas simples.
- Mapeamento incorreto de exceções pode esconder detalhes úteis de diagnóstico se não houver logs correlacionados e redigidos.
- Exceções HTTP de bibliotecas exigem filter consistente para não escapar do contrato.

## Plano de adoção e rollback

Criar tipos/classes e o filter no boundary de apresentação, documentar o health check como 200 envelope e adicionar testes unitários/E2E para cada categoria representativa. Logs internos devem conservar contexto seguro e identificador de correlação sem expor o conteúdo ao cliente.

Todo endpoint futuro deve declarar respostas Swagger com os DTOs padronizados. Se o contrato precisar evoluir após consumidores existirem, tratá-lo como alteração pública, atualizar OpenAPI, testes, changelog e versão. Antes do primeiro consumidor, rollback remove os tipos/filter juntamente com o endpoint técnico correspondente.

## Evidências e referências

- `specs/tasks.txt`, Task 02
- `AGENTS.md` §§3, 5 e 6
- `docs/04-integracoes-externas.md` §§1 e 6
- `/home/vitor/.codex/skills/nestjs-expert/SKILL.md`

