# ADR-010: Integrar verificação de contato por portas de e-mail e WhatsApp

- **Status:** accepted
- **Data:** 2026-09-25
- **Decisores:** produto, backend, operação e segurança
- **Relacionado:** `specs/sdd-006-modelagem-conceitual-cadastro/tasks.md`
- **Substitui/Substituído por:** N/A

## Contexto

O cadastro aceita e-mail ou celular. A decisão de produto escolheu e-mail com OTP e link por Resend, e celular por WhatsApp Cloud API direta da Meta no Brasil, sem fallback por SMS.

## Decisão proposta

Definir portas outbound independentes de provedor para entrega de verificação por e-mail e WhatsApp. O MVP usa Resend para e-mail e WhatsApp Cloud API direta da Meta para celular no Brasil, sem fallback por SMS. Casos de uso geram o desafio antes de chamar adapters; adapters retornam somente resultado seguro/idempotente. Segredos de provedores ficam em ambiente, com timeout, retry limitado e correlação sem PII em logs.

Cada chamada ao provedor tem timeout de cinco segundos. Falhas transitórias de rede ou provedor recebem no máximo duas novas tentativas automáticas; erro definitivo, como número inválido ou template recusado, não é repetido automaticamente. Uma chave de idempotência por desafio e entrega evita múltiplas mensagens quando a pessoa clica novamente ou o cliente repete a requisição.

O cadastro solicita consentimento explícito para o envio transacional do código por WhatsApp ao número informado. Esse consentimento não substitui os aceites jurídicos do produto e é registrado apenas com o contexto mínimo necessário.

## Opções consideradas

1. Portas por canal e adapters substituíveis — aceito; preserva domínio/aplicação e permite testes contratuais.
2. SDK do provedor dentro do caso de uso — rejeitado; acopla regras de negócio e impede substituição.
3. Um canal único para todos — não atende cadastro por e-mail ou celular.

## Consequências

- A implementação exige configuração segura de credenciais e templates aprovados, sem introduzir SDK de provedor no domínio ou aplicação.
- Falhas de entrega não revelam existência de conta e não concluem verificação.
- WhatsApp tem custo por mensagem/template aplicável pela Meta; Resend é usado inicialmente dentro de seu limite gratuito, sujeito aos limites vigentes do provedor.

## Condições de aceitação

Antes da implementação, cadastrar e aprovar templates de autenticação, configurar domínio de e-mail e credenciais, e revisar os termos operacionais vigentes dos provedores. A cobertura inicial do MVP é o Brasil.
