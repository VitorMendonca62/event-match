# Task: Modelar conceitualmente o cadastro

- **Slug:** modelagem-conceitual-cadastro
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-25
- **Status:** ready
- **Versão-alvo:** 0.7.0
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A Task 03 de `specs/tasks.txt` pede a modelagem conceitual do cadastro antes da implementação. A fonte funcional é o DER v1.3: RF001–RF007, RF059, RN001–RN016, RNF003–RNF004, RNF009–RNF010 e RNF017–RNF021. O modelo atual em `docs/03-modelos-de-dominio.md` já define `Account`, `Profile` e `Catalog`, mas ainda não detalha o agregado de cadastro, OTP, bloqueio, transições e recuperação do progresso.

O DER obriga maioridade, ao menos um contato confirmado, senha válida, aceites versionados e no mínimo três interesses. Ele não define os valores e escolhas de segurança necessários para transformar esses princípios em um fluxo implementável; por isso este plano permanece bloqueado.

## 2. Escopo

Inclui:

- documentar o agregado conceitual `Registration`, seus value objects e sua relação futura com `Account`, `Profile`, `ContactIdentifier`, `ContactVerification`, `OtpChallenge`, `TermsAcceptance`, `Interest` e `RegistrationProgress`;
- produzir diagrama de relacionamentos e máquina de estados do cadastro em `docs/03-modelos-de-dominio.md` após as decisões pendentes;
- definir contratos conceituais front/back, sem endpoints, DTOs, OpenAPI ou tipos de código;
- planejar persistência futura com Drizzle/PostgreSQL, chaves, unicidade parcial, transações, migrations e catálogo inicial de interesses;
- propor ADRs para decisões materiais de cadastro, OTP, canais externos e progresso local;
- definir estratégia de testes futura.

Exclui:

- código de produção, schema Drizzle, migrations, seeds, providers, adapters, repositórios, endpoints, DTOs, telas e componentes;
- aceite automático de ADRs;
- política jurídica final de retenção, cópia ou documentos excepcionais.

## 3. Impacto Arquitetural e ADRs

```text
Browser (RSC + Client Components apenas para o formulário)
  -> estado local mínimo e versionado do progresso
  -> NestJS / bounded context Registration
      presentation -> application use cases -> domain ports
                                       <- PostgreSQL/Drizzle adapters
                                       <- e-mail/WhatsApp verification adapters

PostgreSQL: Registration provisório -> transação de conclusão -> Account + Profile
```

O frontend não acessará PostgreSQL. Futuras telas usarão RSC por padrão; a parte interativa limita os dados serializados e aplica `client-localstorage-schema`, `server-no-shared-module-state`, `server-serialization`, `async-cheap-condition-before-await` e `async-parallel` quando aplicáveis. No backend, casos de uso, portas e regras permanecem independentes de NestJS, Drizzle, `pg` e HTTP; controllers futuros usam DTOs `class-validator`, `ValidationPipe`, Swagger e DI por construtor.

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Agregado, persistência e conclusão do cadastro | `docs/adrs/ADR-008-modelagem-e-persistencia-do-cadastro.md` | accepted | Define ownership, transação e primeira migration. |
| OTP, tentativas e bloqueio | `docs/adrs/ADR-009-otp-e-bloqueio-de-verificacao.md` | accepted | Define controles de abuso e antienumeração. |
| Canais de e-mail e WhatsApp | `docs/adrs/ADR-010-integracao-de-verificacao-de-contato.md` | accepted | Define portas e limites de provedores externos. |
| Progresso temporário no navegador | `docs/adrs/ADR-011-progresso-de-cadastro-no-navegador.md` | accepted | Define dados locais, privacidade e expiração. |
| Conteúdo e registro de aceites | `docs/adrs/ADR-012-conteudo-e-registro-de-aceites-do-cadastro.md` | accepted | Separa placeholder de consentimento jurídico efetivo. |

Todos os ADRs devem ser aceitos e as perguntas abaixo respondidas antes da implementação.

## 4. Contratos e Interfaces

Contratos conceituais futuros, sem definição de transporte:

```text
StartRegistration(contact: EmailAddress | PhoneNumber) -> RegistrationSnapshot
RequestContactVerification(registrationId, channel) -> VerificationDeliveryResult
VerifyContact(registrationId, otp) -> RegistrationSnapshot
SaveRegistrationStep(registrationId, data) -> RegistrationSnapshot
CompleteRegistration(registrationId) -> AccountId
```

- `RegistrationSnapshot` não expõe conta existente, destino completo, OTP, segredo, razão de bloqueio ou detalhes do provedor.
- A resposta pública para contato associado, OTP inválido, expirado ou bloqueado é neutra, respeitando RNF004.
- A solicitação de contato cria um desafio técnico de verificação; após OTP validado e senha informada, cria-se o `Registration` provisório. A `Account` é persistida quando os dados obrigatórios forem preenchidos, com estado de cadastro incompleto até cumprir nascimento, aceites e interesses.
- O fluxo é `verification_pending` → `registration_in_progress` → `account_incomplete` → `active`, com `expired` para abandono. Conta incompleta só retoma cadastro; não acessa eventos, perfil público ou recursos do produto. `Registration` expira após 24 horas sem atualização; conta incompleta é removida após 15 dias sem atualização e libera o contato.
- E-mail oferece OTP e link de verificação; celular usa WhatsApp no Brasil. Contato já associado recebe instruções de recuperação pelo mesmo canal, sem confirmar a existência da conta.
- O progresso local usa apenas `sessionStorage`, com schema versionado e TTL deslizante máximo de 30 minutos desde a última atualização; contém somente campos não sensíveis aprovados.
- Documentos lorem ipsum não constituem termos, política ou regras válidos e não podem gerar um aceite jurídico efetivo; a definição de conteúdo, versão e retenção permanece pendente.
- A conclusão ocorre em transação: valida estado, idade, contato confirmado, senha, aceites e três interesses; ativa `Account`, cria/completa `Profile`, associa interesses e registra aceites de forma atômica.
- Mapeamento físico futuro: identificadores opacos; email/celular normalizados e protegidos; unicidade parcial por contato confirmado em conta ativa; `account_interest` com chave composta; aceites versionados e imutáveis; desafios OTP com hashes, expiração e contadores, nunca código em texto.
- A primeira migration do bounded context cria somente os objetos aprovados, é revisada via Drizzle Kit e usa rollout expand/contract. Não há migration nesta tarefa.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Maioridade é requisito de conta. | Cadastro só conclui com 18 anos completos; nascimento não é público. | RF001, RN001, RN009 |
| 2 | Um contato confirmado é exigido. | Verificação bem-sucedida torna o contato elegível, sem confirmar existência de outra conta ao solicitante. | RF002, RN002–RN005, RNF004 |
| 3 | Senha, dados básicos e aceites são obrigatórios. | Conclusão valida senha, nome, região, intenção e versões dos três aceites. | RF003–RF005, RN004, RN006–RN007 |
| 4 | Perfil exige interesses mínimos. | Onboarding não conclui com menos de três interesses ativos. | RF006, RN008, RN147–RN149 |
| 5 | O fluxo deve ser curto e claro. | Progresso interrompido poderá ser retomado sem salvar segredo, OTP ou nascimento no navegador. | RF007, RNF009–RNF010 |
| 6 | Aceites precisam ser versionados. | Placeholder pode testar a interação de leitura, mas só conteúdo aprovado poderá gerar aceite efetivo. | RF005, RNF008, RNF025 |

## 6. Critérios de Aceitação

- `docs/03-modelos-de-dominio.md` terá entidades, diagrama e transições de cadastro após as respostas bloqueantes.
- Nenhum contato, OTP, senha, nascimento ou sinal de existência de conta aparecerá em logs, estado local ou resposta pública indevida.
- Estados, retornos permitidos/bloqueados, persistência definitiva e recuperação estarão especificados sem ambiguidade.
- A persistência futura terá ownership, chaves, constraints, transação, migration, seed de interesses e rollback documentados.
- Integrações usarão portas outbound, timeout, retry limitado, idempotência, observabilidade segura e fallback definido.
- Futuras interfaces atenderão teclado, leitor de tela, zoom 200%, feedback não dependente de cor e os IDs Vercel citados na seção 3.

## 7. Plano de Testes

- Domínio: maioridade, normalização de contato, senha, transições, aceites, mínimo de interesses e bloqueio OTP.
- Aplicação: idempotência, antienumeração, conclusão atômica, conflitos de unicidade e recuperação de progresso.
- Integração: PostgreSQL real/descartável para constraints, transações e migration; doubles contratuais para e-mail/WhatsApp, timeout e falha de provedor.
- Contrato: snapshots dos contratos NestJS e BFF futuro; respostas neutras para conflito/OTP.
- E2E: cadastro por e-mail e celular, retomada interrompida, acessibilidade por teclado/leitor e bloqueio temporário.
- Comandos após implementação: `bun run --cwd front lint`, `typecheck`, `test`, `build`; `bun run --cwd back lint`, `typecheck`, `test`, `test:e2e`, `build` e `db:migrate` após revisão da migration.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---:|---:|---|
| Enumeração de contas por contato ou OTP | média | alto | Respostas neutras, rate limit e auditoria segura. |
| Tentativas excessivas ou custo de mensagens | alta | alto | Parâmetros explícitos de TTL, reenvio e bloqueio; limite por identificador/origem. |
| Falha ou atraso de provedor externo | média | médio | Porta, timeout, idempotência, retry limitado e mensagem segura. |
| Persistir dados sensíveis no navegador | média | alto | Estado local mínimo/versionado, TTL e exclusão de segredo/PII sensível. |
| Migração bloquear ou violar unicidade | baixa | alto | Migration revisada, índice/constraint e rollout expand/contract. |

Rollout: aceitar ADRs, detalhar documento conceitual, implementar vertical slice em feature flag se necessário, aplicar migration revisada em job único e monitorar entregas/erros agregados.

Rollback: desabilitar fluxo/feature flag e reimplantar API anterior; migrations futuras adotam forward fix e não executam `down` destrutivo automaticamente.

## 9. Perguntas em Aberto (bloqueantes)

- [x] Fluxo: contato → OTP → senha → dados obrigatórios → aceites e nascimento → interesses → onboarding de campos opcionais. Estados: `verification_pending` → `registration_in_progress` → `account_incomplete` → `active`, ou `expired`. Conta incompleta só retoma cadastro; `Registration` expira após 24 horas e conta incompleta é removida após 15 dias sem atualização, liberando o contato. Registrado na ADR-008 aceita.
- [x] OTP: validade de 15 minutos; cinco tentativas inválidas; bloqueio de 20 minutos; reenvio após 60 segundos, no máximo três por contato/hora; cinco desafios por contato/hora e dez por origem/IP/hora. Registrado na ADR-009 aceita.
- [x] E-mail oferece OTP e link por Resend; celular usa WhatsApp Cloud API direta da Meta no Brasil, sem SMS de fallback. Timeout de cinco segundos, até duas novas tentativas transitórias e uma chave de idempotência por desafio/entrega. Contato associado recebe recuperação no mesmo canal, com consentimento explícito para o envio transacional por WhatsApp. Registrado na ADR-010 aceita.
- [x] Para contato associado, o fluxo neutro oferece recuperação no mesmo canal, sem revelar a conta.
- [x] Lorem ipsum será usado exclusivamente em testes de interface, com rolagem completa antes de habilitar a ação; não habilita cadastro real nem gera aceite efetivo. Termos, política e regras definitivos serão criados posteriormente com respaldo jurídico, antes de lançamento ou aceite efetivo.
- [x] O progresso local usa `sessionStorage` para etapa atual, nome de exibição, cidade/região, intenção, interesses e campos opcionais, com TTL deslizante de no máximo 30 minutos sem atualização; será apagado em conclusão, cancelamento, expiração e incompatibilidade de versão. Registrado na ADR-011 aceita.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos conceitualmente.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices` e `nestjs-expert` foram aplicadas conforme o escopo.
- [x] Testes, migration e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.
