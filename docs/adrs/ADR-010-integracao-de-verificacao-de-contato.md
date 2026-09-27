# ADR-010: Integrar verificação de contato por portas de e-mail e WhatsApp

- **Status:** accepted
- **Data:** 2026-09-25
- **Decisores:** produto, backend, operação e segurança
- **Relacionado:** `specs/sdd-006-modelagem-conceitual-cadastro/tasks.md`; ADR-024, ADR-025 e ADR-026
- **Substitui/Substituído por:** WhatsApp inicial adiado pela ADR-025; provedor de e-mail substituído pela ADR-026

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

- A implementação exige configuração segura de credenciais e templates aprovados. Conforme ADR-024, o SDK oficial do Resend fica confinado ao adapter de infraestrutura; domínio e aplicação permanecem independentes de provedor.
- Falhas de entrega não revelam existência de conta e não concluem verificação.
- WhatsApp tem custo por mensagem/template aplicável pela Meta; Resend é usado inicialmente dentro de seu limite gratuito, sujeito aos limites vigentes do provedor.

## Condições de aceitação

Antes da implementação, cadastrar e aprovar templates de autenticação, configurar domínio de e-mail e credenciais, e revisar os termos operacionais vigentes dos provedores. A cobertura inicial do MVP é o Brasil.

## Atualização posterior

A ADR-025, aceita em 2026-09-26, adia a ativação de WhatsApp. A primeira publicação permite cadastro somente por e-mail; WhatsApp aparece desabilitado como “Em breve” e o `noop` não simula entrega em produção.

A ADR-026, aceita em 2026-09-26, substitui Resend por Brevo no canal de e-mail para permitir testes com destinatários reais sem custo de domínio. Portas, política de OTP e isolamento do provedor permanecem inalterados.
