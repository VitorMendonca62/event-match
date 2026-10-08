# ADR-050: Manter acessibilidade e alimentação privadas e liberar somente por consentimento contextual

- **Status:** proposed
- **Data:** 2026-10-08
- **Decisores:** produto, privacidade, jurídico, confiança e segurança, backend e frontend
- **Relacionado:** Task 19; ADR-038; RF015, RF017, RF081; RN014, RN112; RNF001–RNF002
- **Substitui/Substituído por:** N/A

## Contexto

Informações de acessibilidade e alimentação podem revelar deficiência, condição de saúde, alergia, religião ou outra característica sensível. RN014 e RN112 exigem privacidade por padrão, finalidade clara e conhecimento da pessoa. O perfil atual usa visibilidades `private | authenticated | public`, mas `authenticated` é uma audiência ampla e não informa por que, para qual evento nem para quem o dado será projetado. Não existe ainda um fluxo implementado de evento/participação autorizado a receber esses dados.

## Opções consideradas

1. **Valores privados no perfil e grant explícito por finalidade, evento e audiência.** Proposta: cada projeção é avaliada no backend contra um consentimento ativo e escopado.
2. Reutilizar `authenticated` como controle de compartilhamento. Rejeitada: a audiência é ampla, não expressa finalidade nem permite revogação por contexto.
3. Copiar os valores para o evento/anfitrião ao confirmar participação. Rejeitada: duplica dado sensível, dificulta revogação e amplia retenção sem necessidade.
4. Não persistir perfil e perguntar a cada evento. Adiada: pode reduzir a reutilização legítima, mas é alternativa caso produto/jurídico não autorize retenção privada antes do evento.

## Decisão proposta

Quando e se a Task 19 for autorizada, o `Profile` será a autoridade dos valores privados. A exposição futura não será uma visibilidade genérica: dependerá de grant explícito contendo finalidade aprovada, identificador de evento, audiência/papel autorizado, instante de concessão, condição de expiração e revogação.

O contexto de eventos/participação não consulta tabelas de perfil diretamente. Ele solicita uma projeção mínima por porta de aplicação; a política avalia o escopo no backend e retorna ausência quando qualquer condição não é satisfeita. A revogação interrompe novas projeções, sem apagar o valor privado automaticamente. Logs e auditoria guardam somente ação, ator/papel autorizado, escopo técnico, resultado e correlação, nunca o conteúdo.

Esta ADR não autoriza uma rota ou uma audiência real até produto e jurídico definirem as finalidades, os papéis, o momento de exposição, expiração, retenção, cópia/exportação e efeito da revogação. `public` e `authenticated` genéricos permanecem proibidos para esses dados.

## Consequências

- Evita que uma escolha de perfil vire revelação ampla ou permanente.
- Exige porta entre bounded contexts, autorização contextual, migration própria, índices por escopo e testes de concorrência/revogação.
- Pode exigir que a primeira entrega seja somente privada ou espere os fluxos de eventos; essa decisão continua bloqueada.
- Exige parecer jurídico brasileiro antes da ativação em produção.

## Adoção e rollback

Publicar somente atrás de flag desligada, após migration aditiva e aceite jurídico. Rollback operacional desabilita edição/exposição e bloqueia novas projeções; schema e dados não recebem down migration destrutiva. Retenção e eliminação dependem de política aceita.

## Evidências

- `docs/DER-EventMatch-MVP.md` RF015, RF017, RF081; RN014, RN112; RNF001–RNF002, RNF006, RNF023, RNF025
- `docs/adrs/ADR-038-modelo-de-completude-e-visibilidade-do-perfil.md`
- `docs/legal/pt-BR/politica-de-privacidade-v1.0.0.md` §§2–4 e §7
