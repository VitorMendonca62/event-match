# ADR-034: Transportar a sessão em cookie HttpOnly por um BFF Next.js

- **Status:** accepted
- **Data:** 2026-09-29
- **Decisores:** segurança, frontend, backend e operação
- **Relacionado:** `specs/sdd-013-autenticacao-sessao-primeiro-acesso/tasks.md`; ADR-022, ADR-023, ADR-033
- **Substitui/Substituído por:** N/A

## Contexto

A sessão opaca da ADR-033 é um bearer secret. O navegador não deve acessá-la por JavaScript, e o NestJS continua sendo a única API de negócio. O projeto já usa Route Handlers como proxy estrito do cadastro e possui origem confiável da Vercel, credencial BFF interna, verificação de `Origin` e política sem CORS.

## Drivers da decisão

- Manter o segredo fora de `localStorage`, `sessionStorage`, props RSC e bundles.
- Evitar cookie cross-origin e CORS amplo entre browser e NestJS.
- Proteger login, logout e rotação contra CSRF e login CSRF.
- Garantir `no-store` e remoção do cookie em expiração/revogação.
- Permitir desenvolvimento local em HTTP sem enfraquecer produção.

## Opções consideradas

1. **Cookie same-origin HttpOnly no Next.js BFF**, que encaminha bearer e credencial interna ao NestJS.
2. Access token entregue ao JavaScript — rejeitado por ampliar impacto de XSS e exigir armazenamento client-side.
3. Cookie direto e cross-origin no NestJS — exige CORS, domínio e proteção de cookie mais sensíveis.
4. Sessão implementada no Next.js — rejeitada por duplicar autorização e acessar persistência fora do backend.

## Decisão

Adotar a opção 1. Em produção o BFF guarda a credencial no cookie:

```text
__Host-eventmatch_session=<opaque>
Path=/; HttpOnly; Secure; SameSite=Lax
```

Não há `Domain`. Sem “Manter conectado”, não há `Max-Age`/`Expires`; o servidor ainda impõe 12 horas absolutas e 30 minutos de inatividade. Com “Manter conectado”, `Max-Age` nunca ultrapassa o restante dos 30 dias absolutos. Em desenvolvimento/teste HTTP, usar `eventmatch_session` sem `Secure`; produção recusa URL pública sem HTTPS e sempre usa o prefixo `__Host-`.

Route Handlers sob `front/src/app/api/auth/**`:

- validam `Origin` exato, `Sec-Fetch-Site`, método e `Content-Type` nas mutações;
- validam DTOs e envelopes com Zod, sem repetir regra de negócio;
- leem/escrevem/expiram o cookie e nunca o retornam no JSON;
- encaminham o segredo em `Authorization: Bearer` e `BFF_INTERNAL_TOKEN` ao NestJS;
- usam `cache: 'no-store'`, timeout, redaction e nenhuma repetição automática de login/logout;
- não acessam PostgreSQL nem mantêm estado de requisição em módulo.

O NestJS pode devolver uma credencial rotacionada apenas em header interno autenticado. O BFF a converte em `Set-Cookie` e remove o header antes de responder ao navegador. Renderização RSC pode validar a sessão sem forçar rotação; um endpoint BFF de manutenção, chamado quando a página autenticada ganha foco e a rotação está devida, atualiza o cookie sem expor o valor. Falha nessa manutenção não estende nem derruba uma sessão ainda válida.

`/inicio` é renderizada no servidor, valida a sessão antes do conteúdo e responde com cache privado desabilitado. Visitante, sessão expirada ou revogada é redirecionado a `/entrar`; o BFF expira o cookie quando recebe `401`. Logout sempre expira o cookie local, mesmo se a revogação upstream já não encontrar a sessão.

`AUTH_HTTP_ENABLED` no backend e `AUTH_UI_ENABLED` server-only no frontend controlam rollout. Nenhuma variável usa prefixo `NEXT_PUBLIC_`.

## Consequências positivas

- O browser nunca lê a credencial.
- Reaproveita a topologia e os controles da ADR-022/023.
- CSRF, CORS, cookie, rotação e redaction ficam em uma fronteira pequena e testável.
- RSC protege conteúdo antes de serializá-lo para o cliente.

## Consequências negativas e riscos

- Um salto HTTP adicional e dependência da disponibilidade do BFF.
- Cookie de sessão não garante remoção ao fechar apenas uma aba; logout e timeouts do servidor são as garantias reais.
- Rotação em múltiplas abas exige a graça curta prevista na ADR-033.
- Headers de cache da resposta RSC precisam de verificação E2E, não apenas teste unitário.

## Plano de adoção e rollback

Publicar BFF e UI desligados, validar cookies em HTTPS e ambiente local, depois habilitar em canário. Rollback desliga `AUTH_UI_ENABLED` e `AUTH_HTTP_ENABLED`, expira o cookie nos handlers ainda publicados e mantém o NestJS inacessível ao browser. Nunca alternar silenciosamente para token em JavaScript ou chamada direta ao backend.

## Evidências e referências

- `AGENTS.md` §§3, 5 e 10
- ADR-022 e ADR-023
- `front/src/shared/server/continuation-cookie.ts` e `same-origin.ts`
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
