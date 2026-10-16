# SDD-030 — Correções da busca de local e prévia de eventos

- **Slug:** event-location-review-fixes
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-09
- **Status:** implemented (2026-10-09)
- **Versão-alvo:** correção de manutenção das superfícies 0.20.0 (backend) e 0.22.0 (frontend), sem alteração de contrato
- **Tipo:** correção / cobertura de testes
- **Impacto público:** sem mudança de contrato; aviso de privacidade da integração passa a aparecer antes do primeiro uso do mapa

## 1. Contexto e motivação

A revisão dos SDD-027, SDD-028 e SDD-029 encontrou assertions de migration e prévia desatualizadas, falta de testes diretos para a busca e para a contenção PostgreSQL, e drift visual em controles de mapa. ADR-064 também exige aviso antes do uso, pois a centralização/carregamento de tiles já compartilha município, área visível e IP com o serviço público.

## 2. Escopo

### Inclui
- [x] Incluir `event_location_search_rate_gate` no snapshot de tabelas da integração e esperar 15 migrations; verificar singleton, timestamp operacional e ausência de colunas de dados pessoais.
- [x] Atualizar o E2E para afirmar que a prévia tem `location.approximateArea` e que nem a projeção nem o payload serializado contém `exactLocation`.
- [x] Completar o runner E2E com configurações padrão de busca e tiles exigidas quando os eventos estão habilitados.
- [x] Criar testes de unidade de `SearchEventLocations` para ownership, município, forma allowlisted e falha do provider.
- [x] Criar testes de unidade do adapter Nominatim para filtragem geográfica, projeção permitida e indisponibilidade.
- [x] Criar teste de integração PostgreSQL provando que adapters/conexões concorrentes compartilham o limite de uma aquisição por segundo.
- [x] Exibir informação curta sobre município/consulta, IP e área visível antes de montar o mapa e disparar tráfego ao OSM.
- [x] Trocar sombras e blur por superfície tonal e bordas; manter estados de foco e contraste.
- [x] Remover `console.log(error)` de fluxos de eventos sem registrar mensagens/dados sensíveis.

### Fora de escopo
- [ ] Mudar endpoints, schemas, regras de domínio, ADR-064 ou comportamento do provedor.
- [ ] Reimplementar componentes ou ampliar a superfície de mapa.

## 3. Impacto arquitetural e ADRs

Sem mudança arquitetural. Mantêm-se a busca autenticada em NestJS, porta `PlaceSearchPort`, adapter Nominatim, porta de rate gate, PostgreSQL como contenção global, BFF same-origin e mapa client-side sob demanda. ADR-064 permanece aceito; esta mudança faz a interface cumprir a divulgação já descrita na decisão.

## 4. Contratos e documentação

Nenhuma alteração de contrato HTTP ou schema. Ajustar somente a documentação de integração se o texto atual sobre o aviso precisar ser alinhado à implementação. A migration 0015 continua forward-only e preservada.

## 5. Plano de implementação

1. Atualizar snapshots de banco e assertions de preview conforme migration/contrato atuais.
2. Completar ambiente do runner E2E para satisfazer configuração de busca e tiles ao habilitar a UI.
3. Acrescentar testes unitários da aplicação e adapter cobrindo autorização, município, allowlist e indisponibilidade.
4. Acrescentar integração PostgreSQL com ao menos duas conexões simultâneas usando o adapter de produção.
5. Colocar aviso de privacidade no formulário antes da ação que abre/monta o mapa; retirar sombra/blur dos controles e camadas relacionados; remover logs crus de erro.
6. Rodar detector visual, E2E autenticado com capturas desktop/mobile, testes de integração PostgreSQL, lint/typecheck/build e suites unitárias aplicáveis.
7. Revisar `git diff` preservando mudanças preexistentes; não criar commit.

## 6. Critérios de aceitação

- Assertions refletem migration 0015 e verificam finalidade operacional sem PII.
- Preview valida a área aproximada nested e não expõe localização exata.
- Busca, geocoder e contenção entre conexões têm cobertura direta dos caminhos de sucesso/falha indicados.
- O texto de divulgação antecede qualquer chamada de centralização/tiles iniciada ao abrir o mapa.
- Componentes afetados não usam sombras ou blur, e os controles continuam legíveis e acessíveis.
- Nenhum erro cru é escrito em console nos use cases de eventos.
- O E2E autenticado completa em uma porta local livre e atualiza as capturas relevantes.

## 7. Plano de validação

- Unitários backend: casos de uso de busca e adapter Nominatim.
- Integração backend: schema/migration, rate gate em múltiplas conexões e suite de integração.
- Frontend: E2E autenticado de eventos, lint, typecheck, build e detector Impeccable após os ajustes visuais.
- Não adicionar testes fora dos critérios desta tarefa; os testes explicitamente necessários fazem parte do escopo pedido.

## 8. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Um teste de concorrência depender de sincronização frágil | Usar pool com conexões distintas, barreira para disparo conjunto e assert sobre exatamente uma aquisição bem-sucedida. |
| Divulgação aparecer depois da montagem do mapa | Colocar aviso fora do componente lazy, antes do botão/ação de abertura; manter mapa desmontado até a ação explícita. |
| Remoção de sombras reduzir separação dos controles | Usar fundo opaco de `background`/`card`, borda de 2px e separadores existentes; rever screenshots em desktop e mobile. |
| E2E ainda falhar por ambiente externo | Registrar a causa objetiva; não encerrar processos alheios nem mudar portas configuradas sem necessidade. |

## 9. Perguntas em aberto

Nenhuma. A localização dos testes e o texto do aviso seguem os padrões existentes e a divulgação de ADR-064.

## 10. Registro de implementação e validação

- `bun run --cwd back lint`, `typecheck` e `build`: aprovados.
- `bun run --cwd back test`: 398 testes aprovados, 1.145 assertions.
- `scripts/test-back-integration.sh`: 68 testes aprovados, 256 assertions; inclui duas conexões PostgreSQL distintas concorrendo pelo rate gate.
- `bun run --cwd front lint`, `typecheck`, `test` e o build no runner E2E: aprovados; 201 testes frontend, 931 assertions.
- `FRONT_E2E_PORT=3100 bun run --cwd front test:e2e tests/e2e/eventos.e2e.ts`: 4 testes aprovados em Chromium desktop e mobile; capturas de formulário e prévia atualizadas.
- Detector Impeccable direcionado aos componentes de eventos sem achados. `git diff --check` aprovado.
- O runner usa `3100` porque a `3005` foi ocupada entre tentativas; nenhum processo alheio foi encerrado.
- Sem alteração de contrato, schema, changelog ou ADR. A migration 0015 permanece forward-only e preservada.
