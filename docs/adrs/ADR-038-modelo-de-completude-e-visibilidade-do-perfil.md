# ADR-038: Evoluir o perfil com completude e visibilidade explícitas

- **Status:** accepted
- **Data:** 2026-09-30
- **Decisores:** produto, backend, frontend, privacidade e confiança e segurança
- **Relacionado:** `specs/sdd-015-primeiro-acesso-completar-perfil/tasks.md`; ADR-002, ADR-013, ADR-036, ADR-037, ADR-039, ADR-040
- **Substitui/Substituído por:** N/A

## Contexto

O cadastro já persiste nome de exibição, região aproximada, intenções de uso e no mínimo três interesses. O contexto `profiles` ainda só oferece uma porta de escrita para o cadastro e não possui agregado de edição, apresentação, foto, revisão concorrente, projeção de prévia ou visibilidade.

RF012–RF016 pedem edição, prévia sem dados privados, privacidade por campo e habilitação derivada de anfitrião. RF081 enumera campos opcionais adicionais, mas produto decidiu adiá-los. A primeira entrega deve atender tanto contas recém-ativadas quanto veteranas cujo estado real esteja incompleto, sem transformar foto e apresentação em requisito para sessão ou uso comum.

## Drivers da decisão

- Uma única autoridade para completude, invariantes e projeção compartilhável.
- Não repetir nem divergir dos dados válidos coletados no cadastro.
- Privacidade por padrão para os novos campos.
- Compatibilidade com campos futuros do RF081 sem modelá-los prematuramente.
- Atualizações concorrentes previsíveis em múltiplas abas.
- Nenhum contato, nascimento, estado de conta ou identificador interno na prévia.

## Opções consideradas

1. **Evoluir o agregado `Profile`, adicionar revisão otimista e visibilidade somente para foto/apresentação nesta entrega.**
2. Criar um novo agregado de onboarding separado do perfil — rejeitado porque duplicaria dados e completude.
3. Modelar todos os campos do RF081 agora — rejeitado pela decisão de produto e pelas políticas específicas ainda não definidas.
4. Calcular completude no frontend — rejeitado porque telas e clientes poderiam divergir das regras do domínio.

## Decisão

Adotar a opção 1.

O contexto `profiles` passa a ser dono da leitura e edição autenticadas do perfil. A porta de escrita usada pelo cadastro permanece para a ativação atômica, mas casos de uso posteriores usam repositório e agregado próprios, sem importar NestJS, Drizzle ou HTTP.

### Dados e invariantes

- `displayName`: obrigatório, texto normalizado, 1–60 caracteres.
- `region`: obrigatória, aproximada e manual, 2–80 caracteres.
- `usageIntents`: ao menos uma e somente valores já suportados.
- `interests`: no mínimo três ids ativos, sem duplicatas.
- `presentation`: opcional, texto simples normalizado em NFC, 1–500 caracteres quando presente; HTML, Markdown executável e caracteres de controle são rejeitados.
- `photo`: zero ou uma foto principal ativa, referenciada por identidade opaca do provedor; URL temporária não é persistida como identidade.
- `photoVisibility` e `presentationVisibility`: `private | authenticated | public`, com default `private` em linhas existentes e novas.
- `revision`: inteiro positivo incrementado em cada mutação do perfil; comandos exigem a revisão observada e conflitos retornam resultado tipado.

URLs, padrões de e-mail e sequências telefônicas evidentes são recusados na apresentação com orientação para não publicar contato. Isso é uma proteção básica, não substitui moderação de conteúdo. Antes de expor perfis a outras pessoas, uma tarefa própria deve decidir moderação, denúncia e tratamento de evasões.

### Completude e prévia

`ProfileCompletion` é derivada no backend dos seis requisitos desta superfície: nome válido, região válida, ao menos uma intenção, três interesses ativos, foto ativa e apresentação não vazia. O resultado contém apenas itens sem conteúdo (`complete`, `completedCount`, `totalCount`, `missing[]`) e não é persistido.

Foto e apresentação continuam opcionais para a conta ativa. A ausência delas apenas mantém o convite e impede que esses requisitos contribuam para RN018. Habilitação de anfitrião permanece uma capacidade derivada e não é concedida por esta task.

`private` restringe o campo à titular; `authenticated` prepara sua exibição a pessoas autenticadas em contextos autorizados; `public` prepara superfícies anônimas permitidas pelo DER, como a identificação pública de anfitrião. Nesta entrega a API de edição aceita somente `private | authenticated`: `public` existe no domínio e no schema, mas fica indisponível até que uma tarefa de perfil público defina audiência, moderação e denúncia.

`ProfilePreviewProjection` é produzida pelo backend para uma audiência explícita. Nesta entrega, `/perfil/previa` simula a audiência `authenticated`, contendo nome, região aproximada, intenções, interesses e foto/apresentação marcadas como `authenticated`; campos `private` ficam ausentes. A projeção nunca consulta nem inclui contato, nascimento completo, status interno, sessão, restrições ou ids técnicos. Ela é acessível somente à própria titular autenticada; não existe endpoint de perfil de terceiros.

### Persistência

A migration aditiva `0007_profile_completion` amplia `profile` com `presentation`, `photo_visibility`, `presentation_visibility` e `revision`. A foto ativa e seu ciclo externo são representados separadamente conforme ADR-039. Checks espelham limites e enums; domínio/DTO continuam como primeira linha de validação.

Linhas existentes recebem visibilidade `private` e revisão `1`; nenhum dado novo é inferido. Remoção/expiração de dados pessoais também limpa apresentação, visibilidades e referência de foto dentro da unidade de trabalho, enquanto a exclusão externa segue a fila de limpeza da ADR-039.

## Consequências positivas

- Backend, convite e prévia compartilham a mesma definição de completude.
- Novatos e veteranos recebem comportamento idêntico baseado em estado real.
- Visibilidade não é inferida da presença do campo.
- Revisão otimista impede que uma aba sobrescreva silenciosamente outra.
- O schema admite evolução futura sem criar colunas prematuras para RF081.

## Consequências negativas e riscos

- A apresentação exige política de texto e testes adicionais.
- As visibilidades `authenticated` e `public` ainda não produzem exposição real a terceiros nesta entrega; `public` não pode ser selecionada pela API/UI.
- Regex de contato reduz acidentes comuns, mas não garante moderação semântica.
- A edição posterior ao cadastro amplia a superfície transacional do contexto `profiles`.

## Plano de adoção e rollback

Aplicar a migration aditiva antes de habilitar `PROFILE_HTTP_ENABLED` e `PROFILE_UI_ENABLED`. Fazer backfill determinístico dos defaults, publicar leitura, depois escrita e por último convite/edição. Rollback operacional desliga as flags e mantém colunas/tabelas; não executar downgrade destrutivo. Correções de schema são migrations forward.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF012–RF016, RF081; RN008–RN014, RN018, RN112, RNF001
- `docs/02-regras-de-negocio.md` §2
- `docs/03-modelos-de-dominio.md` §2.2
- `back/src/modules/profiles/`
- `front/.impeccable/surfaces/src-app-perfil-page-tsx.md`
