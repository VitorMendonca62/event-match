# Modelo de ameaça do EventMatch

## Fronteiras

```text
Navegador -> Next.js/RSC + BFF -> NestJS -> PostgreSQL
                                  -> Brevo
Navegador ----------------------> Cloudinary (upload assinado)
```

O frontend não acessa PostgreSQL. Route Handlers são bordas BFF, não API de negócio. O backend decide autenticação, autorização, estado e persistência.

## Ativos e superfícies prioritários

| Ativo | Ameaças a verificar | Controles/decisões de referência |
|---|---|---|
| Contato, senha, data de nascimento | exfiltração, enumeração, log, dump | ADR-014, ADR-018, ADR-019 |
| Continuação de cadastro | replay, roubo por XSS, CSRF, rotação ausente | ADR-021, ADR-022, ADR-024, ADR-030 |
| Sessão autenticada | fixation, roubo, expiração/revogação, login-CSRF | ADR-033 a ADR-037 |
| Perfil e audiências | IDOR, projeção pública indevida, conflito de versão | ADR-038, ADR-043 a ADR-045 |
| Foto de perfil | upload arbitrário, segredo do provedor, metadata, URL vazada | ADR-039, ADR-040, ADR-042, ADR-046 a ADR-048 |
| E-mail e verificação | token em claro, open redirect, enumeração, abuso | ADR-009, ADR-010, ADR-024, ADR-026 |
| Operações futuras | acesso sem caso/role, retenção irregular, automação punitiva | DER e ADRs propostas de confiança e segurança |

## Invariantes que merecem prova

- Cookies são lidos/emitidos apenas no servidor e tokens nunca voltam em JSON.
- Toda mutação BFF valida origem e não encaminha destino, método ou header arbitrário.
- Toda rota protegida resolve sessão atual e verifica capacidade/audiência antes de acesso a recurso.
- Dados pessoais não entram em logs, telemetria, erros HTTP, chaves de idempotência ou URLs.
- Backend é o único componente com acesso a PostgreSQL e segredos de integração.
- Upload de mídia é direto ao provedor com grant restrito; resposta do navegador não é prova suficiente para ativação.
- Limites de abuso e decisões de estado mantêm validade sob concorrência.

## Escopo temporal

ADRs `proposed` descrevem intenção, não controle existente. Registrar como lacuna de implementação/cobertura, nunca como vulnerabilidade confirmada sem evidência de uma superfície ativa.
