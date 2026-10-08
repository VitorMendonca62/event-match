# ADR-053: Substituir região textual por localização estruturada

- **Status:** accepted
- **Data:** 2026-10-08
- **Decisores:** produto, backend e arquitetura
- **Relacionado:** TASK 20; `specs/sdd-023-regiao-estruturada/tasks.md`; ADR-038 e ADR-045

## Contexto

`profile.region` é texto livre e integra o cadastro, a visão própria, a prévia, completude e atualizações com revisão otimista. O sistema ainda está em construção, sem dados de produção que exijam compatibilidade histórica; manter texto e códigos perpetuaria um contrato ambíguo.

## Decisão proposta

- Remover `profile.region` e substituí-lo por `uf_code` e `municipality_code`, com chave estrangeira composta para o município da mesma UF. As duas colunas podem ser nulas somente em perfis apagados/expirados; todo perfil ativo ou incompleto exige ambas.
- Uma localização estruturada exige ambos os códigos e um município ativo pertencente à UF. O banco protege presença conjunta e integridade referencial; a aplicação protege o status ativo dentro da unidade de trabalho e revisão otimista.
- Cadastro e perfil exigem `ufCode` e `municipalityCode`; texto livre deixa de ser aceito ou devolvido por qualquer contrato.
- As respostas própria e de prévia expõem somente `location`, com código, nome de município e UF. Nenhum contrato expõe endereço, bairro, CEP ou coordenada.
- A completude exige localização estruturada. Não existe fallback para texto legado.

## Consequências

- O contrato do cadastro e perfil é breaking; BFF e backend devem ser publicados de forma coordenada, com changelog e versionamento definidos antes da implementação.
- A migration é destrutiva para dados de desenvolvimento/teste: remove a coluna textual sem inferir códigos. Antes da primeira produção, o deploy exige confirmação explícita de ausência de dados a preservar; depois disso, uma remoção exigiria nova decisão/ADR.
- Rollback antes de produção é restaurar o schema e seed de desenvolvimento a partir do ambiente descartável. Não há rollback de dados textuais após a remoção.

## Alternativas rejeitadas

1. Converter texto automaticamente: ambíguo, especialmente para nomes repetidos e regiões informais.
2. Manter texto e códigos em paralelo: perpetua a divergência de identidade e a lógica de compatibilidade sem benefício antes do lançamento.
3. Permitir texto livre para novos cadastros: perpetua a ausência de identidade estável.

## Aceite

Aceita em 2026-10-08: remoção de `profile.region`, exigência estruturada em todos os fluxos e política de município inativo.
