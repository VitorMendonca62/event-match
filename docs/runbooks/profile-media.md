# Runbook — mídia do perfil

## Preparação

1. Concluir a avaliação jurídica/privacidade do Cloudinary (DPA, região, subprocessadores, transferência internacional, retenção e exclusão).
2. Criar um ambiente Cloudinary separado. O preset deve ser **signed**, `type=authenticated`, sem overwrite, aceitar somente JPEG/PNG/WebP estático, limitar a entrada a 1600×1600 e aplicar `fl_force_strip`.
3. Autorizar somente as transformações antecipadas WebP quadradas 512×512 e 128×128 e habilitar Strict Transformations.
4. Gerar `PROFILE_MEDIA_KEY` e `PROFILE_INVITATION_KEY` independentes (`openssl rand -base64 32`) e preencher as credenciais sem versioná-las.

## Rollout

1. Aplicar `0007_profile_completion` com as flags desligadas.
2. Ligar `PROFILE_HTTP_ENABLED` e validar leitura/edição.
3. Ligar `PROFILE_MEDIA_ENABLED`, realizar upload/finalização/remoção em conta interna e executar `bun run --cwd back profile-media:cleanup`.
4. Em ambiente isolado, configure `PROFILE_MEDIA_SMOKE_ENABLED=true` e `PROFILE_MEDIA_SMOKE_FIXTURE` com o caminho de um JPEG de pelo menos 320×320 px que contenha EXIF/GPS. Execute `bun run --cwd back profile-media:smoke`. O comando valida upload autenticado, rejeição de animação, variantes WebP 128×128 e 512×512, remoção de metadados e destrói o asset em `finally`; a saída nunca contém resposta do provedor, URL assinada ou ids.
5. Conferir créditos/fila `delete_pending` e desligar `PROFILE_MEDIA_SMOKE_ENABLED` após a validação.
6. Ligar `PROFILE_UI_ENABLED` no frontend.

## Operação e rollback

- Execute `bun run --cwd back profile-media:cleanup` por agenda externa e após incidentes do provedor. O comando é idempotente e retorna código diferente de zero quando algum asset continua pendente.
- Em incidente, desligue `PROFILE_UI_ENABLED`; depois `PROFILE_MEDIA_ENABLED` para impedir novos uploads. O texto do perfil permanece disponível.
- Não remova colunas/tabelas nem destrua assets ativos durante rollback. Correções de schema são migrations forward-only.
- Nunca copie respostas completas do Cloudinary, URLs assinadas, cookies, conteúdo do perfil ou ids do provedor para logs/tickets.
- Monitore `profile.media.cleanup` por `failedCount` e duração. Abra incidente se falhas persistirem em duas execuções consecutivas ou se a contagem operacional de `delete_pending` crescer; correlacione somente pelo `correlationId` aleatório do evento.
