# ADR-008: Modelar e persistir o cadastro como agregado provisório

- **Status:** accepted
- **Data:** 2026-09-25
- **Decisores:** produto, backend, arquitetura e privacidade
- **Relacionado:** `specs/sdd-006-modelagem-conceitual-cadastro/tasks.md`
- **Substitui/Substituído por:** N/A

## Contexto

O DER exige verificação de contato, maioridade, senha, dados obrigatórios, aceites e interesses antes de concluir o cadastro. A conta definitiva não deve surgir parcialmente nem violar a unicidade de contatos ativos.

## Decisão proposta

Introduzir futuramente o agregado provisório `Registration`, separado de `Account`, com estados explícitos e prazo de expiração. O fluxo canônico é `verification_pending` → `registration_in_progress` → `account_incomplete` → `active`, com saída `expired` para abandono. O desafio técnico `ContactVerification`/`OtpChallenge` sustenta `verification_pending`; após OTP validado e senha informada, cria-se o `Registration` em progresso. `Account` é persistida com os dados obrigatórios e permanece em `account_incomplete` até a conclusão, que valida as demais invariantes e ativa `Account`, completa `Profile`, associa interesses e registra aceites em uma transação única.

Enquanto estiver em `account_incomplete`, a conta permite exclusivamente retomar o cadastro; não acessa eventos, perfil público nem outros recursos do produto. `Registration` abandonado expira e é apagado 24 horas após a última atualização. `Account` incompleta é removida 15 dias após a última atualização, com exclusão dos dados de cadastro e liberação do contato. O primeiro vertical slice define as tabelas Drizzle e migration revisada.

## Opções consideradas

1. Registro provisório persistido no PostgreSQL — proposto; permite retomada entre dispositivos e controles de abuso auditáveis.
2. Apenas estado local no navegador — não atende retomada segura, unicidade nem proteção contra abuso.
3. Criar `Account` incompleta no início — aumenta risco de contas órfãs e regras espalhadas.

## Consequências

- Exige cleanup/expiração e classificação de dados provisórios, incluindo remoção de `Registration` após 24 horas e de `Account` incompleta após 15 dias sem atualização.
- Permite constraints, idempotência e transação de conclusão.
- Não autoriza schema, migration ou código antes da aceitação e da definição de parâmetros do produto.

## Condições de aceitação

A decisão está pronta para aceite. A implementação futura ainda deverá alinhar a política jurídica aplicável a aceites/dados provisórios antes de lançamento.
