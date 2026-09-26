# ADR-014: Proteger contatos, códigos de verificação e senhas em repouso

- **Status:** accepted
- **Data:** 2026-09-25
- **Aceita em:** 2026-09-26
- **Decisores:** segurança, privacidade e backend
- **Relacionado:** `specs/sdd-007-persistencia-postgresql-cadastro/tasks.md`; ADR-004, ADR-009, ADR-010
- **Substitui/Substituído por:** parcialmente substituída pela ADR-018 (somente a origem da lista de senhas comuns)

## Contexto

O cadastro precisa: buscar e garantir unicidade de contato normalizado; enviar mensagens (verificação e recuperação neutra) ao contato completo; validar OTP/link sem persisti-los em claro; guardar senha. RN009 e RNF004 proíbem exposição de contato; a Task 04 proíbe PII em logs e artefatos de teste.

## Drivers da decisão

- Unicidade e busca por igualdade sem armazenar contato em claro.
- Possibilidade de reenviar/recuperar pelo mesmo canal.
- Resistência a vazamento de dump do banco.
- Domínio e aplicação independentes de crypto de runtime.
- Sem nova dependência quando o runtime já oferece o primitivo.

## Opções consideradas

1. Contato em claro normalizado com `UNIQUE` parcial — simples, maior exposição em dump.
2. **Índice cego HMAC-SHA-256 + contato cifrado AES-256-GCM** — busca/unicidade pelo HMAC; texto recuperável só pela aplicação.
3. Somente hash do contato — impede recuperação/entrega pelo mesmo canal após a verificação.

## Decisão

Adotar a opção 2, confirmada pelo produto em 2026-09-25:

- `ContactIdentifier` (domínio) normaliza: e-mail com trim + lowercase do domínio e da parte local (sem remover pontos/`+`); celular em E.164, restrito a `+55` no MVP.
- Porta `ContactProtectorPort` (`blindIndex(contact)`, `seal(contact)`, `open(sealed)`); adapter com `node:crypto` em `infrastructure/security`.
- Colunas `contact_hash bytea` (HMAC-SHA-256 com `CONTACT_HASH_KEY`) e `contact_ciphertext bytea` (AES-256-GCM, nonce aleatório, `key_version smallint`) com `CONTACT_ENCRYPTION_KEY`. Nenhuma coluna com contato em claro.
- OTP de 6 dígitos gerado por CSPRNG; token de link com 32 bytes. Persistidos apenas como HMAC-SHA-256 com `VERIFICATION_SECRET_KEY` e comparados em tempo constante.
- Senha com Argon2id via `Bun.password` no adapter `PasswordHasherPort`; parâmetros registrados com o hash. O value object `Password` valida apenas as regras estruturais RN006/RN007 (mínimo 8 e não somente espaços). O caso de uso consulta `CommonPasswordCheckerPort` antes de persistir; domínio/aplicação não leem arquivo diretamente. O adapter de infraestrutura carrega uma única vez, na inicialização, `back/src/modules/registration/infrastructure/security/data/common-passwords.txt` (UTF-8, uma senha por linha, minúsculas) em um `Set`; a comparação ignora caixa. O arquivo será uma cópia local da lista `Passwords/Common-Credentials/10-million-password-list-top-10000.txt` do SecLists, fixada na release `2026.1`, sob licença MIT. Na adoção, remover linhas vazias, converter para minúsculas, deduplicar, registrar a origem/licença e o SHA-256 do artefato normalizado; atualizações futuras exigem mudança explícita da versão e revisão do diff. Testes usam lista própria reduzida.
  - **Substituído pela ADR-018 (2026-09-26):** o caminho acima não existe na release `2026.1`. A fonte vigente é `Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt`, filtrada para 8+ caracteres; origem, licença, normalização e SHA-256 estão em `back/src/modules/registration/infrastructure/security/data/SOURCE.md`.
- Chaves: variáveis de ambiente validadas por Zod (mínimo 32 bytes em base64), obrigatórias em `production`, nunca logadas; rotação por `key_version` documentada, sem reprocessamento nesta task.
- Logs e erros usam apenas `contact_channel`, ids opacos e códigos seguros.

## Consequências positivas

- Dump do banco não revela contatos, OTP, tokens nem senhas.
- Unicidade continua garantida pelo PostgreSQL via `contact_hash`.

## Consequências negativas e riscos

- Perda de `CONTACT_ENCRYPTION_KEY` impede contato com as pessoas; exige cofre/backup de segredo.
- Rotação da chave HMAC exige recálculo de índice; fora do escopo.
- Três novos segredos no ambiente e no `.env.example`.

## Plano de adoção e rollback

Adicionar chaves ao schema Zod com mensagens sem valores; testes com chaves geradas por teste. Rollback: API anterior ignora as tabelas; dados cifrados permanecem legíveis enquanto as chaves forem preservadas.

## Evidências e referências

- DER RN002–RN003, RN006–RN007, RN009, RNF002–RNF004
- ADR-004, ADR-009, ADR-010
- SecLists release `2026.1`: https://github.com/danielmiessler/SecLists/releases/tag/2026.1
- Lista de origem (original, substituída pela ADR-018; o caminho não existe na release `2026.1`): https://github.com/danielmiessler/SecLists/blob/2026.1/Passwords/Common-Credentials/10-million-password-list-top-10000.txt
- Lista de origem vigente (ADR-018): https://github.com/danielmiessler/SecLists/blob/2026.1/Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt
- Licença MIT do SecLists: https://github.com/danielmiessler/SecLists/blob/2026.1/LICENSE
