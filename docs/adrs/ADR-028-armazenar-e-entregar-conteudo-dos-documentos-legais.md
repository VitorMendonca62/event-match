# ADR-028: Armazenar o conteúdo dos documentos legais em `terms_document` e entregá-lo na listagem

- **Status:** accepted
- **Data:** 2026-09-28
- **Decisores:** produto, jurídico, backend e frontend
- **Relacionado:** `specs/sdd-011-publicar-conteudo-documentos-legais/tasks.md`, ADR-012, ADR-013, ADR-020
- **Substitui/Substituído por:** N/A

## Contexto

RF005 exige registrar as versões aceitas de Termos de Uso, Política de Privacidade e Regras de Convivência. ADR-012 condiciona o aceite efetivo a conteúdo aprovado, versão imutável, idioma, vigência e artefato preservado. O seed `back/drizzle/0004_seed_legal_documents.sql` publicou as três versões `pt-BR` 1.0.0 como `approved`, mas `terms_document` guarda apenas metadados e `content_digest` (SHA-256 dos arquivos em `docs/legal/pt-BR/`). `GET /api/v1/registration/legal-documents` devolve só metadados, então o frontend não consegue mostrar o texto e o passo de documentos fica bloqueado.

Além disso, `listApproved` devolve todas as versões `approved` de um idioma em ordem crescente de vigência, e `findApproved` aceita qualquer versão `approved`, inclusive uma com `effective_at` futura ou já sucedida por outra versão.

## Drivers da decisão

- O texto exibido precisa ser, byte a byte, o artefato cujo digest foi publicado.
- Uma versão publicada é imutável (`docs/legal/README.md`).
- A pessoa só pode aceitar a versão vigente de cada tipo.
- São três documentos, cerca de 20 KB no total, lidos apenas no passo de documentos do cadastro.
- O RSC já busca documentos e interesses em paralelo (`server-parallel-fetching`), e uma nova tentativa usa `router.refresh()`.

## Opções consideradas

1. Coluna `content text` em `terms_document`, com o conteúdo incluído na listagem existente.
2. A mesma coluna, com a listagem restrita a metadados e um novo `GET legal-documents/:id` com `ETag` e cache imutável.
3. Tabela `terms_document_content` 1:1.
4. Ler os arquivos de `docs/legal/` em tempo de execução.

## Decisão

Adotar a opção 1.

- **Condições da ADR-012 atendidas:** em 2026-09-28, a pessoa responsável pelo produto informou que o jurídico autorizou os três documentos `pt-BR` 1.0.0 e o registro de aceites. Com conteúdo aprovado, versão imutável, idioma, vigência e artefato preservado (esta ADR), o aceite passa a ser efetivo e habilita a ativação real. A ADR-012 não é alterada nem superada: esta ADR registra que as condições dela foram cumpridas.
- A migration aditiva `0005_legal_document_content` adiciona `terms_document.content text` (anulável) e preenche as três linhas existentes com o conteúdo integral dos arquivos, incluindo o frontmatter, em strings com dollar-quoting.
- O `CHECK terms_document_content_digest_check` exige `content IS NULL OR sha256(convert_to(content, 'UTF8')) = content_digest`. Se o texto divergir do digest publicado, a migration falha.
- O `CHECK terms_document_approved_content_check` exige `status <> 'approved' OR content IS NOT NULL`.
- O trigger `terms_document_immutable` rejeita `UPDATE` de `kind`, `version`, `locale`, `effective_at`, `content_digest` e `content` em linha `approved` ou `retired`. Para essas linhas, só é permitida a transição de `status` de `approved` para `retired`. `DELETE` continua bloqueado por `terms_acceptance ON DELETE RESTRICT` para linhas aceitas.
- **Versão vigente:** para cada `(kind, locale)`, é a linha `approved` com o maior `effective_at <= now()`. A listagem devolve apenas a versão vigente de cada tipo, e a conclusão do cadastro só aceita ids vigentes. O instante vem do `ClockPort` da aplicação, não do relógio do banco.
- A resposta pública inclui `content` como corpo Markdown, **sem o frontmatter**. A separação é feita por um value object de domínio (`LegalDocumentText`), não no controller nem no adapter. O digest e o conteúdo integral ficam internos.
- **Sem cache entre requisições nesta entrega.** A resposta continua `Cache-Control: no-store` no backend e no BFF. Com a página `/cadastro` dinâmica, o texto já chega ao cliente no payload RSC. O ganho de cache para 20 KB não compensa o risco de oferecer uma versão já sucedida. Qualquer cache futuro exige nova ADR com chave `(locale, ids vigentes)`, TTL e invalidação na publicação.
- **Publicar uma nova versão** exige novo arquivo em `docs/legal/<locale>/`, novo UUID, nova linha no `README`, nova migration de seed com conteúdo e digest e, quando for o caso, `retired` na versão anterior. Nunca se edita linha existente.

## Consequências positivas

- Uma única consulta e o mesmo endpoint, sem mudança de rota nem de fluxo no BFF.
- A integridade entre texto e digest é garantida pelo banco, não só por teste.
- O aceite fica sempre vinculado a um artefato preservado e imutável (ADR-012).
- Corrige a ambiguidade de várias versões `approved` do mesmo tipo.

## Consequências negativas e riscos

- A resposta de listagem passa de centenas de bytes para cerca de 20 KB. É aceitável com três documentos, mas deve ser revisto se houver muitos idiomas ou documentos longos.
- O dollar-quoting exige um delimitador que não apareça no texto. A implementação deve usar um delimitador próprio (`$eventmatch_legal$`) e validar por teste.
- O trigger adiciona lógica ao banco que precisa ser documentada em `docs/03-*`.
- Um documento com `effective_at` futuro fica invisível até a data. Se isso acontecer, o cadastro fica bloqueado até lá, como hoje.

## Plano de adoção e rollback

Aplicar `0005` depois de `0004`. A mudança é aditiva: coluna anulável, `CHECK`s satisfeitos pelo backfill e trigger. Os consumidores antigos ignoram o campo novo `content`. Rollback segue o padrão fix-forward do repositório: uma migration posterior pode remover o trigger e os `CHECK`s e anular a coluna sem apagar documentos nem aceites. O backend anterior continua funcional com a coluna presente.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` v1.3, RF005
- `docs/legal/README.md`, `back/drizzle/0004_seed_legal_documents.sql`
- `back/src/modules/registration/infrastructure/persistence/repositories/drizzle-terms.repository.ts`
- ADR-012, ADR-013
- `AGENTS.md` §5 (regra de cache)
