# Roteiro manual: revisão do cadastro com leitor de tela

Complementa o E2E automatizado (SDD-012, ADR-032). O Playwright valida papéis, nomes acessíveis, foco e axe; só um leitor de tela real confirma **o que é anunciado e em que ordem**.

## Preparação

1. Ambiente: `bun run --cwd back start:dev` e `bun run --cwd front dev` com PostgreSQL local, ou o ambiente de aceite; e-mail de teste em `example.test` (o código chega pelo Brevo falso ou pelo log do backend de teste).
2. Leitor e navegador principais: **Orca + Firefox** (Pop!_OS). Quando houver acesso: **NVDA + Firefox/Chrome** (Windows) ou **VoiceOver + Safari** (macOS/iOS).
3. Use dados fictícios: e-mail `nome@example.test`, nascimento `1990-05-15`, senha longa inventada.
4. Não use zoom nem modo de alto contraste na primeira passada; repita a etapa 3 com zoom de 200%.

## Como registrar

Para cada linha, marque **OK**, **Falha** ou **N/A**, e descreva o que foi anunciado quando falhar. Falhas viram tarefa ou correção; não fique só no relatório.

## Roteiro

| # | Etapa | O que fazer | Esperado (anúncio) | Orca + Firefox | NVDA | VoiceOver |
|---|---|---|---|---|---|---|
| 1 | Início | Abrir `/` e ativar “Começar meu cadastro” | Link com nome claro; a página seguinte anuncia o título “Quando você nasceu?” |  |  |  |
| 2 | Nascimento | Preencher a data e continuar | Rótulo “Data de nascimento”, dica lida; erro de data anunciado ao enviar vazio; após avançar, foco no título “Como confirmamos que é você?” |  |  |  |
| 3 | Menor de idade | Informar uma data que dê menos de 18 anos | Aviso “Cadastro indisponível para menores de 18 anos” anunciado sem pedir e-mail |  |  |  |
| 4 | E-mail | Ouvir o grupo “Canal de confirmação”; enviar o e-mail | WhatsApp anunciado como indisponível (“Em breve”); ao enviar, título “Digite o código” |  |  |  |
| 5 | OTP correto | Digitar o código recebido | Campo “Código de 6 dígitos” com a validade; avanço anuncia “Crie sua senha” |  |  |  |
| 6 | OTP errado | Digitar código errado | Mensagem neutra “Não foi possível confirmar o código…” anunciada sem mover o foco de forma confusa |  |  |  |
| 7 | Reenvio | Ouvir o botão “Reenviar em mm:ss” | Estado desabilitado anunciado; o contador não interrompe a leitura a cada segundo |  |  |  |
| 8 | Senha | Preencher senha e confirmação; marcar “Mostrar senhas” | Requisitos lidos como lista; caixa “Mostrar senhas” com estado |  |  |  |
| 9 | Documento | Ativar “Termos de Uso” na lista “Documentos para aceitar” | Diálogo anunciado com o nome do documento; foco dentro; região “Texto: …” rolável por teclado; “Aceitar: …” e “Recusar: …” com nome completo; Esc fecha e devolve o foco ao link |  |  |  |
| 10 | Recusa | Recusar e ouvir o diálogo de alerta | “Sem os três aceites, sua conta não é ativada” anunciado como alerta com descrição; “Rever documentos” reabre o documento com foco dentro |  |  |  |
| 11 | Aceites | Aceitar os três e salvar a senha | Cada caixa anunciada como marcada; título “Conte um pouco sobre você” ao avançar |  |  |  |
| 12 | Dados | Preencher nome, região e uma intenção | Rótulos e dicas lidos; grupo “O que você procura no EventMatch?” |  |  |  |
| 13 | Interesses | Escolher menos de três e tentar continuar; depois escolher três | Contador “N interesses escolhidos · faltam X” anunciado (região viva); alerta ao tentar avançar com menos de três |  |  |  |
| 14 | Revisão | Ouvir o resumo e concluir | Lista de descrição lida em pares termo/valor; data de nascimento pedida de novo |  |  |  |
| 15 | Cancelar | Em qualquer etapa, ativar “Cancelar cadastro” e confirmar | Confirmação anunciada; ao cancelar, o início é carregado |  |  |  |
| 16 | Conclusão | Concluir o cadastro | Página “Cadastro concluído.” anunciada; nenhum dado pessoal lido |  |  |  |

## Cabeçalho do resultado (preencher a cada rodada)

| Campo | Valor |
|---|---|
| Data | |
| Pessoa que testou | |
| Leitor e versão | |
| Navegador e versão | |
| Sistema operacional | |
| Build/commit | |

## Achados

| # da linha | Leitor | O que foi anunciado | Gravidade | Correção/tarefa |
|---|---|---|---|---|
| | | | | |
