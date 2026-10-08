---
version: 1
slug: "src-app-cadastro-page-tsx"
primary_target: "src/app/cadastro/page.tsx"
related_targets: ["src/app/page.tsx","src/app/cadastro/concluido/page.tsx"]
---

# Cadastro — surface brief

Scope: `/` (apresentação), `/cadastro` (fluxo em etapas) e `/cadastro/concluido`. Mode: **Operate** (a apresentação inicial tem pitada de Persuade, mas o sucesso é completar o cadastro).

Audience/job: pessoa adulta (18+) sem contexto social presumido; entender o que é o EventMatch, confiar e concluir nascimento → e-mail/OTP → senha → nome + localização → documentos → interesses → revisão.
Constraints: paleta semântica de AGENTS.md apenas; nenhum ativo de marca/ilustração aprovado existe; teclado, leitor de tela, zoom 200%, alvos ≥44px.

Build path: **code-led** por decisão do usuário (2026-09-26): sem geração de imagem nem navegador no ambiente, a autoridade do comp `.impeccable/mocks/decision/cadastro-convite-civico.png` foi rebaixada para referência crítica. A ilustração do hero vira um slot de arte vetorial plana e substituível até existir asset aprovado.

## Direction contract

THESIS: o cadastro é um cartaz cívico que convoca adultos a ocupar a cidade juntos; recusa o onboarding genérico de cartão centralizado com stepper e benefícios em ícones soltos.
OWN-WORLD: fundo quase preto, tinta plana carmim (`--primary`) e âmbar (`--warning`) como cor de cartaz, tipografia condensada em caixa alta pesada para manchetes, texto corrido humanista; faixas verticais de cartaz, retícula sutil, fios finos `--border`; botões largos de cápsula; nenhum gradiente decorativo.
STORY: entende amizade + atividades + cidade, lê “Não é app de namoro” e 18+, confia e toca “Começar meu cadastro”; depois cada etapa diz por que pede o dado.
FIRST VIEWPORT: mobile — marca e slogan em espaçamento largo no topo, painel de arte urbana plana ocupando ~40% da altura com faixas de cartaz, manchete gigante em duas cores (“Interesses em comum. / Mais vida na sua cidade.”), parágrafo, quatro pilares, aviso anti-namoro, CTA carmim em cápsula na base. Desktop: arte à direita, manchete e CTA à esquerda.
FORM: cartaz serigrafado de convocação (Convite Cívico), 1ª da lista aprovada; seed key: convite-civico (challenger-wpa).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Memorable moment: a manchete em cartaz de duas cores sobre a cidade plana, e o marcador de etapa em forma de faixa numerada.
Unresolved: arte definitiva do hero (asset aprovado pendente); conteúdo jurídico real.

## Location block — SDD-023

The required-data step uses the approved block **“Onde você mora?”** with a native `Estado` select followed by a searchable `Município` combobox. The explanatory copy is fixed: “Escolha seu estado e município. Não pedimos endereço, bairro, CEP ou sua localização do aparelho.” The municipality control is disabled until a UF is selected, searches only after two characters, debounces requests, preserves text on failure, supports arrows/Enter/Escape, and announces loading, empty and retry states. The client receives only the 27 UF options from the server; municipality results are fetched through the same-origin BFF and are never bundled.
