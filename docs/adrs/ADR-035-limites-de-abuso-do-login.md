# ADR-035: Aplicar limites independentes por contato e origem ao login

- **Status:** accepted
- **Data:** 2026-09-29
- **Decisores:** produto, segurança, backend e operação
- **Relacionado:** `specs/sdd-013-autenticacao-sessao-primeiro-acesso/tasks.md`; ADR-014, ADR-015, ADR-023
- **Substitui/Substituído por:** N/A

## Contexto

Login por e-mail e senha está sujeito a força bruta, password spraying e credential stuffing. Um limite apenas por contato pode ser contornado distribuindo contatos; um limite apenas por origem pode ser contornado com proxies e bloquear redes compartilhadas. A resposta também não pode revelar se o e-mail existe ou se a conta está impedida de receber sessão comum.

## Drivers da decisão

- Duas barreiras independentes, aplicadas entre réplicas.
- Contar contatos inexistentes da mesma forma que existentes e não penalizar logins bem-sucedidos.
- Não persistir e-mail ou IP em claro.
- Não criar bloqueio permanente nem fluxo de desbloqueio fora do escopo.
- Evitar rajadas de 2× na fronteira de janelas fixas.
- Telemetria útil sem PII, senha, hash de senha ou motivo privado.

## Opções consideradas

1. **Janela deslizante exata em PostgreSQL**, com buckets independentes por contato protegido e fingerprint de origem.
2. Janela fixa — mais simples, mas permite rajada na fronteira.
3. Contador apenas em memória — diverge entre réplicas e reinicia em deploy.
4. Redis/token bucket — bom para escala, mas introduz infraestrutura e decisão de fail-open/fail-closed desnecessárias no MVP.
5. Bloqueio permanente da conta — rejeitado por facilitar negação de serviço e exigir recuperação fora do escopo.

## Decisão

Adotar a opção 1 com os limites confirmados pelo produto:

| Escopo | Limite | Janela |
|---|---:|---:|
| Contato normalizado protegido por HMAC | 5 falhas | 15 minutos deslizantes |
| Fingerprint de origem autenticada pelo BFF | 30 falhas | 15 minutos deslizantes |

Os buckets são independentes; ambos precisam permitir a tentativa. Nunca usar uma chave combinada `origem+contato`. O contato usa HMAC com domínio separado e a origem usa a fingerprint da ADR-023; nenhum valor legível é persistido.

A migration `0006` cria `authentication_attempt` com `scope`, `subject_hash`, `attempted_at` e índices por sujeito/tempo. O adapter serializa consumo por sujeito com lock transacional, remove as linhas daquele sujeito anteriores à janela, conta e insere de forma atômica. Locks dos dois escopos seguem ordem fixa para evitar deadlock. Toda submissão de login válida em forma reserva uma tentativa nos dois buckets antes de consultar a conta ou verificar a senha, inclusive para contatos inexistentes, o que mantém o limite estrito sob concorrência. Se a autenticação for bem-sucedida, a reserva é liberada na mesma unidade de trabalho e **sucessos não consomem os limites**; falhas (contato inexistente, senha incorreta, estado sem permissão) mantêm a reserva. Assim, logins legítimos repetidos ou em vários dispositivos não são bloqueados, e o padrão de consumo de falhas é idêntico para contatos existentes e inexistentes. Limpeza oportunista limitada remove tentativas antigas.

Enquanto abaixo do limite, contato inexistente, senha incorreta e estado sem permissão retornam o mesmo `401` e o mesmo envelope. Ao atingir qualquer bucket, todas as contas recebem `429` com corpo genérico, sem informar escopo, tentativas restantes ou instante exato de liberação. A UI pode pedir que a pessoa aguarde e tente novamente, mas não exibe `Retry-After` preciso. A janela se libera automaticamente; não há bloqueio permanente.

O caminho de conta inexistente executa uma verificação Argon2id contra hash dummy válido para reduzir diferença de custo em relação a uma credencial real. Erros internos não são convertidos em falha de credencial. Telemetria registra somente operação, resultado agregado (`success`, `rejected`, `rate_limited`), duração, correlation id e, no limite, o escopo acionado; não registra e-mail, fingerprint, senha, hash, cookie, body ou estado privado.

## Consequências positivas

- Cobre ataque concentrado e varredura por uma origem.
- Resposta e consumo são equivalentes para contatos existentes e inexistentes.
- Consistência entre réplicas sem nova infraestrutura.
- Sem bloqueio permanente ou recuperação adicional.

## Consequências negativas e riscos

- Duas reservas (e a liberação em sucesso) por submissão aumentam escrita no PostgreSQL.
- Qualquer pessoa ainda pode bloquear temporariamente o contato de outra com 5 falhas; risco aceito, mitigado pela janela automática.
- Proxies distribuídos ainda podem contornar o limite por origem; o limite por contato continua protegendo alvos individuais.
- Redes compartilhadas podem atingir 30 tentativas; a janela temporária e a mensagem genérica mitigam o impacto.
- Advisory locks precisam de teste concorrente com dois pools.

## Plano de adoção e rollback

Criar tabela aditiva com a migration de sessão. Habilitar junto com o endpoint de login; nunca publicar login sem ambos os buckets ativos. Rollback desliga o endpoint e mantém a tabela. Métricas de `rate_limited` orientam ajuste futuro por nova ADR; não alterar limites silenciosamente.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md` RF008 e RNF004
- ADR-014, ADR-015 e ADR-023
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Credential Stuffing Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html
- OWASP Bot Management and Anti-Automation Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Bot_Management_and_Anti-Automation_Cheat_Sheet.html
