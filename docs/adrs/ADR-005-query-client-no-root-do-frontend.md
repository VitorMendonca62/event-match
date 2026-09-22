# ADR-005: Disponibilizar TanStack Query por provider no root do frontend

- **Status:** accepted
- **Data:** 2026-09-21
- **Decisores:** mantenedores de frontend e arquitetura
- **Relacionado:** `specs/sdd-003-fundacao-tecnica-frontend/tasks.md`
- **Substitui/Substituído por:** N/A

## Contexto

O frontend será iniciado sem chamadas à API, mas as próximas features precisarão de cache, deduplicação e estados de requisição no cliente. A Task 01 solicita incluir React Query e disponibilizar seu provider no root, preservando React Server Components como padrão.

## Drivers da decisão

- Oferecer um único `QueryClient` por árvore de cliente, sem estado compartilhado entre requisições do servidor.
- Evitar instalar/descrever cache case a case nas primeiras telas interativas.
- Não converter o `layout` ou páginas inteiras em Client Components.
- Não criar fetch, query, mutation, persistência local ou integração HTTP prematuros.

## Opções consideradas

1. Adiar TanStack Query até a primeira integração com a API.
2. Instalar TanStack Query e criar providers locais em cada feature.
3. Instalar TanStack Query e expor um provider client-only mínimo no root.

## Decisão

Adotar `@tanstack/react-query` e criar um componente client-only de providers, usado pelo `layout` Server Component para envolver seus filhos. O `QueryClient` é criado uma vez por montagem do provider, com inicialização estável e sem variável mutável em escopo de módulo. Não serão criados queries, mutations, `QueryClient` por requisição, persistência em storage, Devtools ou hidratação/dehydratação nesta fundação.

Defaults de retry, stale time, garbage collection, error boundary e hidratação ficam fora desta decisão até existir contrato de API e comportamento de produto que os justifique. Providers adicionais não serão agregados preventivamente.

## Consequências positivas

- Features interativas futuras têm boundary de cache única e previsível.
- Layout e páginas mantêm RSC por padrão, reduzindo JavaScript serializado.
- Evita `QueryClient` compartilhado entre renderizações no servidor.

## Consequências negativas e riscos

- Acrescenta JavaScript de cliente antes da primeira consulta.
- Defaults implícitos da biblioteca podem não ser adequados às futuras operações.
- Uso indevido para dados que devem permanecer no servidor pode causar duplicação de fetch e serialização.

## Plano de adoção e rollback

Instalar a dependência diretamente pelo manifesto do frontend, adicionar provider mínimo e validar a renderização do root sem query. Nas features posteriores, decidir cache/invalidação por contrato e documentar qualquer persistência ou cache cross-session.

Se o custo de bundle não for justificado antes de qualquer consumo, remover o provider e a dependência em uma mudança separada, após verificar que nenhuma feature usa hooks TanStack Query.

## Evidências e referências

- `specs/tasks.txt`, Task 01
- `AGENTS.md` §§3 e 5
- Regra Vercel `server-no-shared-module-state`
- Regra Vercel `server-serialization`
- Regra Vercel `bundle-barrel-imports`

