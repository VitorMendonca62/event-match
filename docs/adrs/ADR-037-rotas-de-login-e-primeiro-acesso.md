# ADR-037: Adotar `/entrar` e `/inicio` como login e primeiro acesso

- **Status:** accepted
- **Data:** 2026-09-29
- **Decisores:** produto, frontend, acessibilidade e segurança
- **Relacionado:** `specs/sdd-013-autenticacao-sessao-primeiro-acesso/tasks.md`; ADR-027, ADR-033, ADR-034
- **Substitui/Substituído por:** N/A

## Contexto

Após o cadastro, `/cadastro/concluido` informa que a conta está ativa, mas ainda diz que login chegará no futuro. A Task 11 precisa oferecer entrada real e uma primeira área protegida sem antecipar descoberta de eventos ou edição completa de perfil.

O sistema visual “Convite Cívico” já está documentado em `DESIGN.md`; login e primeiro acesso são superfícies Operate dentro desse mundo, não um redesign.

## Drivers da decisão

- Rota e destino previsíveis em português.
- Nenhum dado privado na primeira tela.
- Próximos passos claros sem prometer funcionalidades indisponíveis.
- Comportamento seguro para refresh, voltar, múltiplas abas, expiração e logout.
- Acessibilidade integral e mínimo JavaScript no cliente.

## Opções consideradas

1. **`/entrar` para login e `/inicio` para a primeira área protegida.**
2. `/login` e `/dashboard` — termos genéricos e menos alinhados à linguagem do produto.
3. Redirecionar diretamente para descoberta — rejeitado porque descoberta não existe nesta task.
4. Autenticar automaticamente ao concluir o cadastro — rejeitado pelo escopo e pela separação de credenciais.

## Decisão

Adotar a opção 1.

`/entrar` contém e-mail, senha, “Manter conectado” desmarcado, envio protegido contra duplo clique, feedback de progresso e erro neutro com foco. Usa `autocomplete="username"` e `autocomplete="current-password"`, labels persistentes, descrições e `aria-live` sem ecoar valores. Pessoa já autenticada que acessa `/entrar` é redirecionada no servidor para `/inicio`.

Após sucesso, a navegação usa substituição de histórico para `/inicio`. A página protegida valida a sessão antes de renderizar, não expõe nome, e-mail, ids ou outro dado privado e apresenta:

- confirmação clara de que a pessoa entrou no EventMatch;
- logout acessível;
- próximos passos “Completar perfil” e “Descobrir encontros”, com estado “Em breve”/indisponível enquanto suas tasks não existirem.

Refresh e acesso direto preservam uma sessão válida. Voltar após login não reabre um formulário autenticável; `/entrar` redireciona a pessoa conectada. Logout revoga no servidor, expira o cookie e usa substituição para `/entrar`; voltar ou reutilizar cache não revela `/inicio`. Em múltiplas abas, o cookie é compartilhado e logout em uma aba invalida o segredo para todas; as demais redirecionam na próxima navegação, chamada autenticada ou retorno de foco.

`/cadastro/concluido` troca a promessa futura por uma ação clara “Entrar no EventMatch” para `/entrar`; o cadastro não autentica automaticamente.

As superfícies herdam os tokens, tipografia, foco âmbar, componentes planos e linguagem não romântica de `DESIGN.md`. Não há mudança durável do sistema visual sem revisão e documentação próprias.

## Consequências positivas

- Primeiro acesso útil sem depender de eventos/perfil completos.
- Rotas e histórico previsíveis.
- Conteúdo privado nunca participa de cache ou props client-side.
- Reaproveita o sistema visual e primitives existentes.

## Consequências negativas e riscos

- Os dois próximos passos aparecem indisponíveis até tarefas futuras.
- Uma pequena ilha cliente ainda é necessária para formulário, foco, pending e manutenção entre abas.
- A ausência de recuperação de senha precisa ser comunicada sem oferecer link quebrado.

## Plano de adoção e rollback

Publicar atrás de `AUTH_UI_ENABLED`. Habilitar somente após backend/BFF, cookies e E2E passarem. Rollback oculta `/entrar` e `/inicio`, restaura a conclusão anterior ou mantém mensagem neutra sem link e expira cookies pelos handlers publicados. Não redirecionar para uma funcionalidade inexistente.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF007–RF009 e RNF009–RNF021
- `PRODUCT.md` e `DESIGN.md`
- `front/src/app/cadastro/concluido/page.tsx`
- ADR-027, ADR-033 e ADR-034
