# ADR-059: Permitir residência declarada com localização protegida

- **Status:** superseded
- **Data:** 2026-10-08
- **Decisores:** produto, backend, privacidade e segurança
- **Relacionado:** TASK 23.1; ADR-055; RF021; RN020–RN021; RNF001–RNF002
- **Substitui/Substituído por:** substituída pela ADR-061

## Contexto

O produto passou a permitir encontros em residência privada. A regra anterior de restringir eventos a locais públicos ou estabelecimentos não atende mais ao escopo, mas a residência eleva o risco de exposição de endereço e da rotina da anfitriã.

> Decisão superada em 2026-10-08 pela ADR-061: residências não são permitidas no MVP.

## Decisão

- `Event` registra uma categoria de local: `public_place`, `identifiable_establishment` ou `private_residence`.
- Para `private_residence`, a anfitriã declara que tem autorização para receber o grupo e aceita as regras de segurança aplicáveis. A declaração e a categoria são auditadas; não há geocodificação nem validação externa no fluxo comum.
- Endereço, bairro, nome do local e coordenada exata não entram em prévia, descoberta, logs, telemetria ou respostas a pessoas não confirmadas. A coordenada segue cifrada e só é liberada à anfitriã e a participantes confirmados, conforme ADR-055.
- Denúncia, restrição e acesso profissional continuam sujeitos às regras existentes de segurança; a mudança não cria acesso excepcional à residência.
- Antes do lançamento, Termos de Uso e Regras de Convivência precisam de nova versão aprovada juridicamente que reflita essa permissão e suas salvaguardas.

## Consequências

- A categoria permite aplicar informação e auditoria sem coletar endereço textual nem usar provedor de geocodificação.
- A descoberta pode continuar usando exclusivamente município/UF e área aproximada estável, sem revelar que o local é residência antes da confirmação.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RN020–RN021
- `docs/adrs/ADR-055-ponto-exato-protegido-de-eventos.md`
- `docs/legal/pt-BR/termos-de-uso-v1.0.0.md` e `docs/legal/pt-BR/regras-de-convivencia-v1.0.0.md` (a versionar antes do lançamento)
