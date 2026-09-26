# ADR-025: Adiar WhatsApp e publicar o cadastro somente por e-mail

- **Status:** accepted
- **Data:** 2026-09-26
- **Aceita em:** 2026-09-26
- **Decisores:** produto, frontend, backend e operação
- **Relacionado:** `specs/sdd-009-api-http-entrega-verificacao-cadastro/tasks.md`; ADR-010, ADR-020, ADR-024; TASK 07
- **Substitui/Substituído por:** substitui parcialmente ADR-010 e ADR-024 quanto à ativação inicial do WhatsApp

## Contexto

As ADRs 010 e 024 previram Resend e WhatsApp Cloud API na primeira implementação. O MVP publicado ainda não terá conta, telefone, template nem credenciais operacionais da Meta. Manter WhatsApp selecionável com um adapter `noop` faria a pessoa iniciar um fluxo que nunca entrega o OTP.

## Opções consideradas

1. **Publicar somente e-mail e mostrar WhatsApp desabilitado com o texto “Em breve”.**
2. Expor WhatsApp ligado ao `noop` — rejeitado porque responde sem entregar e deixa o cadastro sem saída.
3. Remover toda referência ao WhatsApp — rejeitado porque esconde uma capacidade futura já decidida pelo produto.
4. Implementar a Cloud API agora — adiado por depender de configuração operacional que não faz parte desta etapa.

## Decisão

Adotar a opção 1. Na SDD-009, o contrato HTTP publicado de criação de desafio aceita somente `channel = email`. `whatsapp` é rejeitado pela validação do DTO, antes do caso de uso e sem escrita, envio ou consumo de cota. A adição futura de `whatsapp` será compatível e exige nova tarefa que reavalie a parte adiada das ADRs 010 e 024.

O `NoopVerificationDeliveryAdapter` pode continuar em testes automatizados e desenvolvimento local explicitamente configurado, mas nunca deve simular sucesso de WhatsApp em ambiente publicado. Produção liga somente o adapter oficial do Resend e falha cedo se a configuração de e-mail estiver incompleta.

Na TASK 07, a interface mostra e-mail como única opção selecionável. WhatsApp permanece visível, desabilitado e acompanhado do texto “Em breve”, com semântica acessível por teclado e leitor de tela. Não solicita telefone nem consentimento enquanto estiver indisponível.

## Consequências positivas

- Remove credenciais e templates da Meta do caminho crítico da primeira entrega.
- Evita resposta falsa de sucesso e cadastro preso sem OTP.
- Preserva a intenção de produto sem introduzir integração insegura ou incompleta.

## Consequências negativas e riscos

- O MVP publicado cadastra somente por e-mail e ainda não atende o canal de celular previsto no DER.
- A interface precisa comunicar indisponibilidade sem parecer erro ou opção interativa.
- A ativação futura exige adapter real, configuração Meta, testes e nova revisão de rollout.

## Plano de adoção e rollback

Restringir o DTO/OpenAPI a e-mail, compor somente Resend no ambiente publicado e testar que WhatsApp é rejeitado sem efeitos. A TASK 07 renderiza o controle desabilitado. Rollback visual remove temporariamente o item WhatsApp; nunca habilita o `noop` em produção.

## Evidências e referências

- ADR-010, ADR-020 e ADR-024
- `specs/tasks.txt`, TASK 06 e TASK 07
- `NoopVerificationDeliveryAdapter` existente na fundação do cadastro
