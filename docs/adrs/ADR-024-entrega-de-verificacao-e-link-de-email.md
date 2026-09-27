# ADR-024: Usar SDK oficial do Resend e HTTP direto para WhatsApp

- **Status:** accepted
- **Data:** 2026-09-26
- **Aceita em:** 2026-09-26
- **Decisores:** backend, segurança e operação
- **Relacionado:** `specs/sdd-009-api-http-entrega-verificacao-cadastro/tasks.md`; ADR-010, ADR-014, ADR-016, ADR-020, ADR-025 e ADR-026
- **Substitui/Substituído por:** WhatsApp inicial adiado pela ADR-025; Resend substituído pela Brevo na ADR-026

## Contexto

ADR-010 escolheu Resend e WhatsApp Cloud API, timeout de 5 s e até duas novas tentativas transitórias. Hoje o adapter é noop, o e-mail não recebe link e não há classificação explícita de retry/idempotência por provedor. O OTP claro só existe em memória e não pode ser colocado em outbox sem nova decisão de proteção.

## Opções consideradas

1. **Solução híbrida: SDK oficial do Resend para e-mail e `fetch` nativo para WhatsApp**, com adapters por canal e entrega síncrona após commit.
2. HTTP direto com `fetch` nos dois provedores — reduz dependências, mas abre mão da tipagem e da ergonomia do SDK oficial mantido pelo Resend.
3. SDKs nos dois provedores — rejeitado porque o SDK oficial Node.js da Meta para WhatsApp Cloud API está arquivado; adotar SDK comunitário adicionaria risco de manutenção e cadeia de suprimentos para uma chamada pequena.
4. Outbox/fila com payload cifrado — mais confiável, porém amplia schema, gestão de chave, job/worker e escopo.

## Decisão

Adotar a opção 1, sem outbox nesta task. `ResendVerificationDeliveryAdapter` encapsula exclusivamente o pacote oficial `resend`, envia chave de idempotência estável (suportada por 24 h pelo Resend) e template versionado com OTP e URL de confirmação. O SDK não atravessa a porta outbound nem é importado pelo domínio ou pela aplicação. Sua versão é fixada no lockfile Bun e o adapter possui testes contratuais sobre resultado, erro, timeout e idempotência.

`WhatsAppVerificationDeliveryAdapter` usa o `fetch` nativo do Bun para chamar `POST /{phone-number-id}/messages` na Graph API versionada e enviar template de autenticação aprovado, com `biz_opaque_callback_data` apenas opaco quando suportado. Não usar o SDK oficial arquivado da Meta nem bibliotecas que automatizem uma conta pessoal do WhatsApp.

O caso de uso gera token de link de 32 bytes para e-mail, persiste somente digest em `contact_verification.link_token_digest` e passa o token claro ao adapter apenas em memória. A URL usa `FRONTEND_PUBLIC_URL` e aponta para callback do BFF. Confirmação por link usa lock, comparação segura, expiração do desafio e uso único; token inválido/expirado retorna `verified: false` sem detalhe.

Cada tentativa tem timeout cancelável de 5 s. São permitidas até duas novas tentativas para erro de conexão inequivocamente anterior ao envio, `408`, `429` respeitando `Retry-After` limitado e `5xx` quando o provedor oferece idempotência. `4xx` definitivo não repete. Timeout/resposta ambígua do WhatsApp não é repetido automaticamente porque não há garantia documentada de idempotência; a pessoa usa reenvio explícito, que gera novo OTP/link e nova chave. A implementação deve confirmar, em teste contratual, que a versão fixada do SDK Resend propaga o `AbortSignal`; se isso não ocorrer, a implementação volta para planejamento em vez de simular timeout sem cancelar a requisição.

Usar somente configuração Zod/`ConfigModule`: modo de entrega, chaves, remetente/domínio, phone number id, business account/template/locale, Graph API version e URL pública. Noop é permitido apenas em teste/desenvolvimento explícito. Produção falha cedo se modo real não estiver completamente configurado. Nunca logar request/response completos.

## Consequências

- Adiciona uma dependência oficial e mantida somente ao adapter de e-mail; atualizações exigem revisão do changelog e dos testes contratuais.
- WhatsApp permanece com protocolo HTTP pequeno, explícito e sem dependência de SDK arquivado ou comunitário.
- Resend tem idempotência forte; WhatsApp mantém risco residual de perda ou duplicação em resultado ambíguo.
- Sem outbox: crash após commit pode exigir reenvio do usuário; aceito nesta fatia e observado por métrica segura.
- Webhooks/recibos e fila ficam para ADR/tarefa futura.

## Plano de adoção e rollback

Validar domínio, remetente e templates antes de habilitar produção. Smoke por canal com contatos de teste autorizados. Rollback troca configuração para noop apenas fora de produção ou desabilita as rotas; revogar tokens de provedor em incidente.

## Evidências e referências

- ADR-010, ADR-014 e ADR-016
- SDK oficial do Resend: https://github.com/resend/resend-node
- Resend idempotency keys: https://resend.com/changelog/idempotency-keys
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api/
- SDK Node.js oficial da Meta arquivado: https://github.com/WhatsApp/WhatsApp-Nodejs-SDK

## Atualização posterior

A ADR-025, aceita em 2026-09-26, mantém esta decisão como desenho futuro do adapter WhatsApp, mas o retira da SDD-009 e do primeiro ambiente publicado. Nesta etapa, somente o adapter Resend é real; WhatsApp fica desabilitado na interface e não é aceito pelo contrato HTTP.

A ADR-026, aceita em 2026-09-26, substitui o SDK e protocolo Resend pelo SDK oficial e API transacional da Brevo. Permanecem vigentes a entrega após commit, o link de uso único, o timeout, os retries classificados, a idempotência e a ausência de outbox.
