---
version: 1
slug: "src-app-entrar-page-tsx"
primary_target: "src/app/entrar/page.tsx"
related_targets: ["src/app/inicio/page.tsx"]
---

# Entrar e início — surface brief

Scope: `/entrar` (login) e `/inicio` (primeira área autenticada). Mode: **Operate**. Extensão do mundo “Convite Cívico” já estabelecido pelo cadastro; nenhuma mudança durável em `DESIGN.md` (ADR-037).

Audience/job: pessoa adulta com conta ativa volta ao EventMatch e entra com e-mail e senha; no início, confirma que entrou, sabe que os próximos passos ainda chegam e sabe sair.
Constraints: paleta semântica de AGENTS.md; nenhum dado privado (nome, e-mail, id) na tela ou nas props; mensagens neutras (não revelam existência, estado ou restrição da conta); teclado, leitor de tela, zoom 200%, alvos ≥44px; sem recuperação de senha (dizer isso sem link quebrado).

Build path: **code-led**, decisão do usuário em 2026-09-29 (opções recomendadas).

## Direction contract

THESIS: entrar é voltar a um cartaz conhecido, não a um portal genérico; recusa o cartão centralizado de login com logo e “Esqueceu a senha?”.
OWN-WORLD: herda tudo do cadastro — fundo quase preto, manchete de cartaz em duas tintas (Archivo 900, caixa alta condensada), campos `surface` com borda de 2px, CTA carmim em cápsula com chevron, foco âmbar, selo “Em breve” âmbar; sem faixa numerada (não é etapa).
STORY: `/entrar` — manchete “Bom te ver / de volta.” e o porquê à esquerda; formulário à direita (desktop), empilhado no mobile; “Criar cadastro” no cabeçalho e abaixo do formulário. `/inicio` — “Você entrou / no EventMatch.” com orientação de sair em aparelhos compartilhados à esquerda; à direita “Próximos passos” numa única superfície com fios entre “Completar perfil” e “Descobrir encontros”, cada um com ícone autoral, descrição e selo “Em breve”, sem links; “Sair” secundário no cabeçalho.
FIRST VIEWPORT: mobile — marca pequena e ação no topo, manchete de duas tintas, texto curto, campos e CTA dentro da primeira dobra de 844px no login. Desktop — grade 5fr/6fr com 64px de intervalo, espelhando `StepFrame`.
FORM: Convite Cívico (herdado); seed key: convite-civico.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review and the verdict. `DESIGN.md` permanece inalterado.

Memorable moment: a manchete de duas tintas “Bom te ver / de volta.” recebendo a pessoa no mesmo cartaz do cadastro.
Unresolved: recuperação de senha, perfil e descoberta (tarefas futuras).
