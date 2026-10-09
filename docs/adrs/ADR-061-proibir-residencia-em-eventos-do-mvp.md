# ADR-061: Proibir residência em eventos do MVP

- **Status:** accepted
- **Data:** 2026-10-08
- **Decisores:** produto, backend, privacidade e segurança
- **Relacionado:** TASK 23.1; ADR-055; ADR-059; RF021; RN020–RN021; RNF001–RNF002
- **Substitui/Substituído por:** substitui a ADR-059

## Contexto

O produto corrigiu a decisão anterior: residências não são permitidas como local de evento no MVP. A política deve impedir seu uso sem exigir endereço textual, bairro ou consulta de geocodificação.

## Decisão

- `Event` aceita somente `public_place` ou `identifiable_establishment` como categoria de local.
- A anfitriã declara, no rascunho e novamente na publicação, que o local não é residência. A declaração e a categoria são auditadas.
- Payloads com `private_residence` ou categoria desconhecida são rejeitados; não há geocodificação, coleta de endereço, bairro ou nome do local no fluxo comum.
- A proteção de coordenada exata, área aproximada e acesso apenas de anfitriã/participação confirmada permanece definida pela ADR-055.

## Consequências

- A declaração reduz o risco de envio indevido sem fingir que o sistema valida materialmente o endereço.
- Denúncia e medidas de segurança continuam disponíveis se a declaração for falsa.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RN020–RN021
- `docs/adrs/ADR-055-ponto-exato-protegido-de-eventos.md`
- `docs/adrs/ADR-059-residencia-declarada-com-localizacao-protegida.md`
