# ADR-026: Substituir Resend por Brevo na entrega de e-mail

- **Status:** accepted
- **Data:** 2026-09-26
- **Aceita em:** 2026-09-26
- **Decisores:** produto, backend, segurança e operação
- **Relacionado:** `specs/sdd-009-api-http-entrega-verificacao-cadastro/tasks.md`; ADR-010, ADR-024 e ADR-025
- **Substitui/Substituído por:** substitui ADR-010 e ADR-024 somente na escolha do provedor e adapter de e-mail

## Contexto

A implementação da SDD-009 usa Resend, mas o envio para destinatários arbitrários exige um domínio controlado pelo EventMatch. O MVP é um ambiente público de testes sem objetivo comercial e deve operar sem custo de domínio. A Brevo oferece e-mail transacional no plano gratuito, permite verificar um remetente individual e, sem domínio autenticado, pode substituir o remetente por um endereço técnico próprio. Essa apresentação menos profissional é aceita somente durante os testes do MVP.

O backend, e não o provedor, continua responsável por gerar o OTP, persistir somente seu digest, controlar validade, tentativas, bloqueio, reenvio e consumo único. O provedor recebe OTP e link claros apenas durante a chamada de entrega.

## Opções consideradas

1. **Brevo gratuito com SDK oficial TypeScript e remetente individual verificado.**
2. Manter Resend e comprar um domínio — rejeitado pelo requisito atual de custo zero.
3. Gmail SMTP com senha de aplicativo — rejeitado por acoplar uma conta pessoal, ter controles operacionais fracos e usar credencial que o próprio Google não recomenda quando existe alternativa.
4. Manter `noop` no ambiente publicado — rejeitado porque simularia entrega e impediria concluir o cadastro.

## Decisão

Adotar a opção 1. `BrevoVerificationDeliveryAdapter`, em infraestrutura, implementa a porta `VerificationDeliveryPort` usando `@getbrevo/brevo@6.0.3`. O SDK não atravessa a porta e não é importado por domínio ou aplicação. A composição NestJS usa injeção por construtor e seleciona `brevo` ou `noop`; produção recusa `noop`.

O adapter envia conteúdo HTML e texto versionado no código, sem depender de template remoto. O OTP não aparece no assunto. A chamada usa `POST /v3/smtp/email`, `api-key` somente no transporte e `headers.idempotencyKey` no corpo da mensagem, conforme o contrato da Brevo. Como a Brevo exige UUID e a porta interna também admite chaves compostas de reenvio, o adapter deriva deterministicamente um UUID v5 opaco por entrega. Cada tentativa usa o mesmo UUID, tem timeout cancelável de 5 s e o adapter permite no máximo duas novas tentativas para falhas transitórias classificadas. `Retry-After` é respeitado até o limite de 5 s; erros definitivos não repetem. O SDK fica com retry automático desabilitado para que exista uma única política auditável no adapter.

Configuração: `VERIFICATION_DELIVERY_MODE=brevo`, `BREVO_API_KEY`, `EMAIL_FROM`, `FRONTEND_PUBLIC_URL` e `BREVO_BASE_URL` com padrão oficial. Tudo é validado por Zod/`ConfigModule`; chave, contato, OTP, link, payload e resposta do provedor não entram em logs. O remetente pode ser reescrito pela Brevo enquanto não houver domínio, comportamento aceito para testes e que deverá ser revisto antes de um lançamento comercial.

O plano gratuito vigente limita o ambiente a 300 e-mails/dia. Esse limite não altera a política de OTP: exaustão da cota produz falha de entrega neutra e telemetria segura. O rollout inicial fica restrito a testes controlados e monitora consumo/falhas; ampliar público ou volume exige revisar provedor, domínio e custo.

## Consequências positivas

- Permite testar com destinatários reais sem comprar domínio nem pagar assinatura.
- Mantém SDK oficial confinado ao adapter e preserva todas as portas/casos de uso.
- Evita template remoto obrigatório e mantém o conteúdo versionado/testável no repositório.

## Consequências negativas e riscos

- O remetente técnico da Brevo é menos profissional e pode afetar confiança ou entregabilidade.
- A cota gratuita pode ser esgotada por testes ou abuso; não há SLA gratuito.
- A troca exige nova dependência, configuração, fake HTTP e testes contratuais.

## Plano de adoção e rollback

Substituir dependência, adapter, configuração, fakes, testes, Compose, exemplos de ambiente e documentação. Validar com servidor Brevo falso, sem chamada externa. Antes do smoke real, verificar um remetente individual e guardar a API key no cofre do ambiente. Rollback desabilita as rotas ou usa `noop` somente fora de produção; não reativa Resend sem nova decisão.

## Evidências e referências

- Brevo Transactional Email API: https://developers.brevo.com/docs/send-a-transactional-email
- SDK Node.js oficial: https://developers.brevo.com/guides/node-js
- Limites do plano gratuito: https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan
- Comportamento sem domínio autenticado: https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders
