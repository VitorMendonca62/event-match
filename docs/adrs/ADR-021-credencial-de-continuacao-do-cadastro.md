# ADR-021: Autorizar a continuação do cadastro com token opaco persistido

- **Status:** accepted
- **Data:** 2026-09-26
- **Aceita em:** 2026-09-26
- **Decisores:** segurança, privacidade, backend e frontend
- **Relacionado:** `specs/sdd-009-api-http-entrega-verificacao-cadastro/tasks.md`; ADR-014, ADR-016, ADR-017, ADR-019, ADR-020, ADR-022
- **Substitui/Substituído por:** N/A

## Contexto

UUIDs de desafio, cadastro e conta identificam registros, mas não provam autorização. O fluxo precisa atravessar várias requisições, suportar retomada e impedir que um id descoberto permita consultar ou alterar outro cadastro.

## Opções consideradas

1. **Token aleatório opaco com digest no PostgreSQL**, sessão por estágio, rotação e revogação.
2. JWT assinado e stateless — evita tabela, porém dificulta revogação, rotação e invalidação por estágio.
3. Usar ids como segredo — rejeitado; mistura identificação e autorização e amplia impacto de vazamento.

## Decisão

Adotar a opção 1. Gerar 32 bytes por CSPRNG, expor em base64url apenas ao BFF e persistir somente HMAC/digest com `REGISTRATION_FLOW_SECRET` separado. A sessão registra estágio e FKs internas opcionais, nunca nascimento, contato, OTP ou senha.

TTLs acompanham o recurso: `age_eligible` 30 min, desafio 15 min, registro 24 h e conta incompleta 15 dias. Rotacionar nas mudanças de privilégio; manter digest anterior por no máximo 60 s exclusivamente para repetir a requisição idempotente que causou a rotação, com a mesma `Idempotency-Key` e o mesmo hash de payload. O token anterior não autoriza operação nova. Em uma recuperação válida, o backend não repete o efeito de negócio e emite de forma atômica uma nova continuação recuperável. Revogar/anular digests em conclusão, cancelamento e expiração.

Criar `registration_flow_session` e `registration_idempotency` conforme SDD-009 §4. A idempotência guarda somente hash da chave/payload e resposta pública segura; uma chave repetida com payload diferente falha. O guard recebe `Authorization: Bearer`, resolve/locka a sessão no caso de uso e nunca registra credencial.

## Consequências

- Autorização revogável e auditável por etapa, sem expor ids.
- Nova migration, novo segredo e escrita adicional por comando.
- Pool de uma conexão é preservado; locks e transações permanecem curtos.
- A recuperação do token anterior exige correlação estrita com a idempotência e serialização por lock; acrescenta complexidade, mas reduz a superfície de replay da janela de 60 s.
- Exclusão física de sessões/idempotência fica para job futuro; expiração anula digests.

## Plano de adoção e rollback

Migration forward aditiva antes do deploy. Rollback da aplicação ignora tabelas; forward fix remove/ajusta objetos somente após revisão. Perda do segredo invalida retomadas, mas não expõe dados; rotação multi-chave fica fora desta task.

## Evidências e referências

- RNF002–RNF004
- ADR-014, ADR-016 e ADR-017
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
