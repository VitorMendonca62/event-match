# Task: Implementar a fundação backend de eventos

- **Slug:** backend-eventos
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-08
- **Status:** implemented
- **Versão-alvo:** back `0.18.0` (provisória); workspace/front sem alteração nesta TASK
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A TASK 23.1 cria o bounded context de Eventos no backend: rascunho, prévia e publicação por anfitriãs habilitadas. A divisão separa a UI/BFF na TASK 23.2 e preserva a API NestJS como autoridade de domínio e PostgreSQL.

Rastreabilidade: `specs/tasks.txt` TASK 23.1; `docs/DER-EventMatch-MVP.md` RF016–RF021, RF084–RF085, RN005, RN017–RN022, RN028–RN031, RN047–RN049 e RN137; `docs/01-visao-geral-arquitetura.md` §§4–6; `docs/02-regras-de-negocio.md` §3; `docs/03-modelos-de-dominio.md` §2.3; `docs/04-integracoes-externas.md` §§2–3; ADR-022, ADR-044, ADR-052 e ADR-053.

A TASK 20 foi implementada pela SDD-023 e fornece o contrato estruturado de UF/município consumido por Eventos. As decisões de produto, privacidade e contrato foram consolidadas nas ADRs aceitas abaixo. A revisão jurídica da retenção e a publicação de nova versão dos documentos legais são gates de lançamento, não bloqueios para a implementação técnica.

## 2. Escopo

### Inclui

- `EventsModule` NestJS hexagonal com entidade/value objects, erros tipados, portas, casos de uso, adapters Drizzle e controller HTTP.
- Criar, recuperar e atualizar rascunho incompleto; gerar prévia pública; publicar evento validado em transação.
- Catálogo versionado de tipos de atividade, UF/município com fuso IANA, categoria de local e ponto exato protegido fora da projeção pública.
- Habilitação de anfitriã, limite transacional de eventos, observabilidade allowlisted, OpenAPI, migration, documentação e testes.

### Checklist de campos da criação do evento

- [x] Tipo de atividade (`event_activity_type`) ativo, selecionado por código estável do catálogo de Eventos.
- [x] Título do evento.
- [x] Descrição do evento.
- [x] Data e horário de início.
- [x] Data e horário de término, quando informado.
- [x] UF e município, pelos códigos estruturados já fornecidos pela TASK 20 e com fuso IANA derivado do município.
- [x] Categoria de local (`public_place` ou `identifiable_establishment`) e declaração da anfitriã de que o local não é residência.
- [x] Ponto exato (latitude e longitude), protegido conforme ADR-055; bairro, endereço e coordenada exata não integram a projeção pública.
- [x] Capacidade máxima de participantes, limitada a 12 pessoas no MVP.
- [x] Modalidade de entrada (`manual_approval` ou `automatic_entry`); a regra de entrada efetiva será entregue na TASK 25.

Os campos acima podem ser preenchidos progressivamente no rascunho, mas são obrigatórios para publicar, exceto o término. A publicação exige início entre 24 horas e 30 dias no futuro e duração máxima de oito horas quando houver término. Capa e fotos pertencem à TASK 29; acessibilidade/alimentação, à TASK 19; custo estimado, faixa etária, itens e orientações, à TASK 30.

### Exclui

- BFF, páginas, componentes e E2E do navegador: TASK 23.2.
- Descoberta/lista/mapa/detalhe público: TASK 24.
- Solicitações, vagas, participantes, cancelamento, transferência, reconfirmação e transições pós-publicação: TASK 25.
- Conversa, presença, avaliação, denúncia, gestão profissional completa, evento pago/remoto/residencial e geolocalização/mapas.

## 3. Impacto Arquitetural e ADRs

```text
front BFF (TASK 23.2)
  -> EventsController + guard BFF/sessão
     -> CreateDraft | GetDraft | UpdateDraft | PreviewDraft | PublishEvent
        -> Event aggregate + HostEligibilityPort + HostEventLimitPort
           -> EventRepositoryPort / ActivityTypeCatalogPort / ExactLocationPort
              -> Drizzle adapters -> PostgreSQL
```

`EventsModule` importa somente `PersistenceModule`, `IdentityAccessModule` e contratos exportados por Perfil/Catálogo. Providers são `@Injectable()` e usam constructor injection/tokens; sem `forwardRef()`. Domínio/aplicação não importam NestJS, Drizzle, HTTP nem schemas de outros contextos. Controllers usam DTOs `class-validator`, `ValidationPipe`, Swagger e filtro que traduz `EventError`.

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Agregado, estados iniciais, rascunho, revisão e auditoria | `docs/adrs/ADR-054-agregado-evento-e-ciclo-de-vida-inicial.md` | accepted | Mantém invariantes, prazo e publicação atômica. |
| Coordenada exata protegida e área aproximada estável | `docs/adrs/ADR-055-ponto-exato-protegido-de-eventos.md` | accepted | Separa localização aproximada de dado restrito. |
| Tipos de atividade e atributos de criação | `docs/adrs/ADR-056-catalogo-e-atributos-de-evento.md` | accepted | Respeita RN147 e adia campos opcionais às TASKs próprias. |
| Capacidade e limite de anfitriã | `docs/adrs/ADR-057-autorizacao-e-limites-de-anfitria.md` | accepted | Define um evento futuro ativo, dois publicados por 30 dias e capacidade máxima de 12 pessoas no MVP. |
| API autenticada e projeções por audiência | `docs/adrs/ADR-058-contrato-http-e-projecoes-de-evento.md` | accepted | Separa rascunho, prévia pública e dados exatos. |
| Local não residencial declarado | `docs/adrs/ADR-061-proibir-residencia-em-eventos-do-mvp.md` | accepted | Proíbe residência sem exigir endereço ou geocodificação. |
| Fuso horário derivado do município | `docs/adrs/ADR-060-fuso-horario-derivado-do-municipio-para-eventos.md` | accepted | Evita escolha manual e horário incorreto em municípios brasileiros. |

Todas as ADRs aplicáveis estão aceitas. A TASK 23.2 aplica apenas os limites de frontend já definidos: `server-auth-actions`, `async-api-routes`, `server-no-shared-module-state` e `server-serialization`; não há UI/BFF neste plano.

## 4. Contratos e Interfaces

O contrato foi aceito pela ADR-058. A superfície mínima será:

```ts
POST /api/v1/events/drafts                 // 201: owner draft
GET  /api/v1/events/drafts/:eventId        // 200: owner draft
PUT  /api/v1/events/drafts/:eventId        // 200: owner draft, revision obrigatória
GET  /api/v1/events/drafts/:eventId/preview // 200: PublicEventPreview
POST /api/v1/events/drafts/:eventId/publish // 200: owner published event

type EventDraftInput = Readonly<{
  revision?: number;
  activityTypeCode?: string;
  title?: string;
  description?: string;
  startsAtLocal?: string; // ISO local sem offset; backend resolve pelo fuso do município
  endsAtLocal?: string | null;
  ufCode?: string;
  municipalityCode?: string;
  venueType?: 'public_place' | 'identifiable_establishment';
  nonResidentialHostDeclaration?: boolean;
  exactLocation?: ExactLocationInput;
  capacity?: number; // máximo de 12 pessoas no MVP
  admissionMode?: 'manual_approval' | 'automatic_entry';
  // opcionais pertencem às TASKs 19, 29 e 30
}>;

type ExactLocationInput = Readonly<{ latitude: number; longitude: number }>;
type ApproximateEventArea = Readonly<{
  latitude: number; // centro deslocado, nunca a coordenada exata
  longitude: number;
  radiusMeters: number;
}>;

type PublicEventPreview = Readonly<{
  id: string;
  activityType: { code: string; label: string };
  title: string;
  description: string;
  startsAt: string; // instante normalizado
  endsAt: string | null;
  timeZone: string; // identificador IANA do município
  location: { ufCode: string; municipalityCode: string; municipalityName: string; approximateArea: ApproximateEventArea };
  capacity: number;
  admissionMode: 'manual_approval' | 'automatic_entry';
  status: 'draft' | 'published_open';
}>;
```

`EventRepositoryPort` expõe leitura da anfitriã, `saveIfRevision`, contagem/lock de futuros por anfitriã e transição de publicação. `HostEligibilityPort`, `HostEventLimitPort`, `EventActivityTypeCatalogPort`, `MunicipalityTimeZonePort` e `ExactLocationProtectorPort` permanecem interfaces de domínio/aplicação. O schema proposto inclui `event`, `event_exact_location`, `event_activity_type` e `event_audit`; `event` armazena `venue_type`, instante normalizado e snapshot de `time_zone`, e o catálogo de municípios recebe o fuso IANA por migration/seed versionado. Há FKs para `account`, `municipality` e atividade, checks de estado/modalidade/capacidade/revisão, índice de `(host_account_id, status, starts_at)` e índice de município/estado para a TASK 24.

O contrato é aditivo no `v1`, mas só é consumível pelo BFF autorizado. `400/401/403/404/409/503` devem manter envelope seguro, não ecoar corpo, token, endereço ou sinal de segurança.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Não existe evento persistido. | Rascunho pode ser incompleto; publicação exige campos aprovados, início entre 24 h e 30 dias e duração máxima de 8 h. | RF017–RF021; ADR-054, ADR-060 |
| 2 | Não há autorização de anfitriã. | Backend reavalia foto, apresentação, interesses, contatos, termos e restrições por porta. | RF016, RN005, RN018 |
| 3 | Não há localização de evento. | Somente local público ou estabelecimento, ambos declarados como não residenciais; UF/município e área aproximada estável ficam na prévia; bairro e coordenada exata são protegidos e omitidos. | RN020–RN021; ADR-055 e ADR-061 aceitas |
| 4 | Não há estado de evento. | `draft` só transita para `published_open` nesta TASK; demais transições ficam para tarefas posteriores. | RF085 |
| 5 | Não há catálogo de tipos. | Tipo de atividade é catálogo próprio de Eventos, não interesse nem preferência. | RN147–RN149; ADR-044 |
| 6 | Não há limite de anfitriã. | Toda anfitriã pode manter um evento futuro ativo e dois publicados por 30 dias; capacidade máxima é 12 pessoas. Contagem e validação são atômicas. | RN047–RN049; ADR-057 aceita |
| 7 | Nenhuma rota de evento. | API retorna somente projeções explícitas por audiência, com BFF e sessão; `official` permanece `false`. | RN021, RN137; ADR-058 aceita |

## 6. Critérios de Aceitação

- Somente conta ativa e anfitriã habilitada cria, altera ou publica o próprio evento; ninguém escolhe anfitriã, estado, `official` ou capacidade por payload.
- Rascunho incompleto é recuperável; publicação rejeita dados ausentes, início fora de 24 h a 30 dias, término inválido ou acima de oito horas, capacidade ausente e local incompatível, sem gravar transição parcial.
- Publicação recusa categoria residencial; a anfitriã declara que o local não é residência, e endereço, bairro, nome do local ou coordenada exata nunca chegam a não confirmados.
- A prévia pública, erro, OpenAPI, logs, telemetria e auditoria não expõem bairro, ponto exato, contatos, token, conteúdo sensível, motivo de segurança ou valores brutos de endereço.
- Controllers, DTOs, guards e filtros obedecem `nestjs-expert`: `ValidationPipe`, `class-validator`, Swagger, constructor injection, erros tipados, `Test.createTestingModule` e Supertest.
- UoW, locks e índices impedem ultrapassar um evento futuro ativo e dois publicados por 30 dias sob concorrência; a capacidade nunca supera 12 pessoas, e a query de prévia não faz N+1 nem carrega ou descriptografa dados exatos.
- A feature permanece desabilitada até ADRs aceitas, migração, documentação, contrato e testes concluídos. A TASK 23.2 só começa após contrato estabilizado.

## 7. Plano de Testes

### Unitários e arquitetura

- Agregado/value objects: normalização, rascunho, transição permitida, campos obrigatórios, data/hora local/IANA, prazo de 24 h a 30 dias, duração máxima de oito horas, modalidade, categoria de local, capacidade, revisão e ausência de atualização arbitrária de estado.
- Casos de uso com `Test.createTestingModule`: posse, habilitação, limites de um evento futuro ativo e dois publicados por 30 dias, capacidade máxima de 12 pessoas, conflito, item de catálogo inativo, projeções e redaction.
- Testes de portas/adapters e arquitetura: Eventos não importa NestJS/Drizzle fora de infraestrutura, nem schema de outro contexto.

### Integração, HTTP e E2E backend

- PostgreSQL descartável: migration, checks/FKs/índices, seed versionado de fuso IANA por município, cifra/redaction da coordenada exata, rejeição de categoria residencial, estabilidade/deslocamento da área aproximada, CAS, lock concorrente dos limites e rollback transacional.
- Supertest: DTO inválido, BFF ausente, bearer ausente/expirado, sem capacidade, posse alheia, `409`, `503`, envelope/OpenAPI e prévia sem campos proibidos.
- Smoke autenticado de criar rascunho, recuperar, atualizar, pré-visualizar e publicar usando o contrato de localização da TASK 20.

```text
bun run --cwd back lint
bun run --cwd back typecheck
bun run --cwd back test
bun run --cwd back test:integration
bun run --cwd back test:e2e
bun run --cwd back build
bun run --cwd back db:check
bun run --cwd back db:migrate
```

Os testes que abrem porta ou Docker serão executados fora do sandbox com aprovação, conforme `AGENTS.md`.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---:|---:|---|
| Regressão no contrato estruturado de localização | baixa | alto | Reutilizar os códigos/validações da SDD-023 e cobrir FKs/DTOs de UF–município nos testes de Eventos. |
| Reidentificação da coordenada por mapa público | média | crítico | ADR-055: centro deslocado persistido, raio mínimo, resposta estável e testes contra exposição de bairro/coordenada exata. |
| Uso de residência como local | média | crítico | ADR-061: categoria restrita, declaração, recusa de valor residencial e testes negativos sem geocodificação. |
| Campos opcionais sensíveis ou sem política | alta | alto | ADR-056; não incluir no contrato antes de aprovação. |
| Limite contornado por concorrência | média | alto | UoW, lock por anfitriã, índice e teste concorrente. |
| Diferenciação futura gratuita/paga sem regras aprovadas | média | alto | MVP mantém um único conjunto de limites; categorias, cobrança e autorização exigem ADR futura. |
| API expõe rascunho como detalhe público | média | alto | DTOs de projeção separados, revisão OpenAPI e testes de resposta negativa. |

Rollout: aplicar migration em ambiente descartável → backend com `EVENTS_HTTP_ENABLED=false` → testes/smoke → publicar BFF/UI da TASK 23.2 → habilitar flag gradualmente. Rollback: desabilitar flag e reimplantar aplicação anterior; tabelas e dados são preservados, e qualquer ajuste ocorre por migration forward-only.

## 9. Perguntas em Aberto

- [x] Residência é proibida; publicação aceita somente local público ou estabelecimento com declaração não residencial, conforme ADR-061.
- [x] Contrato inicial adia capa/galeria à TASK 29, acessibilidade/alimentação à TASK 19 e custo/faixa etária/itens/orientações à TASK 30.
- [x] Fuso IANA é derivado do município; publicação exige 24 h a 30 dias de antecedência e duração máxima de oito horas.
- [x] Eventos oficiais ficam fora do MVP; `official=false` é imutável no fluxo comum.
- [x] Rascunho inativo expira após 30 dias; ponto exato é apagado sete dias após o encerramento/cancelamento do evento e é retido além disso somente em caso de denúncia, disputa ou obrigação legal, sujeito à validação jurídica brasileira antes do lançamento.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] ADRs materiais foram aceitas antes da implementação.
- [x] Código de produção, migration, contratos HTTP e adapters foram implementados conforme o plano.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão documentados e separados por audiência.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices` foi aplicado aos limites futuros do BFF; `nestjs-expert` foi aplicado ao backend.
- [x] Testes, migration e rollback foram implementados/verificados na medida do escopo desta TASK.
- [x] Perguntas em aberto foram exauridas.

## 11. Registro de implementação

- `EventsModule` e cinco casos de uso implementados em `back/src/modules/events/`, com DTOs, guards, filtro HTTP, Swagger, portas, agregado e adapters Drizzle/AES-GCM.
- `ProfilesModule` exporta a porta de elegibilidade de anfitriã; `identity-access` reconhece `events_write`; `catalog.municipality` persiste `time_zone`.
- Migration `back/drizzle/0014_events.sql` e journal Drizzle atualizados. A flag permanece desligada por padrão até rollout coordenado.
- Validações concluídas: backend typecheck, lint, build e `db:check`; 386 testes unitários, 66 testes PostgreSQL de integração, 3 testes HTTP de Eventos fora do sandbox e 10 testes específicos de Eventos. Frontend sem alteração funcional: lint, typecheck, 182 testes e build passaram. A flag de Eventos permanece desligada até o BFF da TASK 23.2 e o gate jurídico.
