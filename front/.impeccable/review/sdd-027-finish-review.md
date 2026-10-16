# Finish review — criação de encontros (SDD-027)

- Data: 2026-10-09
- Superfície: `/eventos`, `/eventos/novo` e `/eventos/novo/[eventId]`
- Caminho: extensão local do mundo “Convite Cívico”; sem mudança durável em `DESIGN.md` ou `.impeccable/design.json`.
- Contrato visual: `../surfaces/src-app-eventos-page-tsx.md`.
- Disposição do finish reviewer: `ship` (veredito informado no handoff; este registro documenta a conferência do artefato e não refaz essa avaliação).

## Evidências conferidas

- Produto e sistema vigente: `PRODUCT.md`, `DESIGN.md` e o contrato visual acima.
- Código: `src/app/eventos/page.tsx`, as rotas `src/app/eventos/novo/`, `src/features/events/components/events-home.tsx`, `events-header.tsx`, `event-form.tsx`, `src/features/events/draft-reference.ts`, `src/features/events/contracts.ts`, `src/components/server/ui/button.tsx`, `brand-mark.tsx`, `notice.tsx` e `src/app/globals.css`.
- As 20 capturas `eventos-*.png` foram inspecionadas: desktop, mobile e viewport de `home`, `novo` e `previa`; desktop, mobile, viewport, zoom 200% e viewport de zoom 200% de `rascunho`; mais `eventos-rascunho-focus-desktop.png` e `eventos-rascunho-focus-mobile.png`.
- As capturas mostram a composição escura com manchete em duas tintas, fios e campos de borda dupla; a prévia permanece dentro da janela em desktop e mobile; o anel âmbar aparece no campo focado nas duas larguras. O código confirma o anel global âmbar de 3px com afastamento de 3px e o botão de fechar como SVG autoral de 24px.
- `front/.impeccable/review/finish-review.md` pertence a outra revisão (TASK 28) e foi preservado. `front/.impeccable/design.json` já não existia e não foi criado.

## Resultado do pass

O handoff do finish reviewer informa seis achados corrigidos e resolvidos no veredito final: proveniência descrita como extensão local sem chave de seed inventada; prévia centralizada com margens seguras; rótulos eyebrow removidos; foco âmbar de 3px/3px em desktop e mobile; glifo de fechar como SVG autoral de 24px; e rótulos compactos “Início”/“Encontros” no mobile com nome acessível completo. As capturas e os trechos de código citados acima dão evidência direta para o foco, o diálogo, o ícone e os rótulos móveis; a proveniência também está registrada no contrato visual. O detector já havia rodado uma vez no build e retornado `[]`; não foi executado novamente.

## Resumo do sistema vigente

Paleta: tokens semânticos escuros `background`/`surface`/`card`, papel e grafite, carmim como ação/ênfase, âmbar como atenção/foco e tons de estado; sem cores locais nesta extensão.
Rampa tipográfica: Archivo variável condensada e pesada para manchetes e marca; Figtree humanista para texto, campos e explicações, com títulos e corpo em pesos/tamanhos distintos já registrados em `DESIGN.md`.
The Closed Palette Rule: só os tokens semânticos existentes; sem hex avulso ou cores introduzidas por utilitários.
The Two Inks Rule: carmim carrega ação e ênfase; âmbar sinaliza atenção e foco; sem gradientes decorativos.
The Poster Voice Rule / The Flat Ink Rule: caixa alta condensada fica reservada à voz de cartaz; profundidade vem de camadas tonais e fios, não de sombras.

Defeitos/drift não canonizados nem reparados: nenhum drift visual pré-existente em relação ao `DESIGN.md` foi identificado nas capturas desta superfície; a ausência do sidecar é preexistente, e o contrato define esta entrega como extensão sem atualização durável do sistema.

## Acompanhamento — navegação por etapas e contagem na prévia

- A área lateral do editor agora segue a navegação por seções do perfil, com etapa ativa e estado de preenchimento em desktop e navegação horizontal sticky em telas pequenas; remove o resumo “Seu rascunho”.
- A barra lateral oferece “Salvar rascunho”, “Ver prévia” e “Publicar”; no celular, esses controles ficam fixos abaixo junto do estado de salvamento. As cópias no fim do formulário foram removidas.
- A prévia exibe participantes/vagas como `0/{capacidade}` e informa que a capacidade inclui a anfitriã. Nenhum contrato/API foi alterado.
- Lint, typecheck, build e detector Impeccable passaram. Não houve nova captura autenticada de desktop/mobile nesta solicitação.
