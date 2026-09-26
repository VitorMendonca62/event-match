# ADR-009: Proteger verificação de contato com OTP e bloqueio temporário

- **Status:** accepted
- **Data:** 2026-09-25
- **Decisores:** produto, segurança, backend e operação
- **Relacionado:** `specs/sdd-006-modelagem-conceitual-cadastro/tasks.md`; ADR-015 (persistência dos limites; adia o limite por origem/IP até haver origem confiável)
- **Substitui/Substituído por:** limite por origem/IP parcialmente adiado pela ADR-015; demais decisões permanecem vigentes

## Contexto

RF002 e RNF003 exigem confirmação temporária de contato; RNF004 impede enumeração. O DER não especifica TTL, tentativas, reenvios, bloqueio ou dimensões de rate limit.

## Decisão proposta

Representar desafio OTP por fluxo e contato, armazenando apenas hash do código, expiração, contador de falhas, reenvios e estado de bloqueio. Aplicar limite também por origem para reduzir abuso, devolver respostas neutras e nunca registrar código, contato completo ou detalhe do motivo de bloqueio.

Parâmetros aprovados:

- OTP válido por 15 minutos;
- no máximo cinco tentativas inválidas por desafio;
- bloqueio de 20 minutos após exceder o limite de tentativas;
- reenvio após 60 segundos, no máximo três reenvios por contato por hora;
- no máximo cinco desafios por contato por hora e dez por origem/IP por hora.

## Opções consideradas

1. OTP com hash, expiração e bloqueio persistido — proposto; auditável e consistente entre réplicas.
2. OTP somente em memória — perde estado em restart e não protege múltiplas réplicas.
3. Delegar integralmente o controle ao provedor — não protege regras de negócio nem antienumeração local.

## Consequências

- Requer decisões de produto para TTL, tentativas, duração do bloqueio, reenvio e rate limit.
- Exige transação/locking ao incrementar tentativas e confirmar contato.
- Observabilidade registra somente métricas agregadas e códigos seguros.

## Consequências operacionais

- Contadores de tentativa e bloqueio precisam ser atualizados atomicamente.
- Limites por origem/IP devem considerar proxy confiável e não podem ser a única barreira contra abuso.
- Mensagens para sucesso, falha, expiração, bloqueio e contato existente permanecem neutras, conforme RNF004.
