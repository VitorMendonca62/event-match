# Task: Estruturar a região por UF e município

- **Slug:** regiao-estruturada
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-08
- **Status:** ready
- **Versão-alvo:** front/workspace `0.19.0`; back `0.17.0`, com contrato `v1` coordenado
- **Tipo:** breaking-change
- **Impacto público:** breaking

## 1. Contexto e Motivação

A TASK 20 substitui a entrada textual de região por uma seleção confiável de UF e município, usando códigos oficiais IBGE versionados no EventMatch. Hoje `region` é texto livre em cadastro, perfil, prévia, completude e PostgreSQL. Como o sistema ainda está em construção, a migration remove o texto livre sem preservar dados legados; a troca não pode introduzir consulta ao IBGE durante uma requisição.

Rastreabilidade: `specs/tasks.txt` TASK 20; `docs/DER-EventMatch-MVP.md` RF004, RF012, RF015, RF017, RF022–RF023, RN011–RN014 e RNF001; `docs/03-modelos-de-dominio.md` §2.2; `docs/04-integracoes-externas.md` §§3–5; ADR-038 e ADR-045.

## 2. Escopo

### Inclui

- Catálogo PostgreSQL de 27 UFs e municípios IBGE, com código estável, nome, UF, estado ativo/inativo, proveniência e atualização semestral versionada.
- Seleção de UF seguida de busca/seleção de município no cadastro e no perfil; o browser consulta somente BFF/backend e nunca IBGE.
- Endpoints públicos de catálogo com DTOs, OpenAPI, schemas estritos e limite de busca; um município é aceito apenas se ativo e pertencente à UF escolhida.
- Migration controlada que remove `profile.region` e exige localização estruturada para cadastro e perfil, sem inferência automática de texto antigo.
- Contratos próprios, prévia, completude, BFF, documentação, observabilidade allowlisted e cobertura de testes.
- Brasília como município selecionável dentro da UF Distrito Federal; itens inativos continuam legíveis em referências existentes e são bloqueados para seleção nova.

### Exclui

- Bairro, endereço, CEP, coordenada, geocodificação, localização em tempo real, distância calculada, recomendação e mapa.
- API IBGE, SDK ou download de dados no caminho de uma requisição; cache remoto ou carregamento da lista inteira no bundle.
- Inferência, normalização ou correção automática de texto legado.
- Alterar criação/descoberta de eventos além de preparar o contrato estruturado para tarefas futuras.

## 3. Impacto Arquitetural e ADRs

```text
Browser (cadastro/perfil)
  -> GET /api/catalog/federative-units | /municipalities?uf=XX&q=...
     -> BFF público, sem sessão/credencial interna
        -> NestJS CatalogController
           -> ListFederativeUnits / SearchMunicipalities (ports)
              -> Drizzle catalog adapter -> PostgreSQL

PUT cadastro/perfil
  -> BFF existente
     -> NestJS DTO + ValidationPipe
        -> caso de uso/entidade Profile (UoW + revisão)
           -> profile(uf_code, municipality_code) + FK composta
```

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Catálogo local IBGE, busca limitada e atualização semestral versionada | `docs/adrs/ADR-052-catalogo-versionado-de-ufs-e-municipios.md` | accepted | Elimina dependência de runtime e preserva auditoria. |
| Remoção de texto livre e contrato estruturado | `docs/adrs/ADR-053-transicao-de-regiao-legada-para-localizacao-estruturada.md` | accepted | Remove ambiguidade antes do primeiro lançamento. |

O contexto `catalog` recebe domínio, portas inbound/outbound, adapters Drizzle e controller NestJS. `profiles` e `registration` dependem de portas, nunca de ORM ou controller. Providers usam tokens e constructor injection; não há `forwardRef()`. ADR-052 e ADR-053 estão aceitas.

Regras Vercel aplicáveis: `async-api-routes` (validar UF/consulta antes do fetch), `server-parallel-fetching` (manter leituras independentes em paralelo), `server-no-shared-module-state`, `server-serialization`, `bundle-analyzable-paths`, `bundle-barrel-imports`, `client-event-listeners` e `rerender-derived-state-no-effect`. A busca de município deve ser client-only, debounced e cancelável; RSC continua padrão para carregar a visão inicial.

## 4. Contratos e Interfaces

### Catálogo NestJS/BFF

```ts
GET /api/v1/catalog/federative-units
200 { data: { federativeUnits: Array<{ code: UfCode; name: string }> }, message, statusCode }

GET /api/v1/catalog/municipalities?uf=SP&q=sao
200 { data: { municipalities: Array<{ code: IbgeMunicipalityCode; name: string; ufCode: UfCode }> }, message, statusCode }
400 // UF ou query inválida; 503 // indisponibilidade
```

As rotas BFF preservam `no-store`, `nosniff`, `no-referrer`, uma chamada upstream, `internal: false`, ausência de cookie/token e falha fechada. A UF é obrigatória; `q` é opcional e, quando usado, possui 2–80 caracteres normalizados. A resposta é limitada a 20 municípios e nunca inclui endereço ou geometria.

### Localização em cadastro/perfil

```ts
type StructuredLocation = Readonly<{
  ufCode: 'AC' | /* demais UFs */ 'TO';
  municipalityCode: string; // código IBGE, validado no servidor
  municipalityName: string; // somente projeção de leitura
}>;

type OwnProfileLocation = Readonly<{ location: StructuredLocation }>;
```

- Novo cadastro envia `ufCode` e `municipalityCode`; ausência, UF inválida, município inativo ou incompatível respondem `400`/motivo público allowlisted.
- Atualização de perfil mantém `revision` e exige a forma estruturada; não aceita texto livre nem combinação ambígua de campos.
- `GET /profiles/me` e prévia projetam somente localização estruturada. DTOs possuem `class-validator`, Swagger (`@ApiTags`, `@ApiOperation`, respostas) e schemas front estritos.

### PostgreSQL e ports

- `catalog.federative_unit(code char(2) PK, name, active, source_version, ...)`.
- `catalog.municipality(code char(7) PK, uf_code FK, name, active, source_version, ...)`, índice para `(uf_code, normalized_name)` e unicidade composta `(code, uf_code)`.
- `profiles.profile` substitui `region` por `uf_code` e `municipality_code`, com `CHECK` de presença conjunta e FK composta para município. Ambas podem ser nulas somente enquanto o perfil estiver apagado/expirado.
- Portas: `FederativeUnitCatalogReaderPort`, `MunicipalityCatalogReaderPort` e `MunicipalityCatalogAdminPort` (importação), injetadas em casos de uso de catálogo, cadastro e perfil. Adapters Drizzle são os únicos acessos ao PostgreSQL; gravações usam a UoW existente.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Região é texto livre de 2–80 caracteres. | Novo cadastro exige UF e município ativo compatíveis; texto não identifica município novo. | TASK 20, RF004 |
| 2 | Perfil mostra e edita sempre `region`. | Perfil mostra e edita UF+município; `region` é removido sem conversão automática. | TASK 20, RF012 |
| 3 | Não há catálogo geográfico. | Catálogo local usa código IBGE e atualização semestral versionada; sem IBGE em runtime. | TASK 20 |
| 4 | Não há tratamento de mudança administrativa. | Código inativo continua legível em referência existente, mas é recusado em gravação nova. | TASK 20, RF100 |
| 5 | Distância `same_city` não tem efeito geográfico. | Continua sem cálculo geográfico; a TASK apenas prepara identidade de cidade futura. | ADR-045 |
| 6 | Prévia exibe região textual. | Exibe somente município/UF estruturados; nunca endereço/CEP/coordenada. | RN011–RN014, RNF001 |

## 6. Critérios de Aceitação

- As 27 UFs e municípios ativos vêm exclusivamente do catálogo PostgreSQL versionado; o frontend não contém a lista completa nem consulta IBGE.
- Município retornado/gravado pertence à UF, está ativo e é identificado por código IBGE; Brasília pertence a `DF`.
- O cadastro novo não completa sem os dois códigos válidos; negar geolocalização do dispositivo não bloqueia seleção manual.
- `profile.region` é removido e todos os fluxos ativos usam somente UF+município estruturados, sem conversão automática de texto.
- Município inativo não aparece para nova escolha nem é aceito na escrita, mas continua legível em perfil histórico.
- DTOs, schemas BFF e OpenAPI são estritos; erros não ecoam valores, logs/telemetria não carregam texto de região, município, código, CEP, endereço ou coordenada.
- A atualização mantém transação, revisão otimista, `ValidationPipe`, Swagger, constructor injection e limites hexagonais; nenhum controller/Route Handler acessa PostgreSQL ou contém regra de domínio.
- Busca tem limite, debounce/cancelamento no cliente, acessibilidade por teclado/leitor de tela, estados de carregamento/erro e rótulos persistentes; a interface usa a paleta semântica existente.
- `CHANGELOG.md`, versões, `docs/03-*`, `docs/04-*` e ADRs aceitas são atualizados antes do release.

## 7. UX e acessibilidade

### Experiência no cadastro

- Na etapa atual de dados obrigatórios, o campo único “Bairro ou cidade” é substituído pelo bloco **“Onde você mora?”**. A explicação preserva a regra de privacidade: “Escolha seu estado e município. Não pedimos endereço, bairro, CEP ou sua localização do aparelho.”
- A ordem é obrigatoriamente **UF → município**. Primeiro, um `<select>` nativo rotulado “Estado”; em seguida, um combobox pesquisável rotulado “Município”, inicialmente desabilitado com a dica “Escolha primeiro seu estado”. Isso reduz lista, erro de combinação e carga cognitiva.
- Depois de escolher a UF, o foco permanece no controle acionado e uma região `aria-live="polite"` informa que o município já pode ser pesquisado. O campo de município aceita ao menos dois caracteres, apresenta “Buscando municípios…”, “Nenhum município encontrado” ou uma lista de no máximo 20 resultados; não seleciona resultado automaticamente.
- Teclado: Tab chega aos controles na ordem visual; setas percorrem a lista do combobox, Enter confirma, Escape fecha a lista e limpar/trocar UF remove imediatamente o município já escolhido. Leitor de tela recebe rótulo, dica, estado expandido, quantidade de resultados e erro associado por `aria-describedby`/`aria-errormessage`.
- O botão “Salvar e continuar” conserva o comportamento atual: uma tentativa incompleta mantém foco no primeiro campo inválido, mostra mensagem textual por campo e não depende de cor. Falha de rede preserva UF, texto da busca e município já selecionado para nova tentativa.

### Experiência na edição de perfil

- A seção “Dados básicos” mostra o mesmo bloco e os mesmos nomes/ordem do cadastro, evitando que a pessoa tenha de reaprender o fluxo. A localização salva aparece como “Município — UF”, com ação explícita para trocar estado; trocar UF exige selecionar novo município antes de salvar.
- A busca é acionada somente depois da UF e de uma pausa curta de digitação (proposta: 300 ms), cancela a requisição anterior e ignora respostas obsoletas. Nenhuma lista completa é pré-carregada ou enviada ao Client Component.
- O estado de erro do catálogo oferece ação de tentar novamente e mantém a seleção já confirmada. A indisponibilidade do catálogo não é apresentada como erro de endereço ou de digitação da pessoa.

### Direção visual e responsividade

- As superfícies permanecem no sistema **Convite Cívico / Operate** já documentado: fundo escuro, tokens semânticos existentes, controles `surface` com borda de 2 px, foco âmbar visível e sem novo sistema visual, gradiente ou sombra.
- Em desktop, os dois controles ficam empilhados na coluna do formulário ao lado da explicação “por que pedimos este dado”; em mobile e a 200% de zoom, formam uma única coluna com alvos de pelo menos 44 px e lista limitada à largura do viewport.
- Estado selecionado, indisponível, carregando e erro usam texto, ícone/indicador e borda além de cor. A UI respeita `prefers-reduced-motion`; não há animação necessária para revelar resultados.

### Entrega e verificação visual

- Criar/atualizar o surface brief do cadastro e do perfil para registrar o bloco de localização e os textos aprovados, preservando `PRODUCT.md`, `DESIGN.md` e a paleta obrigatória.
- Após a implementação, executar um passe visual limitado em desktop, mobile e zoom de 200%; rodar o detector Impeccable sobre os targets alterados e concluir o finish review. Cobrir também navegação por teclado, leitor de tela e redução de movimento.

## 8. Plano de Testes

- Domínio/catalog: validação de UF, código IBGE, compatibilidade UF–município, ativo/inativo, Brasília e normalização de busca.
- Aplicação: cadastro e perfil exigem localização; atualização respeita revisão; item inativo histórico lê, mas não grava.
- Persistência PostgreSQL: migration de remoção controlada, seed idempotente, FK composta, checks, índice de busca, transação e restauração de ambiente descartável.
- HTTP NestJS: DTOs inválidos, guards públicos, status/envelope, Swagger, `400`/`503`, ausência de dados sensíveis e Supertest.
- BFF: query allowlisted, `internal: false`, sem token/cookie, uma chamada, headers e falha fechada.
- Frontend: schemas, fluxo UF→busca de município, debounce/cancelamento, acessibilidade, cadastro, edição de perfil e serialização mínima.
- E2E com Docker: novo cadastro com localização estruturada, edição de perfil e seleção de município; smoke de migration/seed.

```text
bun run --cwd back lint && bun run --cwd back typecheck && bun run --cwd back test && bun run --cwd back build
bun run --cwd back test:integration
bun run --cwd back test:e2e
bun run --cwd front lint && bun run --cwd front typecheck && bun run --cwd front test && bun run --cwd front build
bun run --cwd front test:e2e
```

## 9. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---:|---:|---|
| Fonte IBGE muda formato ou códigos | média | alto | Artefato fixado, checksum, parser testado e revisão humana semestral. |
| Migration remove texto de desenvolvimento/teste | média | alto | Confirmar ausência de dados de produção, executar em ambiente descartável e manter backup operacional antes de qualquer primeiro deploy. |
| Contrato parcial entre front/back | média | alto | Publicação backend antes do frontend, schemas/contratos/E2E coordenados e changelog. |
| Busca retorna lista grande ou lenta | média | médio | UF obrigatória, mínimo de caracteres, limite 20 e índice normalizado. |
| Exposição indevida de localização | baixa | alto | Somente município/UF, redaction, sem endereço/CEP/coordenada e revisão de logs. |
| Município desativado interrompe edição | média | médio | Permitir leitura histórica e exigir troca somente quando a pessoa alterar para novo valor. |

Rollout: confirmar que não há dados a preservar e que `profile` está vazia; a migration falha fechada se encontrar perfil legado. Depois aplicar migration e seed no backend; publicar endpoints; publicar BFF/frontend; executar smoke com cadastro novo, edição de perfil e DF. Rollback antes da produção é restaurar o ambiente descartável/schema anterior; depois de dados reais, qualquer remoção de localização exige nova ADR e migration forward-only.

## 10. Perguntas em Aberto (bloqueantes)

- [x] ADR-052 aceita: catálogo local, busca mínima de dois caracteres/limite 20, atualização semestral, Brasília sob DF e política de inativos.
- [x] ADR-053 aceita: remoção de `profile.region`, exigência estruturada em todos os fluxos e transição de contrato.
- [x] Contrato `v1` será alterado de modo coordenado: backend/migration antes do frontend; não haverá rota `v2` nesta entrega pré-lançamento.

Não há perguntas bloqueantes; o plano está pronto para implementação.

## 11. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices` e `nestjs-expert` foram aplicadas conforme o escopo.
- [x] Testes, migration e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.
