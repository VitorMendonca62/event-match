# ADR-048: Restringir a localização de fotos adicionais a contexto textual aproximado

- **Status:** proposed
- **Data:** 2026-10-07
- **Decisores:** produto, privacidade, frontend e backend
- **Relacionado:** Task 17; ADR-038, ADR-046
- **Substitui/Substituído por:** N/A

## Contexto

As fotos adicionais devem ajudar a contar sobre hobbies, atividades, lugares frequentados ou já visitados. Uma indicação opcional de local dá contexto, mas GPS, endereço e localização em tempo real expõem rotina, residência e segurança física. O DER determina localização aproximada, privacidade por padrão e minimização (RN011–RN014, RNF001–RNF002).

## Opções consideradas

1. **Campos textuais opcionais de cidade, bairro/região aproximada e nome de lugar, com visibilidade vinculada à própria foto.**
2. Coordenadas/GPS extraídos da imagem ou do aparelho. Rejeitada: viola minimização e cria risco de rastreamento.
3. Endereço, CEP ou ponto exato. Rejeitada: não é necessário para o objetivo da galeria e conflita com as regras de segurança do produto.
4. Catálogo/geocodificação de locais. Adiada: exige fornecedor, dados geográficos, política de precisão e não é necessária para contextualização inicial.

## Decisão proposta

- Cada item de galeria pode ter, de forma independente, `city` (2–80 caracteres), `area` (bairro/região aproximada, 2–80) e `placeName` (nome do lugar, 2–120), todos opcionais e de texto simples normalizado. Pelo menos um campo preenchido caracteriza a localização contextual; todos vazios equivalem a ausência.
- A interface orienta exemplos como “Centro, São Paulo” ou “Parque Ibirapuera”, e informa que não se deve inserir residência, endereço, rotina ou localização ao vivo.
- O backend não recebe geotags do browser, não lê EXIF/GPS, não geocodifica e não deriva coordenadas. O upload continua removendo metadados conforme ADR-039.
- A localização herda a audiência da foto e é omitida quando ela é `private`, não aprovada para terceiros ou não projetada na superfície autorizada. Não existe visibilidade mais ampla que a da foto.
- Legenda (até 120 caracteres) e localização passam pela mesma política textual de proibição de links, contatos e precisão indevida; detecção/revisão de conteúdo é coordenada pela ADR-047.

## Consequências

- A pessoa ganha contexto social sem o produto coletar posição, rota ou histórico preciso.
- Texto livre exige validação de tamanho, orientação de UI e moderação; não deve ser utilizado como dado de busca, recomendação ou telemetria nesta tarefa.
- Uma futura integração de locais estruturados exige nova ADR e migration, sem reinterpretar os textos já salvos.

## Evidências

- `docs/DER-EventMatch-MVP.md` RF015, RF081; RN011–RN014; RNF001–RNF002
- `docs/02-regras-de-negocio.md` §2
- `specs/tasks.txt` Task 17
