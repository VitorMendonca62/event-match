# ADR-020: Definir o contrato HTTP v1 do cadastro

- **Status:** accepted
- **Data:** 2026-09-26
- **Aceita em:** 2026-09-26
- **Decisores:** produto, backend, frontend e segurança
- **Relacionado:** `specs/sdd-009-api-http-entrega-verificacao-cadastro/tasks.md`; ADR-009, ADR-012, ADR-019, ADR-021; ADR-025
- **Substitui/Substituído por:** aceitação inicial de canal parcialmente restringida pela ADR-025

## Contexto

Os casos de uso da SDD-007 são internos, recebem ids e ainda não possuem DTOs, controllers ou OpenAPI. O frontend precisa de contrato estável sem usar ids como autorização nem obter sinais de existência de conta.

## Opções consideradas

1. **API REST orientada ao fluxo atual identificado por credencial**, sob `/api/v1/registration`, sem ids internos no path/body.
2. Rotas orientadas a recursos com `verificationId`, `registrationId` e `accountId` públicos — simples, mas incentiva uso de ids como autorização.
3. GraphQL — adiciona tecnologia e complexidade sem benefício para o fluxo linear.

## Decisão

Adotar a opção 1 e os endpoints definidos na SDD-009 §4: elegibilidade, pedido/reenvio/confirmação de contato, confirmação por link, senha, dados obrigatórios, snapshot, interesses, documentos aprovados e conclusão.

Manter o envelope existente `{ data, message, statusCode }`, UTC ISO-8601 e `Cache-Control: no-store`. O guard resolve a sessão da credencial; controllers não recebem ids internos do browser. `Idempotency-Key` é obrigatório nas mutações reexecutáveis após a sessão existir. Respostas de pedido/reenvio e recuperação têm mesmo status, shape e mensagem em caminhos observáveis.

DTOs vivem em `presentation/http/dto`, controllers/presenters em `presentation/http`, regras continuam em application/domain. Todos os endpoints têm Swagger, respostas tipadas e limites explícitos. O contrato é aditivo em `0.9.0`.

## Consequências

- Contrato mais seguro e simples para o frontend, ao custo de guard/sessão próprios.
- Catálogos de interesses são públicos; estado e documentos do fluxo usam continuação quando aplicável.
- Mudanças futuras de rota/DTO exigem compatibilidade, testes de contrato, changelog e versionamento.

## Plano de adoção e rollback

Publicar OpenAPI e rotas atrás de configuração/flag até existir BFF. Rollback: desabilitar as rotas e reimplantar `0.8.1`; nenhum consumidor público deve ser liberado antes do aceite.

## Evidências e referências

- `docs/04-integracoes-externas.md` §§1–2, 6
- `back/src/shared/presentation/http/api-response.dto.ts`
- `back/src/modules/registration/application/use-cases/`

## Atualização posterior

A ADR-025, aceita em 2026-09-26, restringe o pedido de verificação desta versão a `channel = email`. `whatsapp` não integra o enum público inicial e é rejeitado na validação sem efeitos; sua futura inclusão será uma extensão aditiva do contrato.
