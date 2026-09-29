# ADR-029: Renderizar o Markdown dos documentos legais com `react-markdown` no servidor

- **Status:** accepted
- **Data:** 2026-09-28
- **Decisores:** frontend, segurança e produto
- **Relacionado:** `specs/sdd-011-publicar-conteudo-documentos-legais/tasks.md`, ADR-012, ADR-027, ADR-028
- **Substitui/Substituído por:** N/A

## Contexto

Com ADR-028, o backend passa a entregar o corpo Markdown dos três documentos legais. Os arquivos atuais usam títulos `#`/`##`, parágrafos, `**negrito**` e listas `-`. O passo de documentos (`legal-step.tsx`) é um Client Component dentro da ilha `RegistrationFlow`. Hoje ele mostra texto puro com `whitespace-pre-line`, então marcações apareceriam literalmente. Os documentos são carregados no RSC (`loadRegistrationView`), e a nova tentativa usa `router.refresh()`, sem busca no cliente.

## Drivers da decisão

- Não interpretar HTML bruto nem usar `dangerouslySetInnerHTML` com o conteúdo.
- Hierarquia de títulos acessível dentro do passo: o `h1` é o do passo, e cada documento abre um `h2`.
- Não aumentar o bundle do cliente (`bundle-conditional`, `bundle-dynamic-imports`, `server-serialization`).
- Suportar Markdown CommonMark em versões futuras, sem manter um parser próprio.

## Opções consideradas

1. `react-markdown` renderizado em Server Component e entregue à ilha cliente como `ReactNode`.
2. `react-markdown` dentro do Client Component.
3. Parser próprio do subconjunto usado.
4. Texto puro sem frontmatter.

## Decisão

Adotar a opção 1.

- Adicionar `react-markdown` (versão estável mais recente, fixada exatamente como as demais dependências de `front/package.json`) via `bun add`. Não adicionar `rehype-raw` nem plugins de HTML.
- Criar `LegalMarkdown`, um Server Component sem `'use client'`, que importa `react-markdown` e é usado somente em `app/cadastro/page.tsx` ou em um componente de servidor chamado por ela. O resultado é passado a `RegistrationFlow` como `body: ReactNode` de cada documento. O texto bruto não é serializado para o cliente (`server-serialization`, `server-dedup-props`), e `react-markdown` nunca entra no bundle do cliente.
- Configuração: `skipHtml`, `allowedElements` limitado a `h1`–`h4`, `p`, `strong`, `em`, `ul`, `ol`, `li`, `blockquote`, `hr`, `br` e `a`, com `unwrapDisallowed`. Imagens são removidas.
- **Links:** só `https:` e `mailto:` são aceitos. Um `urlTransform` devolve vazio para qualquer outro esquema (`http:`, `javascript:`, `data:`, relativo), e um link sem URL válida vira texto simples. Links `https:` abrem em nova aba com `target="_blank"`, `rel="noopener noreferrer"` e o aviso acessível “(abre em nova aba)”. Assim, o cadastro e os aceites em memória não se perdem. Links `mailto:` não usam `target`.
- **Títulos:** o primeiro título de nível 1 do corpo é omitido, porque o passo já exibe o título do documento como `h2`. Isso é feito em `LegalMarkdown`, removendo a primeira linha `# …` da fonte antes do parse. Os demais níveis são deslocados: `##` → `h3`, `###` → `h4`, `####`+ → `h5`, e um `#` adicional, se existir, vira `h3`. O mapa `components` aplica as classes do tema com os tokens obrigatórios.
- Um documento sem `content` continua bloqueando a ativação.

## Consequências positivas

- Markdown seguro, sem HTML e sem custo no bundle do cliente.
- Contatos do encarregado de dados e links institucionais podem ser incluídos em versões futuras sem nova ADR.
- A hierarquia de títulos fica correta para leitores de tela.
- Documentos futuros com outros recursos CommonMark são suportados sem código novo.

## Consequências negativas e riscos

- Nova dependência ESM, com árvore `unified`/`remark`, no servidor. É preciso confirmar a compatibilidade com Next.js 16, React 19 e Bun no build.
- `ReactNode` como prop exige que a composição RSC → ilha seja mantida. Um refactor que mova o parse para o cliente aumentaria o bundle. O plano de testes inclui a verificação do bundle.
- Se os documentos passarem a ser buscados no cliente, esta ADR precisa ser revista.

## Plano de adoção e rollback

Instalar com Bun, criar `LegalMarkdown` e trocar o `whitespace-pre-line` do passo pelo `body` recebido. Rollback remove a dependência e volta a exibir o corpo como texto puro. Não há efeito no backend, no banco ou no contrato.

## Evidências e referências

- ADR-012, ADR-027, ADR-028
- `front/src/features/registration/components/steps/legal-step.tsx`
- `front/src/shared/server/registration-view.ts`
- Regras Vercel `bundle-conditional`, `server-serialization`, `server-dedup-props` e `server-parallel-fetching`
