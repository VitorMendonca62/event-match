# ADR-040: Adiar o convite de perfil por sete dias no navegador

- **Status:** accepted
- **Data:** 2026-09-30
- **Decisores:** produto, frontend, backend e privacidade
- **Relacionado:** `specs/sdd-015-primeiro-acesso-completar-perfil/tasks.md`; ADR-034, ADR-037, ADR-038
- **Substitui/Substituído por:** N/A

## Contexto

O convite para completar o perfil não pode bloquear uma conta ativa nem reaparecer a cada navegação depois de “Agora não”. Produto escolheu sete dias e prefere persistência no navegador, sem coluna de onboarding no banco. A solução precisa funcionar no primeiro render server-side, não produzir flash e não aplicar o adiamento de uma conta a outra em navegador compartilhado.

## Drivers da decisão

- Convite não coercitivo e sem impacto em autorização.
- Ausência de migration e retenção de preferência comportamental no servidor.
- Leitura pelo RSC antes de renderizar `/inicio`.
- Isolamento entre contas no mesmo navegador.
- Degradação segura se o cookie for apagado ou adulterado.
- Mesmas regras para novatos e veteranos.

## Opções consideradas

1. **Cookie HttpOnly de sete dias, escopado por sujeito pseudônimo da conta.**
2. `localStorage` — rejeitado porque só existe após hidratação, causa flash e é acessível a scripts.
3. Coluna no PostgreSQL — rejeitada porque sincronização entre dispositivos não agrega valor suficiente para uma preferência de apresentação.
4. Cookie global sem vínculo de conta — rejeitado porque uma conta esconderia o convite de outra no mesmo navegador.
5. Não permitir adiamento — rejeitado por coerção e repetição.

## Decisão

Adotar a opção 1.

O backend continua autoridade para `ProfileCompletion`. Quando resolve o próprio perfil, também produz para o BFF um `invitationSubject` pseudônimo: HMAC versionado do `accountId` com `PROFILE_INVITATION_KEY`. O valor não contém o UUID, não é exposto em componentes cliente, não é logado e só serve para comparar o cookie neste navegador.

O cookie armazena versão, subject e `dismissedUntil`. Em produção usa `__Host-eventmatch_profile_invite`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sem `Domain` e `Max-Age=604800`. Desenvolvimento/teste usa nome sem prefixo e sem `Secure`, validado por ambiente. Como a preferência não concede acesso nem muda dados, adulterar ou apagar o cookie no máximo mostra ou esconde o convite localmente; ainda assim, forma, versão e prazo são validados e prazos futuros acima de sete dias são ignorados.

`POST /api/profile/invitation/dismiss` exige sessão válida, mesma origem e JSON. O Route Handler consulta a completude/sujeito pelo backend, grava o cookie e responde sem ids. Não acessa PostgreSQL diretamente nem duplica a regra de completude. Se o perfil já estiver completo, a operação é idempotente e a UI permanece sem convite.

No RSC de `/inicio`, a ordem é:

1. validar a sessão;
2. obter completude e subject no backend;
3. esconder o convite quando o perfil estiver completo;
4. se incompleto, esconder somente quando cookie válido tiver o mesmo subject e prazo ainda futuro;
5. caso contrário, mostrar o convite.

“Completar perfil” navega para `/perfil`. “Agora não” só desativa o convite após resposta bem-sucedida e anuncia a mudança por `aria-live`. Em outra aba, o cookie passa a valer na próxima navegação/refresh; não se adiciona canal de sincronização em tempo real. Após sete dias, no próximo request server-side, o convite reaparece se a completude continuar falsa.

Logout não precisa apagar o cookie porque o subject impede vazamento entre contas e preservar o prazo reduz repetição no próximo login da mesma pessoa naquele navegador. Rotacionar `PROFILE_INVITATION_KEY` invalida adiamentos existentes de forma segura.

## Consequências positivas

- Sem migration, job ou estado de onboarding no PostgreSQL.
- Sem flash de convite durante hidratação.
- Navegadores e dispositivos permanecem independentes como decidido por produto.
- Contas compartilhando o navegador não interferem entre si.
- Cookie nunca participa de autorização ou completude.

## Consequências negativas e riscos

- O adiamento não acompanha outro dispositivo ou navegador.
- Limpar cookies faz o convite reaparecer antes de sete dias.
- Outra aba só reflete o adiamento na próxima navegação/refresh.
- O cookie contém um identificador pseudônimo estável de primeira parte, embora sem PII e com finalidade restrita.

## Plano de adoção e rollback

Publicar o handler atrás de `PROFILE_UI_ENABLED`; o convite só aparece quando backend e UI estiverem habilitados. Rollback desliga o convite e deixa cookies expirarem. Mudança de nome/chave invalida cookies anteriores sem afetar perfil ou sessão. Não há migration.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF012–RF016; RN014, RN018, RNF001
- `front/src/app/inicio/page.tsx`
- `front/src/shared/server/authenticated-view.ts`
- `front/.impeccable/surfaces/src-app-perfil-page-tsx.md`
- ADR-034 e ADR-037
