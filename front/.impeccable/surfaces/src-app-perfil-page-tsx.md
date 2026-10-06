---
version: 1
slug: "src-app-perfil-page-tsx"
primary_target: "src/app/perfil/page.tsx"
related_targets: ["src/app/perfil/previa/page.tsx", "src/app/inicio/page.tsx"]
---

# Completar perfil - surface brief

Scope: convite em `/inicio`, edição em `/perfil` e prévia autenticada em `/perfil/previa`, incluindo a identidade opcional da SDD-016 e as preferências de atividades da SDD-017. Mode: **Operate**. Extensão confirmada em 2026-09-30 do mundo "Convite Cívico"; direção da identidade opcional confirmada em 2026-10-03; preferências de atividades confirmadas em 2026-10-06 (SDD-017/ADR-044); nenhuma mudança durável em `DESIGN.md`.

## Job e audiência

Pessoa adulta com conta ativa, novata ou veterana, chega a `/inicio` com foto ou apresentação ausente. Ela precisa entender o que pode completar, decidir sem coerção e editar seu perfil sem repetir dados já informados. O fluxo comum do EventMatch continua disponível mesmo quando ela adia ou deixa o perfil incompleto.

## Resultado e prova

- O convite deriva da completude autoritativa do backend e mostra progresso real, sem distinguir novato de veterano.
- A pessoa adiciona uma foto principal, escreve uma apresentação e pode corrigir nome, região aproximada, intenções e interesses existentes.
- A pessoa pode informar pronomes, profissão e até cinco idiomas sem alterar a completude ou ser obrigada a compartilhá-los.
- A pessoa pode marcar até cinco preferências de como gosta que os encontros sejam, distintas dos interesses, sem prioridade e sem efeito na completude.
- Antes de enviar a foto, vê o recorte quadrado; antes de sair, pode abrir uma prévia autenticada da futura visão compartilhável.
- "Agora não" remove o convite deste navegador por sete dias; perfil completo remove o convite independentemente do cookie.

## Direção selecionada

THESIS: completar o perfil é preparar uma apresentação para uma atividade em grupo, não montar uma vitrine pessoal nem atravessar outro cadastro obrigatório.

STRUCTURE: em `/inicio`, o item antes indisponível vira uma linha acionável com progresso curto e duas decisões claras: completar ou adiar. `/perfil` é uma superfície de trabalho contínua, sem wizard e sem cards aninhados: foto e dados básicos vêm primeiro; apresentação vem logo depois como núcleo da futura projeção; “Identidade e comunicação” reúne pronomes, profissão e idiomas antes de intenções e interesses; “Como você gosta dos encontros” vem logo após interesses, sem card, com uma frase que separa do que a pessoa gosta (interesses) de como prefere o encontro (preferências); ações de salvar permanecem próximas ao conteúdo alterado. `/perfil/previa` remove os controles de edição e apresenta somente a projeção autorizada do perfil.

FOCAL MOMENT: a foto recortada e a apresentação aparecem juntas na prévia, permitindo conferir como a pessoa será apresentada sem publicar para terceiros nesta entrega.

VISUAL AUTHORITY: herdar marca, tipografia, tokens, bordas, foco âmbar, ritmo e linguagem não romântica de `DESIGN.md` e do brief de `/entrar`/`/inicio`. A tela continua operacional e compacta; não usa hero, painel de marketing, pilha de cards ou ilustração decorativa.

## Escopo e limites

- Produção completa para desktop e mobile, teclado, leitor de tela e zoom de 200%.
- Uma foto principal; pronomes, profissão e idiomas integram a SDD-016. Foto adicional, redes sociais e os demais campos opcionais do RF081 ficam fora.
- UF e município estruturados ficam fora desta superfície até a Task 20; região continua no formato vigente durante a SDD-016.
- A prévia mostra preferências somente quando autorizadas, depois de interesses. A prévia da audiência `authenticated` é acessível somente pela titular. Perfil navegável por outras pessoas, descoberta, seleção de audiência `public` e moderação visual automática ficam fora.
- Foto e apresentação são opcionais para uso comum. Elas continuam compondo, sem conceder sozinhas, a futura habilitação de anfitrião.
- Não alterar cadastro, login, recuperação de senha, descoberta ou o sistema visual global.

## Estados e faixas

- Perfil: incompleto, completo, carregando, indisponível, conflito de atualização e sucesso salvo.
- Convite: visível, adiado neste navegador, oculto por completude e reapresentado após sete dias.
- Foto: vazia, seleção local, recorte/prévia, envio, processamento, pronta, substituição, remoção, formato/tamanho inválido e falha recuperável.
- Apresentação: vazia ou de 1 a 500 caracteres; texto simples, contador próximo do limite e erros associados ao campo.
- Interesses: de 3 ao total ativo do catálogo; intenções preservam o conjunto suportado pelo domínio.
- Conteúdo real deve acomodar nomes de 1 a 60 caracteres e regiões de 2 a 80 sem truncar controles nem deslocar a topologia.
- Identidade opcional: pronome ausente, opção comum, “Outro” com texto de até 40 caracteres ou “Prefiro não informar”; profissão ausente ou até 80 caracteres; idiomas de zero a cinco, incluindo item previamente escolhido que tenha sido desativado.
- Preferências de atividades: catálogo de 12 opções, zero a cinco marcadas, limite atingido (demais `aria-disabled` com explicação), item escolhido e depois descontinuado ("Opção descontinuada", desmarcável e sem retorno) e catálogo indisponível (aviso só na seção, seleção atual preservada no salvamento).
- Busca de idioma: lista inicial, consulta sem resultado, um a cinco selecionados, limite atingido, remoção e erro de catálogo indisponível.

## Interação e layout

- RSC carrega sessão, perfil e catálogo antes da superfície; Client Components ficam restritos a formulário, recorte, upload, pending, foco e confirmação de remoção.
- A edição usa labels persistentes, feedback junto ao campo, resumo focável no erro e prevenção de duplo envio.
- Pronomes usam um combobox compacto com lista controlada, navegação por setas, Home/End, Enter/Espaço e Escape; somente “Outro” revela um campo adicional. “Prefiro não informar” permanece uma escolha da visão própria, força privado, desabilita seu controle de compartilhamento e nunca aparece na prévia.
- Profissão é apresentada como autodeclaração, sem linguagem de verificação. Idiomas usam busca local, lista operável por teclado exibida somente enquanto a busca ou seus resultados mantêm foco, contador `n/5` e botões de remoção com nomes acessíveis.
- Preferências usam um grupo nativo de checkboxes em chips (≥ 44 px), na ordem do catálogo, sem busca; contador `n/5` em `aria-live="polite"`. Opções aparentemente opostas podem coexistir.
- Cada um dos quatro grupos opcionais termina com seu próprio controle de visibilidade; não há consentimento global que exponha todos de uma vez.
- O seletor de foto aceita arrastar/soltar e seleção por arquivo, mas mantém um botão nativo claramente rotulado. O editor abre em diálogo modal, mostra a imagem completa com um quadrado de recorte arrastável e redimensionável, e oferece sliders e botões de ajuste para posição e ampliação, com equivalência por teclado.
- A navegação entre edição e prévia usa ações nomeadas e rotas reais, preservando voltar/atualizar; não simula abas que perdem estado silenciosamente.
- Ao pedir a prévia com alterações não salvas, um diálogo explica que somente dados persistidos serão exibidos e oferece salvar antes de avançar ou descartar o rascunho e continuar.
- Mobile empilha as seções e mantém alvos de pelo menos 44 px. Desktop usa uma coluna principal legível com prévia da foto ao lado apenas quando houver largura real.
- Motion limita-se a feedback de estado e respeita `prefers-reduced-motion`; nenhum upload depende de animação para comunicar progresso.

## Restrições confirmadas

- Paleta semântica de `AGENTS.md`; nenhuma cor hexadecimal local.
- Cloudinary fica atrás do backend e não determina a composição da interface.
- Foto e apresentação começam `private`; esta interface pode alternar apenas entre `private` e `authenticated`. A audiência `public` fica reservada no domínio para uma tarefa futura.
- Pronomes, profissão, idiomas e preferências de atividades seguem a mesma regra, com visibilidades independentes e `private` por default.
- O segredo do provedor nunca alcança o navegador; URLs temporárias não são registradas nem reutilizadas como identidade do asset.
- A implementação termina com duas capturas desktop/mobile em um passe conjunto, correção em lote, no máximo uma confirmação visual e finish review do Impeccable.
- Aplicar `server-serialization`, `server-auth-actions`, `server-no-shared-module-state`, `async-parallel`, `async-defer-await`, `bundle-barrel-imports`, `rerender-derived-state-no-effect` e `rerender-move-effect-to-event`.

Open decisions: nenhuma de UX para a identidade opcional. A implementação da SDD-016 depende do aceite da ADR-043; os demais limites técnicos e políticas permanecem nos ADRs da SDD-015.
