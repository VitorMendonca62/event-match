# ADR-046: Modelar fotos adicionais como itens ordenados da galeria vinculados a assets de mídia

- **Status:** accepted
- **Data:** 2026-10-07
- **Decisores:** produto, backend, frontend, privacidade e confiança e segurança
- **Relacionado:** Task 17; ADR-038, ADR-039, ADR-042
- **Substitui/Substituído por:** N/A

## Contexto

O RF081 prevê fotos adicionais como campo opcional do perfil. A Task 17 limita a coleção a cinco fotos, com legenda e localização contextual opcionais, visibilidade por foto, reordenação e remoção. A implementação atual possui somente uma `profile_photo_asset` ativa por conta, destinada à foto principal (ADR-039), e usa a revisão do agregado `Profile` para impedir sobrescrita silenciosa.

Duplicar o adapter Cloudinary, o lifecycle de limpeza ou a autenticação de entrega criaria regras divergentes para o mesmo tipo de mídia. Por outro lado, colocar legenda, localização, posição e moderação no asset do provedor mistura a identidade técnica do arquivo com o conteúdo editável do perfil.

## Opções consideradas

1. **Generalizar o asset existente por finalidade e criar um item de galeria separado para os metadados e a ordenação.**
2. Criar uma segunda tabela de assets e copiar o lifecycle Cloudinary da foto principal. Rejeitada: duplica limites, limpeza e verificações de segurança.
3. Armazenar URLs e metadados diretamente em JSON no `profile`. Rejeitada: perde integridade, ordenação concorrente, limpeza auditável e separação entre URL de entrega e identidade do asset.
4. Reutilizar a foto principal como primeiro item da galeria. Rejeitada: a Task 17 exige que reordenar ou remover itens adicionais não afete a foto principal nem a completude.

## Decisão proposta

- Manter `profile_photo_asset` como fonte de verdade do arquivo, acrescentando uma finalidade imutável `primary | gallery`; os índices parciais atuais passam a se aplicar à finalidade `primary`.
- Criar `profile_gallery_photo`, com `id`, `account_id`, `asset_id` único, `position` de 1 a 4, `caption` anulável (1–120 quando presente), localização contextual anulável, `visibility`, estado de moderação e datas de auditoria. Uma FK composta garante que o item e o asset pertencem à mesma conta.
- Modelar localização contextual como texto normalizado e opcional: `city`, `area` (bairro/região aproximada) e `place_name`. Nenhuma coluna aceita endereço, CEP, coordenada, precisão, horário ou EXIF/GPS.
- O máximo de cinco itens ativos e a ordenação única por conta são garantidos na mesma UoW e revisão otimista do perfil; a migration usa constraint/índice único deferrable para permitir troca e reordenação sem estado intermediário inválido.
- Grant, upload direto, confirmação autoritativa, normalização, variantes, entrega autenticada e cleanup usam a mesma `ProfileImageStorePort` e o mesmo adapter Cloudinary. A cota de grants é compartilhada entre foto principal e galeria.
- A titular pode ver seus próprios itens finalizados; projeções de terceiros recebem somente derivados permitidos pela visibilidade e pelo estado de moderação definido na ADR-047. URLs nunca são persistidas.

## Consequências

- A foto principal mantém seu contrato e suas invariantes; a galeria não pode alterá-la indiretamente.
- Metadados podem ser editados ou removidos sem reenviar o arquivo.
- A migration e os adapters ficam mais complexos, mas a limpeza de órfãos continua centralizada e idempotente.
- `GET/PUT /profiles/me` e a prévia própria se tornam aditivos; toda mutação de item exige a revisão observada e retorna `409` em conflito.

## Adoção e rollback

A migration será aditiva e forward-only. Contas existentes começam sem itens de galeria. Rollback operacional desliga as flags da galeria e preserva schema, assets privados e o comando de cleanup; não haverá down migration destrutiva.

## Evidências

- `docs/DER-EventMatch-MVP.md` RF012, RF015, RF068, RF081; RN014; RNF001
- `specs/tasks.txt` Task 17
- `back/src/modules/profiles/infrastructure/persistence/schema/profiles.schema.ts`
- `docs/adrs/ADR-039-cloudinary-para-foto-principal-do-perfil.md`
