# ADR-054: Modelar Evento como agregado com rascunho e publicação transacional

- **Status:** accepted
- **Data:** 2026-10-08
- **Decisores:** produto, backend, arquitetura e privacidade
- **Relacionado:** TASK 23.1; `specs/sdd-025-backend-eventos/tasks.md`; RF017–RF021, RF085; RN017–RN020, RN028–RN031
- **Substitui/Substituído por:** N/A

## Contexto

O EventMatch ainda não possui o bounded context de Eventos. A TASK 23.1 precisa permitir rascunhos incompletos e publicação validada, sem antecipar participação, vagas, cancelamento, conversa ou descoberta.

## Drivers da decisão

- Preservar RF018 sem aceitar publicação parcial.
- Manter estados e invariantes no domínio, não em controllers ou DTOs.
- Preparar transições futuras sem implementar antecipadamente as TASKs 25–27.

## Opções consideradas

1. Agregado `Event` com estados canônicos, revisão otimista e transação por mutação.
2. Salvar cada etapa do formulário em tabelas independentes. Rejeitada: fragmenta invariantes e torna publicação não atômica.
3. Publicar diretamente sem estado de rascunho. Rejeitada: viola RF018.

## Decisão

- Criar `EventsModule` hexagonal, dono do agregado `Event`, com `draft` e `published_open` operacionais nesta tarefa; os estados canônicos futuros permanecem representáveis, mas suas transições pertencem às TASKs 25–27.
- Persistir um snapshot versionado de rascunho em `event`, com `revision`, anfitriã, atividade, município/UF, data/hora local, fuso IANA do município, categoria do local, capacidade, modalidade e campos públicos; uma tabela append-only de auditoria registra ação, ator, instante, correlação e máscara de campos, nunca valores privados.
- A publicação exige início com pelo menos 24 horas de antecedência e no máximo 30 dias no futuro; término é opcional, mas, quando informado, não excede oito horas de duração. A resolução do fuso segue a ADR-060. Rascunho inativo expira após 30 dias; o ponto exato é apagado sete dias após encerramento/cancelamento, salvo denúncia, disputa ou obrigação legal, sujeito à validação jurídica brasileira antes do lançamento.
- `saveDraft` aceita ausência dos campos exigidos para publicar. `publish` revalida o agregado dentro da mesma UoW e só muda para `published_open` depois de todas as invariantes.
- Escritas usam compare-and-set de `revision` e transação PostgreSQL. Limites de anfitriã são consultados na mesma UoW pela política definida na ADR-057.

## Consequências

- O domínio e a aplicação não importam NestJS, Drizzle ou HTTP; adapters Drizzle são o único acesso ao PostgreSQL.
- A transição futura para `full`, `cancelled`, `completed` e `not_held` exige casos de uso próprios, sem permitir atualização arbitrária de estado.
- O desenho físico usa os limites já definidos de data/hora, local e retenção; os campos opcionais adiados pertencem às TASKs 19, 29 e 30.

## Plano de adoção e rollback

Migration aditiva cria tabelas, checks, FKs e índices. Rollout publica primeiro o backend com a flag de Eventos desligada, executa smoke de rascunho/publicação e só então libera o BFF da TASK 23.2. Rollback operacional desliga a flag e retorna a aplicação; schema e registros são preservados para correção forward-only.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF017–RF021, RF085; RN017–RN031
- `docs/02-regras-de-negocio.md` §3
- `docs/03-modelos-de-dominio.md` §2.3
- `back/src/shared/infrastructure/persistence/drizzle-unit-of-work.ts`
