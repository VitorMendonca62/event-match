# Finish review — identidade opcional do perfil (SDD-016)

- Data: 2026-10-04
- Superfície: `/perfil` e `/perfil/previa`
- Build path: code-led
- Direction contract: `../surfaces/src-app-perfil-page-tsx.md`
- Disposição final: `ship`

## Conformidade com a direção

A implementação preserva a direção visual “Convite Cívico”, a paleta semântica e a composição escolhida pelo produto. A seção “Identidade e comunicação” aparece depois da apresentação e antes de intenções/interesses. Pronomes usam o combobox controlado atual; profissão e idiomas permanecem opcionais, privados por padrão e sem alegação de verificação.

O brief foi corrigido para descrever a interface entregue, sem tentar reordená-la ou substituí-la por um `select` nativo. O seletor de idiomas devolve o foco à busca após cada escolha, permitindo seleções consecutivas por teclado. A remoção de cada idioma usa uma área interativa de 44 × 44 px.

## Evidências

- `perfil-desktop.png`: viewport CSS 1440 × 900, captura full-page.
- `perfil-mobile.png`: viewport CSS 390 × 844, captura full-page.
- `perfil-previa-desktop.png`: viewport CSS 1440 × 900.
- `perfil-previa-mobile.png`: viewport CSS 390 × 844, captura full-page.

As quatro capturas foram abertas e inspecionadas depois da suíte E2E. A composição mantém hierarquia legível, coluna única no mobile, controles sem corte, chips com quebra de linha e prévia coerente com as visibilidades. Não foi observado overflow horizontal, colisão ou regressão visual bloqueante.

## Validação

- Detector Impeccable executado após cada passe final de interface: zero achados (`[]`).
- Playwright: a suíte-base passou em 74 cenários, com 1 cenário exclusivamente desktop ignorado no projeto mobile. Após as correções do review, o cenário do combobox por teclado passou novamente em desktop e mobile (2/2).
- Axe: sem violações graves nos cenários desktop/mobile; zoom de 200% e ausência de rolagem horizontal cobertos.
- O E2E do perfil comprovou seleção integral por teclado, `Prefiro não informar` sempre privado, contador `n/5`, cinco idiomas na ordem escolhida, aviso de limite e foco preservado.
- Frontend: lint, typecheck e 141 testes unitários/integração passaram.
- Backend: lint, typecheck, build, 322 testes unitários, 57 testes PostgreSQL e 26 E2E passaram.

## Achados e disposição

Não há achados visuais P0–P3 neste passe. A superfície atende o direction contract atualizado e o craft floor aplicável; disposição final: **ship**.

A tentativa de revisão por um subagente independente foi bloqueada pelo limite de uso do serviço até 2026-10-09. Para não representar uma revisão inexistente, este documento registra um finish review do agente principal, sustentado pelas capturas e validações acima. Uma segunda opinião independente continua recomendada antes do PR, mas não há evidência de bloqueio técnico ou visual.
