---
version: 1
slug: "src-app-eventos-page-tsx"
primary_target: "src/app/eventos/page.tsx"
related_targets: ["src/app/eventos/novo/page.tsx", "src/app/eventos/novo/[eventId]/page.tsx"]
---

# Criar encontros — surface brief

Scope: `/eventos`, `/eventos/novo` e `/eventos/novo/[eventId]`, com criação consciente, edição de rascunho, prévia e publicação (SDD-027). Mode: **Operate**. Extensão do mundo “Convite Cívico”; sem mudança durável em `DESIGN.md` ou `.impeccable/design.json`.

Audience/job: anfitriã com sessão ativa organiza um encontro informal e gratuito em local não residencial. Ela precisa preencher o essencial em grupos curtos, entender quais informações serão mostradas e publicar com segurança, podendo salvar, sair e retomar sem perder o rascunho remoto.

## Direction contract

THESIS: criar um encontro é preparar um convite claro para ocupar a cidade em grupo; o formulário explica cada decisão sem virar novo cadastro nem painel de marketing.

OWN-WORLD: herdar o cartaz cívico — fundo escuro, manchete Archivo condensada em duas tintas, fios finos, bordas de 2 px, campos generosos, botões em cápsula, foco âmbar e tokens semânticos existentes. Não introduzir gradientes, ilustrações, cores locais ou novos componentes de sistema visual.

STORY: `/eventos` explica o que a anfitriã pode organizar e oferece “Criar encontro” como ação consciente; se a sessão contém um UUID válido, também apresenta “Continuar rascunho”. `/eventos/novo` cria apenas após a ação explícita e abre o formulário identificado. A edição agrupa proposta, quando, onde, vagas e entrada, com “Salvar rascunho”, “Ver prévia” e “Publicar” no momento apropriado. `/eventos/novo/[eventId]` sempre lê o estado autoritativo. A edição permite busca explícita por local público, ajuste do pino e coordenadas manuais. A prévia mostra município/UF e somente o centro/raio aproximados do backend; nunca recebe nem serializa o ponto exato.

FIRST VIEWPORT: mobile — marca e voltar no topo, manchete curta, contexto de segurança e ação principal visíveis sem competir com a decisão de começar. Desktop — composição editorial com explicação à esquerda e ação/lista de rascunho à direita; o formulário usa uma coluna de conteúdo legível e navegação de etapas compacta. O layout deve reflow em zoom 200% e não cobrir campos focados com ações fixas.

FORM: grupos sequenciais com navegação real e preservação do estado em memória, não um wizard que oculta requisitos de publicação; os campos permanecem no documento e os grupos podem ser revisitados. Ordem: proposta, onde, quando, vagas e entrada. A localização vem antes do horário porque o backend deriva o fuso pelo município e exige esse dado para persistir horário local. Reutilizar `LocationField` contextualizado; UF precede município. Horários locais explicam o fuso retornado. O mapa e a busca só carregam após ação explícita; o texto da busca não é salvo. Sem endereço residencial, bairro, CEP ou geolocalização do aparelho.

FOCAL MOMENT: abrir a prévia e confirmar que local, horário e proposta são compreensíveis enquanto somente a área aproximada permanece visível.

STATES: flag desligada/rota inexistente; sessão anônima, expirada, proibida ou indisponível; catálogo indisponível; rascunho vazio/incompleto/pronto/publicado; carregamento, salvo, prévia, conflito 409 com edição local preservada, validação e serviço indisponível.

LIMITS: formulário cliente mantém apenas estado transitório; `sessionStorage` contém somente UUID de referência com versão e TTL; criação/salvamento/publicação não fazem retry automático. A edição autorizada pode receber coordenadas exatas; a busca externa recebe somente o nome consultado e município/UF, sem evento, conta, sessão ou ponto exato. A prévia recebe centro/raio aproximados e omite `exactLocation`. Nenhuma regra de elegibilidade ou validação final de publicação é duplicada no frontend.

ACCESSIBILITY: teclado, nomes e instruções persistentes, erros associados a controles e resumo focável, estados anunciados por texto, mapa navegável com setas, controles de zoom e botão para confirmar o pino, redução de movimento, alvos de toque ≥44 px, desktop, mobile e zoom 200%. A cor nunca é o único sinal.

PERFORMANCE: carregar sessão e tipos de atividade em paralelo; serializar somente opções e dados necessários; manter componentes Client limitados à interação do formulário; importar módulos diretamente.

Unresolved: nenhum limite arquitetural. A extensão de busca e mapa segue SDD-029 e ADR-064 aceito, mantendo a direção visual atual.

## Provenance

This surface extends the established “Convite Cívico” world recorded in `DESIGN.md`; no concept-roll seed key was generated for this extension. The Impeccable `new-work.md` workflow skips `concept-seed` for local extensions, so no seed identifier can be cited without inventing one.
