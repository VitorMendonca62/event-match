---
name: task-register
description: Registra uma nova demanda no `specs/tasks.txt` do EventMatch, preservando o formato canônico de TASK. Use quando o usuário pedir para criar, adicionar, registrar ou transformar uma demanda em task no backlog, incluindo objetivo, valor para a pessoa usuária, requisitos de origem e dependências, escopo, fora de escopo, critérios de aceite, situação para planejamento e estimativa inicial.
---

# Registrar tarefa no backlog SDD

Crie uma nova entrada no backlog do repositório, não apenas uma sugestão em conversa. Preserve as tarefas existentes e use `apply_patch` para editar `specs/tasks.txt`.

## Fluxo obrigatório

1. Leia `AGENTS.md` e `specs/tasks.txt` por completo o suficiente para identificar o formato, a maior numeração `TASK N` e tarefas relacionadas.
2. Leia os documentos e o código diretamente relacionados à demanda, quando existirem. Não invente requisitos, contratos, regras de negócio ou decisões arquiteturais.
3. Converta a demanda em uma única tarefa vertical. Se ela exceder complexidade Fibonacci 13, divida-a em tarefas independentes e explique a divisão.
4. Antes de editar, faça até cinco perguntas objetivas somente se uma lacuna impedir uma task responsável. Caso contrário, registre premissas e lacunas em `Situação para planejamento`.
5. Acrescente a tarefa nova no início de `specs/tasks.txt`, usando o próximo número inteiro disponível. Não renumere, reordene nem altere TASKs existentes sem pedido explícito.
6. Releia a entrada inserida e confirme que todos os campos obrigatórios existem, são consistentes e distinguem escopo de fora de escopo.

## Formato obrigatório

Use exatamente esta estrutura, com uma linha `---` após a tarefa:

```markdown
TASK <próximo número> — <título conciso e orientado a resultado>

Objetivo:
<capacidade ou resultado a entregar>

Valor para a pessoa usuária:
Como <persona>, quero <ação/resultado>, para <benefício observável>.

Requisitos de origem e dependências:
- <requisito, documento, decisão ou evidência de origem; usar `Pendente de definição` se ausente>
- <dependência real de TASK, contrato, decisão ou `Nenhuma`>

Escopo:
- <inclusão verificável>
- <inclusão verificável>

Fora de escopo:
- <limite explícito>

Critérios de aceite:
- <comportamento observável e testável>
- <comportamento observável e testável>

Situação para planejamento:
- <pronta para planejamento ou condição/bloqueio, com dúvidas, decisões ou ADRs necessários>

Estimativa inicial:
- Complexidade Fibonacci: <1|2|3|5|8|13>.
- Risco de deploy: <baixo|médio|alto>, por <motivo concreto>.

---
```

## Regras de qualidade

- Escreva em português e mantenha o vocabulário já usado em `specs/tasks.txt`.
- Descreva valor e aceite pelo efeito percebido; detalhes técnicos pertencem ao escopo somente quando necessários para delimitar o trabalho.
- Cite IDs de requisitos, ADRs, SDDs e TASKs apenas depois de verificá-los. Marque informações indisponíveis como `Pendente de definição`.
- Use dependências reais e diretas. Não introduza dependências de camada ou de conveniência.
- Declare na situação para planejamento decisões materiais ainda necessárias (por exemplo, arquitetura, persistência, contrato, segurança, privacidade, cache ou deploy) e ADRs correspondentes.
- Estime de forma relativa: 1/2 para ajuste delimitado, 3/5 para mudança pequena ou média, 8 para fluxo transversal, 13 para item que requer refinamento e divisão antes da execução. Não informe prazos.
- Não implemente código, crie ADRs, atualize documentação de produto ou altere outras tarefas ao registrar a demanda, salvo solicitação explícita.

## Entrega

Informe o número e o título da TASK criada, o caminho de `specs/tasks.txt` e quaisquer lacunas deixadas para o planejamento.
