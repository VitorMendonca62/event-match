# Finish review — convite e edição do perfil (SDD-015)

- Data: 2026-10-01
- Superfície: `/inicio`, `/perfil` e `/perfil/previa`
- Build path: code-led
- Direction contract: `../surfaces/src-app-perfil-page-tsx.md`
- Disposição final: `ship`

## Evidências

- `inicio-desktop.png`: viewport CSS 1440 x 900.
- `inicio-mobile.png`: viewport CSS 390 x 844, captura full-page.
- `perfil-desktop.png`: viewport CSS 1440 x 900, captura full-page.
- `perfil-mobile.png`: viewport CSS 390 x 844, captura full-page.
- `perfil-previa-desktop.png`: viewport CSS 1440 x 900.
- `perfil-previa-mobile.png`: viewport CSS 390 x 844, captura full-page.

Todas as capturas foram abertas e verificadas após estabilizar navegação e animação. O detector executado uma vez sobre os componentes alterados de perfil e a prévia retornou zero achados. O Playwright confirmou o caminho em Chromium desktop/mobile, incluindo axe sem violações sérias, ausência de overflow, falha de rede recuperável, sessão expirada e indisponibilidade do provedor. Firefox foi retirado da matriz por decisão de produto em 2026-10-03 para reduzir o tempo da suíte.

## Revisão independente

O passe de hardening corrigiu o indicador de progresso para semântica `progressbar`, protegeu todos os estados pendentes com `finally` e redirecionou `401` para `/entrar`. A revisão visual confirmou hierarquia consistente, coluna única no mobile, controles sem corte, chips com wrap e prévia sem conteúdo privado.

O fechamento da revisão acrescentou recuperação explícita de conflito: o aviso de `409` mantém os valores presentes no formulário, oferece carregar a revisão autoritativa e permite reaplicar o rascunho sem refresh destrutivo. O scroll de sucesso alterna para comportamento imediato sob `prefers-reduced-motion`. O detector permaneceu sem achados e o cenário de duas abas passou em Chromium desktop e mobile.

Audit health score: **20/20** — acessibilidade 4, performance 4, responsividade 4, theming 4 e integridade de implementação 4. Não há achados P0–P3 neste passe. No Chromium mobile, taps e os gestos de mover e redimensionar o recorte foram verificados com eventos touch reais; dispositivo físico permanece fora do ambiente automatizado.

`PRODUCT.md`, `DESIGN.md` e `.impeccable/design.json` permanecem autoridades válidas. A superfície preserva o sistema “Convite Cívico” e não introduz mudança durável no sistema visual.
