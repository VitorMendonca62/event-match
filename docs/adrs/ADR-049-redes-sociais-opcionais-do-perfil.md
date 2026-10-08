# ADR-049: Modelar redes sociais do perfil por provedor permitido e identificador canônico

- **Status:** accepted
- **Data:** 2026-10-07
- **Decisores:** produto, backend, frontend, privacidade e confiança e segurança
- **Relacionado:** Task 18; ADR-038, ADR-043
- **Substitui/Substituído por:** N/A

## Contexto

O RF081 permite redes sociais como campo opcional de perfil. A Task 18 deve oferecer contexto adicional sem transformar o EventMatch em diretório de contatos, aceitar URLs arbitrárias, fazer requisições a domínios de terceiros ou confirmar propriedade de contas externas.

Uma URL armazenada como texto livre permitiria esquemas maliciosos, hosts falsos, credenciais embutidas, redirecionadores e parâmetros de rastreamento. Ao mesmo tempo, um catálogo relacional genérico para poucas integrações iniciais anteciparia operação de provedores antes de existir necessidade.

## Opções consideradas

1. **Provedor em allowlist + identificador canônico persistido; URL derivada somente na projeção.**
2. URL livre validada somente por esquema `https`. Rejeitada: não evita personificação de host, redirecionamento, parâmetros e links abusivos.
3. Campo genérico de URL por pessoa. Rejeitada: contradiz explicitamente a Task 18 e amplia spam/SSRF/XSS.
4. OAuth ou prova de propriedade. Adiados: ampliam tratamento de tokens, escopo de integração e suporte sem necessidade para a primeira entrega.
5. Catálogo mutável de provedores no banco. Adiado: cada provedor exige parser, renderer, política e testes; não é conteúdo administrável comum.

## Decisão

- Criar `profile_social_link` com `id`, `account_id`, `provider`, `canonical_identifier`, `position`, `visibility`, `created_at` e `updated_at`. Há no máximo um vínculo por provedor e a ordenação é estável por conta.
- O domínio possui um registro versionado de provedores permitidos. Cada provedor define hosts exatos, caminho de perfil aceito, normalização do identificador, URL de entrega e rótulo; não há campo genérico ou redirecionador.
- A persistência guarda apenas `provider + canonical_identifier`; URL de entrada é aceita apenas como conveniência, parseada/normalizada e descartada. A URL de saída é derivada da configuração confiável do provedor, sem query string, fragmento, credenciais ou host fornecido pela pessoa.
- Cada vínculo começa `private`. O contrato de edição aceita `private | authenticated`; `public` permanece reservado no domínio/schema até haver perfil público, moderação e denúncia. Toda projeção de terceiros depende de superfície autorizada futura.
- A UI mostra o provedor e informa que o perfil externo não é verificado. Nenhum backend, BFF ou RSC faz `fetch`, scraping, preview, resolução DNS ou confirmação remota da URL.

### Decisões de produto confirmadas para aceite

Produto confirmou:

1. Instagram, LinkedIn e X como provedores iniciais, todos restritos a perfis pessoais públicos;
2. no máximo um vínculo por provedor — portanto, no máximo três vínculos enquanto estes forem os únicos provedores;
3. a UI aceita tanto handle/identificador quanto URL colada, mas persiste somente o identificador canônico.
4. a edição aceita `private | authenticated`; `authenticated` aparece na prévia da titular nesta entrega, sem qualquer perfil de terceiros, diretório ou exposição real até existirem as proteções correspondentes.

O WhatsApp fica em estudo e fora do MVP desta ADR. Diferente dos demais provedores, um vínculo de WhatsApp pode revelar um número de telefone e iniciar contato direto; sua eventual inclusão exige decisão específica sobre consentimento, visibilidade, abuso, bloqueio e denúncia.

## Consequências

- O banco não armazena URL arbitrária, token ou parâmetros de rastreamento.
- Acrescentar provedor exige alteração revisada do registro de domínio, migration/check quando necessário e atualização de validação/testes; isso é intencional.
- A ausência de verificação de propriedade deixa risco de personificação, mitigado por texto claro, denúncia futura e ausência de importação de contatos.
- Links externos são dados opcionais e não entram em completude, capacidades, busca, ranking ou recomendação.

## Adoção e rollback

Migration aditiva cria a relação vazia; nenhuma conta recebe vínculo inferido. Publicar backend antes do frontend, ambos protegidos pelas flags de perfil. Rollback operacional desliga a UI e preserva vínculos privados; não há down migration destrutiva.

## Evidências

- `docs/DER-EventMatch-MVP.md` RF015, RF081; RN009, RN014; RNF001
- `specs/tasks.txt` Task 18
- `docs/adrs/ADR-038-modelo-de-completude-e-visibilidade-do-perfil.md`
- `back/src/modules/profiles/` e `front/src/features/profile/`
