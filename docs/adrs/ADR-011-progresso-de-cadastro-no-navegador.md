# ADR-011: Reter progresso mínimo e versionado do cadastro no navegador

- **Status:** accepted
- **Data:** 2026-09-25
- **Decisores:** produto, frontend, privacidade e segurança
- **Relacionado:** `specs/sdd-006-modelagem-conceitual-cadastro/tasks.md`
- **Substitui/Substituído por:** N/A

## Contexto

RF007 e a Task 03 exigem recuperar cadastro interrompido. RNF009 pede onboarding curto; RNF002, RNF003, RNF004 e RNF017 exigem não expor contato, OTP, segredo ou informações privadas.

## Decisão proposta

Persistir em `sessionStorage` apenas versão do formulário, etapa atual, nome de exibição, cidade/região, intenção de uso, interesses selecionados e campos opcionais já preenchidos. Não persistir senha, confirmação, OTP, token de verificação, nascimento completo, identificador de contato, aceites autenticados nem respostas do backend. O estado terá versão, TTL deslizante máximo de 30 minutos desde a última atualização, limpeza em conclusão/cancelamento e invalidação por schema; a fonte de verdade é o backend quando existir registro provisório.

## Opções consideradas

1. Estado local mínimo/versionado com TTL — proposto; melhora retomada sem transformar o navegador em repositório de dados sensíveis.
2. Salvar todo o formulário em localStorage — rejeitado por exposição de PII/segredos.
3. Não salvar estado local — piora retomada e UX em abandono breve.

## Consequências

- Client Components futuros aplicam `client-localstorage-schema`; RSC não usa estado mutável de requisição.
- A lista permitida é etapa atual, nome de exibição, cidade/região, intenção, interesses e campos opcionais; a futura interface informa que o cadastro deve ser recomeçado após expiração ou incompatibilidade.

## Condições de aceitação

O estado é apagado em conclusão, cancelamento, expiração e mudança incompatível do schema. A lista de campos permitidos e a experiência pós-expiração estão definidas nesta ADR.
