# Architecture Decision Records

ADRs registram decisões arquiteturais materiais. Use um arquivo por decisão, numerado sequencialmente: `ADR-NNN-<slug>.md`.

## Ciclo

`proposed` durante o planejamento -> `accepted` antes da implementação -> opcionalmente `superseded` ou `rejected`. Uma decisão aceita é imutável; correções e substituições usam novo ADR com links bidirecionais.

## Template

```markdown
# ADR-NNN: <título>

- **Status:** proposed | accepted | rejected | superseded
- **Data:** YYYY-MM-DD
- **Decisores:** <nomes/papéis>
- **Relacionado:** `specs/sdd-NNN-<slug>/tasks.md`
- **Substitui/Substituído por:** <ADR ou N/A>

## Contexto
## Drivers da decisão
## Opções consideradas
## Decisão
## Consequências positivas
## Consequências negativas e riscos
## Plano de adoção e rollback
## Evidências e referências
```
