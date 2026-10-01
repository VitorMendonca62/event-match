# ADR-039: Usar Cloudinary para a foto principal do perfil

- **Status:** accepted
- **Data:** 2026-09-30
- **Decisores:** produto, backend, segurança, privacidade e operação
- **Relacionado:** `specs/sdd-015-primeiro-acesso-completar-perfil/tasks.md`; ADR-017, ADR-038
- **Substitui/Substituído por:** N/A

## Contexto

A Task 13 introduz o primeiro conteúdo binário enviado por pessoas usuárias. O PostgreSQL não deve armazenar arquivos e o browser não pode receber segredo de provedor. A foto precisa de recorte/prévia, normalização, remoção de metadados, variantes pequenas, substituição, remoção, limites contra abuso e recuperação de falhas entre banco e serviço externo.

Cloudinary e Cloudflare R2 + Images foram comparados. Cloudinary reduz o trabalho inicial por reunir upload, transformação e entrega; R2 oferece custo e portabilidade melhores, mas exige mais composição. Produto escolheu Cloudinary para esta entrega, preservando uma porta que permita troca futura.

## Drivers da decisão

- Menor tempo e menor superfície operacional para o MVP.
- Upload sem transportar o arquivo por Next.js e NestJS.
- Segredo do provedor exclusivamente no backend.
- Assets e derivados inacessíveis sem autorização.
- Somente imagens raster normalizadas, sem EXIF/localização.
- Limites de volume e limpeza eventual de órfãos.
- Falha do provedor não impede edição textual do perfil.

## Opções consideradas

1. **Cloudinary atrás de uma porta, com upload direto assinado e finalização autoritativa.**
2. Cloudflare R2 + Images — adiado; exige montar armazenamento, transformação e entrega privada separadamente.
3. Upload mediado por BFF e NestJS — rejeitado porque duplica tráfego, buffers e limites de corpo.
4. Armazenar binário no PostgreSQL — rejeitado por custo, pool, backup e fronteira de ownership.
5. Upload Cloudinary não assinado — rejeitado por abuso, parâmetros livres e exposição do preset.

## Decisão

Adotar a opção 1.

O domínio conhece apenas `ProfilePhotoRef` e `ProfileImageStorePort`. O adapter `CloudinaryProfileImageStoreAdapter`, injetado pelo módulo NestJS, assina uploads, verifica resultados, gera entrega temporária e destrói assets. Casos de uso não importam SDK, URLs ou tipos Cloudinary.

### Upload e finalização

1. A titular seleciona JPEG, PNG ou WebP estático de até 5 MiB e pelo menos 320 x 320 px; GIF, SVG, PDF, vídeo e animação são recusados.
2. O cliente cria uma prévia local e um recorte quadrado acessível. Nada é enviado antes da ação de salvar.
3. `CreateProfilePhotoUpload` autoriza `profile_write`, aplica limites e cria no PostgreSQL um asset `pending` com `publicId` aleatório, sem account id ou PII.
4. O backend devolve ao BFF somente parâmetros exatos assinados por cinco minutos, cloud name, API key pública e URL oficial de upload. `api_secret` nunca sai do adapter.
5. O browser envia diretamente ao Cloudinary usando preset assinado, `type=authenticated`, overwrite desabilitado e parâmetros fixos.
6. `FinalizeProfilePhotoUpload` valida assinatura da resposta, id do asset, versão, formato, bytes, dimensões e consulta autoritativa ao provedor. Resposta do browser sozinha nunca ativa a foto.
7. Em uma transação curta, o asset novo vira `active`, o anterior vira `delete_pending`, a revisão do perfil aumenta e o asset não finalizado não aparece em leitura alguma.

O preset aplica transformação de entrada com limite de 1600 x 1600, qualidade definida e `fl_force_strip`, produzindo um raster normalizado antes do armazenamento. Gera antecipadamente variantes WebP quadradas de 512 e 128 px. Somente essas variantes transformadas são entregues; o original não é exposto. A documentação do Cloudinary confirma que transformações removem EXIF/IPTC/XMP por padrão e que `fl_force_strip` força a remoção na transformação de entrada.

### Acesso e privacidade

- Assets usam entrega `authenticated`; originais e derivados exigem URL assinada.
- `GetOwnProfile` e a prévia podem receber uma URL de variante com validade máxima de cinco minutos, `Cache-Control: private, no-store` no contrato do EventMatch e política de referrer `no-referrer`.
- A URL temporária nunca é persistida, logada, enviada à telemetria ou tratada como identidade do asset.
- Nesta entrega somente a titular recebe URL. Visibilidade `authenticated` afeta a prévia simulada, mas não cria endpoint para terceiros; `public` permanece indisponível na API/UI até uma tarefa própria.
- Moderação visual automática fica adiada até a exposição a terceiros. Não se integra antivírus externo nesta fase: allowlist raster, decodificação pelo provedor, transformação de entrada e entrega somente de derivados normalizados reduzem a superfície de arquivo ativo, mas não equivalem a antivírus nem avaliam adequação do conteúdo. Original ou formato não transformado nunca é entregue.

### Limites, persistência e limpeza

`profile_photo_asset` registra `id`, `account_id`, `provider`, `public_id`, `provider_asset_id`, `version`, metadados validados, `state`, `upload_expires_at`, `activated_at`, `delete_after`, tentativas e datas. Índices parciais garantem no máximo um `pending` e um `active` por conta. `profile_media_attempt` registra somente subjects HMAC de conta/origem e instante para limitar emissão a 10 grants por conta em 24 h e 30 por origem em 15 min; não guarda IP ou token.

Assets `pending` vencidos e `delete_pending` são destruídos pelo caso de uso idempotente `CleanupProfileMedia`. Ele roda em lote pequeno após mutações de mídia, fora da transação principal, e por comando operacional explícito `bun run --cwd back profile-media:cleanup`. Não se introduz `@nestjs/schedule` nem cron embutido. Uma agenda externa futura pode invocar o mesmo caso de uso sem mudar o domínio. Falha de exclusão mantém a linha para retry exponencial e gera telemetria sem URL.

Remover foto torna o asset `delete_pending` na mesma transação que altera a projeção. Exclusão/expiração de conta segue o mesmo caminho. Nunca se bloqueia a resposta de edição por uma destruição externa; a limpeza é convergente e auditável.

### Configuração e custos

O backend exige `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_PROFILE_UPLOAD_PRESET`, `PROFILE_MEDIA_KEY` e limites validados. O Console deve manter preset assinado, Strict Transformations e limite de uso compatível com 5 MiB. Testes usam fake adapter; integração real é um smoke opt-in sem segredo no CI comum.

O plano Free atual oferece 25 créditos mensais compartilhados entre transformação, armazenamento e largura de banda. Métricas internas acompanham grants, finalizações, bytes, recusas, deleções e falhas; alertas de consumo do próprio Cloudinary devem ser habilitados antes do rollout.

Foto de perfil é dado pessoal sob a LGPD. Antes de produção, jurídico/privacidade deve validar DPA, subprocessadores, região de processamento/armazenamento, transferência internacional, prazo de exclusão/backup, atendimento a direitos do titular e termos do plano contratado. Implementação técnica não representa essa aprovação.

## Consequências positivas

- Upload não atravessa os processos Next.js/NestJS.
- Transformação e entrega privada ficam disponíveis sem infraestrutura própria de objetos.
- A porta e ids internos limitam lock-in no domínio e no banco.
- Asset só se torna visível após verificação server-side.
- Limpeza pode evoluir para scheduler externo sem reescrever regras.

## Consequências negativas e riscos

- Créditos combinados tornam custo menos previsível, e o primeiro plano pago é um salto relevante.
- Upload e finalização formam uma saga; órfãos temporários são inevitáveis.
- URLs assinadas ainda podem ser compartilhadas durante sua curta validade.
- A moderação visual não existe enquanto a foto permanece restrita à titular.
- Preset e Strict Transformations são configuração externa sujeita a drift.
- Região, subprocessadores e retenção de backups dependem do contrato do provedor e exigem validação jurídica/privacidade.

## Plano de adoção e rollback

Criar schema e fake adapter primeiro. Configurar um ambiente Cloudinary separado por ambiente, validar preset/transformações com fixtures e manter `PROFILE_MEDIA_ENABLED=false`. Habilitar assinatura, depois finalização e por último UI, somente após validação jurídica/privacidade para produção. Rollback desliga mídia e mantém texto/perfil; assets ativos continuam privados e a limpeza operacional permanece disponível. Migration não é revertida destrutivamente. Migração futura de provedor lê refs internas e copia apenas assets ativos.

## Evidências e referências

- [Cloudinary pricing](https://cloudinary.com/pricing)
- [Cloudinary access control](https://cloudinary.com/documentation/control_access_to_media)
- [Cloudinary upload presets](https://cloudinary.com/documentation/upload_presets)
- [Cloudinary image optimization and metadata stripping](https://cloudinary.com/documentation/image_optimization)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/)
- `docs/DER-EventMatch-MVP.md` RF012–RF016; RN009, RN014, RN018, RNF001
