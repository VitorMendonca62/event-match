# ADR-030: Cancelar o cadastro executando a expiração imediata no backend

- **Status:** accepted
- **Data:** 2026-09-29
- **Decisores:** produto, backend e frontend
- **Relacionado:** `specs/sdd-011-publicar-conteudo-documentos-legais/tasks.md`, ADR-017, ADR-021, ADR-022
- **Substitui/Substituído por:** N/A. Complementa a nota do SDD-010 §4.1 (“o contrato não tem revogação no servidor”).

## Contexto

“Cancelar cadastro” só apagava o rascunho local e o cookie de continuação. No backend, o cadastro provisório seguia até o TTL (24 h em `registration_in_progress`, 15 dias em `account_incomplete`), retendo o e-mail cifrado e o hash da senha e mantendo o contato indisponível para um novo cadastro. A ADR-021 já prevê revogar os digests “em conclusão, cancelamento e expiração”, mas não existia operação de cancelamento.

## Decisão

Criar `DELETE /api/v1/registration`, autenticado pela continuação (Bearer) e pela credencial do BFF, que aciona o mesmo procedimento da expiração de um cadastro abandonado (ADR-017), agora sob demanda:

- `registration_in_progress`: o registro passa a `expired` e os dados retidos (contato, cifra, versão de chave, hash de senha) são anulados.
- `account_incomplete`: a conta passa a `expired`, o nascimento e os dados pessoais são apagados (`erasePersonalData`) e o contato é liberado.
- Estágios anteriores (`age_eligible`, `verification_pending`, `contact_verified`): nada foi retido no registro; só a continuação é revogada.
- Em todos os casos os digests da sessão são anulados e `revoked_at` é preenchido (sem mudar o estágio). Sem exclusão física.
- Conta `active` e sessão `completed` nunca são alteradas. Token desconhecido, já revogado ou anterior (rotacionado) responde `401` e não altera nada.
- Resposta `200 { cancelled: true }` com `Cache-Control: no-store`. A operação é naturalmente idempotente: repetir devolve `401`, que o BFF trata como sucesso de cancelamento.
- O BFF (`DELETE /api/registration`) usa o proxy comum (origem confiável, `Content-Type` JSON, cookie → Bearer) e expira o cookie em sucesso ou `401`. Se o backend não puder ser alcançado, a pessoa continua no cadastro com um aviso e pode tentar de novo; o TTL segue como rede de segurança.
- No frontend, “Cancelar cadastro” e “Sair do cadastro” (após “Não aceito”) usam a mesma chamada. Isso altera a regra do SDD-011 §5 nº 4 (“nenhuma chamada ao backend” na saída), que só existia por falta desta operação.

## Consequências

- O e-mail e a senha deixam de ser retidos após a desistência, e a pessoa pode recomeçar com o mesmo e-mail.
- Nenhuma nova tabela nem migration; a operação reaproveita as regras de domínio `Registration.expire` e `Account.expire`.
- Contrato aditivo: nova rota; versão do backend permanece `0.10.0` (ainda não publicada).
- Sessões em `verification_pending` mantêm o desafio de verificação até seu TTL de 15 minutos; não há dado pessoal além do contato cifrado do desafio.
