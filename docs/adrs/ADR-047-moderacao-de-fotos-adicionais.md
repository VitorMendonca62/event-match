# ADR-047: Moderar fotos adicionais por porta de domínio antes de qualquer exposição a terceiros

- **Status:** proposed
- **Data:** 2026-10-07
- **Decisores:** produto, confiança e segurança, privacidade, backend e operação
- **Relacionado:** Task 17; ADR-039, ADR-046
- **Substitui/Substituído por:** N/A

## Contexto

A Task 17 permite visibilidade `authenticated` somente em superfícies autorizadas, mas determina que uma foto adicional não seja entregue a terceiros sem moderação. O DER requer denúncia, contestação, acesso por profissional autorizado, auditoria e proteção de dados de terceiros (RF065, RF077, RF080, RF091, RN075–RN077, RN150–RN155, RNF022).

Cloudinary normaliza arquivos, remove metadados e controla entrega, mas não define a política de adequação do conteúdo nem o fluxo de denúncia do EventMatch. O repositório ainda não implementa o bounded context operacional de denúncias, profissionais, casos e recursos.

## Opções consideradas

1. **Porta de moderação com triagem automática, revisão humana para sinalizados, falha fechada para exposição e fluxo de denúncia/recurso no contexto de confiança e segurança.**
2. Publicar e agir apenas após denúncia. Rejeitada: expõe pessoas a conteúdo inadequado antes da proteção e contraria a Task 17.
3. Revisar manualmente todas as fotos antes de qualquer uso, sem triagem. Rejeitada: cria fila operacional desproporcional sem reduzir a necessidade de denúncia e recurso.
4. Aceitar exclusivamente o veredito de um provedor sem revisão ou recurso. Rejeitada: automação punitiva opaca conflita com o DER e não oferece governança adequada.

## Decisão proposta

- Introduzir a porta de saída `ProfileImageModerationPort`; o domínio recebe somente um veredito normalizado (`approved`, `flagged`, `rejected`, `unavailable`) e uma referência opaca de auditoria, jamais scores brutos, URLs ou conteúdo.
- Após a finalização autoritativa no Cloudinary, a foto de galeria fica disponível apenas para a titular e entra em `pending_moderation`. Somente `approved` permite projeção `authenticated`; `flagged`, `rejected` ou `unavailable` mantêm a foto fora de qualquer visão de terceiros.
- A chamada a fornecedor, reconsulta e remoção externa acontecem fora de transação e não bloqueiam a edição textual do perfil. Retentativas são idempotentes e telemetria não registra imagem, URL, legenda, localização nem razão detalhada.
- Denúncia, ocultação imediata para quem denuncia, decisão humana, recurso, segregação de acesso, conflito de interesse e auditoria serão implementados no bounded context de Confiança e Segurança; a galeria só referencia o caso por identificador opaco.
- A seleção do fornecedor, DPA, suboperadores, região, retenção de imagens/vereditos e limites de uso permanecem pendentes. Esta ADR não pode ser aceita nem a exposição `authenticated` habilitada até essas decisões e o fluxo operacional existirem.

## Consequências

- A galeria privada pode ser entregue sem liberar conteúdo a terceiros quando a moderação não estiver pronta.
- Exposição autenticada depende de uma integração nova, de operação humana e de critérios versionados; aumenta custo e prazo, mas preserva segurança e possibilidade de recurso.
- O adapter de moderação permanece substituível e não contamina domínio, controllers ou contratos públicos com detalhes do fornecedor.

## Adoção e rollback

Introduzir flags separadas para galeria privada, moderação e projeção a terceiros. A ordem é migration → galeria privada → adapter de moderação em modo observável → fluxo de denúncia/recurso → exposição autenticada. Rollback desliga a projeção a terceiros e mantém itens privados; qualquer asset removido continua no cleanup idempotente.

## Evidências

- `docs/DER-EventMatch-MVP.md` RF065, RF077, RF080, RF081, RF091; RN075–RN077, RN150–RN155; RNF001, RNF022
- `docs/02-regras-de-negocio.md` §§5–6
- `specs/tasks.txt` Task 17
