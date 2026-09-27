# ADR-023: Derivar fingerprint de origem em camada confiável

- **Status:** accepted
- **Data:** 2026-09-26
- **Aceita em:** 2026-09-26
- **Decisores:** segurança, backend, frontend e operação
- **Relacionado:** `specs/sdd-009-api-http-entrega-verificacao-cadastro/tasks.md`; ADR-009, ADR-015, ADR-022
- **Substitui/Substituído por:** complementa ADR-015 e encerra o adiamento do limite por origem na implementação da SDD-009

## Contexto

ADR-009 exige até dez desafios por origem/IP/hora. ADR-015 adiou o limite porque o backend não configurava proxy confiável e aceitar `X-Forwarded-For` do cliente permitiria falsificação. Com BFF, o backend enxerga o BFF, não necessariamente o visitante.

## Opções consideradas

1. **BFF deriva o endereço somente de proxy/header explicitamente confiável, converte em fingerprint HMAC e envia ao backend.**
2. Backend confiar em qualquer `X-Forwarded-For` — rejeitado por spoofing.
3. Continuar sem limite por origem — deixa abuso conhecido sem mitigação.
4. Persistir IP puro — rejeitado por minimização e privacidade.

## Decisão

Adotar a opção 1. O frontend/BFF inicial será hospedado diretamente na Vercel, no plano compatível com o caráter não comercial do ambiente de testes, sem Cloudflare ou outro proxy à frente. Em produção de testes, o resolvedor aceita somente `x-vercel-forwarded-for` fornecido pela Vercel; `X-Forwarded-For`, `X-Real-IP` e valores enviados diretamente pelo cliente não são fallback.

O BFF valida que há um único endereço bem-formado, normaliza IPv4/IPv6 e calcula `HMAC-SHA-256(ORIGIN_FINGERPRINT_KEY, canonicalIp)`. Somente a fingerprint segue no header interno `X-EventMatch-Origin-Fingerprint`; nenhum IP puro cruza para o NestJS, persistência, logs ou telemetria.

Como o backend do ambiente gratuito pode possuir URL pública, todas as rotas de cadastro exigem também `X-EventMatch-BFF-Token`, credencial opaca de 32 bytes configurada separadamente como `BFF_INTERNAL_TOKEN` no BFF e no NestJS e comparada em tempo constante. A credencial nunca vai ao navegador nem aos logs. O backend ignora headers públicos de encaminhamento e só aceita a fingerprint quando a credencial interna é válida.

O acesso à origem fica isolado em um resolvedor server-only, selecionado por configuração validada e sem estado mutável de módulo. A futura migração para Cloudflare substituirá apenas o adapter Vercel por um adapter que use `CF-Connecting-IP`, após teste de compatibilidade e nova ADR de deploy; não altera o contrato interno de fingerprint, o NestJS nem o schema PostgreSQL.

Ausência, multiplicidade ou configuração inválida falha cedo no ambiente publicado. Desenvolvimento local e testes automatizados usam adapter explícito baseado em fixture, nunca fallback silencioso para header arbitrário. O limite é consumido antes da unidade de negócio, como o limite por contato.

## Consequências

- Ativa limite entre réplicas sem armazenar IP.
- Exige `ORIGIN_FINGERPRINT_KEY` no BFF, `BFF_INTERNAL_TOKEN` compartilhado com o NestJS e conhecimento da topologia de deploy.
- Mudança de chave altera fingerprints e zera efetivamente a janela corrente; rotação deve respeitar a janela de uma hora.
- Vercel é o alvo inicial de menor atrito para Next.js; a portabilidade para Cloudflare é preservada pelo resolvedor, mas a migração exigirá adapter/configuração e validação próprios.

## Plano de adoção e rollback

Configurar os dois segredos e a cadeia Vercel direta antes de habilitar as rotas. Rollback desabilita a entrada pública, não o limite silenciosamente; ADR-015 volta a representar o estado anterior. A migração futura para Cloudflare ocorre por nova ADR e rollout explícito, nunca aceitando simultaneamente headers genéricos de múltiplos provedores.

## Evidências e referências

- ADR-009 e ADR-015
- `back/src/main.ts` (sem `trust proxy` atualmente)
- `verification_rate_window.scope = 'origin'`
- https://vercel.com/docs/headers/request-headers
- https://developers.cloudflare.com/fundamentals/reference/http-headers/
