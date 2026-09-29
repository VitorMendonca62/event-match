# Documentos legais do EventMatch

| Documento | Identificador | Versão | Idioma | Vigência | Arquivo |
|---|---|---:|---|---|---|
| Termos de Uso | `eventmatch-terms-pt-br-1.0.0` | 1.0.0 | `pt-BR` | 2026-09-28 | [`pt-BR/termos-de-uso-v1.0.0.md`](pt-BR/termos-de-uso-v1.0.0.md) |
| Política de Privacidade | `eventmatch-privacy-pt-br-1.0.0` | 1.0.0 | `pt-BR` | 2026-09-28 | [`pt-BR/politica-de-privacidade-v1.0.0.md`](pt-BR/politica-de-privacidade-v1.0.0.md) |
| Regras de Convivência | `eventmatch-community-rules-pt-br-1.0.0` | 1.0.0 | `pt-BR` | 2026-09-28 | [`pt-BR/regras-de-convivencia-v1.0.0.md`](pt-BR/regras-de-convivencia-v1.0.0.md) |

Uma versão publicada é imutável. Alterações de conteúdo exigem novo arquivo, novo identificador e nova versão.

O seed [`back/drizzle/0004_seed_legal_documents.sql`](../../back/drizzle/0004_seed_legal_documents.sql) publica essas três versões no PostgreSQL, com os UUIDs `019c0000-0000-7000-8000-000000000001` a `019c0000-0000-7000-8000-000000000003` e SHA-256 do conteúdo de cada arquivo.

## Autorização jurídica

Em 2026-09-28, a pessoa responsável informou que o jurídico autorizou os três documentos v1.0.0 e o registro dos aceites (ADR-012, ADR-028). Retenção de dados, cópia de dados e documentos excepcionais continuam pendentes de validação jurídica própria.

## Conteúdo no PostgreSQL

A migration [`back/drizzle/0005_legal_document_content.sql`](../../back/drizzle/0005_legal_document_content.sql) grava em `terms_document.content` o texto integral de cada arquivo, byte a byte, incluindo o frontmatter e o `\n` final. Um `CHECK` exige `sha256(content) = content_digest`, outro exige texto em toda linha `approved`, e um trigger impede alterar linhas `approved` ou `retired` (só `approved → retired`). A API entrega o corpo sem frontmatter.

## Publicar uma nova versão

1. Registrar a autorização jurídica da nova versão neste arquivo e na ADR aplicável.
2. Criar um novo arquivo `pt-BR/<slug>-v<versão>.md`, com novo `document_id`, `version` e `effective_at`; nunca editar um arquivo publicado.
3. Criar uma migration nova (`back/drizzle/NNNN_*.sql`) que insere a linha `approved` com UUID novo, `content` (dollar-quoting `$eventmatch_legal$`, que não pode aparecer no texto) e `content_digest = sha256` do arquivo. Gere o SQL a partir do arquivo com um script descartável, para não haver divergência de bytes.
4. A versão anterior deixa de ser oferecida assim que a nova entra em vigor (`effective_at <= now`); marque-a `retired` na mesma migration. Aceites já gravados apontam para a linha antiga e não mudam.
5. Reaceite de contas já ativas está fora do escopo desta entrega.
