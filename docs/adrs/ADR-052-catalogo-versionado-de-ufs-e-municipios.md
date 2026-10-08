# ADR-052: Catálogo versionado de UFs e municípios no PostgreSQL

- **Status:** accepted
- **Data:** 2026-10-08
- **Decisores:** produto, backend e arquitetura
- **Relacionado:** TASK 20; `specs/sdd-023-regiao-estruturada/tasks.md`; RF004, RF022–RF023, RN011–RN014 e RNF001

## Contexto

A região do perfil é texto livre, o que impede identidade estável de município e produz erros de digitação. A TASK 20 exige a tabela oficial do IBGE no EventMatch, sem consulta ao IBGE durante uma requisição da pessoa usuária, e prevê mudanças administrativas sem apagar referências históricas.

## Decisão proposta

- Manter `federative_unit` e `municipality` no contexto `catalog`, em PostgreSQL, com sigla de UF, código IBGE estável de município, nome, status `active | inactive`, versão da fonte e datas de carga.
- Importar um snapshot oficial versionado do IBGE por migration/seed idempotente e auditável. A rotina operacional revisa e publica atualização **semestralmente**, ou extraordinariamente quando uma mudança oficial afetar pessoas cadastradas.
- A atualização nunca consulta o IBGE no caminho HTTP. O artefato de importação registra fonte, data de referência e checksum; a migration cria, renomeia ou desativa itens sem reutilizar códigos.
- `GET /api/v1/catalog/federative-units` devolve as 27 UFs ativas. `GET /api/v1/catalog/municipalities?uf=XX&q=texto` devolve somente municípios ativos da UF, em ordem de nome, com busca normalizada no servidor e limite fixo. O valor inicial proposto é consulta com ao menos dois caracteres e no máximo 20 resultados.
- O Distrito Federal aparece como UF `DF` e Brasília como município selecionável da UF, usando o código oficial correspondente.
- Município inativo permanece referenciável para leituras históricas, mas não é devolvido pelos catálogos de seleção nem aceito em nova gravação.

## Consequências

- Não há dependência de rede, cache externo ou SDK IBGE em runtime.
- A busca não carrega todos os municípios no bundle e não recebe endereço, CEP ou coordenada.
- O módulo `catalog` ganha entidades/portas/adapters próprios; controllers continuam apenas adaptadores HTTP com DTOs, Swagger, `ValidationPipe` e DI por construtor.
- A atualização semestral é uma operação de release com migration forward-only. Rollback operacional restaura a aplicação anterior e preserva o snapshot catalogado; correções são novas migrations.

## Alternativas rejeitadas

1. Consultar a API IBGE a cada seleção: introduz indisponibilidade e dependência externa no fluxo crítico.
2. Embutir todos os municípios no frontend: aumenta bundle, duplica a fonte de verdade e dificulta atualização.
3. Guardar somente nome de município: não trata homônimos, renomeações nem fusões de modo confiável.
4. Atualização automática sem revisão: prejudica auditoria, previsibilidade e rollback.

## Aceite

Aceita em 2026-10-08: catálogo local, busca mínima de dois caracteres/limite 20, revisão semestral versionada, Brasília sob DF e retenção histórica de municípios inativos.
