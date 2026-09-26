# ADR-018: Fixar a lista de senhas comuns e distinguir conversão de expiração do cadastro

- **Status:** accepted
- **Data:** 2026-09-26
- **Aceita em:** 2026-09-26
- **Decisores:** produto, segurança e backend
- **Relacionado:** `specs/sdd-007-persistencia-postgresql-cadastro/tasks.md`; ADR-008, ADR-013, ADR-014, ADR-017
- **Substitui/Substituído por:** substitui parcialmente a ADR-014 (somente a origem da lista de senhas comuns) e complementa a ADR-013 (estados físicos de `registration`)

## Contexto

A revisão de código da SDD-007 encontrou duas divergências:

1. A ADR-014 fixou a lista `Passwords/Common-Credentials/10-million-password-list-top-10000.txt` do SecLists `2026.1`, mas esse caminho não existe nessa release. O artefato versionado em `back/src/modules/registration/infrastructure/security/data/common-passwords.txt` corresponde, após normalização, a `Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt` filtrada para senhas com 8 ou mais caracteres. Origem, licença e SHA-256 não estavam registrados.
2. `SaveRequiredData` encerrava o `Registration` convertido em `Account` com `status = 'expired'`, o mesmo estado usado para abandono após 24 h. Isso confunde auditoria e métricas de abandono.

## Decisão

### Lista de senhas comuns

- Fonte: SecLists release `2026.1`, `Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt`, licença MIT.
- Normalização: remover `\r` e linhas vazias, converter para minúsculas, deduplicar preservando a ordem e manter apenas entradas com 8 ou mais caracteres (as menores já são recusadas pelo value object `Password`).
- Proveniência, licença e SHA-256 do artefato normalizado ficam em `back/src/modules/registration/infrastructure/security/data/SOURCE.md`. Atualizações exigem nova versão da fonte e revisão do diff.
- O build copia o arquivo para `dist/`, pois o adapter o carrega em tempo de execução.

### Conversão do cadastro

- `registration.status` passa a aceitar `converted`, além de `registration_in_progress` e `expired`.
- `converted` é terminal: o `Registration` virou `Account` na mesma transação de `SaveRequiredData`. Contato cifrado, índice cego e hash de senha são anulados, pois passam a pertencer a `account_contact` e `account_credential`.
- `CHECK (status = 'registration_in_progress' OR contact_hash IS NULL)` cobre os dois estados terminais.
- `expired` volta a significar exclusivamente abandono (ADR-017).

## Opções consideradas

1. Manter a lista NCSC e registrar a origem real — escolhida; cobertura maior sem custo relevante de memória (um `Set` com ~46 mil entradas).
2. Trocar pela `xato-net-10-million-passwords-10000.txt`, nome atual da lista pretendida — cobertura menor.
3. Manter `expired` para conversão e apenas documentar — rejeitado; perde a distinção entre sucesso e abandono.

## Consequências

- Migration forward `0002` altera o `CHECK` de status de `registration`; nenhuma linha existente muda de estado.
- Métricas de abandono passam a contar somente `expired`.

## Plano de adoção e rollback

Aplicar a migration `0002` antes do deploy. Rollback da aplicação: versão anterior continua funcional, pois não lê `converted`. Rollback de schema apenas por nova migration forward.

## Evidências e referências

- https://github.com/danielmiessler/SecLists/tree/2026.1/Passwords/Common-Credentials
- https://github.com/danielmiessler/SecLists/blob/2026.1/LICENSE
