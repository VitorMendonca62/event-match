# ADR-031: Aceitar os documentos na tela da senha, com link e diálogo

- **Status:** accepted
- **Data:** 2026-09-29
- **Decisores:** produto e frontend
- **Relacionado:** `specs/sdd-011-publicar-conteudo-documentos-legais/tasks.md`, ADR-011, ADR-012, ADR-028, ADR-029, ADR-030
- **Substitui/Substituído por:** N/A. Substitui o passo “Documentos” da SDD-010/011; o restante do aceite não muda.

## Contexto

O passo “Documentos” mostrava os três textos abertos, com versão e vigência, numa tela longa antes dos interesses. A leitura ficava pesada e a tela feia. O DER (RF005) exige apenas registrar as versões aceitas; a posição do aceite no fluxo está em `docs/02-regras-de-negocio.md`, não no DER.

## Decisão

- O passo “Documentos” deixa de existir (sete etapas). Os aceites ficam na tela da senha, logo abaixo dos campos: “Li e concordo com os **Termos de Uso**”, “…com a **Política de Privacidade**” e “…com as **Regras de Convivência**”.
- O texto não aparece de cara. O nome do documento é um botão em forma de link que abre o documento num diálogo modal (`<dialog>` nativo: foco preso, Esc fecha, foco volta ao link). O diálogo tem título, região de leitura rolável por teclado e, no rodapé, **Aceitar** e **Recusar**.
- **Aceitar** marca a caixa e fecha o diálogo. A caixa nunca marca sozinha: clicar nela abre o documento; desmarcar retira o aceite.
- **Recusar** desfaz o aceite daquele documento e abre um segundo diálogo (`alertdialog`): “Sem os três aceites, sua conta não é ativada”, com **Rever documentos** (reabre o mesmo documento) e **Cancelar cadastro** (ADR-030, expira o cadastro no backend).
- Os aceites continuam só em memória e são gravados na conclusão, dentro da transação de ativação (`terms_acceptance`), sem mudança de contrato. “Salvar senha” exige os três aceites.
- Os documentos passam a ser carregados no RSC a partir de `contact_verified` (a tela da senha) e em `account_incomplete`; os interesses continuam só em `account_incomplete`. Após confirmar o código, o fluxo recarrega o RSC para trazê-los.
- Quem recarrega a página depois da senha perde os aceites (memória). A revisão final mostra os mesmos controles de aceite quando faltarem, e só ativa com os três.
- Versão e vigência deixam de ser exibidas. O backend segue devolvendo `version` e `effectiveAt` (necessários à rastreabilidade do aceite). A linha “Versão … · Vigente a partir de …” que abre cada arquivo em `docs/legal/` é ocultada só na exibição; o texto armazenado e o digest não mudam. Removê-la do texto exige nova versão e aprovação jurídica.

## Consequências

- A tela da senha fica mais longa, mas cada documento é lido sob demanda e o aceite é uma ação deliberada.
- `react-markdown` continua só no servidor; o corpo renderizado segue para a ilha cliente como `ReactNode` (ADR-029).
- Sem `dependência` nova: o modal usa o elemento nativo `<dialog>`.
- A ordem “aceites depois dos dados obrigatórios” de `docs/02` muda para “aceites com a senha”; a validação e o registro continuam atômicos na ativação (ADR-012).
