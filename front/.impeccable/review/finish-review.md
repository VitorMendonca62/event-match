# Finish review — preferências de atividades do perfil (SDD-017)

- Data: 2026-10-06 (revisão final após `code-reviewer`)
- Superfície: `/perfil` e `/perfil/previa`
- Build path: code-led (sem comp aprovado; o direction contract é a referência de crítica)
- Direction contract: `../surfaces/src-app-perfil-page-tsx.md` (atualizado para a SDD-017 antes da UI)
- Revisor: passe in-thread de `reference/degraded/finish-reviewer.md`. O agente `impeccable-finish-reviewer` não está disponível neste harness; substituição declarada.
- Disposição final: `ship`

## Evidências

Capturas geradas pela suíte Playwright desta entrega (`tests/e2e/perfil.e2e.ts`), inspecionadas em um único passe:

| Arquivo | Viewport | Conteúdo |
|---|---|---|
| `perfil-desktop.png` | 1440, full-page | `/perfil` com a seção vazia (0/5), após interesses |
| `perfil-mobile.png` | 390, full-page | idem, coluna única |
| `perfil-preferencias-desktop.png` | 1440, seção | limite 5/5 com não marcadas `aria-disabled` e foco visível |
| `perfil-preferencias-mobile.png` | 390, seção | limite 5/5 em coluna única |
| `perfil-preferencias-zoom200.png` | 640 × 400 CSS (zoom 200% de 1280 × 800) | seção sem rolagem horizontal, visibilidade ativa |
| `perfil-previa-preferencias-desktop.png` | 1440, full-page | prévia com a lista autorizada, na ordem do catálogo, após interesses |
| `perfil-previa-preferencias-mobile.png` | 390, full-page | idem no mobile |

`perfil-previa-desktop.png` e `perfil-previa-mobile.png` vêm de outro cenário, de uma conta sem preferências, e por isso não mostram a seção. A prévia com preferências passou a ter capturas próprias, listadas acima.

## persistence

pass. `PRODUCT.md`, `DESIGN.md` e o surface brief existem; build code-led, sem `state.json` exigido.

## fidelity

| Elemento do contrato | Veredito | Evidência |
|---|---|---|
| Seção sem card logo após interesses | match | `perfil-desktop.png`, `perfil-mobile.png` |
| Frase que separa interesses de preferências | match | cabeçalho da seção nas capturas de seção |
| Checkboxes nativos em chips ≥ 44 px, ordem do catálogo, sem busca | match | 12 chips na ordem `outdoor` → `spontaneous_activity` |
| Contador `n/5` | match | `0/5` e `5/5` alinhados à legenda |
| Limite: não marcadas visíveis, `aria-disabled`, explicação textual | match | borda tracejada e texto apagado (não só cor) e texto de limite; E2E confirma `aria-disabled` e bloqueio por Espaço |
| Controle de visibilidade próprio ao fim, `private` por padrão | match | toggle desligado no estado inicial e ligado após salvar (zoom 200%) |
| Prévia só quando autorizada, após interesses | match | `perfil-previa-preferencias-*.png`; E2E confirma ausência quando privada |
| Item descontinuado e catálogo indisponível | adaptation | sem captura: estados cobertos por `tests/unit/profile-activity-preferences.test.tsx`, não renderizáveis no E2E sem alterar o catálogo |
| Mobile em uma coluna, zoom 200% | match | capturas mobile e zoom 200%; `expectNoHorizontalScroll` verde |

## ceiling

reached. Componentes nativos do sistema (`Choice` em chip, `ProfileVisibilityToggle`, `Notice`) reutilizados sem variação local; nenhuma cor hexadecimal avulsa.

## material_fixes

Nenhum.

Observação não material: no mobile, os rótulos longos ocupam um chip por linha, o que alonga a seção para cerca de 700 px. Como é o mesmo padrão dos interesses, foi mantido.

## keep

Separação semântica explícita entre interesses e preferências, e o estado de limite que não esconde opções.

## Validação

- Detector Impeccable (`impeccable detect --json`) em `profile-activity-preferences-field.tsx`, `profile-form.tsx`, `perfil/page.tsx` e `perfil/previa/page.tsx`: `[]`.
- Playwright: 76 cenários passaram em desktop e mobile, sem falhas, incluindo o fluxo de preferências por teclado, limite, salvar, visibilidade, prévia, remoção, axe e a nova checagem de zoom 200%.
- Frontend: lint, typecheck, 149 testes unitários/integração e build.
- Backend: lint, typecheck, 354 testes unitários, 59 PostgreSQL, 26 E2E e build.

## Documentação

Extensão ordinária do mundo “Convite Cívico”: nenhum token, componente ou regra nova. `DESIGN.md` e `.impeccable/design.json` permanecem inalterados; nenhum drift novo identificado.
