# Task: Alinhar documentação ao DER do EventMatch

- **Slug:** alinhar-documentacao-der-eventmatch
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-21
- **Status:** ready
- **Versão-alvo:** 0.3.0
- **Tipo:** docs
- **Impacto público:** none

## 1. Contexto e Motivação

O DER EventMatch MVP v1.3 foi adicionado com 107 RFs, 168 RNs e 25 RNFs. Os documentos `docs/01–04` ainda eram genéricos. Origem: `specs/tasks.txt` e `docs/DER-EventMatch-MVP.md`.

## 2. Escopo

Inclui contexto, atores, bounded contexts propostos, invariantes, agregados, classificação/retenção de dados, grupos de API, integrações, segurança, observabilidade e ressalva jurídica. Exclui código, schema físico, endpoints definitivos, ORM e escolha de provedores.

## 3. Impacto Arquitetural e ADRs

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Contextos de domínio do EventMatch | `docs/adrs/ADR-002-contextos-de-dominio-eventmatch.md` | proposed | Organizar o amplo escopo sem antecipar schema físico. |

O ADR deve ser aceito antes do scaffolding dos módulos de produção. Esta tarefa altera apenas documentação.

## 4. Contratos e Interfaces

Documentar grupos de capacidades da API NestJS, OpenAPI como contrato, BFF opcional, audiências, integrações e limites de upload, sem fixar paths ou DTOs finais.

## 5. Regras de Negócio

| Área | Após a mudança | Origem |
|---|---|---|
| Conta/perfil | invariantes de idade, contatos, privacidade e recuperação rastreadas | DER §2–3.1, §3.7–3.8 |
| Eventos/participação | estados, capacidade, reconfirmação, recusa e vaga rastreados | DER §3.2–3.4, §3.13 |
| Conversa/segurança | acesso, moderação, denúncia, bloqueio e retenção rastreados | DER §3.5–3.8 |
| Operação | papéis, conflito, auditoria e catálogos rastreados | DER §3.10–3.12 |

## 6. Critérios de Aceitação

- `docs/01–04` citam o DER como fonte funcional.
- RFs/RNs/RNFs são cobertos por agrupamentos rastreáveis, sem reescrever o DER integralmente.
- Ressalvas jurídicas são visíveis em arquitetura, negócio, dados e integrações.
- Nenhuma escolha de ORM, provedor ou endpoint definitivo é inventada.

## 7. Plano de Testes

- Verificar presença dos intervalos RF001–RF107, RN001–RN168 e RNF001–RNF025 no DER.
- Conferir links e referências documentais.
- Buscar afirmações antigas de ausência de regras/modelos.
- Lint/build/test não se aplicam: somente Markdown, sem manifests.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Resumo perder nuance | média | alto | DER permanece canônico; citar intervalos e seções. |
| Política de retenção juridicamente inadequada | média | alto | marcar bloqueio jurídico em todos os documentos afetados. |
| Contextos inadequados | média | médio | ADR-002 permanece `proposed` até revisão. |

## 9. Perguntas em Aberto (bloqueantes)

Nenhuma para sincronização documental. Parecer jurídico e aceitação do ADR-002 bloqueiam decisões finais/implementação correspondente, não esta atualização.

## 10. Checklist de Conformidade

- [x] Decisões citam DER, docs e ADR.
- [x] ADR-002 criado como `proposed`.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos e dados estão descritos conceitualmente.
- [x] Segurança, performance, acessibilidade e observabilidade foram tratadas.
- [x] Ressalvas jurídicas estão explícitas.
