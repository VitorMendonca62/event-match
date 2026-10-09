# ADR-055: Proteger a coordenada exata e projetar uma área aproximada estável do evento

- **Status:** accepted
- **Data:** 2026-10-08
- **Decisores:** produto, privacidade, segurança e backend
- **Relacionado:** TASK 23.1; `specs/sdd-025-backend-eventos/tasks.md`; RF017, RF020–RF021; RN020–RN021; RNF001–RNF002
- **Substitui/Substituído por:** complementada pela ADR-061 para proibição de residência

## Contexto

O município/UF do evento é necessário para descoberta futura, enquanto a coordenada exata só pode ser vista pela anfitriã e por pessoas com participação confirmada. Expor bairro, endereço, nome do local ou coordenada real na prévia permitiria deduzir o ponto antes da confirmação.

## Drivers da decisão

- Aplicar minimização e acesso contextual exigidos por RN021.
- Evitar que listagens, logs ou DTOs de prévia carreguem localização exata ou bairro.
- Manter a futura integração com Participações e Operações por portas explícitas.

## Opções consideradas

1. Coordenada protegida separada e área aproximada estável, com projeções explícitas por audiência.
2. Colunas de endereço no registro público do evento. Rejeitada: favorece vazamento acidental em listas, logs e DTOs.
3. Exibir somente município/UF, sem indicação espacial. Rejeitada: reduz demasiadamente a utilidade de descoberta futura.
4. Gerar um novo centro aproximado a cada leitura. Rejeitada: múltiplas consultas permitiriam calcular uma média e reduzir a incerteza.

## Decisão

- `event` guarda UF, município e dados públicos; não armazena bairro. `event_exact_location` é uma extensão 1:1 que contém somente latitude/longitude exatas e nunca participa de consultas de descoberta.
- A coordenada exata é cifrada em repouso por adapter de infraestrutura; chaves e rotação são fornecidas somente por `ConfigModule`. O domínio recebe value object sem detalhes criptográficos.
- Na publicação, o backend gera uma área aproximada estável para o evento: centro deslocado deterministicamente da coordenada real, raio mínimo configurado e persistido, e sem bairro/endereço. O mesmo evento sempre retorna a mesma área até alteração relevante autorizada; a regra não é executada pelo BFF nem pelo mapa.
- Casos de uso retornam três projeções: rascunho da anfitriã, prévia pública com município/UF e área aproximada, e localização exata autorizada. Anfitriã recebe a coordenada própria; Participações só a recebe depois de `confirmed`, nunca para solicitação pendente; Operações receberá porta própria posteriormente.
- A categoria e a declaração de local não residencial não são inferidas por geocodificação e seguem a ADR-061; esta ADR preserva a proteção de ponto exato para qualquer categoria permitida.

## Consequências

- DTOs públicos, logs, telemetria, mensagens de erro e auditoria não contêm bairro, endereço, complemento, nome do local, CEP ou coordenada exata.
- Descoberta futura usa somente município/UF e a área aproximada persistida; não recalcula nem recebe a coordenada real.
- A cifragem e o acesso contextual aumentam testes de autorização, gestão de segredo e custo de operação, mas evitam que uma mudança de projeção revele o ponto exato.

## Plano de adoção e rollback

A migration é aditiva e não replica o valor exato no registro público. Antes da flag ser ligada, validar configuração de chave, o mínimo de raio e testes de redaction/estabilidade da área. Rollback desliga as rotas de evento; não descriptografa nem copia dados para logs, e correções são feitas por migration forward-only.

## Aceite

Aceita em 2026-10-08: o evento não recebe bairro; a prévia/detalhe não confirmado mostra somente uma área aproximada com centro deslocado e estável; a coordenada exata é liberada apenas para anfitriã e participação confirmada.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF017, RF020–RF021; RN020–RN021
- `docs/04-integracoes-externas.md` §3
- `docs/01-visao-geral-arquitetura.md` §5
