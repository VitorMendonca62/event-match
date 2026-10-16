# Task: Entregar o frontend de criação, rascunho, prévia e publicação de eventos

- **Slug:** frontend-eventos
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-09
- **Status:** implemented
- **Versões:** backend `0.19.0`; frontend/workspace `0.20.0`
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e motivação

A TASK 23.1 entregou o agregado e os comandos autenticados de Eventos. A TASK 23.2 deve oferecer uma experiência web clara para anfitriãs habilitadas iniciarem, editarem, revisarem e publicarem seus próprios encontros, mantendo Browser -> BFF -> NestJS e as projeções por audiência.

Rastreabilidade: TASK 23.2 em `specs/tasks.txt`; `docs/DER-EventMatch-MVP.md` RF016-RF021, RF084-RF085, RN005, RN017-RN022, RN028-RN031, RN047-RN049 e RN137; ADR-054 a ADR-058, ADR-060 e ADR-061. O contexto Impeccable foi carregado: a superfície deve estender o sistema visual “Convite Cívico / Operate”, sem criar um sistema paralelo.

A ADR-062 aceita a extensão do catálogo necessária ao formulário. A recuperação por `eventId` já pertence à TASK 23.1; a interface manterá apenas uma referência mínima de sessão para retomar o rascunho conhecido, sem criar endpoint ou regra de domínio.

## 2. Escopo

### Inclui

- [x] Rotas autenticadas `/eventos`, `/eventos/novo` e `/eventos/novo/[eventId]`, condicionadas a `EVENTS_UI_ENABLED=false` por padrão.
- [x] Formulário client-side restrito a estado de apresentação: tipo de atividade, título, descrição, horários locais, UF/município, categoria de local, declaração não residencial, ponto exato, capacidade e modalidade de entrada.
- [x] BFF fino para criar, ler, salvar, pré-visualizar e publicar; validação Zod estrita, origem confiável, JSON, sessão HTTP-only, uma chamada upstream e redaction por schema.
- [x] Recuperação do rascunho conhecido pela anfitriã, prévia derivada do backend, conflitos de revisão, feedback acessível, componentes/testes e artefatos Impeccable.

### Exclui

- [ ] Regra de domínio, acesso PostgreSQL, validação final de publicação, descoberta, participação, mapas, geocodificação, residência, mídia e campos das TASKs 19, 29 e 30.
- [ ] Persistência de coordenadas, conteúdo ou respostas do backend no navegador; consulta direta do browser a NestJS, IBGE ou outro provedor.

## 3. Arquitetura e contratos

```text
RSC /eventos e /eventos/novo
  -> catálogos públicos validados no servidor
Client EventForm
  -> /api/events/drafts[/[eventId]][/preview|/publish]
     -> events-bff.ts (sessão, mesma origem, schema, redaction)
        -> /api/v1/events/* (NestJS)
```

| Necessidade | Contrato planejado | Estado |
|---|---|---|
| Selecionar atividade | `GET /api/v1/catalog/event-activity-types?locale=pt-BR` | ADR-062 aceita |
| Criar | `POST /events/drafts` | já entregue |
| Ler/editar | `GET`/`PUT /events/drafts/:eventId` | já entregue |
| Revisar | `GET /events/drafts/:eventId/preview` | já entregue |
| Publicar | `POST /events/drafts/:eventId/publish` | já entregue |

O BFF adicionará `EVENTS_UI_ENABLED` a `bff-env.server.ts`, `front/.env.example`, README, fixtures e testes de ambiente. Quando desligada, rotas e handlers retornam 404 sem chamar o backend. `events-bff.ts` receberá dependências injetáveis (`env`, `fetchImpl`) e usará `server-only`, `callBackend`, `jsonResponse`, `readSessionCookie`, `expiredSessionCookie`, `hasTrustedOrigin` e `hasJsonContentType` já existentes. Mutações devolvem 403 antes do upstream se origem/JSON forem inválidos; `401` expira a sessão; `400`, `403`, `404`, `409` e `503` mantêm envelopes neutros. Logs contêm somente operação, status, duração e correlation id.

## 4. UX e acessibilidade

- `/eventos` apresenta a ação de iniciar encontro e, quando houver uma referência de sessão válida, a de continuar o rascunho conhecido; estados vazio, carregando, indisponível e sessão expirada são explícitos.
- `/eventos/novo` cria um rascunho somente após comando consciente e navega para a rota identificada. Após criação ou leitura bem-sucedida, o cliente guarda exclusivamente o UUID do rascunho em `sessionStorage`, com schema e TTL versionados; `/eventos/novo/[eventId]` sempre recarrega o estado autoritativo pelo BFF. Conteúdo, coordenadas, token e respostas nunca entram no storage.
- O formulário usa etapas/grupos curtos: proposta, onde, quando, vagas e entrada. Localização vem antes do horário porque o backend deriva o fuso pelo município e exige esse dado para persistir horário local. Ações persistentes mostram “Salvar rascunho”, “Ver prévia” e “Publicar” no momento apropriado; não há autosave implícito.
- A navegação das etapas acompanha o padrão lateral do perfil: links e estado de preenchimento em desktop, faixa horizontal sticky no mobile; a prévia mostra participantes confirmados sobre a capacidade total no formato inicial `0/vagas`.
- `LocationField` é reutilizado com textos contextualizados para o local do encontro, mantendo UF antes de município, busca cancelável/debounced e sem endereço, bairro, CEP ou localização do aparelho.
- Horários aceitam data/hora local sem offset e explicam que o fuso vem do município. A tela mostra o fuso retornado, não oferece seletor manual e não reimplementa janela de publicação ou regras de duração.
- A prévia renderiza exclusivamente `PublicEventPreview`: município/UF e área abstrata textual, nunca `exactLocation`, latitude/longitude, contatos, auditoria ou motivo interno. A confirmação de publicação reconsulta a revisão e trata `409` preservando o formulário.
- Erro é associado ao campo com texto, `aria-describedby`/`aria-errormessage`; sumário recebe foco. Indicadores de carregamento, sucesso e conflito usam regiões ao vivo. Teclado, leitor de tela, redução de movimento, mobile e zoom 200% são requisitos de aceite.
- Antes de editar UI, registrar `front/.impeccable/surfaces/src-app-eventos-page-tsx.md`; após implementação, executar capturas desktop/mobile, detector limitado e finish review conforme Impeccable.

## 5. Etapas de implementação

1. Implementar e validar a extensão NestJS/OpenAPI/documentação definida pela ADR-062 antes de ligar a UI.
2. Adicionar flag e `events-bff.ts`; criar Route Handlers delegadores e schemas públicos separados para lista, proprietário e prévia.
3. Criar RSCs protegidos e a ilha `EventForm`; carregar em paralelo sessão, UFs e tipos de atividade, serializando somente opções e projeções necessárias.
4. Reutilizar `LocationField` com API de cópia contextual e criar entradas acessíveis para horários, coordenadas, declaração, capacidade e modalidade.
5. Implementar salvar, revalidar, prévia, publicar e recuperação, preservando edição local ao receber conflito e sem retries automáticos de mutações.
6. Documentar rotas, flag, contratos e rollout; concluir testes, revisão visual e verificações do workspace.

## 6. Plano de testes

- Unitários: schemas de Eventos, serialização local mínima, mensagens por status, formulário, horários locais, controles de capacidade/modalidade e ausência de campos proibidos na prévia.
- Integração BFF: flag desligada, método/corpo inválido sem upstream, sessão ausente/expirada, uma chamada com bearer interno, schemas estritos, redaction, `400/401/403/404/409/503` e mutações sem retry.
- E2E: anfitriã habilitada cria rascunho, salva, retorna pelo UUID preservado na sessão, reabre, edita, pré-visualiza e publica; cobertura de sessão expirada, conflito, API indisponível, dados inválidos e inspeção de que prévia não exibe coordenada/ponto exato.
- Visual: desktop, mobile e zoom 200%, `axe`, ausência de rolagem horizontal, teclado e `prefers-reduced-motion`.

```text
bun run --cwd front lint
bun run --cwd front typecheck
bun run --cwd front test
bun run --cwd front test:server-boundary
bun run --cwd front build
bun run --cwd front test:e2e
```

Os testes que iniciam portas ou Docker serão executados fora do sandbox por aprovação, conforme `AGENTS.md`.

## 7. Riscos, rollout e rollback

| Risco | Mitigação |
|---|---|
| Catálogo divergente ou codificado no cliente | ADR-062, schema estrito e endpoint autoritativo. |
| Rascunho não retomado na sessão atual | UUID versionado com TTL em `sessionStorage`, rota por UUID e leitura autoritativa; sem conteúdo no storage. |
| Exposição de ponto exato | Schemas separados, snapshot/E2E negativo e nenhuma coordenada na prévia. |
| Conflito entre abas | Revisão obrigatória, `409` tratada e recarga explícita da versão remota. |
| Backend e UI com versões incompatíveis | `EVENTS_UI_ENABLED=false` até backend, BFF, E2E e smoke coordenados. |

Rollout: backend/OpenAPI com extensões aceitas -> frontend/BFF com `EVENTS_UI_ENABLED=false` -> testes e smoke autenticado -> habilitação gradual de `EVENTS_HTTP_ENABLED` e `EVENTS_UI_ENABLED`. Rollback: desligar primeiro `EVENTS_UI_ENABLED`, depois `EVENTS_HTTP_ENABLED`; preservar dados e corrigir somente com migration/contrato forward-only quando necessário.

## 8. Perguntas em aberto

- [x] ADR-062 aceita: catálogo de tipos de atividade ativo e versionado será lido por endpoint público limitado e entregue pelo proxy server-only do Next.js.

## 9. Checklist de conformidade

- [x] Código, contratos e documentação existentes foram inspecionados.
- [x] `vercel-react-best-practices`, Impeccable e limites NestJS foram aplicados ao plano.
- [x] ADR necessária foi aceita para a decisão material.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos, testes, privacidade, observabilidade, rollout e rollback foram planejados.
- [x] Decisões materiais aceitas; plano pronto para implementação.

## 10. Implementação e validação

- [x] Extensão NestJS/OpenAPI do catálogo implementada conforme ADR-062; DTOs anuláveis permitem limpar localização sem omissão ambígua.
- [x] Flag, BFF, Route Handlers, páginas autenticadas, formulário, prévia filtrada e publicação implementados; sessão persiste somente a referência mínima do rascunho.
- [x] Documentação, changelog e versões atualizados; sem migration nova.
- [x] Testes unitários, integração BFF, fronteira server-only, build, lint, typecheck e E2E desktop/mobile executados; resultados registrados na revisão final Impeccable.

Resultados finais em 2026-10-09:

- Frontend: lint, typecheck, build e fronteira server-only aprovados; 201 testes passaram (930 assertions); E2E passou nos 4 cenários desktop/mobile.
- Backend: lint, typecheck e build aprovados; 390 testes passaram (1 snapshot, 1.124 assertions); integração PostgreSQL passou em 8 arquivos (67 assertions).
- Revisão visual Impeccable: `ship`; os seis achados foram resolvidos e não houve regressões. Registro em `front/.impeccable/review/sdd-027-finish-review.md`.
- Revisão de arquitetura e código: `APROVADO`; `git diff --check` passou. Nenhum commit foi criado.

### Refinamento de navegação e participantes — 2026-10-09

- O resumo “Seu rascunho” foi substituído por navegação lateral por etapas, com estado de preenchimento e comportamento responsivo alinhado à barra lateral do perfil.
- “Salvar rascunho”, “Ver prévia” e “Publicar” ficam na barra lateral; no celular, ficam fixos na parte inferior junto do estado de salvamento. As cópias no fim do formulário foram removidas.
- A prévia agora apresenta `0/{capacidade}` participantes/vagas, deixando claro que o limite inclui a anfitriã. A projeção da API não foi alterada.
- Frontend lint, typecheck, build e detector Impeccable aprovados. Testes automatizados e nova revisão visual autenticada não foram executados nesta solicitação.
