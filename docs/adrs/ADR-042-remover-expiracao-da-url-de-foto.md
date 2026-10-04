# ADR-042: Remover a promessa de expiração da URL de foto

- **Status:** accepted
- **Data:** 2026-10-03
- **Decisores:** produto
- **Relacionado:** `specs/sdd-015-primeiro-acesso-completar-perfil/tasks.md`; ADR-039; ADR-041
- **Substitui/Substituído por:** substitui parcialmente a ADR-039 quanto à validade máxima da URL de entrega

## Contexto

A entrega `authenticated` do Cloudinary usa uma assinatura de transformação que protege o caminho, mas não incorpora prazo. O contrato inicialmente devolvia `expiresAt` e prometia validade máxima de cinco minutos, embora a URL pudesse continuar funcionando. A ADR-041 propôs token-based authentication, possivelmente dependente de plano mais caro, ou um proxy de binários como alternativa.

## Decisão

Retirar `expiresAt` do objeto de foto e remover `PROFILE_PHOTO_DELIVERY_TTL_SECONDS`. A porta de mídia passa a devolver somente a URL assinada do derivado WebP 512. O prazo de cinco minutos continua existindo exclusivamente para o grant de upload, cujo `expiresAt` permanece no contrato correspondente.

A URL de entrega não é apresentada como temporária, não é persistida nem registrada e continua disponível somente à titular por endpoints autenticados com `Cache-Control: private, no-store`. O original permanece inacessível e somente o derivado normalizado é entregue.

## Consequências

- O contrato deixa de prometer uma garantia que o mecanismo atual não cumpre.
- Não são necessários token-based authentication, plano Cloudinary Advanced nem proxy de binários nesta entrega.
- Uma URL copiada pode ser reutilizada enquanto o asset e sua versão existirem no provedor; `no-store` e autenticação do endpoint não revogam uma URL já obtida.
- Exposição da foto a terceiros permanece fora do escopo e exige nova decisão de segurança, privacidade e moderação.
- Substituir ou remover a foto continua convergindo para destruição do asset pelo lifecycle existente.

## Rollback e evolução

Para voltar a oferecer URLs temporárias, uma nova ADR deve escolher e validar um mecanismo de expiração real antes de reintroduzir `expiresAt`. Desligar `PROFILE_MEDIA_ENABLED` continua sendo o rollback operacional.

## Evidências

- `back/src/modules/profiles/infrastructure/media/cloudinary-profile-image-store.adapter.ts`
- `back/src/modules/profiles/presentation/http/dto/profile-response.dto.ts`
- `front/src/features/profile/contracts.ts`
