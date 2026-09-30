# ADR-033: Adotar sessões autenticadas opacas e stateful

- **Status:** accepted
- **Data:** 2026-09-29
- **Decisores:** produto, segurança, backend e frontend
- **Relacionado:** `specs/sdd-013-autenticacao-sessao-primeiro-acesso/tasks.md`; ADR-014, ADR-016, ADR-021, ADR-022
- **Substitui/Substituído por:** N/A

## Contexto

O cadastro termina com uma `Account` ativa e uma credencial Argon2id, mas revoga a continuação do cadastro. Essa continuação autoriza apenas estágios do onboarding e não pode se transformar em sessão geral. O EventMatch precisa autenticar por e-mail e senha, manter até cinco sessões por conta, expirar e revogar cada sessão no servidor e reavaliar o estado da conta a cada uso.

O fluxo web não precisa expor credenciais ao JavaScript nem atender, nesta entrega, clientes móveis ou terceiros. A revogação imediata, o limite por inatividade e a invalidação futura por mudança de senha favorecem estado autoritativo no servidor.

## Drivers da decisão

- Separar autenticação geral da continuação de cadastro da ADR-021.
- Revogar logout, expiração e sessões excedentes sem aguardar a expiração de um JWT.
- Aplicar estado e capacidades atuais da conta a cada requisição.
- Não persistir token em claro nem dados de dispositivo desnecessários.
- Suportar múltiplas abas e até cinco dispositivos sem par access/refresh token.
- Manter domínio e aplicação independentes de NestJS, HTTP e Drizzle.

## Opções consideradas

1. **Token opaco único com sessão no PostgreSQL**, digest HMAC, expiração absoluta e por inatividade, rotação e revogação.
2. Access token JWT curto + refresh token rotativo — dois segredos e um fluxo adicional, embora revogação e estado da conta ainda exigissem consulta autoritativa.
3. Reutilizar a continuação do cadastro — rejeitado por misturar privilégios e violar o escopo da ADR-021.
4. Sessão apenas em memória do processo — rejeitada por perder estado em deploy e divergir entre réplicas.

## Decisão

Adotar a opção 1 em um novo bounded context `identity-access` (`IdentityAccessModule`). A aplicação expõe casos de uso de autenticar, resolver/autorizar sessão e encerrar sessão; o domínio contém a entidade de sessão e as políticas; a infraestrutura contém os adapters de PostgreSQL, HMAC, Argon2id e telemetria; a apresentação mapeia DTOs/Swagger e erros HTTP.

O browser recebe um segredo aleatório opaco de 32 bytes em base64url. O backend persiste somente seu digest HMAC, com chave exclusiva `AUTH_SESSION_SECRET`. Não existe access token JWT nem refresh token separado. A sessão contém, no mínimo:

- `id`, `account_id` e digest atual;
- digest anterior e prazo de graça somente durante rotação;
- `remembered`, `idle_timeout_seconds`, `created_at`, `last_seen_at`, `rotated_at`;
- `absolute_expires_at` e a política de inatividade aplicável.

Os dados físicos de conta, contato e credencial continuam sendo produzidos pelo cadastro. Suas definições Drizzle comuns podem ser movidas para infraestrutura compartilhada para que `registration` escreva o ciclo de vida e `identity-access` leia uma projeção de autenticação sem importar domínio ou adapters de outro contexto. `identity-access` é o único owner da nova tabela `authenticated_session`.

### Duração e atividade

| Modalidade | Expiração absoluta | Inatividade | Cookie |
|---|---:|---:|---|
| Padrão | 12 horas | 30 minutos | não persistente |
| “Manter conectado” | 30 dias | 7 dias | persistente até o limite absoluto |

Atividade autenticada renova apenas o prazo de inatividade. O limite absoluto nunca é estendido sem nova autenticação. `last_seen_at` é atualizado no máximo uma vez a cada cinco minutos, sem heartbeat que mantenha a sessão artificialmente ativa. O backend, não o cliente, decide ambos os prazos.

### Rotação, concorrência e múltiplos dispositivos

- O login sempre cria um novo segredo, sem aceitar identificador pré-autenticado, prevenindo fixation.
- Mudanças futuras de senha/privilégio devem rotacionar ou revogar conforme o caso.
- Sessões padrão de 12 horas não têm rotação periódica. Sessões com “Manter conectado” ficam elegíveis a rotação transparente a cada 24 horas.
- Somente o token atual pode iniciar uma rotação. Ela ocorre de forma atômica sob lock/compare-and-swap da sessão; se duas réplicas tentarem rotacionar, apenas uma vence e emite o novo segredo.
- O digest anterior vale por no máximo 60 segundos exclusivamente para concluir requisições concorrentes que começaram com a credencial anterior. Ele nunca inicia outra rotação nem recebe o token novo. A rotação, por si só, não atualiza `last_seen_at` e nunca estende inatividade ou expiração absoluta.
- Uma conta mantém no máximo cinco sessões ativas. O sexto login, sob lock da conta/sessões, remove a sessão válida menos recentemente usada antes de criar a nova.
- Logout remove/revoga a sessão no servidor. Reuso posterior do segredo falha.
- Sessões expiradas são inválidas mesmo antes da limpeza física. Logout e apresentação de sessão expirada removem a linha; autenticações executam limpeza oportunista e limitada das expiradas, sem tabela histórica de dispositivos.

Os valores são centralizados em política validada pelo `ConfigModule`; produção não inicia com prazos incoerentes, segredo ausente ou menos de 128 bits de entropia.

## Consequências positivas

- Revogação e expiração imediatas e autoritativas.
- Um único segredo no browser, sem payload com PII e sem refresh endpoint.
- Estado e restrições da conta podem ser reavaliados em todas as requisições.
- Concorrência entre réplicas e limite de sessões são resolvidos no PostgreSQL.
- A continuação do cadastro permanece isolada.

## Consequências negativas e riscos

- Cada requisição protegida faz leitura indexada no PostgreSQL; a atualização de atividade é amortizada em cinco minutos.
- A rotação transparente exige o BFF para atualizar o cookie, uma graça curta para abas concorrentes e testes de corrida entre réplicas.
- A limpeza é oportunista no MVP; baixo tráfego pode conservar linhas expiradas por mais tempo, embora nunca permaneçam autorizadas.
- O pool atual de uma conexão exige transações e locks curtos, sem I/O externo dentro da unidade de trabalho.

## Plano de adoção e rollback

Aplicar a migration `0006` antes do backend, com tabela e índices aditivos. Publicar o backend com `AUTH_HTTP_ENABLED=false`, validar contrato e concorrência e só então habilitar o BFF/UI. Rollback desliga a flag e o frontend; as tabelas ficam inertes. Se o rollback decorrer de incidente de segurança, revogar todas as sessões ativas antes de reabilitar a funcionalidade. Não fazer downgrade destrutivo da migration.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF008–RF011 e RNF004–RNF006
- `docs/03-modelos-de-dominio.md` (Account, credencial e continuação de cadastro)
- ADR-014, ADR-016 e ADR-021
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- NIST SP 800-63B, Session Management: https://pages.nist.gov/800-63-4/sp800-63b/session/
