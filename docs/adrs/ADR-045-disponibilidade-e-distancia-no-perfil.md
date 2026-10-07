# ADR-045: Modelar disponibilidade e distância preferida como enums fechados e sempre privados no perfil

- **Status:** accepted
- **Data:** 2026-10-06
- **Decisores:** produto, backend, frontend e privacidade
- **Relacionado:** `specs/sdd-018-disponibilidade-distancia/tasks.md`; ADR-038, ADR-043, ADR-044; Task 16; Task 20
- **Substitui/Substituído por:** N/A

## Contexto

O RF081 prevê "disponibilidade" e "distância" entre os campos opcionais do perfil. A Task 16 pede registrar quando a pessoa costuma participar e até onde pretende se deslocar, sem agenda detalhada, endereço, coordenada ou localização contínua (RN011–RN014, RNF001–RNF002). Os critérios de aceite exigem que a disponibilidade "não represente horários exatos nem seja exibida publicamente", que a distância use faixas e não exija coordenada, e que negar a localização do aparelho não impeça o preenchimento.

Diferente de interesses, idiomas e preferências de atividades, nem disponibilidade nem distância constam dos catálogos do DER §3.10: são escalas com significado fixo (dias da semana, períodos do dia, quilômetros), não listas que profissionais acrescentam ou reordenam (RN148).

A região hoje é texto livre (SDD-015). A Task 20 introduzirá UF e município IBGE estruturados; só então haverá referência geográfica para medir distância.

Produto confirmou em 2026-10-06:

- disponibilidade em grade de 7 dias × 4 períodos pelo dia do calendário: madrugada (0h–6h), manhã (6h–12h), tarde (12h–18h) e noite (18h–24h); a madrugada de sexta é sexta das 0h às 6h;
- sem campo de fuso: os períodos valem na hora local da região da pessoa;
- distância em faixas fixas: até 2 km, até 5 km, até 10 km, até 25 km ou "qualquer lugar na minha cidade";
- ambos sempre privados, sem controle de compartilhamento nesta entrega;
- a Task 16 é entregue antes da Task 20, guardando a distância como preferência ainda sem efeito geográfico.

## Drivers da decisão

- Minimização (RNF002) e privacidade de rotina (RN014): granularidade baixa e nenhuma exposição.
- Contrato estável para a futura descoberta (RF023: filtros por horário e distância) sem antecipar o algoritmo.
- Integridade no banco e consulta eficiente por período para a descoberta futura.
- Coerência com os padrões aceitos de snapshot completo, revisão otimista e purga de expiração (ADR-038, ADR-043, ADR-044).
- Não depender da Task 20 para entregar valor à pessoa.

## Opções consideradas

### Disponibilidade

1. **Enum fechado de 28 slots `<weekday>_<period>` persistido em relação normalizada `profile_availability_slot`.**
2. Catálogo relacional editável (como ADR-044). Rejeitada: dias e períodos não são conteúdo operável; tornar a escala editável mudaria o significado histórico dos registros (RN148 trata de catálogos de conteúdo).
3. Bitmask inteiro de 28 bits na linha `profile`. Rejeitada: compacta, mas opaca para leitura, suporte e migrations futuras; consulta por slot exige operador bit a bit sem índice B-tree útil.
4. `text[]` na linha `profile`. Rejeitada: CHECK por elemento é frágil e consultas "quem está livre sábado à noite" ficam sem índice simples.
5. Faixas de horário livres (início/fim). Rejeitada: viola o critério "não representa horários exatos" e aproxima-se de uma agenda.

### Distância

1. **Enum fechado em coluna anulável `profile.preferred_distance`** com CHECK.
2. Número livre em km/slider. Rejeitado: falsa precisão sem coordenada e mais dado do que o necessário.
3. Catálogo editável. Rejeitado pelo mesmo motivo da disponibilidade.

### Visibilidade

1. **Sempre privado, sem coluna de visibilidade.** A presença ou remoção do dado é o controle da pessoa; nenhuma projeção (prévia ou visão de terceiros) inclui os campos.
2. Visibilidade `private | authenticated` como os demais grupos (ADR-038). Rejeitada nesta entrega: rotina semanal é dado de segurança pessoal e o critério da Task 16 proíbe exibição; não há caso de uso de produto para mostrá-la a outras pessoas.
3. Coluna de visibilidade reservada, fixa em `private`. Rejeitada: coluna sem semântica alcançável; uma futura exposição exigirá nova ADR e migration aditiva de qualquer forma.

## Decisão

Adotar a opção 1 em cada eixo.

### Disponibilidade

- `AvailabilityWeekday = mon | tue | wed | thu | fri | sat | sun` e `AvailabilityPeriod = early_hours | morning | afternoon | evening`. Um slot é o par; seu código canônico é `<weekday>_<period>` (ex.: `sat_evening`), totalizando 28 códigos.
- Janelas pelo **dia do calendário**: `early_hours` 00:00–06:00 (madrugada), `morning` 06:00–12:00, `afternoon` 12:00–18:00 e `evening` 18:00–24:00, em hora local da região da pessoa. Cada slot cobre somente horas do próprio dia: `fri_early_hours` é sexta 00:00–06:00, e um evento de sábado às 02:00 corresponde a `sat_early_hours`. A semântica alternativa (madrugada vinculada à noite do dia anterior) foi descartada por produto para que todo código represente o dia real do relógio. Não há campo de fuso; a descoberta futura compara a hora local do evento com o slot.
- Conjunto de 0 a 28 slots únicos, sem ordem própria; toda projeção usa a ordem canônica (segunda → domingo; madrugada → manhã → tarde → noite). Conjunto vazio significa "não informado".
- Persistência em `profile_availability_slot(account_id, weekday, period, selected_at)`, PK `(account_id, weekday, period)`, CHECKs de domínio, FK para `account` com `ON DELETE CASCADE` e índice `(weekday, period)` para a descoberta futura.

### Distância

- `PreferredDistance = up_to_2km | up_to_5km | up_to_10km | up_to_25km | same_city`, ou `null` (não informado). Unidade: km.
- A faixa é uma preferência declarada relativa à região informada pela pessoa, nunca a endereço ou posição do aparelho. Até a Task 20, a descoberta não tem como medir distância e deve tratar qualquer faixa como "mesma região"; com município estruturado, a distância passa a ser medida a partir da referência do município. `same_city` significa "qualquer local do mesmo município/região".
- Persistência em `profile.preferred_distance text NULL` com CHECK.

### Privacidade e projeção

- Ambos são sempre privados: aparecem somente na visão própria (`GET /api/v1/profiles/me`). A prévia e qualquer projeção futura de terceiros os omitem. Esta é uma exceção explícita ao padrão de "controle de visibilidade por grupo" do RF081, justificada por RN014 e pelo critério de aceite da Task 16; o controle oferecido é preencher, alterar ou remover.
- Nenhum valor entra em logs, métricas ou mensagens de erro; telemetria mantém só operação, resultado e correlação.
- Esta entrega não solicita, lê nem armazena localização do aparelho (RN012).
- Os campos não entram na completude (`ProfileCompletion`), não concedem capacidades e não são usados em recomendação ou filtros nesta entrega.

### Contrato e concorrência

`GET/PUT /api/v1/profiles/me` são ampliados. O `PUT` continua recebendo snapshot completo com `revision`; `availabilitySlots` (array de códigos canônicos, 0–28, únicos) e `preferredDistance` (enum ou `null`) passam a ser **chaves obrigatórias**. Valores fora do enum são rejeitados por validação (`400`), sem códigos `422` novos, porque não há catálogo mutável. A substituição de `profile_availability_slot` e a coluna de distância mudam na mesma unidade de trabalho e compare-and-set dos demais campos. Rótulos pt-BR vivem no frontend, como os de intenção de uso.

A purga de expiração de conta incompleta remove os slots e anula a distância.

## Consequências positivas

- Dados mínimos, legíveis e com integridade garantida pelo banco.
- Contrato estável (códigos + faixa) para a descoberta, sem algoritmo antecipado.
- Entrega independente da Task 20, sem reescrita futura: a Task 20 só acrescenta a referência geográfica.
- Nenhuma exposição de rotina a terceiros.

## Consequências negativas e riscos

- Mudar janelas ou períodos exige migration e nova ADR (escala fixa por decisão).
- "Sexta de madrugada" é ambíguo em pt-BR (muita gente entende "depois da noite de sexta"). Como o slot segue o calendário, a UI precisa deixar a janela explícita ("Madrugada 0h–6h", nota "a madrugada de sexta vai da 0h às 6h de sexta") para que quem sai na sexta à noite marque também a madrugada de **sábado**.
- Até a Task 20, a distância não tem efeito geográfico; a UI precisa dizer isso sem prometer recomendação.
- Fuso implícito pressupõe que a pessoa participa de encontros na própria região; deslocamento entre fusos fica sem tratamento no MVP.
- O `PUT` ganha mais duas chaves obrigatórias: publicação coordenada front/back.
- Divergência deliberada do padrão de visibilidade por grupo (RF081), documentada acima.

## Plano de adoção e rollback

Migration aditiva `0010_profile_availability_distance`: coluna `profile.preferred_distance` anulável com CHECK e tabela `profile_availability_slot` com CHECKs, FK em cascata e índice. Contas existentes ficam com conjunto vazio e distância `null`; nenhum valor é inferido.

Rollout com `PROFILE_UI_ENABLED=false` → migration → backend → frontend → smoke → religar UI. Rollback operacional desliga a UI e volta as aplicações, preservando schema e dados; correções são forward-only, sem down migration destrutiva.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF015, RF023, RF081; RN011–RN014, RN148; RNF001–RNF002; §3.10
- `docs/02-regras-de-negocio.md` §2; `docs/03-modelos-de-dominio.md` §§2.2, 2.11 e 3
- ADR-038, ADR-043, ADR-044
- `specs/tasks.txt` Tasks 16 e 20
