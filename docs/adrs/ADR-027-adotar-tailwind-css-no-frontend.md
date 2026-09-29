# ADR-027: Avaliar a adoção de Tailwind CSS no frontend

- **Status:** accepted
- **Data:** 2026-09-26
- **Decisores:** produto, frontend e arquitetura
- **Relacionado:** `specs/sdd-010-frontend-nextjs-fluxo-cadastro/tasks.md`
- **Substitui/Substituído por:** N/A

## Contexto

O cadastro precisa reconstruir a direção visual aprovada “Convite Cívico”. A implementação atual usa CSS global; foi solicitado avaliar Tailwind CSS como sistema de estilos para as superfícies Next.js.

## Drivers da decisão

- Manter os tokens obrigatórios do EventMatch centralizados.
- Acelerar composição responsiva e estados de interface sem levar regras de negócio ao CSS.
- Preservar RSC por padrão e evitar custo de bundle desnecessário.
- Evitar coexistência permanente de dois sistemas de estilos.

## Opções consideradas

1. Manter CSS Modules/`globals.css` com tokens semânticos.
2. Adotar Tailwind CSS v4 com integração PostCSS e tokens CSS existentes.
3. Adotar Tailwind CSS v3 com arquivo de configuração JavaScript/TypeScript.

## Decisão

Adotar Tailwind CSS v4 com `@tailwindcss/postcss`. Os tokens obrigatórios do EventMatch continuam definidos em CSS como variáveis semânticas; componentes devem consumi-los por utilitários arbitrários ou primitives reutilizáveis, sem introduzir cores de paleta Tailwind como decisão visual. A migração do cadastro será integral, removendo estilos globais obsoletos ao fim da mudança.

O suporte mínimo do frontend passa a ser Safari 16.4+, Chrome 111+ e Firefox 128+, compatível com os requisitos da v4. Classes extensas e repetidas devem ser extraídas para primitives de apresentação, sem ocultar comportamento de domínio ou BFF.

## Consequências positivas

- Utilitários consistentes para layout responsivo, estados e acessibilidade.
- Tokens podem continuar como fonte semântica única.

## Consequências negativas e riscos

- Nova dependência e curva de manutenção.
- Migração incompleta pode duplicar estilos globais e utilitários.
- Classes extensas podem reduzir legibilidade se não houver convenções claras.

## Plano de adoção e rollback

Instalar somente `tailwindcss`, `@tailwindcss/postcss` e `postcss` via Bun, configurar PostCSS, migrar a superfície de cadastro por completo e remover estilos obsoletos. Rollback remove a integração e retorna aos tokens em CSS, sem efeito sobre API, banco ou contratos.

## Evidências e referências

- `AGENTS.md` §§4, 5 e 9
- `specs/sdd-010-frontend-nextjs-fluxo-cadastro/tasks.md`
- Regras Vercel `bundle-analyzable-paths`, `bundle-barrel-imports` e `server-serialization`
