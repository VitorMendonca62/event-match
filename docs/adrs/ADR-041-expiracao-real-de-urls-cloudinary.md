# ADR-041: Exigir expiração real nas URLs de derivados do Cloudinary

- **Status:** rejected
- **Data:** 2026-10-01
- **Decisores:** produto, backend, segurança, privacidade e operação
- **Relacionado:** `specs/sdd-015-primeiro-acesso-completar-perfil/tasks.md`; ADR-039
- **Substitui/Substituído por:** alternativa rejeitada; decisão adotada na ADR-042

## Registro da rejeição

Em 2026-10-03, produto rejeitou adicionar token-based authentication ou proxy de binários nesta entrega e decidiu retirar `expiresAt` do contrato de foto. A URL continua assinada e restrita à titular, mas o EventMatch não promete expiração temporal. A ADR-042 registra a decisão adotada e substitui parcialmente a ADR-039.

Todos os prazos de cinco minutos descritos abaixo pertencem à alternativa rejeitada de expiração real da URL de entrega. Na decisão vigente, somente o grant de upload expira em cinco minutos; a URL assinada de entrega não possui prazo contratual.

## Contexto

A implementação inicial do ADR-039 gera uma URL assinada para um asset `authenticated` e devolve `expiresAt`, mas a assinatura de transformação do Cloudinary não incorpora prazo. Portanto, o contrato informa cinco minutos sem que a URL deixe de funcionar depois desse instante.

Expiração efetiva de derivados entregues diretamente pelo Cloudinary exige token de acesso configurado na conta e uma chave própria de entrega. Esse recurso pode exigir plano Cloudinary Advanced. A alternativa de transmitir a imagem pelo BFF mudaria a fronteira e o custo de tráfego decididos no ADR-039.

## Drivers da decisão

- Cumprir o prazo máximo de cinco minutos no mecanismo, não apenas no DTO.
- Entregar somente o derivado normalizado, nunca o original.
- Manter segredo e identificadores do provedor fora do browser, logs e telemetria.
- Não transformar Next.js ou NestJS em proxy de binários sem decisão explícita.
- Tornar custo e pré-requisitos do provedor visíveis antes do rollout.

## Opções consideradas

1. **Token-based authentication do Cloudinary na entrega direta.** Adiciona chave de token dedicada e exige validar disponibilidade comercial no ambiente contratado.
2. Proxy autenticado pelo BFF/backend. Permite TTL sob controle do EventMatch, mas duplica tráfego e muda a fronteira de entrega direta.
3. Manter somente URL assinada de transformação. Rejeitada porque não implementa expiração real.
4. Entregar o original por `private_download_url`. Rejeitada porque viola a entrega exclusiva de derivados normalizados.

## Decisão proposta

Adotar a opção 1, condicionada à confirmação de que o plano Cloudinary contratado suporta token-based authentication.

Adicionar uma chave dedicada `CLOUDINARY_AUTH_TOKEN_KEY`, validada no bootstrap quando mídia Cloudinary estiver habilitada. `CloudinaryProfileImageStoreAdapter` deve gerar um token limitado ao caminho exato do derivado WebP 512, com `exp` igual a `now + PROFILE_PHOTO_DELIVERY_TTL_SECONDS`. A URL e o token nunca são persistidos nem registrados.

O fake deve modelar o prazo e os testes de contrato devem verificar alteração do token por deadline e recusa conceitual após o instante de expiração. Um smoke test opt-in no ambiente Cloudinary confirma `200` antes e recusa depois do prazo.

Se o recurso não estiver disponível no plano aprovado, esta ADR não pode ser aceita como escrita: produto e arquitetura devem escolher explicitamente a opção 2 ou retirar a promessa de URL temporária antes do rollout.

## Consequências positivas

- O prazo público corresponde ao controle aplicado pelo provedor.
- A entrega continua direta e restrita ao derivado normalizado.
- Compartilhamento da URL fica limitado à janela decidida.

## Consequências negativas e riscos

- Pode exigir plano Cloudinary mais caro.
- Introduz uma credencial operacional adicional e configuração no console.
- Configuração divergente entre aplicação e Cloudinary causa indisponibilidade de imagens.

## Plano de adoção e rollback

Esta alternativa foi rejeitada e não condiciona mais o rollout. A decisão vigente e seu risco aceito estão na ADR-042. O rollback continua desligando mídia; assets existentes permanecem privados e sujeitos ao cleanup da ADR-039.

## Evidências e referências

- ADR-039
- `back/src/modules/profiles/infrastructure/media/cloudinary-profile-image-store.adapter.ts`
- Cloudinary: Control access to media
