# ADR-057: Avaliar habilitação e limites de anfitriã no backend por portas explícitas

- **Status:** accepted
- **Data:** 2026-10-08
- **Decisores:** produto, backend, confiança e segurança
- **Relacionado:** TASK 23.1; `specs/sdd-025-backend-eventos/tasks.md`; RF016, RF021; RN005, RN018, RN047–RN049
- **Substitui/Substituído por:** N/A

## Contexto

Criar ou publicar evento depende de capacidade derivada: perfil com foto, apresentação, três interesses, ambos os contatos confirmados e regras aceitas. Para o MVP, não há classificação de anfitriã nova ou experiente e tampouco categoria gratuita ou paga de anfitriã.

## Drivers da decisão

- Autorizar sempre no servidor a partir de fatos atuais, sem confiança no browser.
- Impedir que concorrência ultrapasse limites de publicação.
- Não acoplar Eventos diretamente a tabelas ou entidades de outros contextos.

## Opções consideradas

1. Porta de capacidade e porta de consulta de limites, avaliadas no backend dentro da UoW.
2. Confiar no BFF ou em flag enviada pelo cliente. Rejeitada: permite escalonamento de privilégio.
3. Consultar tabelas de Perfil, Identidade e Segurança diretamente pelo adapter de Eventos. Rejeitada: quebra limites entre contextos.

## Decisão

- `EventsModule` consome `HostEligibilityPort` e `HostEventLimitPort`. Seus adapters compõem somente projeções mínimas dos contextos Perfil/Identidade e, futuramente, Participações/Avaliações/Segurança.
- O backend verifica a habilitação em toda criação, edição de rascunho e publicação; a decisão nunca é cacheada no cliente.
- A reserva do limite de eventos futuros e a publicação usam lock transacional por `accountId`, consulta indexada e contagem no mesmo commit para impedir que requisições concorrentes ultrapassem um evento futuro ativo ou dois eventos publicados em qualquer janela móvel de 30 dias.
- A capacidade máxima configurável é de 12 pessoas e é validada pelo domínio em toda mutação do rascunho e na publicação.
- Qualquer diferenciação futura entre categorias gratuita e paga de anfitriã requer nova ADR, autorização e definição de cobrança; não é inferida de histórico de eventos e não faz parte do MVP.
- Restrições de criação retornam resposta neutra, sem expor sinal de segurança, denúncia ou razão interna.

## Consequências

- Exige tokens/ports exportados e testes de arquitetura para garantir que Eventos não importe ORM, controller ou entidade de outro contexto.
- As métricas registram apenas operação, resultado e correlação; não gravam capacidade, motivos de bloqueio ou conteúdo de perfil.
- A futura diferenciação de categorias não reutiliza a noção de experiência e será introduzida somente por caso de uso e ADR complementares.

## Plano de adoção e rollback

Publicar atrás de flag e iniciar com a política aprovada. Rollback desliga criação/publicação; registros existentes não são reclassificados. Qualquer correção de limite é forward-only e auditada.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF016, RF021; RN005, RN018, RN047–RN049
- `docs/03-modelos-de-dominio.md` §§2.2–2.3
- `back/src/modules/identity-access/domain/value-objects/account-access.ts`
