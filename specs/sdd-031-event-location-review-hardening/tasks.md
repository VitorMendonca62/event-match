# Task: Fechar lacunas de busca, publicação e acessibilidade de eventos

- **Slug:** event-location-review-hardening
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-16
- **Status:** implemented
- **Versão-alvo:** correção sem bump de versão; sem mudança de contrato
- **Tipo:** fix
- **Impacto público:** none

## 1. Contexto e Motivação

A revisão dos SDD-027, SDD-028 e SDD-029 identificou lacunas que impedem comprovar o fluxo de busca de localização do BFF ao NestJS e no navegador. Também encontrou divergência de texto sobre o limite de publicação e uma rolagem suave incondicional ao fechar o mapa ampliado. Este plano cobre essas correções e os dois cenários E2E de publicação/salvamento acordados para a tarefa.

Origem: TASK 34 em `specs/tasks.txt`, SDD-027/028/029, TASK 31 e brief de superfície `front/.impeccable/surfaces/src-app-eventos-page-tsx.md`. A regra existente de publicação é uma janela móvel de 30 dias; nenhuma regra nova será introduzida.

## 2. Escopo

### Inclui
- [x] Testar busca explícita no BFF: origem/JSON, sessão, validação estrita, encaminhamento autenticado, projeção da resposta e rate limit, sem registrar o termo consultado.
- [x] Testar a rota de busca NestJS: guard BFF/sessão, DTO estrito, associação da conta e rascunho ao caso de uso, resposta `no-store` e conversão do rate limit.
- [x] Acrescentar E2E em desktop e mobile que abre o mapa ampliado, aguarda a centralização inicial, busca somente após submissão, escolhe um local, move o mapa por teclado e salva o ponto no rascunho.
- [x] Acrescentar E2E que comprova mensagens individuais para latitude/longitude ausentes ao publicar e salvamento bem-sucedido de um rascunho incompleto.
- [x] Usar “janela móvel de 30 dias” nos dois avisos de limite de publicação.
- [x] Ao fechar o mapa ampliado, usar rolagem automática quando `prefers-reduced-motion: reduce` estiver ativo e manter o comportamento suave para as demais pessoas.
- [x] Manter limites de privacidade, direção visual, lazy loading existente (`bundle-dynamic-imports`, `bundle-conditional`) e contratos atuais.

### Fora de escopo
- [ ] Alterar endpoint, DTO, OpenAPI, BFF, caso de uso, regra de domínio, persistência, migration, ADR ou configuração do provedor.
- [ ] Alterar os fluxos do mapa além da rolagem de retorno, adicionar retry/autocomplete ou coletar localização do aparelho.
- [ ] Redesenhar a interface, alterar tokens visuais, criar componentes de sistema ou modificar outras superfícies.

## 3. Impacto Arquitetural e ADRs

Sem mudança arquitetural. O BFF continua validando entrada same-origin, sessão e resposta e encaminhando a busca ao backend. O controller NestJS continua usando `EventsBffGuard`, DTO com `class-validator`, caso de uso por DI e filtro de erros. O mapa permanece client-side sob demanda; PostgreSQL e migrations não mudam. Bun permanece o único runtime/package manager.

```text
Browser E2E -> Next.js Route Handler/BFF -> EventsController -> SearchEventLocations
          formulário/mapa Client Component -> API BFF existente
```

Aplicam-se os requisitos `nestjs-expert` para `ValidationPipe`, DTOs, autorização, respostas HTTP e testes de controller; no frontend, preservam-se lazy loading (`bundle-dynamic-imports`, `bundle-conditional`) e estado local, sem novos efeitos de dados ou bibliotecas.

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Nenhuma decisão arquitetural material | — | Não aplicável | Cobertura e correções locais não alteram camadas, contratos, integração ou persistência. |

## 4. Contratos e Interfaces

Sem alteração de contrato. A busca continuará usando `POST /api/events/drafts/:eventId/location-search` no BFF e `POST /api/v1/events/drafts/:eventId/location-search` no NestJS, com `{ query }` e a resposta allowlisted existente. Os testes verificarão origem confiável, JSON, autenticação, validação de DTO sem campos extras, associação de conta/evento, `Cache-Control: no-store` e resposta 429 neutra. Nenhuma tabela, índice, porta ou tipo exportado será alterado.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | A publicação é limitada a dois eventos em 30 dias corridos, texto divergente da janela móvel implementada/documentada. | Os dois avisos descrevem com precisão “janela móvel de 30 dias”; regra de backend permanece inalterada. | SDD-028, TASK 31, ADR-057 |
| 2 | Rascunhos podem ser salvos incompletos; publicação exige campos de localização e demais requisitos. | Comportamento preservado e demonstrado no E2E. | TASK 31 / SDD-028 |

## 6. Critérios de Aceitação

- A busca só é enviada ao submeter o formulário; inicialização vazia serve somente à centralização municipal.
- A rota BFF não chama o backend para origem/JSON inválidos, sessão ausente, UUID/body inválidos ou flag desativada; consultas e localização exata não aparecem nos logs.
- O controller NestJS rejeita uso sem credenciais BFF/sessão e corpos extras/inválidos antes do caso de uso; sucesso é `no-store` e rate limit é 429.
- O E2E confirma a busca digitada, resultado escolhido, ajuste por seta e persistência apenas no rascunho; não encontra coordenadas exatas no texto público.
- O E2E confirma erros associados para latitude e longitude ausentes, sem publicação, e mantém permitido salvar um rascunho incompleto.
- A rolagem de retorno segue a configuração `prefers-reduced-motion`; o controle recupera foco após fechar o diálogo.
- As duas mensagens da janela de publicação usam o termo “janela móvel de 30 dias”.
- Lint, typecheck, testes e builds disponíveis de front/back passam; detector Impeccable e `git diff --check` não apontam problemas.

## 7. Plano de Testes

- BFF: `bun test front/tests/integration/events-bff.test.ts`.
- Backend HTTP com Supertest: `bun test back/test/unit/events/event.http.test.ts` (fora do sandbox se o bind de porta exigir, conforme `AGENTS.md`).
- E2E Chromium desktop/mobile: `FRONT_E2E_PORT=3100 bun run --cwd front test:e2e tests/e2e/eventos.e2e.ts`.
- Suites e qualidade: `bun run --cwd front test`, `bun run --cwd front lint`, `bun run --cwd front typecheck`, `bun run --cwd front build`; `bun run --cwd back test`, `bun run --cwd back lint`, `bun run --cwd back typecheck`, `bun run --cwd back build`.
- Revisar alterações e executar o detector Impeccable aplicável ao formulário/mapa; não há testes de migration/DB a adicionar porque persistência não muda.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| E2E de mapa depende de serviço externo ou regressão em viewport móvel | Média | Médio | Interceptar somente a busca com fixture determinística; manter os testes nos viewports desktop/mobile já configurados e preservar tiles atuais. |
| E2E alterar capturas ou artefatos locais já existentes | Média | Baixo | Preservar e restaurar os artefatos preexistentes alterados pelo runner, sem descartar mudanças do workspace. |
| Mock do controller omitir erro tipado do rate limit | Baixa | Médio | Reusar erro e filtro atuais, conferir status/payload neutro no teste HTTP. |
| Implantação/rollback | Baixa | Baixo | Sem migration nem configuração nova; rollback por reversão dos arquivos de teste, copy e rolagem. |

Dependências externas: nenhuma além dos runners/contêineres já configurados no projeto.

## 9. Perguntas em Aberto (bloqueantes)

Nenhuma. O escopo, comportamento esperado e interfaces atuais estão explícitos; não há decisão de produto/arquitetura pendente.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs existentes; não há decisão arquitetural material nova.
- [x] Nenhum ADR novo é necessário.
- [x] O plano não altera código de produção.
- [x] Contratos atuais, status, autorização, validação e persistência estão explicitados.
- [x] Performance, segurança, privacidade, acessibilidade e observabilidade foram consideradas.
- [x] `vercel-react-best-practices` e `nestjs-expert` foram aplicadas ao escopo.
- [x] Testes e comandos Bun estão planejados; migration/rollback não se aplicam.
- [x] Perguntas bloqueantes foram exauridas.

## 11. Registro de Implementação e Validação

- BFF: 11 testes e 58 assertions passaram, incluindo corpo estrito, sessão, encaminhamento interno, projeção allowlisted, privacidade dos logs e rate limit.
- NestJS HTTP: 8 testes e 22 assertions passaram; inclui guard/DTO, associação ao host, `no-store` e erro neutro 429.
- Suíte frontend completa passou; suíte backend completa: 400 testes, 1.155 assertions e 1 snapshot passaram.
- E2E: os dois cenários existentes passaram em desktop/mobile (4/4) na execução completa; o novo fluxo de busca, teclado, privacidade e movimento passou desktop/mobile na execução direcionada (2/2).
- Lint e typecheck de front/back passaram; build de frontend passou no runner E2E e build de backend passou. Detector Impeccable retornou `[]`; `git diff --check` passou.
- Nenhum contrato, regra de domínio, migration ou ADR foi alterado. As capturas e `front/next-env.d.ts` existentes foram restaurados após o runner E2E.
