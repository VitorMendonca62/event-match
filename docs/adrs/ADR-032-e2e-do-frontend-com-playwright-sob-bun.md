# ADR-032: E2E do frontend com Playwright executado pelo Bun

- **Status:** accepted
- **Data:** 2026-09-29
- **Decisores:** frontend, backend e qualidade
- **Relacionado:** `specs/sdd-012-e2e-frontend-cadastro/tasks.md`, SDD-010 §7, SDD-011 §7, ADR-022, ADR-023, ADR-027
- **Substitui/Substituído por:** N/A

## Contexto

A SDD-010 e a SDD-011 exigem um E2E full-stack do cadastro: navegador real contra Next.js, NestJS, PostgreSQL descartável e o Brevo falso. Hoje `front/tests/e2e/` está vazio. Os testes do frontend renderizam componentes em HTML estático e testam o BFF contra um backend fingido; nada prova juntos o cookie `HttpOnly`, o `303` do link, o `<dialog>` nativo, o foco, o `sessionStorage` e a navegação do App Router.

O runner do backend (`scripts/test-back-e2e.sh` + `docker-compose.back.test.yml`) já sobe PostgreSQL, o Brevo falso e o NestJS, aplica as migrations e expõe `E2E_DATABASE_URL` e `E2E_FAKE_BREVO_URL`.

Em 2026-09-29, um teste descartável confirmou que `@playwright/test` 1.63.0 roda com `bunx --bun playwright test` neste ambiente (Pop!_OS 24.04, Chromium de fallback do Ubuntu 24.04), incluindo foco dentro de `<dialog>` e `toMatchAriaSnapshot`, tanto no Chromium quanto no Firefox.

## Drivers da decisão

- Navegador real, com cookies, `<dialog>`, foco e árvore de acessibilidade.
- Bun como runtime e gerenciador (AGENTS.md §2), sem Node obrigatório.
- Consultas por papel e nome acessível (`getByRole`), que também validam a semântica usada por leitores de tela.
- Diagnóstico de falhas (trace, captura) sem guardar PII.
- Nenhuma mudança no código de produção por causa do teste.

## Opções consideradas

Ferramenta:

1. `@playwright/test` como runner, executado com `bunx --bun`.
2. Biblioteca `playwright` dentro de `bun test`.
3. Cypress.
4. Puppeteer.

Acesso do suporte de teste ao estado do backend (limite de origem, versões de documento):

- A. Conexão direta ao banco descartável, restrita ao suporte de E2E (escolhida).
- B. Endpoint de teste no NestJS (por exemplo, `/__test/reset`): descartada, porque coloca código de teste em produção e amplia a superfície de ataque.
- C. Fingerprint variável por teste via header aceito só fora de produção no BFF: descartada, pelo mesmo motivo.
- D. SQL pelo shell (`docker compose exec postgres psql`): mesmo acesso, mais frágil e menos legível.

## Decisão

Adotar a opção 1.

- **Dependências de desenvolvimento do `front/`**, fixadas exatamente: `@playwright/test` `1.63.0` e `@axe-core/playwright` `4.13.0` (checagem automatizada de acessibilidade: contraste, nomes, papéis). Os navegadores são baixados por `bunx playwright install chromium firefox`, fora do repositório.
- **Navegadores:** Chromium e Firefox desde a primeira entrega, porque o fluxo depende de `<dialog>` nativo e de foco, que variam entre motores, e o Firefox é o navegador da revisão com Orca. Projetos: `chromium-desktop` (1440×900), `chromium-mobile` (390×844, toque) e `firefox-desktop` (1440×900); o Firefox do Playwright não emula `isMobile`, por isso não há `firefox-mobile`. WebKit pode entrar depois como projeto adicional sem nova ADR.
- **Execução:** `bun run --cwd front test:e2e` chama `scripts/test-front-e2e.sh`, que reaproveita `docker-compose.back.test.yml` (PostgreSQL, Brevo falso, NestJS) e sobe o Next.js **no host** com `next build` + `next start`, `NODE_ENV=test`, `EDGE_PROVIDER=fixture` e porta fixa (`FRONT_E2E_PORT`, padrão `3100`), porque `FRONTEND_PUBLIC_URL` precisa ser igual à origem do navegador. O backend recebe o mesmo `FRONTEND_PUBLIC_URL` para gerar o link de e-mail. O ambiente é derrubado ao final, com ou sem falha.
- **Arquivos:** `front/playwright.config.ts` e `front/tests/e2e/**/*.e2e.ts`. O sufixo `.e2e.ts` evita que `bun test` (unitários/integração) execute esses arquivos.
- **Isolamento:** o suporte de teste acessa o PostgreSQL descartável só por `E2E_DATABASE_URL`. Isso é uma exceção deliberada e restrita à regra “PostgreSQL somente pelo backend” (AGENTS.md §§5 e 10): vale apenas para `front/tests/e2e/support/`, nunca para `front/src/`, e apenas contra o banco criado pelo runner. A exceção será escrita no AGENTS.md §10 quando esta ADR for aceita. O acesso usa `Bun.SQL` (sem nova dependência) para: limpar `verification_rate_window` de escopo `origin` antes de cada cenário (o `fixture` gera sempre a mesma fingerprint e o limite é de dez desafios por origem/hora), publicar uma nova versão de documento e ler estados para asserções. O OTP e o link são lidos em `GET /__messages` do Brevo falso. Cenários destrutivos (documentos ausentes) ficam num projeto separado que roda por último.
- **Artefatos:** trace e captura apenas em falha, em `front/test-results/` e `front/playwright-report/` (ignorados pelo Git). Dados de teste usam `example.test`, senhas e datas fictícias; nenhum segredo real.
- **Aria snapshots** versionados apenas para estrutura (papéis e nomes), sem e-mail, código ou dado pessoal.

## Consequências positivas

- Cobre o que hoje não é testado em conjunto: cookie `HttpOnly`, callback `303`, diálogos, foco, `sessionStorage`, reload e cancelamento.
- `getByRole` e o axe detectam regressões de acessibilidade antes da revisão manual.
- Sem mudança em código de produção nem em contratos.

## Consequências negativas e riscos

- Duas dependências de desenvolvimento e o download de dois navegadores (~270 MB) por máquina/CI.
- Três projetos aumentam o tempo de execução (estimativa: 2 a 3 vezes o de um só navegador).
- Chromium e Firefox rodam em builds de fallback neste sistema (Pop!_OS não é suportado oficialmente pelo Playwright); o teste descartável passou nos dois.
- `next start` com `NODE_ENV=test` é não padrão; se o Next forçar `production` em tempo de execução, o cookie `__Host-`/`Secure` e a validação de HTTPS impediriam o teste em `http://localhost`. Validar no primeiro passo da implementação; alternativa: `next dev` apenas no runner, registrada no plano.
- O suporte de teste acessa o banco diretamente; isso fica restrito a `front/tests/e2e/support/` e a ambientes descartáveis.
- O E2E fica mais lento que os unitários (estimativa: poucos minutos), por isso roda antes de PR, não a cada alteração.

## Plano de adoção e rollback

Adicionar as dependências com `bun add -d`, criar a configuração, o script e os cenários. Rollback: remover as dependências, `playwright.config.ts`, `tests/e2e/*.e2e.ts` e o script; nenhum efeito em produção, API ou banco.

## Evidências e referências

- `specs/sdd-010-frontend-nextjs-fluxo-cadastro/tasks.md` §2.0 e §7
- `specs/sdd-011-publicar-conteudo-documentos-legais/tasks.md` §7
- `scripts/test-back-e2e.sh`, `docker-compose.back.test.yml`, `back/test/support/fake-brevo-server.ts`
- `AGENTS.md` §§2, 5 e 10
