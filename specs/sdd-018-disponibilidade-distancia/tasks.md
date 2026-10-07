# Task: Adicionar disponibilidade geral e distância preferida ao perfil

- **Slug:** disponibilidade-distancia
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-06
- **Status:** ready — ADR-045 aceita em 2026-10-06; nenhuma pergunta em aberto
- **Versão-alvo:** workspace/front `0.16.0`; back `0.15.0`
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A Task 16 pede que a pessoa informe **quando costuma participar** e **até onde pretende se deslocar**, sem agenda detalhada, endereço, coordenada ou localização contínua, preparando contratos para a futura descoberta (RF023) sem implementá-la.

Decisões de produto confirmadas em 2026-10-06:

| Tema | Decisão |
|---|---|
| Disponibilidade | grade de 7 dias × 4 períodos pelo dia do calendário: madrugada (0h–6h), manhã (6h–12h), tarde (12h–18h), noite (18h–24h); madrugada de sexta = sexta das 0h às 6h |
| Fuso | implícito: hora local da região da pessoa; nenhum campo de fuso |
| Distância | faixas fixas: até 2 km, até 5 km, até 10 km, até 25 km, qualquer lugar na minha cidade; ou não informar |
| Unidade | km |
| Privacidade | ambos sempre privados, sem controle de compartilhamento; prévia não mostra |
| Ordem com a Task 20 | Task 16 primeiro; a distância é guardada como preferência sem efeito geográfico até existir município estruturado |

Rastreabilidade: `docs/DER-EventMatch-MVP.md` RF015, RF023, RF081; RN011–RN014, RN148; RNF001–RNF002; §3.10 (disponibilidade e distância **não** são catálogos). `docs/02-regras-de-negocio.md` §2; `docs/03-modelos-de-dominio.md` §§2.2, 2.11 e 3; `docs/04-integracoes-externas.md` (perfil). ADR-038, ADR-043, ADR-044, ADR-045. Brief `front/.impeccable/surfaces/src-app-perfil-page-tsx.md`.

> **Gate de execução:** concluído em 2026-10-06 com o aceite da ADR-045.

## 2. Escopo

### Inclui

- [ ] Value objects de domínio `AvailabilitySlot` (28 códigos `<weekday>_<period>`) e `PreferredDistance` (5 faixas), fechados e versionados no código.
- [ ] Seleção de 0–28 slots únicos e de uma faixa de distância ou `null`, removíveis.
- [ ] Ampliar agregado, repositório, purga de expiração, visão própria e update atômico com revisão.
- [ ] Garantir que a prévia e a telemetria **nunca** contenham os campos.
- [ ] Migration aditiva `0010` com tabela de slots, coluna de distância, CHECKs, FK em cascata e índice.
- [ ] Nova seção em `/perfil`, logo após "Como você gosta dos encontros": grade acessível de disponibilidade e grupo de rádios de distância.
- [ ] Atualizar docs 02–04, OpenAPI, `CHANGELOG.md`, versões, surface brief e testes.
- [ ] Revisão visual Impeccable delimitada (desktop, mobile, zoom 200%) e finish review.

### Exclui

- Calendário, datas específicas, recorrência, horários livres ou compromissos.
- Campo de fuso, conversão de fuso ou deslocamento entre fusos.
- Localização do aparelho, coordenada, endereço, CEP, geocodificação, cálculo de distância, rota ou rastreamento (RN012–RN013).
- Região estruturada UF/município (Task 20).
- Busca, filtro, ranking ou recomendação de eventos (RF023 futuro) e porta de leitura para descoberta.
- Exposição a terceiros, visibilidade `authenticated|public` ou exibição na prévia.
- Alterações em completude, capacidades, interesses, preferências de atividades ou eventos.

### Entregas verticais

1. **Domínio e persistência:** value objects, agregado, porta do repositório, adapter, purga, migration e testes.
2. **Contrato HTTP:** DTOs, OpenAPI, visão própria, BFF e testes.
3. **Experiência web:** seção acessível, presets, E2E e validação visual.

## 3. Impacto Arquitetural e ADRs

### Estrutura prevista

```text
back/drizzle/0010_profile_availability_distance.sql

back/src/modules/profiles/
├── domain/value-objects/availability.ts                (+ AvailabilitySlot, PreferredDistance, ordem canônica)
├── domain/entities/profile.ts                          (+ availabilitySlots, preferredDistance)
├── domain/ports/outbound/profile-repository.port.ts    (estado persistido inclui os novos campos)
├── domain/services/profile-preview-projector.ts        (sem mudança de saída; teste de omissão)
├── application/use-cases/profile.use-cases.ts          (input + ownView)
├── infrastructure/persistence/
│   ├── schema/profiles.schema.ts                       (+ coluna, profileAvailabilitySlot)
│   ├── drizzle-profile-repository.adapter.ts           (ler/substituir slots, gravar distância)
│   └── drizzle-profile-writer.adapter.ts               (purga na expiração)
└── presentation/http/dto/
    ├── profile-request.dto.ts                          (+ 2 campos obrigatórios)
    └── profile-response.dto.ts                         (+ 2 campos na visão própria)

front/src/features/profile/
├── components/profile-availability-field.tsx          (novo, Client)
├── components/profile-form.tsx                         (monta a seção e o payload)
├── contracts.ts                                        (+ enums e campos)
└── messages.ts                                         (+ rótulos pt-BR)
```

Nenhum módulo, porta de catálogo, endpoint ou Route Handler novo.

### Fluxo

```text
GET /perfil (RSC, no-store; sem fetch novo)
  -> GET /api/v1/profiles/me  -> availabilitySlots[] canônicos + preferredDistance
  -> ilha cliente recebe só esses dois campos a mais

PUT /api/profile (browser)
  -> BFF: sessão, origem, JSON, 8 KiB (28 códigos curtos cabem), Zod estrito
  -> PUT /api/v1/profiles/me
     -> ValidationPipe: enums, unicidade, tamanho
     -> UpdateOwnProfile [UoW + revision]
        -> Profile.update valida e normaliza para ordem canônica
        -> update profile.preferred_distance + replace profile_availability_slot
  <- visão própria com os dois campos

GET /perfil/previa -> ProfilePreviewProjector: nunca inclui os campos
```

### Hexagonal, DI e NestJS (`nestjs-expert`)

- Os enums são value objects do domínio de `profiles` (sem NestJS/Drizzle). Não há porta de catálogo, pois a escala é fixa (ADR-045).
- `Profile.update` é o único ponto de validação de regra. O DTO repete as restrições de formato só para falhar cedo com `400`, sem regra de negócio adicional.
- Adapters `@Injectable()` com constructor injection, sem provider novo, `forwardRef()` ou dependência circular. O `ProfilesModule` não muda.
- DTO de request com `@IsArray() @ArrayMaxSize(28) @ArrayUnique() @IsIn(AVAILABILITY_SLOTS, { each: true })` e `@IsIn(PREFERRED_DISTANCES) @ValidateIf(v => v !== null)`. Também `@ApiProperty` com `enum`, `maxItems: 28`, `uniqueItems` e `nullable`.
- Nenhum `ProfileErrorCode` novo; violações de domínio usam `INVALID_PROFILE_CONTENT` (`400`).

### RSC, Client Components e performance (`vercel-react-best-practices`)

- Sem fetch adicional: os dados chegam no perfil já carregado (`async-parallel` preservado com quatro leituras).
- Rótulos e enums ficam em módulos estáticos importados diretamente (`bundle-barrel-imports`, `bundle-analyzable-paths`), sem request por interação.
- A ilha recebe só `availabilitySlots: string[]` e `preferredDistance` (`server-serialization`).
- Estado único (`Set` de slots e a faixa); contador e estado dos presets são derivados na renderização (`rerender-derived-state-no-effect`); presets e limpar alteram estado no handler (`rerender-move-effect-to-event`).
- BFF sem estado de módulo e sem PostgreSQL (`server-no-shared-module-state`, `server-auth-actions`).

### PostgreSQL e migration

`back/drizzle/0010_profile_availability_distance.sql`, aditiva e forward-only:

| Objeto | Alteração/colunas | Constraints e índices |
|---|---|---|
| `profile` | `preferred_distance text NULL` | `CHECK (preferred_distance IS NULL OR preferred_distance IN ('up_to_2km','up_to_5km','up_to_10km','up_to_25km','same_city'))` |
| `profile_availability_slot` | `account_id uuid`, `weekday text`, `period text`, `selected_at timestamptz` | PK `(account_id, weekday, period)`; `CHECK weekday IN ('mon','tue','wed','thu','fri','sat','sun')`; `CHECK period IN ('early_hours','morning','afternoon','evening')`; FK `account` `ON DELETE CASCADE`; índice `(weekday, period)` para a descoberta futura |

Sem seed. Contas existentes ficam com conjunto vazio e `preferred_distance = NULL`. O limite de 28 é estrutural (PK sobre domínio finito). Ledger passa a ter **11** migrations.

Rollback: UI desligada, aplicações revertidas, schema e dados preservados; sem down migration destrutiva.

### ADRs

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Enums fechados (não catálogo) para slots e faixas; relação normalizada de slots; coluna de distância; fuso implícito; sempre privado sem coluna de visibilidade; independência da Task 20 | `docs/adrs/ADR-045-disponibilidade-e-distancia-no-perfil.md` | accepted | Define semântica, privacidade, persistência e contrato; diverge deliberadamente do padrão de visibilidade por grupo (RF081). |
| Snapshot completo + revisão otimista; `private` por padrão | `docs/adrs/ADR-038-modelo-de-completude-e-visibilidade-do-perfil.md` | accepted | Reutilizada sem mudança. |
| Relação normalizada + substituição na mesma UoW | `docs/adrs/ADR-043-identidade-opcional-e-catalogo-de-idiomas.md`, `ADR-044` | accepted | Padrão reutilizado. |

Toda ADR necessária deve estar `accepted` antes da implementação.

## 4. Contratos e Interfaces

### 4.1 Domínio (pseudocódigo)

```ts
// profiles/domain/value-objects/availability.ts
export const AVAILABILITY_WEEKDAYS = ['mon','tue','wed','thu','fri','sat','sun'] as const;
export const AVAILABILITY_PERIODS = ['early_hours','morning','afternoon','evening'] as const; // early_hours = madrugada, 0h–6h do próprio dia
export type AvailabilitySlot = `${Weekday}_${Period}`;           // 28 códigos
export const AVAILABILITY_SLOTS: readonly AvailabilitySlot[];   // ordem canônica
export const PREFERRED_DISTANCES = ['up_to_2km','up_to_5km','up_to_10km','up_to_25km','same_city'] as const;
export type PreferredDistance = (typeof PREFERRED_DISTANCES)[number];
export function toCanonicalOrder(slots: readonly AvailabilitySlot[]): AvailabilitySlot[];

ProfileState += {
  availabilitySlots: readonly AvailabilitySlot[];   // ordem canônica, 0..28, únicos
  preferredDistance: PreferredDistance | null;
};
// PersistedProfileState herda os dois campos sem hidratação (não há catálogo).
```

`Profile.update` rejeita com `INVALID_PROFILE_CONTENT` slot fora do enum, duplicado ou faixa inválida, e normaliza para a ordem canônica independentemente do payload.

### 4.2 HTTP NestJS

Envelope padrão e `Cache-Control: no-store`.

| Método e rota | Mudança | Sucesso | Falhas | Auth |
|---|---|---|---|---|
| `GET /api/v1/profiles/me` | `+ availabilitySlots: AvailabilitySlot[]` (ordem canônica), `+ preferredDistance: PreferredDistance \| null` | `200` | `401`, `403`, `404`, `503` | sessão |
| `PUT /api/v1/profiles/me` | `+ availabilitySlots` (0..28, únicos, enum) e `+ preferredDistance` (enum ou `null`), **chaves obrigatórias** | `200` | `400`, `401`, `403`, `409`, `422` (existentes), `503` | sessão + capacidade |
| `GET /api/v1/profiles/me/preview` | **sem mudança**: nunca contém os campos | `200` | inalteradas | sessão |

Compatibilidade: aditiva na leitura. No `PUT`, a ausência das chaves responde `400`, então front e back são publicados de forma coordenada, como nas SDD-016/017. O OpenAPI vai para `0.15.0`.

### 4.3 BFF e frontend

- `contracts.ts`: `availabilitySlotSchema = z.enum(AVAILABILITY_SLOTS)`, `preferredDistanceSchema = z.enum(PREFERRED_DISTANCES)`; `ownProfileSchema` com `availabilitySlots: z.array(...).max(28)` e `preferredDistance: ...nullable()`; `updateProfileSchema` com unicidade por refine. Os enums do front espelham o contrato OpenAPI, sem regra de negócio.
- `profilePreviewSchema` **não** ganha campos; por ser `.strict()`, se o backend vazar os campos a prévia falha fechada.
- `PUT /api/profile` não muda além de repassar os campos; mantém 8 KiB, mesma origem e sem retry.
- `messages.ts`: `AVAILABILITY_WEEKDAY_LABELS`, `AVAILABILITY_PERIOD_LABELS` (com faixa horária) e `PREFERRED_DISTANCE_LABELS`.

### 4.4 UX e acessibilidade (`impeccable`)

- Seção sem card **"Quando e até onde você costuma ir"** logo após "Como você gosta dos encontros". A frase de apoio diz que é opcional, privado e que só será usado para sugerir encontros quando esse recurso existir, sem prometer recomendação.
- **Disponibilidade:** `<table>` com `<caption>`, cabeçalhos de linha (dias) e de coluna na ordem do relógio ("Madrugada 0h–6h", "Manhã 6h–12h", "Tarde 12h–18h", "Noite 18h–24h"). Cada célula tem um checkbox nativo ≥ 44 px com nome acessível completo ("Sábado à noite", "Sexta de madrugada (0h–6h)"). Uma nota curta sob a tabela esclarece que "a madrugada de sexta vai da 0h às 6h de sexta". A mesma tabela serve desktop e 390 px (dia + 4 colunas de 44 px), sem layout alternativo; se o zoom 200% não comportar, o cabeçalho da madrugada abrevia para "Madrug." com o texto completo no nome acessível.
- Presets como botões (`type="button"`): "Dias úteis à noite" e "Fins de semana" **acrescentam** slots; "Limpar" remove todos. Contador "n períodos marcados" em `aria-live="polite"`.
- **Distância:** `radiogroup` com `Choice type="radio" appearance="chip"`: "Não informar" (padrão), "Até 2 km (dá para ir a pé)", "Até 5 km", "Até 10 km", "Até 25 km", "Qualquer lugar na minha cidade". A nota diz que a distância é contada a partir da região informada e que o EventMatch não pede a localização do aparelho.
- Não há toggle de visibilidade. Uma linha fixa diz "Só você vê estas informações."
- A prévia não mostra nada destes campos e não exibe placeholder de "privado" para eles.
- Erros de `400` no salvamento usam o resumo existente; a validação Zod no cliente impede estados inválidos.
- Teclado, leitor de tela (tabela navegável), zoom 200%, mobile e `prefers-reduced-motion` validados. O surface brief do `/perfil` é atualizado **antes** da UI, sem mudança durável em `DESIGN.md`.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Perfil não registra disponibilidade nem distância. | Disponibilidade opcional em 0–28 slots dia × período; distância opcional em cinco faixas. Ambos removíveis. | RF081, ADR-045 |
| 2 | — | Períodos têm janelas fixas (madrugada 0–6, manhã 6–12, tarde 12–18, noite 18–24) do próprio dia do calendário, em hora local da região; não há horário exato. | Task 16, ADR-045 |
| 3 | — | A distância é relativa à região informada, nunca a endereço ou aparelho; até a Task 20 não tem efeito geográfico. | RN011–RN013, ADR-045 |
| 4 | Grupos opcionais têm visibilidade `private\|authenticated`. | Disponibilidade e distância são **sempre privadas** e nunca projetadas. | RN014, Task 16, ADR-045 |
| 5 | Completude com seis itens. | Inalterada; os campos não concedem capacidade. | RF016, ADR-038 |
| 6 | Update por snapshot + revisão. | Os campos participam da mesma mutação atômica. | ADR-038 |
| 7 | — | Sem uso em busca/filtro/recomendação nesta entrega. | Task 16 |
| 8 | Expiração de conta incompleta purga dados de perfil. | Também remove slots e anula a distância. | ADR-017, ADR-045 |

## 6. Critérios de Aceitação

- `PUT` aceita 0–28 slots únicos do enum e faixa válida ou `null`. Slot desconhecido, duplicado, 29 itens ou faixa inválida resulta em `400`, sem gravar nenhuma parte do snapshot.
- A resposta devolve slots na ordem canônica, independentemente da ordem do payload.
- Ausência das chaves novas no `PUT` resulta em `400`.
- Contas existentes e novas começam com `[]` e `null`.
- Prévia, respostas de erro, logs e métricas nunca contêm slots ou distância.
- Conflito de revisão responde `409`, sem substituição parcial dos slots.
- Expiração purga e exclusão de conta cascateia.
- Alterar os campos não muda completude, capacidades, interesses nem preferências.
- A tela não solicita localização do aparelho.
- Controller/DTO com Swagger completo; DTOs `class-validator`; DI por construtor; `Test.createTestingModule` nos testes de composição.
- O frontend não acessa PostgreSQL nem duplica regra; o BFF falha fechado.
- A grade é operável por teclado e leitor de tela, sem deslocamento de layout. Desktop, mobile (390 px) e zoom 200% sem rolagem horizontal.
- Regras Vercel citadas na §3 aplicadas e verificadas na revisão.
- Um passe conjunto de capturas desktop/mobile/zoom, correção em lote, no máximo uma confirmação e finish review Impeccable.

## 7. Plano de Testes

### Backend unitário

- Value objects: 28 códigos, ordem canônica (madrugada antes da manhã), `toCanonicalOrder`; `fri_early_hours` corresponde a sexta 00:00–06:00.
- `Profile`: 0/28 slots válidos; duplicado, desconhecido e 29 rejeitados; faixa inválida rejeitada; `null` aceito; normalização de ordem.
- `UpdateOwnProfile`: grava e devolve os campos; conflito; interesses e completude inalterados.
- `ProfilePreviewProjector`: nunca inclui os campos, para qualquer combinação.
- Telemetria: eventos sem slots nem distância.
- DTO/HTTP via `Test.createTestingModule`: `400` sem chaves, enum inválido, 29 itens; metadados Swagger.

### Backend integração/PostgreSQL

- Upgrade `0009 -> 0010`: defaults, CHECKs de weekday/period/distância, PK, FK com cascata, índice e ledger com 11 migrations.
- Compare-and-set concorrente entre duas transações: um vencedor e relação íntegra.
- Rollback da UoW sob falha não deixa slots parciais.
- Purga de expiração remove slots e anula a distância.

### Backend E2E (Supertest)

- `GET /me` com `[]`/`null`; `PUT` válido em ordem embaralhada volta canônico; `400` (sem chaves, enum, 29 itens, faixa); `409`; prévia sem os campos; OpenAPI `0.15.0`.

### Frontend unitário/integração

- Schemas estritos (prévia rejeita campos extras), rótulos, presets (acrescentar/limpar), contador, rádios com "Não informar", payload completo.
- BFF `PUT /api/profile` repassa os campos; a prévia falha fechada se o upstream vazar os campos.

### Frontend E2E/visual (Playwright)

- Login → `/perfil` → marcar por teclado → preset "Fins de semana" → escolher "Até 5 km" → salvar → recarregar e conferir → prévia sem os campos → limpar e "Não informar" → salvar.
- Axe desktop/mobile, `expectNoHorizontalScroll` em 390 px e 640×400 (zoom 200%).
- Capturas `perfil-disponibilidade-{desktop,mobile,zoom200}.png` para o finish review.

### Comandos de validação

```text
bun run --cwd back lint
bun run --cwd back typecheck
bun run --cwd back test
bun run --cwd back test:integration
bun run --cwd back test:e2e
bun run --cwd back build
bun run --cwd front lint
bun run --cwd front typecheck
bun run --cwd front test
bun run --cwd front test:e2e
bun run --cwd front build
```

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Pessoa achar que a distância já filtra encontros | média | médio | copy explícita ("ainda não usamos"), nenhuma promessa; ADR registra a semântica até a Task 20. |
| Rotina semanal exposta | baixa | alto | sempre privado; prévia `.strict()` sem os campos; testes de omissão em projector, E2E e telemetria. |
| Grade densa no mobile | média | médio | tabela de dia + 4 colunas com alvos de 44 px, cabeçalho abreviável, presets para reduzir toques, validação em 390 px e zoom 200%. |
| Backend novo rejeitar `PUT` do front antigo | aceita na janela | alto | `PROFILE_UI_ENABLED=false` durante migration/deploy; publicação coordenada e smoke. |
| Substituição parcial de slots | baixa | alto | UoW única + compare-and-set; teste de concorrência e de rollback. |
| Fuso implícito errado para quem se desloca entre fusos | baixa | baixo | documentado na ADR-045; fora do MVP. |
| Formulário longo | média | médio | seção compacta, sem card; revisão Impeccable delimitada. |

**Dependências:** PR #7 (SDD-016) e PR #8 (SDD-017) devem estar integrados antes, porque esta entrega amplia o mesmo snapshot do `PUT`. Não depende da Task 20.

**Rollout:** `PROFILE_UI_ENABLED=false` → migration `0010` → backend `0.15.0` → frontend `0.16.0` → smoke de perfil/prévia → E2E/capturas → `PROFILE_UI_ENABLED=true` → monitorar só contagens de resultado. **Rollback:** UI desligada, aplicações revertidas, schema e dados preservados; correções forward-only.

## 9. Perguntas em Aberto (bloqueantes)

- [x] Períodos: madrugada/manhã/tarde/noite com janelas 0–6, 6–12, 12–18 e 18–24 pelo dia do calendário; madrugada de sexta = sexta 0h–6h (decidido 2026-10-06; madrugada incluída e semântica escolhida a pedido).
- [x] Fuso: implícito pela região, sem campo (decidido 2026-10-06).
- [x] Faixas: até 2/5/10/25 km e "na minha cidade", em km (decidido 2026-10-06).
- [x] Visibilidade: sempre privado, sem toggle (decidido 2026-10-06).
- [x] Ordem: Task 16 antes da Task 20; distância sem efeito geográfico até lá (assumido em 2026-10-06 a partir do aceite da proposta; confirmar no aceite da ADR).
- [x] Produto/arquitetura aceita a ADR-045 como escrita (inclui a divergência do padrão de visibilidade por grupo do RF081), em 2026-10-06.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR foi criado e aceito para cada decisão material.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices`, `impeccable` e `nestjs-expert` foram aplicadas conforme o escopo.
- [x] Testes, migration e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.
