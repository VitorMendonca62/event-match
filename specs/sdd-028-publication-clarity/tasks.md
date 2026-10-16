# Task: Clarificar validações e limites de publicação

- **Slug:** publication-clarity
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-09
- **Status:** implemented (2026-10-09)
- **Versão-alvo:** frontend/workspace `0.22.0` (release combinado com SDD-029); backend permanece `0.19.0`
- **Tipo:** fix
- **Impacto público:** none (sem alteração de API)

## 1. Contexto e Motivação

Após a entrega da SDD-027, a anfitriã relatou que o modal de publicação já está centralizado, mas ainda faltam explicações sobre campos obrigatórios, janela e duração do encontro e limite de eventos por anfitriã. A ausência de latitude/longitude só era percebida depois do comando, com uma mensagem genérica.

Rastreabilidade: TASK 31 em `specs/tasks.txt`; RF016–RF021 e RN047–RN049 em `docs/DER-EventMatch-MVP.md`; regras de publicação em `specs/sdd-025-backend-eventos/tasks.md`; tela e privacidade em `specs/sdd-027-frontend-eventos/tasks.md` e ADR-055, ADR-057, ADR-060 e ADR-061.

## 2. Escopo

### Inclui
- [x] Antes de confirmar publicação, validar no formulário os dados obrigatórios e associar mensagens precisas aos campos ausentes ou inválidos, especialmente latitude e longitude.
- [x] Destacar visualmente cada controle inválido, marcar `aria-invalid`, ligar o controle à explicação e focar um resumo navegável de erros.
- [x] Manter a validação exclusiva de publicação separada do salvamento permissivo de rascunho.
- [x] Explicar junto aos campos que o início deve ocorrer entre 24 horas e 30 dias e que o término é opcional, com duração máxima de 8 horas quando informado.
- [x] Explicar no formulário e na confirmação que, no MVP, qualquer anfitriã pode manter no máximo um evento futuro ativo e publicar até dois eventos em uma janela móvel de 30 dias; não há categoria paga.
- [x] Atualizar o changelog e preservar o modal de publicação centralizado nos dois eixos.

### Fora de escopo
- [ ] Alterar regras do domínio/backend, DTOs, rotas, OpenAPI, persistência ou mensagens de domínio.
- [ ] Implementar mapa, busca de local ou geocodificação (TASK 32 / SDD-029).
- [ ] Alterar a projeção de privacidade da localização exata.

## 3. Impacto Arquitetural e ADRs

Mudança limitada à interação do Client Component existente. O navegador antecipa erros comuns para orientar a pessoa; NestJS continua como autoridade final e não recebe publicação quando os campos obrigatórios já estão ausentes no formulário. Não há nova decisão arquitetural nem alteração de contrato que exija ADR.

```text
Browser (validação de publicação + resumo acessível)
  -> front/ BFF existente
    -> back/ NestJS (revalidação autoritativa inalterada)
```

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Reutilizar o formulário e contrato existentes | — | decidido | O escopo é cópia, feedback visual e validação antecipada, sem mudar a autoridade do backend. |

## 4. Contratos e Interfaces

- Nenhuma rota, DTO, porta, OpenAPI, status code, tabela ou migration muda.
- As mensagens do navegador apontam para os controles presentes; `saveEventDraft` continua aceitando rascunhos incompletos.
- O comando `publishEventDraft` permanece protegido e revalidado no NestJS, inclusive para data/hora, localização e limites concorrentes.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | O backend exige atividade, título, descrição, município, categoria pública, declaração não residencial, localização exata, início e capacidade; o formulário pode enviar a publicação incompleta. | A interface destaca os dados ausentes antes de abrir a confirmação; o backend conserva a decisão final. | RF016–RF021; `Event.validateForPublication`; ADR-054, ADR-057, ADR-061 |
| 2 | Início precisa ocorrer 24 h–30 d no futuro; duração máxima de 8 h se término informado. | Mesma regra com explicação visível junto aos campos de horário. | ADR-054 e SDD-025 |
| 3 | Todas as anfitriãs podem manter um evento futuro ativo e publicar até dois em 30 dias corridos. | Mesma regra com explicação visível antes de confirmar; sem categoria paga no MVP. | RN047–RN049; ADR-057 |

## 6. Critérios de Aceitação

- Clicar em publicar com latitude ou longitude ausente destaca o controle específico e explica a correção; o comando de publicação não é enviado.
- Outros dados obrigatórios ausentes também aparecem no resumo e junto ao campo, com contraste e associação acessível.
- Erros de formulário não impedem salvar rascunho incompleto.
- Texto de horários e limites é visível antes da confirmação e coincide com o backend.
- O resumo recebe foco sem deslocar o modal; modal permanece centralizado vertical e horizontalmente.
- Aplicar `vercel-react-best-practices` nas regras de renderização/estado aplicáveis (`rerender-derived-state-no-effect`, `js-early-exit`); sem dependência de terceiros ou carregamento extra.
- Manter a direção visual da superfície existente, paleta do `AGENTS.md`, teclado, zoom e layout móvel; sem alterar `DESIGN.md`.

## 7. Plano de Testes

- Revisão manual no formulário: publicação com latitude ausente, longitude ausente, ambos ausentes e preenchimento completo.
- Confirmar visualmente que rascunho incompleto continua salvando, textos dos limites ficam visíveis e o modal continua centralizado em desktop e mobile.
- Rodar detector aplicável do Impeccable e executar o finish review limitado à superfície alterada.
- Não adicionar nem executar testes automatizados nesta solicitação.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Validação visual divergir do backend | baixa | médio | Não alterar regras nem cálculos do domínio; espelhar somente os requisitos de presença e preservar o backend como autoridade. |
| Campo inválido continuar pouco perceptível | média | médio | Destaque no controle, resumo focável e mensagem específica vinculada ao campo. |

Sem migration; rollout e rollback são apenas frontend. Rollback: reverter frontend/workspace para `0.20.0`.

## 9. Perguntas em Aberto (bloqueantes)

Nenhuma.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs existentes.
- [x] Nenhum ADR novo é necessário para a mudança local de interface.
- [x] Nenhum código de produção foi escrito durante o planejamento.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explicitamente inalterados.
- [x] Performance, segurança e acessibilidade foram tratadas.
- [x] `vercel-react-best-practices` e `impeccable` foram aplicadas conforme o escopo.
- [x] Testes, migration e rollback estão planejados conforme as instruções superiores.
- [x] Perguntas em aberto foram exauridas.

## 11. Registro da Implementação

- Frontend/workspace `0.22.0` no release combinado com SDD-029; sem alteração no backend, contratos ou migration para SDD-028.
- Lint, typecheck e build do frontend passaram. Testes automatizados não foram executados nesta solicitação.
- Detector Impeccable retornou `[]` para o formulário de eventos.
- A revisão visual em navegador não pôde ser concluída: `/eventos/novo` redirecionou para `/entrar` e não havia sessão autenticada disponível. Capturas anteriores da SDD-027 não foram usadas como evidência visual desta mudança.
