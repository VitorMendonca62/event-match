# EventMatch — Next.js + NestJS + PostgreSQL

O EventMatch conecta adultos por interesses e atividades locais para amizade e descoberta da cidade. O projeto é um monorepo Bun com frontend Next.js em `front/` e backend NestJS hexagonal em `back/`; PostgreSQL é acessado exclusivamente pelo backend.

## Docker com Make

O `Makefile` reúne os ambientes Docker já existentes. Use `make help` para listar todos os alvos.

```bash
make back-dev-up      # backend e PostgreSQL com hot reload
make back-dev-down    # para e preserva o banco de desenvolvimento
make back-prod-up     # imagem de produção do backend
make back-prod-down
make back-test-up     # PostgreSQL, Brevo falso e backend de teste
make back-test-down   # para e remove volumes descartáveis
make front-dev-up     # Next.js com hot reload
make front-dev-down
make front-prod-up    # imagem de produção do frontend
make front-prod-down
```

Antes de usar `back-test-up`, crie `back/.env.test.local` conforme a documentação do backend. Os ambientes de desenvolvimento e produção usam as variáveis já exportadas no shell ou nos arquivos de ambiente locais; nenhum segredo é declarado pelo Makefile.

## Documentação e Spec-Driven Development (SDD)

| Documento | Consulte quando... |
|---|---|
| `docs/DER-EventMatch-MVP.md` | precisar consultar RFs, RNs, RNFs e o escopo funcional canônico. |
| `docs/01-visao-geral-arquitetura.md` | entender limites front/back e arquitetura hexagonal. |
| `docs/02-regras-de-negocio.md` | alterar comportamentos e invariantes. |
| `docs/03-modelos-de-dominio.md` | alterar domínio, portas ou PostgreSQL. |
| `docs/04-integracoes-externas.md` | alterar API NestJS, BFF ou integrações. |
| `docs/adrs/` | consultar ou registrar decisões arquiteturais. |

### Como trabalhar com SDD

1. Registre a demanda em `specs/tasks.txt`.
2. Gere um plano com [`code-planner`](.agents/skills/code-planner/SKILL.md).
3. Crie um ADR `proposed` por decisão material e aceite-o antes da implementação.
4. Implemente com [`code-implementer`](.agents/skills/code-implementer/SKILL.md).
5. Use `vercel-react-best-practices` no frontend e `nestjs-expert` no backend.
6. Revise com [`code-reviewer`](.agents/skills/code-reviewer/SKILL.md).
7. Abra PR com `open-pull-request` apenas quando solicitado.

Use Bun para instalação, execução, lint, testes e builds. A fonte de verdade é o código e seus testes; consulte [`AGENTS.md`](AGENTS.md) para as regras completas.
