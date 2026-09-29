# Task: Criar o E2E full-stack do cadastro no navegador e a revisão com leitor de tela

- **Slug:** e2e-frontend-cadastro
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-29
- **Status:** draft
- **Versão-alvo:** 0.11.0 (ainda não publicada; só testes e ferramentas de desenvolvimento)
- **Tipo:** chore
- **Impacto público:** none

## 1. Contexto e Motivação

A TASK 10 de `specs/tasks.txt` fecha pendências apontadas na revisão da SDD-010/SDD-011 (2026-09-29):

- SDD-010 §2.0: “Pendentes: runner E2E full-stack do frontend e revisão com leitor de tela real.”
- SDD-011 §7: E2E de aceite total, recusa, documento ausente e troca de versão.

Estado verificado:

- `front/tests/e2e/` contém só `.gitkeep`. `bun run --cwd front test` roda 78 testes unitários e de integração (componentes em HTML estático e BFF contra backend fingido).
- `bun run --cwd back test:e2e` passa 18/18 contra PostgreSQL descartável, o Brevo falso e o NestJS em container (`scripts/test-back-e2e.sh`, `docker-compose.back.test.yml`). O Brevo falso expõe `GET /__messages`.
- A fingerprint de origem no modo `fixture` é constante (`front/src/shared/server/origin-fingerprint.ts`), e o backend limita dez desafios por origem/hora (`docs/02-regras-de-negocio.md` §2).
- Teste descartável de 2026-09-29: `@playwright/test` 1.63.0 roda com `bunx --bun playwright test` neste ambiente.
- Há um problema provável de foco em “Rever documentos” (`terms-consent.tsx`): o diálogo do documento abre antes de o `alertdialog` fechar, e o foco pode voltar para um elemento inerte. O E2E deve confirmar ou descartar.

Rastreabilidade: `docs/DER-EventMatch-MVP.md` v1.3 RF001–RF007, RNF (acessibilidade e segurança); `docs/02-regras-de-negocio.md` §2; `docs/04-integracoes-externas.md` (BFF do cadastro); ADR-011, ADR-021 a ADR-025, ADR-028 a ADR-031.

## 2. Escopo

Inclui:

- [ ] Dependências de desenvolvimento `@playwright/test` 1.63.0 e `@axe-core/playwright` 4.13.0 no `front/`, fixadas exatamente (ADR-032).
- [ ] `front/playwright.config.ts`: `testMatch: '**/*.e2e.ts'`, projetos `chromium-desktop` (1440×900), `chromium-mobile` (390×844, toque), `firefox-desktop` (1440×900) e `destructive` (roda por último, depende dos demais), trace/captura só em falha, `workers: 1`.
- [ ] `scripts/test-front-e2e.sh` e o script `test:e2e` em `front/package.json`: reaproveita `docker-compose.back.test.yml`, aplica migrations, sobe o backend com `FRONTEND_PUBLIC_URL=http://localhost:${FRONT_E2E_PORT}`, faz `next build` + `next start` no host com `NODE_ENV=test`, `EDGE_PROVIDER=fixture`, segredos descartáveis e o mesmo `BFF_INTERNAL_TOKEN`; espera `/cadastro` responder, roda o Playwright com Bun e derruba tudo em `trap`.
- [ ] `docker-compose.back.test.yml`: `FRONTEND_PUBLIC_URL: ${FRONTEND_PUBLIC_URL:-http://localhost:3000}` (hoje fixo), mantendo o E2E do backend igual.
- [ ] Suporte de teste em `front/tests/e2e/support/`: `brevo.ts` (último OTP/link por destinatário), `db.ts` (`Bun.SQL` sobre `E2E_DATABASE_URL`: limpar janela de origem, publicar nova versão de documento com `content`/digest coerentes, aposentar documentos no projeto destrutivo), `flow.ts` (passos reutilizáveis: nascimento, e-mail, OTP, senha + aceites, dados, interesses, revisão).
- [ ] Cenários em `front/tests/e2e/*.e2e.ts` (§7).
- [ ] `.gitignore`: `front/test-results/`, `front/playwright-report/`, `front/blob-report/`.
- [ ] Roteiro manual de leitor de tela em `specs/sdd-012-e2e-frontend-cadastro/leitor-de-tela.md` (Orca + Firefox no Pop!_OS; NVDA ou VoiceOver quando houver acesso), com tabela de resultado por etapa, data, leitor e navegador.
- [ ] Documentação: `front/README.md` (como rodar, pré-requisito `bunx playwright install chromium firefox`), `AGENTS.md` §2 (novo comando) e §10 (exceção: o suporte de E2E pode acessar o PostgreSQL descartável criado pelo runner, nunca `front/src/`), `CHANGELOG.md` 0.11.0, SDD-010 §2.0 e SDD-011 §7 marcando as pendências como resolvidas.
- [ ] Se o E2E confirmar falhas reais (por exemplo, o foco em “Rever documentos”), corrigi-las nesta task com teste que falhava antes.

Exclui:

- WebKit e Firefox em viewport móvel (o Firefox do Playwright não emula `isMobile`); podem entrar depois sem nova ADR.
- Pipeline de CI (não existe hoje no repositório).
- Automação de leitor de tela real (Guidepup e similares só funcionam com VoiceOver/NVDA em macOS/Windows).
- Reenvio **depois** dos 60 s de cooldown e expiração natural de 15 min do OTP em tempo real; o E2E cobre o bloqueio antes do cooldown e a expiração por ajuste de `expires_at` no banco. O resto já está no E2E do backend.
- Falha simulada da Brevo e contato já existente com copy idêntica: já cobertos no E2E do backend; o front só exibe a resposta neutra (coberto em integração).
- Mudanças de contrato, schema ou migrations.

## 3. Impacto Arquitetural e ADRs

```text
scripts/test-front-e2e.sh
  ├─ docker compose (docker-compose.back.test.yml): postgres, fake-brevo, back(:random)
  │    back: FRONTEND_PUBLIC_URL=http://localhost:3100, BFF_INTERNAL_TOKEN=<descartável>
  ├─ host: next build && next start -p 3100  (NODE_ENV=test, EDGE_PROVIDER=fixture)
  └─ bunx --bun playwright test
        Chromium/Firefox ──HTTP──> Next.js :3100 (RSC + BFF) ──> NestJS ──> PostgreSQL
        support/brevo.ts ──> fake-brevo /__messages   (OTP e link)
        support/db.ts    ──> PostgreSQL (E2E_DATABASE_URL, só em ambiente descartável)
```

- Nenhum código de produção muda por causa do teste. A exceção é corrigir defeitos reais que o E2E encontrar.
- `.e2e.ts` separa o Playwright do `bun test`; `tsconfig`/ESLint do front passam a incluir os novos arquivos sem regra especial.
- Acesso direto ao banco fica só no suporte de teste, nunca em `front/src/`, preservando “PostgreSQL somente pelo backend” no produto. A exceção para o suporte de E2E será escrita no AGENTS.md §10 (ADR-032). Endpoint de teste no NestJS e header de fingerprint aceito fora de produção foram descartados por mexerem em código de produção.

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Playwright + axe como ferramental E2E, executado pelo Bun; Chromium e Firefox; Next no host com `NODE_ENV=test`; isolamento por `Bun.SQL` no banco descartável, com exceção explícita no AGENTS.md §10 | `docs/adrs/ADR-032-e2e-do-frontend-com-playwright-sob-bun.md` | proposed | Novas dependências e novo runner. |

Todo ADR necessário deve estar `accepted` antes da implementação.

## 4. Contratos e Interfaces

Sem mudança de rota, DTO, OpenAPI, porta ou schema.

Novos comandos e variáveis (apenas desenvolvimento/teste):

| Item | Valor |
|---|---|
| `bun run --cwd front test:e2e` | `../scripts/test-front-e2e.sh` |
| `FRONT_E2E_PORT` | porta fixa do Next no host (padrão `3100`) |
| `E2E_FRONT_URL`, `E2E_FAKE_BREVO_URL`, `E2E_DATABASE_URL` | exportadas pelo script para o Playwright |
| Pré-requisitos | Docker, Bun, `back/.env.test.local` (o mesmo do E2E do backend), `bunx playwright install chromium firefox` |

Assinaturas do suporte (pseudocódigo):

```ts
// support/brevo.ts
lastOtp(address: string): Promise<string>;
lastLink(address: string): Promise<string>;      // URL do callback confirm-link

// support/db.ts
resetOriginWindow(): Promise<void>;              // DELETE verification_rate_window WHERE scope = 'origin'
publishTermsVersion(kind, version): Promise<string>;   // nova linha approved vigente, content + sha256
retireCurrentDocuments(): Promise<void>;         // só no projeto destructive
expireLatestVerification(): Promise<void>;       // o contato é cifrado; usa o desafio pendente mais recente
```

## 5. Regras de Negócio

Nenhuma regra muda. O E2E verifica as regras existentes:

| # | Regra | Verificação E2E | Origem |
|---|---|---|---|
| 1 | Menor de idade não avança nem informa contato | cenário 3 | RN001, ADR-019 |
| 2 | WhatsApp desabilitado, sem requisição | cenário 4 | ADR-025 |
| 3 | OTP neutro, bloqueio, cooldown | cenário 5 | ADR-009 |
| 4 | Aceite só em memória, três documentos, recusa | cenários 1, 9 | ADR-011, ADR-031 |
| 5 | Nova versão durante o fluxo exige novo aceite | cenário 10 | ADR-028 |
| 6 | Cancelar expira no backend e libera o contato | cenário 8 | ADR-030 |
| 7 | Retomada pelo estágio remoto; `sessionStorage` só com allowlist | cenários 6, 15 | ADR-011, ADR-021 |
| 8 | Link de uso único, URL final limpa | cenário 2 | ADR-024 |

## 6. Critérios de Aceitação

- `bun run --cwd front test:e2e` sobe o ambiente, roda todos os cenários nos projetos `chromium-desktop`, `chromium-mobile` e `firefox-desktop` (e `destructive` por último) e derruba containers e o processo do Next mesmo em falha.
- Nenhum cenário depende de ordem, exceto o projeto `destructive`. Cada cenário usa e-mail único em `example.test`.
- Consultas por papel e nome acessível (`getByRole`, `getByLabel`); seletores CSS só quando não houver alternativa.
- Axe sem violações `serious`/`critical` em cada etapa, nos três projetos.
- A 390 px e com zoom de 200% (viewport 640×400 CSS px), sem rolagem horizontal (`scrollWidth <= clientWidth`).
- Foco: título da etapa focado após cada transição; diálogo do documento recebe foco ao abrir e devolve ao link ao fechar; “Rever documentos” deixa o foco dentro do diálogo reaberto.
- Segurança observável: o cookie de continuação não aparece em `document.cookie`; a URL e o histórico não contêm `token=`; o `sessionStorage` só tem chaves da allowlist (sem e-mail, senha, OTP, nascimento, aceites).
- Traces, capturas e aria snapshots não contêm e-mail, OTP ou senha em claro fora de valores fictícios.
- `bun run --cwd front lint`, `typecheck`, `test` e `build`; `bun run --cwd back test` e `test:e2e` continuam verdes.
- Regras Vercel: nenhuma alteração de runtime; se houver correção de defeito, citar a regra aplicável (`rerender-move-effect-to-event`, etc.).

## 7. Plano de Testes

Cenários E2E (`front/tests/e2e/`):

1. **Caminho feliz** (`cadastro.e2e.ts`): apresentação → nascimento adulto → e-mail → OTP do Brevo falso → senha + três aceites pelo diálogo → dados → três interesses → revisão com novo nascimento → `/cadastro/concluido`; cookie expirado e `sessionStorage` vazio ao final.
2. **Link de e-mail** (`link.e2e.ts`): pedir código num contexto; abrir o link em **outro contexto** do navegador; `303` para `/cadastro` sem `token` na URL/histórico; aviso “E-mail confirmado”; etapa senha no novo contexto.
3. **Menor de idade**: recusa com explicação, sem campo de e-mail e sem cookie.
4. **WhatsApp**: opção desabilitada, “Em breve”, nenhuma requisição ao BFF ao interagir.
5. **OTP**: código errado → mensagem neutra; cinco erros → bloqueio neutro; “Reenviar” indisponível antes de `nextResendAt`; código expirado (via `expires_at` no banco) → mensagem neutra.
6. **Retomada**: reload em `otp`, `password`, `required_data`, `interests` e `review` volta à etapa certa; após reload depois da senha, a revisão pede os aceites de novo.
7. **Sessão expirada**: remover o cookie (ou revogar a sessão no banco) → aviso “Sessão expirada” e recomeço.
8. **Cancelar** (`cancelamento.e2e.ts`): “Cancelar cadastro” após a senha → volta a `/`; novo cadastro com o mesmo e-mail chega ao OTP.
9. **Recusa** (`documentos.e2e.ts`): Recusar → `alertdialog` → “Rever documentos” reabre o mesmo documento com foco dentro; Recusar → “Cancelar cadastro” encerra.
10. **Troca de versão**: aceitar os três, publicar nova versão de Termos no banco, concluir → aviso “Documentos atualizados”, aceites zerados, aceitar de novo e concluir.
11. **Documentos ausentes** (projeto `destructive`): aposentar os vigentes → aviso de bloqueio e “Salvar senha” desabilitado.
12. **Menos de três interesses**: continuar indisponível e contador textual.
13. **Só teclado**: caminho feliz inteiro com `Tab`/`Enter`/`Espaço`/`Esc`, sem mouse.
14. **Acessibilidade**: axe por etapa; aria snapshots de etapa e diálogos; sem rolagem horizontal a 390 px e a 200%.
15. **Armazenamento e cookies**: allowlist do `sessionStorage`, cookie fora de `document.cookie`, nada sensível na URL.

Validação:

```bash
bun run --cwd front lint && bun run --cwd front typecheck && bun run --cwd front test && bun run --cwd front build
bun run --cwd front test:e2e
bun run --cwd back test && bun run --cwd back test:e2e
```

Manual (roteiro `leitor-de-tela.md`): Orca + Firefox, caminho feliz, erro de OTP, diálogo de documento, recusa e cancelamento; registrar o resultado e abrir correções para o que falhar.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| `next start` forçar `NODE_ENV=production` (cookie `Secure`, HTTPS obrigatório) | média | alto | Validar no primeiro passo; alternativa: `next dev` só no runner, registrada no plano e na ADR-032. |
| Limite de dez desafios por origem/hora com fingerprint constante | alta | médio | `resetOriginWindow()` antes de cada cenário. |
| Cenário de documentos ausentes afetar os demais | alta | médio | Projeto `destructive` por último; ambiente descartável por execução. |
| Testes instáveis por tempo (countdown, animações, rede) | média | médio | Asserções com espera automática do Playwright; sem `waitForTimeout`; datas absolutas do backend. |
| Chromium e Firefox de fallback no Pop!_OS | baixa | baixo | Teste descartável passou nos dois; fixar versão do Playwright. |
| Comportamento diferente de `<dialog>`/foco entre Chromium e Firefox | média | médio | É justamente o que o projeto `firefox-desktop` detecta; corrigir no componente, não no teste. |
| Porta fixa ocupada | baixa | baixo | `FRONT_E2E_PORT` configurável; o script falha com mensagem clara. |
| Vazamento de PII em trace/captura | baixa | médio | Dados fictícios em `example.test`; artefatos ignorados pelo Git e só em falha. |

Rollout: só desenvolvimento. Rollback: remover dependências, configuração, script e cenários (ADR-032). Sem migration.

## 9. Perguntas em Aberto (bloqueantes)

- [ ] Aceitar a ADR-032 (Playwright + axe, Chromium e Firefox, Next no host, `Bun.SQL` no suporte com exceção no AGENTS.md §10)?
- [x] Manter o cenário 11 (documentos ausentes) no projeto `destructive` ou deixá-lo só na integração do BFF? **Decidido em 2026-09-29: manter no projeto `destructive`, que roda por último.**

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material (ADR-032).
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos (sem mudança).
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices` e `nestjs-expert` foram aplicadas conforme o escopo (sem mudança de runtime).
- [x] Testes, migration e rollback estão planejados (sem migration).
- [ ] Perguntas em aberto foram exauridas.
