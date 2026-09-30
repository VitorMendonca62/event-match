# Finish review — entrar e início

- Data: 2026-09-30
- Superfície: `/entrar` e `/inicio`
- Build path: code-led
- Direction contract: `../surfaces/src-app-entrar-page-tsx.md`
- Disposição final: `ship`

## Evidências

- `entrar-desktop.png`: viewport CSS 1440 x 900.
- `entrar-mobile.png`: viewport CSS 390 x 844, captura full-page; o bitmap exclui a largura da scrollbar.
- `inicio-desktop.png`: viewport CSS 1440 x 900.
- `inicio-mobile.png`: viewport CSS 390 x 844.

Todas as capturas foram abertas e verificadas após estabilizar navegação e animação. O detector executado uma vez sobre `src/app/entrar/page.tsx`, `src/app/inicio/page.tsx` e `src/features/authentication` retornou zero achados.

## Revisão independente

A primeira revisão retornou `fix`: a grade desktop de `/inicio` usava `6fr / 5fr`, contrariando o FIRST VIEWPORT do direction contract e comprimindo “Próximos passos”. A grade foi corrigida para `5fr / 6fr`, preservando o intervalo de 64 px.

O verdict pass confirmou:

- `resolved`: `/inicio` usa `5fr / 6fr`; medição em 1440 x 900 resultou em `458.172px 549.828px`.
- `clear`: nenhuma regressão foi introduzida; mobile permanece em coluna única.
- disposição: `ship`.

`PRODUCT.md`, `DESIGN.md` e `.impeccable/design.json` permanecem autoridades válidas. Esta extensão herda o sistema “Convite Cívico” e não introduz mudança durável no sistema visual.
