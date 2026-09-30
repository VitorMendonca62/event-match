# ADR-036: Autorizar sessões por estado atual e capacidade da conta

- **Status:** accepted
- **Data:** 2026-09-29
- **Decisores:** produto, segurança, domínio e backend
- **Relacionado:** `specs/sdd-013-autenticacao-sessao-primeiro-acesso/tasks.md`; ADR-008, ADR-017, ADR-033
- **Substitui/Substituído por:** N/A

## Contexto

Hoje o schema implementado conhece `account_incomplete`, `active` e `expired`, enquanto o DER também prevê verificação de idade, recuperação restrita, desativação, exclusão pendente/concluída e suspensão. Alguns estados futuros podem admitir fluxos especializados, mas a Task 11 cria somente a sessão comum e uma área autenticada mínima.

Uma sessão válida não pode congelar o estado ou as capacidades existentes no instante do login. Mudanças de segurança precisam surtir efeito sem aguardar expiração ou novo login.

## Drivers da decisão

- Menor privilégio e negação por padrão.
- Falha neutra sem revelar estado privado.
- Reavaliação live em toda requisição protegida.
- Preparar guards por capacidade sem implementar todo o subsistema de restrições.
- Preservar fluxos futuros de reativação e cancelamento de exclusão fora da sessão comum.

## Opções consideradas

1. **Somente `active` recebe sessão comum; capacidades são consultadas a cada requisição.**
2. Copiar status e permissões para a sessão no login — rejeitado por ficar obsoleto.
3. Emitir sessão comum para qualquer conta com senha correta — rejeitado por ampliar privilégios.
4. Implementar nesta task todos os fluxos limitados de desativação/exclusão/recuperação — fora do escopo.

## Decisão

Adotar a opção 1. A migration `0006` amplia o `CHECK`/tipo de `account.status` para os estados canônicos já documentados, sem criar transições novas nesta task:

```text
account_incomplete | active | expired | age_verification | recovery_restricted |
deactivation_pending | deactivated | deletion_pending | deleted | suspended
```

Somente `active` pode criar sessão comum. Contato inexistente, senha incorreta, `account_incomplete`, `expired` e qualquer estado não autorizado retornam o mesmo `401`, sem sessão e sem indicar a causa. Fluxos futuros de reativação, recuperação ou cancelamento da exclusão terão contratos e sessões limitadas próprios; não reutilizam a sessão comum por antecipação.

Uma conta `active` submetida a restrição pode autenticar somente nas capacidades que a política atual permitir. `identity-access` depende de uma porta de decisão (`AccountAccessPolicyPort`) que recebe conta e capacidade solicitada. Nesta entrega, as capacidades públicas são no mínimo `authenticated_home` e `logout`; testes com fake provam negação de outras capacidades. A persistência completa de restrições continua fora do escopo, mas nenhum guard futuro pode autorizar apenas por haver uma sessão.

Cada resolução de sessão consulta a conta/política atual; a sessão guarda identidade, não um snapshot de permissões. A negação segue dois casos distintos:

| Situação na resolução | Resposta | Efeito na sessão |
|---|---|---|
| Sessão ausente, expirada, revogada ou conta fora de `active` | `401` neutro, igual ao do login | A sessão é revogada/removida no servidor; o BFF expira o cookie e redireciona a `/entrar`. |
| Conta `active` com a capacidade solicitada negada pela política | `403` com corpo genérico | A sessão permanece válida; o BFF não expira o cookie nem serializa conteúdo privado. |

`401` significa, portanto, “sem sessão utilizável” e nunca revela o estado da conta; `403` fica reservado a restrições parciais de uma conta `active` e também não informa o motivo. Logout permanece possível para qualquer sessão que ainda possa ser resolvida, inclusive com capacidade negada.

## Consequências positivas

- Mudanças de estado e restrição têm efeito imediato.
- Sessão não vira fonte paralela de autorização.
- Estados privados permanecem ocultos no login.
- Fluxos limitados futuros podem ser desenhados sem conceder sessão comum agora.

## Consequências negativas e riscos

- Toda requisição protegida consulta estado/capacidade no backend.
- O schema passa a reconhecer estados ainda sem comandos de transição.
- A integração real com restrições depende de tarefa futura; esta entrega fornece a porta, a negação por padrão e testes de contrato.

## Plano de adoção e rollback

Ampliar o `CHECK` na migration `0006` e manter os comandos existentes sem produzir estados novos. Rollback da aplicação continua lendo os três estados atuais; a constraint ampliada permanece. Se algum estado novo já tiver sido persistido por entrega futura, um downgrade que não o reconheça exige forward fix, nunca estreitamento destrutivo da constraint.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF057–RF062, RF076, RF078, RF088 e RN085–RN106
- `docs/03-modelos-de-dominio.md` §Account e estados sugeridos
- `back/src/modules/registration/domain/entities/account.ts`
- ADR-008, ADR-017 e ADR-033
