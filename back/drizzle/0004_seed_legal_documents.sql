-- Approved legal documents v1.0.0. Each SHA-256 is computed from the complete, immutable
-- Markdown artifact in docs/legal/pt-BR/. Do not update these rows in place: publish a new
-- document version instead.
INSERT INTO "terms_document" ("id", "kind", "version", "locale", "effective_at", "content_digest", "status") VALUES
  (
    '019c0000-0000-7000-8000-000000000001',
    'terms',
    '1.0.0',
    'pt-BR',
    '2026-09-28T00:00:00.000Z',
    decode('451a84dc658d3cde409607e64a527ed2d20ab576224e58da3126b7f34c5c62d9', 'hex'),
    'approved'
  ),
  (
    '019c0000-0000-7000-8000-000000000002',
    'privacy',
    '1.0.0',
    'pt-BR',
    '2026-09-28T00:00:00.000Z',
    decode('ece3b82d0ee35f8ac25df42272c0c1107fb02c4dc30ce6b6e7d8ef27037f09d5', 'hex'),
    'approved'
  ),
  (
    '019c0000-0000-7000-8000-000000000003',
    'community_rules',
    '1.0.0',
    'pt-BR',
    '2026-09-28T00:00:00.000Z',
    decode('055385aa29006e1b18e019f88f22547ca383f09791f6ac2a2b549381455a8f5d', 'hex'),
    'approved'
  )
ON CONFLICT ("kind", "version", "locale") DO NOTHING;
