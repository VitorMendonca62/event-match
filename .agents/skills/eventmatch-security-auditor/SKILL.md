---
name: eventmatch-security-auditor
description: Auditar defensivamente o EventMatch full-stack (Next.js/React, Route Handlers BFF, NestJS hexagonal e PostgreSQL), com evidências rastreáveis e sem modificar o sistema. Use ao revisar segurança, privacidade ou conformidade de front, BFF, backend, banco, integrações de e-mail/mídia, sessões, autorização, uploads, dependências ou testes de segurança do EventMatch.
---

# Auditoria de Segurança do EventMatch

## Objetivo

Executar auditoria autorizada e prioritariamente somente leitura. Produzir um relatório verificável; separar fatos, hipóteses e cobertura ausente. Não declarar o sistema seguro por ausência de evidência.

## Limites operacionais

- Ler `AGENTS.md`, `PRODUCT.md`, `docs/DER-EventMatch-MVP.md`, documentos de arquitetura, ADRs e o código antes de concluir.
- Auditar `front` e `back` quando o pedido não limitar o escopo. Registrar branch/commit, ambiente e comandos permitidos.
- Não explorar produção, tentar credenciais, fazer port scan, fuzzing amplo, alterar dados, iniciar serviços externos, rodar migrations nem instalar scanners/dependências sem autorização explícita.
- Não imprimir ou reproduzir valores de `.env`, tokens, cookies, credenciais, PII, URLs assinadas, bodies de e-mail ou dumps. Ao avaliar configuração, informar somente nomes, presença e propriedades seguras.
- Não corrigir arquivos durante a auditoria, salvo pedido separado. Propor mudanças mínimas e testes de regressão.

## Fluxo

1. A partir da raiz do repositório, executar `<diretório-da-skill>/scripts/inventory.sh` para obter uma visão somente leitura dos entrypoints. Confirmar manualmente os caminhos listados.
2. Delimitar alvo, ambiente, mudanças relevantes, superfícies externas e dados sensíveis. Usar `references/eventmatch-threat-model.md` para orientar fronteiras e prioridades.
3. Conferir o desenho contra as ADRs e depois contra a implementação/testes. Código e testes prevalecem sobre documentação; registrar divergências.
4. Carregar `references/checklist.md`; percorrer as seções aplicáveis e registrar evidência ou lacuna para cada uma.
5. Validar todo possível achado com uma segunda evidência independente: fluxo de código, teste negativo, configuração segura ou reprodução local inofensiva com fixture sintética.
6. Executar somente comandos existentes e não destrutivos quando autorizados: `bun run --cwd front lint|typecheck|test|build` e equivalentes do `back`. Declarar comandos não executados e motivo.
7. Entregar o relatório no formato definido abaixo. Deduplicar causas-raiz e priorizar risco explorável.

## Focos obrigatórios

### Frontend e BFF

- Garantir que RSC, props, bundles, `sessionStorage`, URLs e logs não exponham segredo, token, PII, URL assinada ou configuração server-only.
- Em cada Route Handler mutante, verificar método allowlisted, `Origin`, `Sec-Fetch-Site`, `Content-Type`, tamanho/formato do corpo, tratamento de erro e `Cache-Control`.
- Verificar cookie de continuação e sessão: prefixo `__Host-` em produção, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, expiração, rotação e remoção no logout/cancelamento.
- Verificar que o BFF não é proxy aberto, usa rota/método allowlisted, nunca repassa headers arbitrários, converte o cookie em bearer apenas no servidor e não acessa PostgreSQL.
- Examinar redirecionamentos, Markdown, mensagens de erro, cache, CSP/headers, upload direto e respostas do backend por XSS, CSRF/login-CSRF, SSRF, open redirect, vazamento ou enumeração.

### Backend e dados

- Confirmar `ValidationPipe` global, DTOs validados, guards na borda HTTP, envelope/filters sem detalhes internos e Swagger controlado conforme ambiente.
- Examinar autenticação, sessão opaca stateful, revogação, expiração, rotação, limites de login e respostas neutras para enumeração.
- Testar autorização por estado, capacidade, audiência e ownership; procurar IDOR em perfil, sessão, mídia, cadastros e futuras superfícies profissionais.
- Conferir transações, locks, idempotência e invariantes contra race conditions; autenticação, Argon2id e I/O externo não podem ficar dentro de transação/lock.
- Verificar HMAC/AES/Argon2id, comparação constante, versões/rotação de chaves, dados cifrados, índice cego e ausência de PII/segredos em logs, telemetria, erros e migrations.
- Conferir Drizzle/SQL parametrizado, privilégios e exposição do PostgreSQL, configuração via `ConfigModule`, allowlists de CORS/origem e rate limit persistido.

### Integrações e privacidade

- Para Brevo, conferir destinatário, tokens de verificação, URLs, timeouts, retry, erros neutros e ausência de conteúdo sensível em logs.
- Para Cloudinary, conferir grant de upload de escopo fixo e curto, allowlist de raster/tamanho/dimensões, remoção de EXIF, ausência de `api_secret` no browser, finalização autoritativa e entrega de derivados privados. Tratar a não expiração real da URL assinada como risco aceito somente nos limites da ADR-042.
- Conferir minimização, audiência padrão privada, retenção, limpeza convergente e bloqueios jurídicos. Não confundir requisito futuro com controle já implementado.

## Evidência e classificação

Usar `Critical`, `High`, `Medium`, `Low` ou `Informational`; usar `P0` para exploração remota não autenticada com impacto alto/crítico, `P1` para bypass relevante autenticado/autorização, `P2` para risco moderado e `P3` para hardening. Nunca elevar ou reduzir severidade sem explicar explorabilidade, impacto, alcance e controles compensatórios.

Para cada achado, usar:

```text
ID — [Severidade/Prioridade] Título
Status: confirmado | provável | lacuna de evidência | falso positivo
Localização: caminho:linha ou símbolo
Evidência: fato verificável, sem segredo/PII
Impacto: efeito para atacante ou pessoa não autorizada
Condição: pré-requisitos e alcance
Remediação: alteração concreta, compatível com BFF/Nest/domínio
Verificação: teste negativo ou comando esperado
Referências: ADR, DER, regra ou checklist
```

## Relatório final

Começar com escopo, risco geral, totais por severidade e limitações. Ordenar achados confirmados por prioridade e incluir:

1. controles positivos observados, sem usá-los para diminuir vulnerabilidade confirmada;
2. cobertura pendente e hipóteses não confirmadas;
3. plano em ondas: imediata, próxima entrega e hardening;
4. comandos executados/não executados.

Se nenhum achado for confirmado, escrever: **“nenhuma vulnerabilidade confirmada no escopo”**. Nunca escrever “sistema seguro”.
