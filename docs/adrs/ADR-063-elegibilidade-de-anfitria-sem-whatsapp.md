# ADR-063: Não exigir WhatsApp para habilitar anfitriãs no MVP

- **Status:** accepted
- **Data:** 2026-10-09
- **Decisores:** produto
- **Relacionado:** ADR-025, ADR-057; RF016; RN005, RN018
- **Substitui/Substituído por:** substitui parcialmente ADR-057 somente quanto ao requisito de contatos

## Contexto

A ADR-025 mantém a verificação por WhatsApp desabilitada no MVP. A regra original de anfitriã, refletida na ADR-057 e no DER, exigia e-mail e celular confirmados; isso tornava a habilitação impossível para contas cadastradas pelo único canal de verificação disponível.

## Decisão

Anfitriãs precisam ter e-mail confirmado. A confirmação pelo canal WhatsApp não é requisito de elegibilidade enquanto esse canal permanecer indisponível no MVP. As demais condições de perfil, interesses, foto, apresentação, aceite das regras, limites e autorização no backend permanecem inalteradas.

A checagem continua autoritativa, ao vivo e no backend. O adapter retorna apenas um booleano e não revela à pessoa qual requisito está faltando.

## Consequências

- Uma conta elegível pelo e-mail pode criar e publicar eventos sem verificação por WhatsApp.
- Habilitar WhatsApp no futuro não o torna automaticamente obrigatório para anfitriãs; uma nova decisão de produto será necessária para alterar esse requisito.
- Não há mudança em endpoint, schema, migration ou dados persistidos.

## Plano de adoção e rollback

A regra é aplicada no adapter de elegibilidade do backend. O rollback de código restaura a exigência anterior e volta a impedir anfitriãs sem WhatsApp; não há rollback de dados.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF016, RN005 e RN018
- `docs/02-regras-de-negocio.md` §2
- ADR-025, que mantém WhatsApp indisponível para verificação no MVP
- ADR-057, que define a composição de elegibilidade e os limites de anfitriã
