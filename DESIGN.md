---
name: EventMatch
description: Cartaz cívico que convoca pessoas adultas a ocupar a cidade juntas, por amizade e atividades locais.
colors:
  background: "#09090b"
  surface: "#111113"
  card: "#18181b"
  border: "#2a2a2e"
  primary: "#e11d48"
  primary-hover: "#fb3c5a"
  primary-active: "#be123c"
  primary-muted: "rgba(225, 29, 72, 0.15)"
  foreground: "#fafafa"
  muted-foreground: "#a1a1aa"
  disabled: "#71717a"
  success: "#22c55e"
  warning: "#f59e0b"
  error: "#f87171"
typography:
  display:
    fontFamily: "Archivo, Figtree, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.75rem, 11vw, 5rem)"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 82"
  headline:
    fontFamily: "Archivo, Figtree, ui-sans-serif, sans-serif"
    fontSize: "clamp(2rem, 6vw, 3.25rem)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 82"
  title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.4
  body-lead:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  label-progress:
    fontFamily: "Archivo, Figtree, ui-sans-serif, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.43
    letterSpacing: "0.18em"
  tag:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "0.05em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
  3xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.foreground}"
    typography: "{typography.title}"
    rounded: "{rounded.full}"
    padding: "0 20px 0 32px"
    height: "56px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.foreground}"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.foreground}"
  button-primary-disabled:
    backgroundColor: "{colors.card}"
    textColor: "{colors.disabled}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "0 24px"
    height: "48px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.full}"
    padding: "0 12px"
    height: "44px"
  text-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "52px"
  choice-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
    height: "64px"
  choice-card-selected:
    backgroundColor: "{colors.primary-muted}"
    textColor: "{colors.foreground}"
  choice-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "8px 16px 8px 12px"
    height: "48px"
  notice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
  notice-blocked:
    backgroundColor: "{colors.card}"
    textColor: "{colors.muted-foreground}"
  step-band:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.foreground}"
    width: "56px"
  progress-segment-current:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.full}"
    height: "12px"
  progress-segment-done:
    backgroundColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    height: "6px"
  tag-soon:
    backgroundColor: "transparent"
    textColor: "{colors.warning}"
    typography: "{typography.tag}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: EventMatch

## Overview

**Creative North Star: "Convite Cívico"**

O EventMatch se apresenta como um cartaz serigrafado de convocação colado na cidade à noite: fundo quase preto, tinta plana carmim e âmbar, manchetes condensadas em caixa alta pesada e texto corrido humanista que explica, com calma, por que cada dado é pedido. A voz visual é pública e coletiva, não íntima: convida a ocupar a cidade junto, e por isso nada nela lembra a linguagem de namoro (sem corações decorativos, sem rosa suave, sem fotos de casal).

A densidade é de formulário generoso: alvos de 44px ou mais, um único fluxo por coluna no mobile e, no desktop, a explicação ao lado do formulário que ela justifica. A profundidade vem de camadas tonais e fios finos, nunca de sombra; a ênfase vem de peso tipográfico e da faixa carmim, nunca de gradiente. A arte é geometria urbana plana (torres, faixas, viaduto, escadaria, copas) sem figuras humanas, e ocupa um slot substituível.

O movimento é breve e editorial: cada etapa entra desmascarando sua faixa numerada a partir de um estado já visível, e tudo colapsa para 1ms com `prefers-reduced-motion`.

**Key Characteristics:**
- Tema escuro único, paleta semântica fechada (paleta padrão do Tailwind removida).
- Manchete de cartaz em duas tintas: linha em `foreground`, linha em `primary`.
- Faixa vertical carmim numerada como marcador de etapa.
- Botões em cápsula, campos e cartões com cantos suaves e borda de 2px.
- Estado nunca depende só de cor: ícone, texto, espessura de borda ou altura acompanham.
- Foco visível âmbar de 3px em todo elemento interativo.

## Colors

Uma noite neutra levemente fria, uma tinta carmim dominante e o âmbar como segunda tinta de cartaz e cor de atenção. Os valores vêm de `AGENTS.md` §5 e vivem só em `front/src/app/globals.css`.

### Primary
- **Carmim de Cartaz** (`primary`): CTA principal, faixa numerada de etapa, segunda linha da manchete, segmento atual do progresso, marcador de checkbox/radio marcado, cor do cursor de texto e da seleção.
- **Carmim Aceso** (`primary-hover`): hover do botão primário.
- **Carmim Prensado** (`primary-active`): estado pressionado do botão primário.
- **Véu Carmim** (`primary-muted`): fundo de opção selecionada (cartão ou chip), sempre junto de borda `foreground` e marca de check.

### Secondary
- **Âmbar de Sinalização** (`warning`): segunda tinta do cartaz (copas e faixa na arte, ícones alternados dos pilares), anel de foco, borda de avisos e selo "Em breve".

### Neutral
- **Noite** (`background`): fundo de página, `theme-color` e cor de "janela" dentro da arte.
- **Asfalto** (`surface`): campos, opções, avisos e caixa anti-namoro.
- **Concreto** (`card`): estado bloqueado, botão primário desabilitado, escadaria da arte.
- **Fio** (`border`): fios de 1px entre itens, borda de 2px em repouso, segmento pendente do progresso.
- **Papel** (`foreground`): texto principal, primeira linha da manchete, prédios da arte, borda de opção selecionada, segmento concluído.
- **Grafite Claro** (`muted-foreground`): texto de apoio, dicas, explicação de etapa, borda em hover.
- **Apagado** (`disabled`): placeholder e texto desabilitado.

### Status
- **Verde Confirmado** (`success`), **Vermelho Legível** (`error`): tons de `Notice` e erro de campo; `error` também é a borda de campo inválido.

### Named Rules
**The Closed Palette Rule.** Só os 14 tokens semânticos existem; o `@theme` do Tailwind zera `--color-*`, então nenhum utilitário pode introduzir cor fora do sistema. Hex avulso em componente é defeito.

**The Two Inks Rule.** Carmim e âmbar são as únicas tintas cromáticas de expressão. O carmim carrega ação e ênfase; o âmbar sinaliza atenção e foco. Nenhum gradiente decorativo.

## Typography

**Display Font:** Archivo variável com eixo `wdth` (com Figtree e `ui-sans-serif` de fallback), via `next/font` como `--font-poster`.
**Body Font:** Figtree (com `ui-sans-serif`, `system-ui`), via `next/font` como `--font-body`.

**Character:** Um grotesco condensado e pesado, de cartaz de rua, contra um sans humanista redondo e acolhedor; o primeiro convoca, o segundo explica.

### Hierarchy
- **Display** (900, `clamp(2.75rem, 11vw, 5rem)`, 0.9): manchete de apresentação em duas tintas, caixa alta, `font-stretch: 82%`, `word-spacing: 0.12em`, `text-wrap: balance`.
- **Headline** (900, `clamp(2rem, 6vw, 3.25rem)`, 0.95): título de etapa (h1 e alvo de foco a cada troca de etapa), mesmo tratamento condensado em caixa alta.
- **Title** (700, 1.125rem): rótulo do botão primário e títulos de destaque em caixas.
- **Body lead** (400, 1.125rem, 1.625): parágrafo de apresentação e explicação "por que pedimos este dado", até 46–52ch.
- **Body** (400, 1rem, 1.5): texto corrido e avisos.
- **Label** (600, 1rem): rótulos de campo e de opção, sempre visíveis acima do campo.
- **Label de progresso** (Archivo 700, 0.875rem, `0.18em`, caixa alta): "Etapa N de 8", com numerais tabulares.
- **Tag** (700, 0.75rem, `0.05em`, caixa alta): selo de estado, como "Em breve".

### Named Rules
**The Poster Voice Rule.** Caixa alta condensada 900 é reservada para manchete, título de etapa, número da faixa e marca. Texto que explica, pede ou orienta é sempre Figtree em caixa normal.

**The Weight Not Gradient Rule.** Ênfase tipográfica vem de peso, tamanho e troca de tinta entre linhas; nunca de gradiente em texto.

## Layout

Coluna única no mobile com calha lateral de 20px (32px a partir de `sm`, 40px em `lg`). A apresentação usa até 1280px em duas colunas iguais no desktop (texto à esquerda, arte à direita, alinhada à base); no mobile, marca no topo, arte logo abaixo e manchete sobreposta em -24px à base da arte. O fluxo de cadastro usa até 1152px; cada etapa vira grade `5fr / 6fr` com 64px de intervalo no desktop, explicação à esquerda e formulário à direita, empilhando no mobile com 32px.

Ritmo vertical: 32px entre blocos de seção, 24px entre campos de um formulário, 20px dentro do cabeçalho de etapa, 16px de preenchimento em cartões e avisos, 12px entre ícone e texto. Progresso e cabeçalho ficam acima do conteúdo com 40px de respiro.

### Named Rules
**The Reason Beside Form Rule.** Toda etapa mostra por que o dado é pedido ao lado (desktop) ou acima (mobile) do campo que o pede.

## Elevation & Depth

Sistema totalmente plano: não há `box-shadow` em nenhum componente. A profundidade é tonal (`background` → `surface` → `card`) e linear (fios de 1px `border` entre itens, bordas de 2px em controles). Estados aparecem por troca de borda (`border` → `muted-foreground` no hover → `foreground` quando selecionado) e de fundo (`primary-muted`).

### Named Rules
**The Flat Ink Rule.** Nada flutua. Se um elemento precisa se destacar, ele muda de tinta ou de espessura de borda, nunca ganha sombra.

## Shapes

Duas famílias convivem: a cápsula (`rounded.full`) para ações, chips, selos, segmentos de progresso e pontos da marca; e o retângulo de canto suave para superfícies de conteúdo (16px em cartões de opção, avisos e caixas; 12px em campos; 6px no quadrado de checkbox). A faixa de etapa é um retângulo reto no topo e arredondado 8px só na base, como um estandarte pendurado. A arte da cidade é geometria reta e círculos cheios, sem contorno.

Ícones são autorais: grade de 24px, traço de 2px arredondado, `currentColor`, decorativos por padrão.

## Components

### Buttons
Largos, cheios e decididos, como a faixa de chamada do cartaz.
- **Shape:** cápsula (`rounded.full`).
- **Primary:** `primary` com texto `foreground`, 56px de altura, 1.125rem 700. Na variante de avanço, o texto fica centrado e um chevron de 24px (traço 2.6) fica à direita (32px à esquerda, 20px à direita). Pode ocupar a largura toda.
- **Hover / Active / Focus:** `primary-hover` no hover, `primary-active` e `scale(0.99)` ao pressionar, anel âmbar de 3px no foco; transição de 200ms em `ease-out-expo`. Em espera, spinner girando com rótulo de progresso e `aria-busy`.
- **Disabled:** fundo `card`, texto `disabled`.
- **Secondary:** transparente com borda de 2px `border`, 48px de altura; borda passa a `muted-foreground` no hover.
- **Quiet:** texto `muted-foreground` sublinhado (sublinhado `border` de 2px, vira `primary` no hover), 44px de altura; para ações de saída como "Cancelar cadastro".

### Chips
- **Style:** cápsula `surface` com borda de 2px `border`, 48px de altura, quadrado/círculo de marcação de 24px à esquerda.
- **State:** selecionado ganha fundo `primary-muted`, borda `foreground` e marcador cheio `primary` com check; indisponível ganha borda tracejada, fundo transparente e texto `disabled`. Usado em listas densas, como interesses.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** `surface` (bloqueado em `card`).
- **Shadow Strategy:** nenhuma (ver Elevation & Depth).
- **Border:** 2px (1px na caixa anti-namoro da apresentação).
- **Internal Padding:** 16px (20px em caixas de destaque).

O cartão de opção (`Choice` em modo card) tem 64px de altura mínima, marcador de 24px, ícone opcional em `muted-foreground`, rótulo e descrição; o input nativo continua no fluxo de teclado e no leitor de tela.

### Inputs / Fields
- **Style:** `surface`, borda de 2px `border`, 12px de raio, 52px de altura, texto 1.125rem; rótulo 600 acima e dica em `muted-foreground` ligada por `aria-describedby`.
- **Focus:** borda passa a `foreground` e anel âmbar de 3px com 2px de afastamento.
- **Error / Disabled:** borda `error` e mensagem `error` 600 com ícone de alerta; desabilitado usa texto `disabled`. O código OTP usa Archivo 700 em 1.875rem, espaçamento 0.5em, numerais tabulares, centralizado.

### Notices
Mensagem de estado com ícone + rótulo oculto para leitor de tela + título + texto; nunca só cor. Tons: `info` (borda `border`), `success`, `warning`, `error` (borda do tom a 50–70% de opacidade) e `blocked` (fundo `card`, cadeado). 16px de raio, borda de 2px, 16px de preenchimento.

### Navigation
- **Progress rail:** "Etapa N de 8" em Archivo caixa alta à esquerda, nome da etapa em `muted-foreground` à direita, e oito segmentos em cápsula: concluído 6px `foreground`, atual 12px `primary`, pendente 6px `border`. A altura, não só a cor, marca a etapa atual; transição de 500ms.
- **Cabeçalho do fluxo:** marca pequena à esquerda e ação quiet "Cancelar cadastro" à direita.

### Step Band (signature)
Faixa carmim de 56px de largura, reta no topo e com base arredondada em 8px, com o número da etapa em dois dígitos (Archivo 900, 1.5rem, tabular) e um traço `foreground` de 20×2px embaixo. Fica colada ao título da etapa e entra com `band-in` (560ms, recorte de 22% na base se desfazendo).

### Poster Headline (signature)
Manchete em duas linhas de tinta: primeira em `foreground`, segunda em `primary`, Archivo 900 caixa alta condensada. Tamanho `hero` na apresentação, `step` em telas de conclusão.

### Brand Mark
Marca tipográfica sem logo: "Event" em `foreground` e "Match" em `primary`, Archivo 800 com `-0.03em`; na versão grande, o slogan "Pessoas · Atividades · Cidades" com pontos carmim abaixo.

### City Poster Art (slot)
SVG plano e substituível: prédios `foreground` com janelas `background`, estandarte carmim e faixa âmbar com palavras de convocação, copas âmbar, viaduto e escadaria `card` com retícula de 6px a 16%. Sem figuras humanas e sem gradientes. É um substituto até existir a ilustração aprovada; a troca não deve mudar o layout.

## Do's and Don'ts

### Do:
- **Do** use apenas os tokens semânticos de `globals.css` através dos utilitários do Tailwind (`bg-primary`, `text-muted-foreground`, `border-border`).
- **Do** componha manchetes em duas tintas (`foreground` + `primary`) com Archivo 900 caixa alta condensada (`font-stretch: 82%`).
- **Do** marque cada etapa com a faixa carmim numerada e mova o foco para o h1 da etapa a cada troca.
- **Do** mantenha alvos interativos com pelo menos 44px (48px chips e secundários, 56px no CTA primário).
- **Do** sinalize estado com ícone, texto, espessura de borda ou altura além da cor.
- **Do** use o anel de foco âmbar de 3px com afastamento de 3px em todo interativo.
- **Do** anime só a entrada da faixa (`band-in`, 560ms) e do conteúdo (`rise-in`, 480ms) em `ease-out-expo`, partindo de estado já visível, e respeite `prefers-reduced-motion`.
- **Do** use os ícones autorais de 24px com traço de 2px em `currentColor`.

### Don't:
- **Don't** use gradiente decorativo em fundo, texto ou arte.
- **Don't** use `box-shadow` para dar profundidade; troque tinta ou borda.
- **Don't** reintroduza a paleta padrão do Tailwind nem hex avulso em componentes.
- **Don't** use linguagem visual de namoro: corações decorativos, rosa suave, pares românticos.
- **Don't** coloque figuras humanas na arte da cidade.
- **Don't** use caixa alta condensada em texto de instrução, dica ou parágrafo.
- **Don't** empacote o cadastro em cartão centralizado com stepper genérico e benefícios em ícones soltos.

## Pendências registradas

Itens em aberto do build, não regras do sistema:
- No desktop, a apresentação deixa espaço vazio acima da coluna de arte (a arte alinha à base e não preenche a altura).
- A ilustração definitiva aprovada ainda não existe; `CityPosterArt` é um substituto.
