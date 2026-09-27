# ADR-019: Validar maioridade antes de coletar contato no cadastro

- **Status:** accepted
- **Data:** 2026-09-26
- **Aceita em:** 2026-09-26
- **Decisores:** produto, privacidade, frontend e backend
- **Relacionado:** `specs/sdd-009-api-http-entrega-verificacao-cadastro/tasks.md`; ADR-008, ADR-011, ADR-012
- **Substitui/Substituído por:** substitui parcialmente a ADR-008 somente na ordem da jornada e no momento da primeira validação do nascimento

## Contexto

O DER apresenta validação de idade como RF001 e proíbe contas de menores (RN001), mas não fixa a ordem das telas. A ADR-008 e as SDDs 006/007 adotaram contato → OTP → senha → dados obrigatórios → nascimento/aceites → interesses. O produto questionou essa ordem e a recomendação técnica foi impedir o avanço antes de coletar contato ou consumir entrega externa.

## Drivers da decisão

- Interromper cedo um fluxo inelegível.
- Não coletar contato, senha ou gastar mensagem com menor.
- Não persistir nascimento antes da ativação nem colocá-lo no navegador.
- Preservar revalidação autoritativa no backend na conclusão.

## Opções consideradas

1. **Nascimento como primeira informação após apresentação**, validar no backend, não persistir a data e emitir continuação apenas se elegível.
2. Manter nascimento na conclusão — menor fricção inicial, mas coleta dados e envia mensagem antes de descobrir inelegibilidade.
3. Perguntar apenas “tenho 18 anos” — menos sensível, porém não atende RF001, que exige solicitar nascimento.

## Decisão

Adotar a opção 1. `CheckRegistrationEligibility` recebe `birthDate`, usa `BirthDate` e `ClockPort`, retorna apenas `eligible`. Se elegível, cria uma sessão de continuação em estágio `age_eligible`; a data não entra na sessão, banco, token, log, telemetria ou `sessionStorage`. Se inelegível, nenhuma sessão ou outro dado é criado.

O frontend mantém a data somente em memória durante a navegação. Em refresh/retomada, solicita-a novamente. A conclusão recebe `birthDate` novamente e `CompleteRegistration` revalida os 18 anos sob a transação antes de persistir na conta ativa.

## Consequências

- Reduz coleta e custo de entrega para pessoas inelegíveis.
- Refresh exige informar a data novamente, por decisão de minimização.
- Exige atualizar as referências da ADR-008, das SDDs 006/007, dos documentos canônicos e do fluxo existente.
- Não comprova identidade/idade real; apenas aplica a declaração de nascimento informada, como já ocorre no MVP.

## Plano de adoção e rollback

Adicionar o caso de uso e endpoint de elegibilidade antes de expor contato. Rollback: desabilitar a exigência do estágio `age_eligible` e restaurar a ordem anterior por nova ADR; não há nascimento persistido para migrar.

## Evidências e referências

- DER RF001, RN001, RN009
- `docs/adrs/ADR-008-modelagem-e-persistencia-do-cadastro.md`
- `docs/adrs/ADR-011-progresso-de-cadastro-no-navegador.md`
