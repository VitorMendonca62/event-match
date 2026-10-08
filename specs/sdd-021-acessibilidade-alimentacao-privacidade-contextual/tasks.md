# Task: Adicionar acessibilidade e alimentação com privacidade contextual

- **Slug:** acessibilidade-alimentacao-privacidade-contextual
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-08
- **Status:** blocked
- **Versão-alvo:** workspace/front `0.18.0`; back `0.17.0` (provisórias, após aceite das ADRs)
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A TASK 19 pretende permitir que a pessoa registre necessidades de acessibilidade e alimentação para finalidades explicitamente informadas, mantendo os dados privados por padrão e expondo somente uma projeção mínima em contexto autorizado. Rastreia `docs/DER-EventMatch-MVP.md` RF015, RF017, RF081, RN014, RN112 e RNF001–RNF002; complementa ADR-038 e a política de privacidade vigente.

Os campos podem revelar condição de saúde, deficiência, religião ou outros dados sensíveis. O produto não definiu vocabulários, texto livre, finalidade, audiência, vigência/revogação do consentimento, retenção nem tratamento de alergias. Também não há bounded context implementado de eventos/participação que possa consumir uma projeção. Portanto, este plano não autoriza implementação até os bloqueios serem resolvidos e as ADRs aceitas.

## 2. Escopo

### Inclui, após os bloqueios

- Dados opcionais privados de acessibilidade e alimentação, com vocabulário controlado e texto complementar mínimo aprovado.
- Consentimento explícito, granular, revogável e informado por finalidade/contexto autorizado.
- Projeção mínima derivada pelo backend, nunca o valor privado bruto, para a futura integração autorizada com participação em evento.
- Atualização atômica por `revision`, documentação, migração aditiva, observabilidade sem conteúdo sensível e testes de privacidade.
- Interface de perfil em modo Operate, com linguagem não clínica, explicação de audiência/finalidade, teclado, leitor de tela e zoom de 200%.

### Exclui

- Diagnóstico, laudo, documento médico, triagem clínica, recomendação de saúde, garantia de segurança alimentar ou atendimento emergencial.
- Perfil público, descoberta, busca, ranking, filtragem de pessoas, visibilidade `authenticated` genérica, exportação para anfitrião ou participante sem consentimento contextual.
- Compartilhamento antes de existirem os fluxos aceitos de evento, participação, autorização do anfitrião e informação de finalidade.
- Inferir preferências, alergias, deficiência, religião ou condição de saúde a partir de interesse, foto, texto ou participação.

## 3. Impacto Arquitetural e ADRs

O contexto `profiles` mantém os valores privados e sua edição no agregado `Profile`. Um futuro contexto de eventos/participação não lê tabelas de perfil: solicita uma projeção por porta de aplicação, com `accountId`, `eventId`, finalidade e audiência autorizada. A projeção recusa por padrão quando não houver grant ativo e não produz URL, texto privado ou metadado de diagnóstico em logs, métricas ou erros.

```text
Browser -> front/ RSC /perfil -> GET /api/profile -> NestJS Profiles -> PostgreSQL
Browser -> front/ Client island -> PUT /api/profile -> BFF -> NestJS Profiles [UoW + revision]

Futuro fluxo de participação autorizado
  -> Events/Participation use case -> ContextualNeedsProjectionPort
  -> Profiles policy/grant evaluation -> projeção mínima ou ausência
```

Arquivos candidatos, somente após aceite: `profiles/domain/value-objects/` para códigos e grant; `profiles/domain/services/` para política de projeção; portas inbound/outbound explícitas; caso de uso e adapter Drizzle transacional; DTOs `class-validator`, controller existente com Swagger e o BFF `/api/profile` com Zod estrito. Não haverá regra de consentimento no Route Handler, controller, DTO ou adapter.

No frontend, `/perfil` continua RSC e entrega à ilha somente o snapshot privado da titular (`server-serialization`). A seção cliente deriva estado no render/handlers (`rerender-derived-state-no-effect`, `rerender-move-effect-to-event`), sem fetch adicional, estado mutável em módulo ou catálogo inteiro serializado (`async-parallel`, `bundle-barrel-imports`, `server-no-shared-module-state`). O surface brief existente precisa de atualização somente depois de o produto confirmar conteúdo e audiência.

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Valores privados e consentimento por evento/finalidade/audiência, não por visibilidade genérica | `docs/adrs/ADR-050-consentimento-contextual-para-acessibilidade-e-alimentacao.md` | proposed | Evita exposição ampla e preserva revogação verificável. |
| Vocabulário controlado e texto complementar minimizado, sem diagnóstico | `docs/adrs/ADR-051-vocabularios-minimos-para-acessibilidade-e-alimentacao.md` | proposed | Evita coleta excessiva e impede que texto livre vire prontuário ou canal de contato. |

Toda ADR necessária deve estar `accepted` antes da implementação.

## 4. Contratos e Interfaces

O contrato definitivo permanece bloqueado. Após o aceite, `GET /api/v1/profiles/me` e o snapshot obrigatório de `PUT /api/v1/profiles/me` poderão acrescentar estruturas equivalentes a:

```ts
type PrivateContextualNeed = {
  selections: readonly ControlledNeedCode[];
  detail: string | null; // limite e política definidos pela ADR-051
};

type ContextualConsent = {
  purpose: ApprovedPurpose;
  eventId: string;
  audience: ApprovedAudience;
  grantedAt: string;
  expiresAt: string | null;
};
```

O valor privado e o consentimento não usam `public` nem `authenticated` como substituto de finalidade. A futura porta de projeção recebe identidade do solicitante e contexto de evento; retorna somente códigos/descrições aprovados para aquele propósito ou nenhuma informação. Nenhuma rota de evento, audiência, status HTTP de exposição, tabela, índice, enum, TTL ou contrato OpenAPI será criado antes de produto e jurídico definirem os itens da seção 9.

Compatibilidade prevista: leituras aditivas; escrita do perfil continua snapshot coordenado entre backend e frontend. Linhas existentes iniciam sem valores nem grants. Qualquer migração será aditiva e forward-only; tabelas de grants devem ter FK para conta e futuro evento, unicidade de escopo, timestamps e índices compatíveis com a consulta autorizada, mas o desenho físico depende da ADR-050 aceita.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Perfil não contém necessidades de acessibilidade ou alimentação. | Valores só podem existir privados para a titular e são opcionais. | RF081; RN014; RN112 |
| 2 | Visibilidade de perfil usa `private`/`authenticated` para alguns campos. | Necessidades contextuais não usam audiência genérica; exposição exige grant explícito de finalidade, evento e audiência. | RF015; RN112; ADR-050 proposta |
| 3 | Não há consumidor autorizado. | Sem evento/participação autorizados, a projeção é vazia e nenhum dado é compartilhado. | RF017; RN112 |
| 4 | Revogação não se aplica. | Revogar bloqueia novas projeções sem apagar automaticamente o dado privado; efeito sobre cópias já legitimamente recebidas depende de decisão jurídica/produto. | RN112; política de privacidade §7 |
| 5 | Logs não têm conteúdo de perfil sensível. | Telemetria registra somente operação, resultado, escopo agregado e correlação; nunca códigos, texto, alergia, condição, audiência identificável ou evento em claro. | RNF001; RNF006 |

## 6. Critérios de Aceitação

- Todo valor novo começa privado e não integra completude, capacidade de anfitrião, perfil público, descoberta, ranking ou filtros de pessoas.
- A UI declara, antes do consentimento, finalidade, audiência, contexto, período de validade e como revogar; não usa linguagem clínica, não promete adaptação/segurança e não depende só de cor.
- A revogação é imediata para novas leituras e não remove o valor privado por efeito colateral.
- A autorização é avaliada no backend para cada projeção; BFF e UI não decidem audiência, não acessam PostgreSQL e falham fechados perante resposta inválida.
- DTOs usam `class-validator`, rotas existentes mantêm guard, `ValidationPipe`, Swagger e envelopes seguros; casos de uso e adapters usam DI por construtor, erros tipados, UoW e revisão otimista.
- A consulta de projeção usa índices de escopo e não faz N+1; dados independentes do RSC carregam em paralelo e somente a projeção mínima chega a Client Components.
- A feature fica desligada por flag até aceite jurídico, migração, testes e fluxo consumidor autorizado; logs, traces e respostas de erro não incluem conteúdo sensível.

## 7. Plano de Testes

### Backend unitário

- Value objects para códigos permitidos, duplicatas, texto mínimo/limites aprovados, rejeição de diagnóstico/contato/controle e normalização.
- Política de consentimento: privado por default, grant de escopo exato, audiência/finalidade errada, expiração, revogação, ausência de consentimento e projeção mínima.
- Caso de uso com `Test.createTestingModule`: revisão conflitante, nenhum dado em telemetria e nenhum acesso entre bounded contexts sem porta.
- DTO/controller: `400` para schema inválido, `401`/`403` sem enumeração, Swagger e filtro de erros seguro.

### Integração e E2E backend

- Upgrade de migration, checks, FKs, unicidades de grant, rollback transacional e concorrência entre edição/revogação/projeção.
- Supertest para snapshot próprio, `409`, ausência em prévia e, somente com fluxo de evento aceito, autorização por papel/participação/finalidade.

### Frontend

- Schemas Zod estritos, serialização mínima, BFF sem dados sensíveis em falha e recusa de shape extra.
- Componentes: labels persistentes, descrição de finalidade/audiência, erro associado, foco, teclado, leitor de tela e revogação explícita.
- Playwright: salvar privado, conceder/revogar, recarregar, conflito em duas abas, desktop/mobile, axe e zoom 200%; projeção de evento só após existir superfície autorizada.

Após implementação: `bun run --cwd back lint`, `bun run --cwd back typecheck`, `bun run --cwd back test`, `bun run --cwd back test:e2e`, `bun run --cwd back build`, `bun run --cwd front lint`, `bun run --cwd front typecheck`, `bun run --cwd front test`, `bun run --cwd front test:e2e`, `bun run --cwd front build` e `bun run --cwd back db:migrate` em banco descartável. A UI também exige `impeccable detect --json` nos alvos alterados, capturas desktop/mobile e finish review em até dois passes.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Coletar dado de saúde/religião além do necessário | alta | alto | ADR-051, vocabulário mínimo, texto limitado e validação jurídica antes de rollout. |
| Exposição a anfitrião/participante sem finalidade clara | média | crítico | Grant por contexto no backend, default deny, auditoria sem conteúdo e testes de autorização. |
| Discriminação ou decisão automatizada baseada no dado | média | crítico | Não usar em descoberta/recusa/filtro; política de acesso e revisão de confiança e segurança antes de qualquer consumo. |
| Revogação concorrer com leitura/projeção | média | alto | UoW, revisão/versão de grant, consulta autorizada atômica e teste concorrente. |
| Texto livre tornar-se prontuário ou canal de contato | alta | alto | Nenhum texto até decisão; limite/normalização/rejeição de contatos após ADR-051. |
| Retenção/cópia de dados sem base jurídica definida | média | alto | Feature flag desligada e aceite jurídico com política de retenção antes de produção. |

Rollout proposto: ADRs aceitas e parecer jurídico → migration aditiva → backend com flag desligada → UI privada da titular → testes/smoke → consumidor de evento autorizado em entrega separada → habilitação gradual. Rollback: desligar flags e impedir novas projeções; preservar dados/schema para migration corretiva forward-only, conforme decisão jurídica sobre eliminação/retensão.

## 9. Perguntas em Aberto (bloqueantes)

- [ ] Quais opções controladas de acessibilidade e alimentação serão oferecidas, quais podem coexistir e quais descrições localizadas serão apresentadas?
- [ ] Existe texto complementar? Se sim, qual finalidade operacional, limite, proibições e tratamento para menção de alergia, condição de saúde, religião ou contato?
- [ ] Quais finalidades e audiências são autorizadas: anfitrião, participantes confirmados, equipe de suporte, ou outra? Em qual estado da participação cada uma passa a enxergar a projeção?
- [ ] O consentimento é por evento, por solicitação, por participação confirmada ou por categoria de evento? Quando expira e o que ocorre em cancelamento, desistência, transferência e exclusão de conta?
- [ ] A revogação deve invalidar somente leituras futuras ou também gerar notificação/obrigações para quem já recebeu a informação?
- [ ] Qual base legal, classificação, política de retenção, cópia/exportação, acesso profissional e trilha de auditoria foram aprovados pela assessoria jurídica brasileira?
- [ ] O produto autoriza armazenar valores privados antes de existir um fluxo de evento/participação consumidor, ou a entrega deve aguardar esse fluxo?

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explicitamente condicionados aos bloqueios.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices`, `nestjs-expert` e Impeccable foram aplicadas conforme o escopo.
- [x] Testes, migration e rollback estão planejados.
- [ ] Perguntas em aberto foram exauridas.
