# ADR-013: Definir schema físico, ownership e catálogo inicial do cadastro

- **Status:** accepted
- **Data:** 2026-09-25
- **Decisores:** backend, arquitetura, produto e privacidade
- **Relacionado:** `specs/sdd-007-persistencia-postgresql-cadastro/tasks.md`; ADR-002, ADR-007, ADR-008, ADR-012
- **Substitui/Substituído por:** complementada pela ADR-018 (estado `converted` de `registration`)

## Contexto

A ADR-008 decidiu o agregado provisório `Registration` e o fluxo `verification_pending` → `registration_in_progress` → `account_incomplete` → `active`, mas deixou tabelas e migration para o primeiro vertical slice. A ADR-007 exige Drizzle Kit com SQL revisado, sem `push`, e proíbe tipos Drizzle fora de `infrastructure/persistence`. A ADR-002 distribui responsabilidades entre Identidade e Acesso (cadastro, contatos, credencial, aceites), Perfis e Preferências (perfil e interesses) e Operações (catálogos). A Task 04 pede persistir todo o fluxo no bounded context `registration`.

Hoje `drizzle.config.ts` aponta para um único `src/shared/infrastructure/persistence/schema.ts` vazio e `DrizzleDatabase` é tipado sem schema.

## Drivers da decisão

- Ownership explícito de cada tabela por um único módulo, conforme ADR-002.
- Conclusão/ativação atômica envolvendo conta, perfil, interesses e aceites (ADR-008).
- Migration única, pequena, revisável e com forward-fix.
- Catálogo inicial de interesses idempotente e com significado histórico preservado (RN147–RN149).
- Não antecipar tabelas de outros agregados (sessões, eventos, catálogos não usados no cadastro).

## Opções consideradas

1. **Módulo `registration` como dono de todas as tabelas do fluxo.** Simples e transacional, mas mistura Perfis e Operações no contexto de Identidade e cria dívida de extração.
2. **Módulo `registration` (Identidade e Acesso) dono do fluxo e da conta; tabelas `profile`, `interest` e `account_interest` pertencentes a módulos `profiles` e `catalog` mínimos, acessados por portas outbound e participando da mesma unidade de trabalho.** Respeita ADR-002 com mais scaffolding.
3. **Schema PostgreSQL por contexto (`identity`, `profiles`, `catalog`).** Isolamento forte, mas aumenta custo de migrations e permissões sem benefício imediato.

## Decisão proposta

Adotar a opção 2 no schema PostgreSQL `public`, com ownership documentado por módulo (não no nome da tabela). Confirmado pelo produto em 2026-09-25: `profiles` e `catalog` são módulos próprios.

| Tabela | Dono | Finalidade |
|---|---|---|
| `contact_verification` | `registration` | desafio por contato/canal/fluxo; OTP e link com hash, contadores, bloqueio, idempotência de entrega, consentimento WhatsApp |
| `verification_rate_window` | `registration` | contadores por janela horária para contato e origem (ADR-015) |
| `registration` | `registration` | registro provisório: contato verificado, hash da senha, dados obrigatórios parciais, `last_updated_at`, `expires_at` |
| `account` | `registration` | conta `account_incomplete`/`active`/`expired`, nascimento privado, datas |
| `account_contact` | `registration` | contato confirmado da conta; PK `(account_id, channel)` e `UNIQUE (channel, contact_hash) WHERE holds_contact` (ADR-014/ADR-017) |
| `account_credential` | `registration` | hash da senha e algoritmo/parâmetros |
| `terms_document` | `registration` | documento versionado (`kind`, `version`, `locale`, `effective_at`, `content_digest`, `status` `placeholder`/`approved`/`retired`) |
| `terms_acceptance` | `registration` | aceite imutável por conta/documento |
| `profile` | `profiles` | nome de exibição e região; 1:1 com `account` |
| `profile_usage_intent` | `profiles` | intenções de uso (múltipla escolha, mínimo 1, valores fixos por `CHECK`); PK `(account_id, usage_intent)` |
| `account_interest` | `profiles` | PK composta `(account_id, interest_id)` |
| `interest` | `catalog` | catálogo com `slug` estável, `label`, `position`, `active`, datas |

Regras físicas:

- Identificadores `uuid` gerados pela aplicação (UUIDv7 por adapter de `IdGenerator`), sem sequências expostas.
- `timestamptz` em UTC; estados como `text` com `CHECK`, evitando enums PostgreSQL que exigem migrations frágeis.
- FKs com `ON DELETE CASCADE` apenas de dependentes da própria conta (`account_contact`, `account_credential`, `profile`, `profile_usage_intent`, `account_interest`); `terms_acceptance` usa `ON DELETE RESTRICT` até política jurídica de retenção (ADR-012).
- Aceites só são criados para `terms_document.status = 'approved'`, verificado pelo caso de uso sob lock na transação de ativação; `terms_acceptance` tem `UNIQUE (account_id, document_id)` e não recebe `UPDATE`. `terms_document` tem `UNIQUE (kind, version, locale)` e `CHECK` de estado.
- Nenhuma tabela de sessão, login, recuperação completa, evento ou outros catálogos.

Organização Drizzle:

- Schemas em `back/src/modules/<modulo>/infrastructure/persistence/schema/*.ts`; `drizzle.config.ts` passa a usar o glob `./src/modules/*/infrastructure/persistence/schema/*.ts`. Não há agregador: o `schema.ts` compartilhado vazio é removido, `shared` não importa de `modules/*` e `DrizzleDatabase` permanece sem tipo de schema. Adapters usam o query builder do core (`db.select().from(tabela)`), sem `db.query` relacional, que exigiria o schema agregado.
- **FK entre módulos:** um schema pode importar a tabela de outro módulo **apenas para declarar `.references()`**, e somente dentro de `infrastructure/persistence/schema`. É dependência de compilação restrita à persistência: nenhum tipo Drizzle, nem esse import, chega a domínio, aplicação ou portas. Aplica-se a `profile → account` e `account_interest → account`/`interest`. Consultas e escritas entre módulos continuam exclusivamente por portas outbound; nenhum adapter consulta tabela de outro módulo. Uma regra de lint de imports (`no-restricted-imports`) restringe esse import à pasta `schema/`.
- Migration `0000_registration_foundation` gerada por `db:generate`, revisada manualmente e complementada por migration `--custom` com o seed de `interest` usando `INSERT ... ON CONFLICT (slug) DO NOTHING` para os 20 interesses do DER §3.10.
- O seed não atualiza `label` nem `position` de registros existentes (`DO NOTHING`), preservando o significado histórico; mudanças do DER no catálogo entram por nova migration forward.
- `terms_document` não recebe seed: não há conteúdo aprovado (ADR-012).

## Consequências positivas

- Ownership alinhado à ADR-002 e extração futura sem mover dados.
- Constraints expressam invariantes que não dependem apenas da aplicação.
- Seed idempotente e revisável no ledger de migrations.

## Consequências negativas e riscos

- Três módulos NestJS mínimos e portas adicionais para uma transação única.
- Tabelas compartilhando a mesma unidade de trabalho exigem disciplina para não importar schema de outro módulo.
- Sem documento aprovado, nenhuma conta chega a `active` fora de testes — comportamento desejado pela ADR-012.
- `ON DELETE RESTRICT` em `terms_acceptance` impede a remoção física de contas com aceites; a purga futura (ADR-017) depende da decisão jurídica de retenção dos aceites (ADR-012).
- Schemas de módulos diferentes se importam para FK; a disciplina é garantida por lint e revisão, não pelo compilador.

## Plano de adoção e rollback

Gerar migration contra PostgreSQL descartável, revisar SQL, validar com `db:check` e testes de integração. Rollback: reimplantar versão anterior da API; as tabelas novas são aditivas e não afetam `health`. Remoção das tabelas exige migration forward explícita, nunca `down` automático.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF001–RF007, RN001–RN016, RN147–RN149, §3.10
- `docs/03-modelos-de-dominio.md` §2.1, §4
- ADR-002, ADR-007, ADR-008, ADR-012
