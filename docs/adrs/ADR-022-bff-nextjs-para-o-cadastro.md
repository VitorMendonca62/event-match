# ADR-022: Usar Next.js BFF como entrada do navegador para o cadastro

- **Status:** accepted
- **Data:** 2026-09-26
- **Aceita em:** 2026-09-26
- **Decisores:** frontend, backend, segurança e operação
- **Relacionado:** `specs/sdd-009-api-http-entrega-verificacao-cadastro/tasks.md`; ADR-020, ADR-021, ADR-023; TASK 07
- **Substitui/Substituído por:** N/A

## Contexto

O browser pode chamar o NestJS diretamente ou passar por Route Handlers. A continuação precisa ficar inacessível a JavaScript, e produção precisa de uma origem confiável para rate limit sem liberar CORS amplo.

## Opções consideradas

1. **Next.js Route Handlers como BFF/proxy estrito**, cookie HttpOnly no mesmo domínio e NestJS interno.
2. Browser chama NestJS diretamente com cookie cross-origin — exige CORS/CSRF/cookie e topologia mais sensíveis.
3. Reimplementar fluxo no Next.js — rejeitado; duplicaria regras e violaria ownership do backend.

## Decisão

Adotar a opção 1. A TASK 07 cria Route Handlers sob `front/src/app/api/registration/**` que validam origem/CSRF, encaminham DTOs ao NestJS, guardam a continuação no cookie `__Host-eventmatch_registration` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`) e removem headers/tokens sensíveis da resposta ao browser.

O BFF usa `BACKEND_INTERNAL_URL`, não acessa PostgreSQL, não interpreta regras nem guarda estado mutável em módulo. O NestJS continua sendo a única API de negócio. Em produção, rotas de cadastro do backend aceitam tráfego apenas da rede/BFF autorizado; CORS para browser não é necessário. Callback de e-mail consome o token via Route Handler e responde `303` para URL limpa com `Referrer-Policy: no-referrer`.

## Consequências

- Simplifica cookie, CORS, CSRF e redaction para o navegador.
- Acrescenta um salto HTTP e exige disponibilidade/configuração do BFF.
- TASK 06 pode testar diretamente com bearer; liberação pública espera TASK 07.
- Aplicar `server-auth-actions`, `server-no-shared-module-state`, `server-serialization`, `async-api-routes` e `async-defer-await`.

## Plano de adoção e rollback

Backend fica atrás de flag até o BFF existir. Rollback desabilita Route Handlers e rotas; cookie é expirado. Nenhum tráfego deve alternar silenciosamente para chamada direta.

## Evidências e referências

- `AGENTS.md` §§3 e 5
- `.agents/skills/nextjs-architecture/SKILL.md`
- ADR-020 e ADR-021

## Atualização posterior

A ADR-023, aceita em 2026-09-26, define a Vercel direta como o primeiro ambiente publicado do frontend/BFF. Nesse ambiente, o BFF deriva a fingerprint de origem e autentica cada chamada de cadastro ao NestJS com uma credencial interna; uma futura migração para Cloudflare troca apenas o resolvedor server-only e exige nova ADR de deploy.
