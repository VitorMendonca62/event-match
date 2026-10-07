# Checklist de auditoria EventMatch

Marcar cada item como `evidência`, `lacuna`, `não aplicável` ou `achado`. Referenciar arquivo/símbolo e teste quando existirem.

## Preparação

- [ ] `AGENTS.md`, DER, arquitetura e ADRs relevantes lidos.
- [ ] Escopo, commit, ambiente, dados e comandos autorizados registrados.
- [ ] Entry points, fronteiras de confiança, flags e integrações mapeados.
- [ ] Requisitos jurídicos pendentes separados de defeitos técnicos confirmados.

## Frontend e BFF

- [ ] RSC e props não serializam tokens, cookies, segredos, PII ou URLs assinadas além do necessário.
- [ ] Código client não usa configuração server-only nem acesso ao PostgreSQL.
- [ ] `sessionStorage`/`localStorage` contêm somente dados allowlisted e sem credenciais.
- [ ] Cada mutação valida método, `Origin`, `Sec-Fetch-Site`, `Content-Type` e corpo antes do proxy.
- [ ] BFF possui allowlist de destino/método e não é SSRF/proxy aberto.
- [ ] Erros e status de BFF não revelam detalhes internos, segredos ou existência de conta.
- [ ] Cookies usam atributos corretos por ambiente, rotação/expiração e limpeza segura.
- [ ] Redirecionamentos usam destinos internos allowlisted; Markdown/HTML não cria XSS.
- [ ] Respostas autenticadas ou com PII aplicam cache adequado (`no-store`/`private`).
- [ ] Headers, CSP, download e upload são avaliados conforme a superfície ativa.

## NestJS e domínio

- [ ] `ValidationPipe` global e DTOs validam parâmetros, query e body.
- [ ] Controllers ficam finos; regra de negócio e autorização contextual vivem em casos de uso/domínio.
- [ ] Guards distinguem a credencial interna BFF da credencial de pessoa usuária e não confiam em headers externos.
- [ ] Sessão verifica assinatura, revogação, prazo absoluto/inatividade, rotação e estado atual da conta.
- [ ] Rotas e recursos verificam ownership, capacidade e audiência; investigar IDOR.
- [ ] Login, OTP, recuperação e conflitos de contato têm resposta antienumeração.
- [ ] Limites são persistidos/atômicos no escopo correto e seguros contra concorrência.
- [ ] Erros, Swagger e logs não expõem stack, SQL, segredo, PII, token ou detalhe operacional.
- [ ] Transações/locks preservam invariantes; hash e I/O externo permanecem fora de regiões críticas.

## Dados, segredos e integrações

- [ ] SQL/Drizzle é parametrizado; migrations preservam constraints e ownership.
- [ ] Segredos são validados via ambiente/`ConfigModule`, não hardcoded, não públicos e não logados.
- [ ] Contato, OTP/link e senha respeitam HMAC/AES/Argon2id, CSPRNG e comparação constante quando aplicável.
- [ ] Brevo e Cloudinary têm timeout, allowlist, handling de falha e telemetry sem dados sensíveis.
- [ ] Cloudinary não recebe upload não assinado/irrelevante; `api_secret` não chega ao browser; finalização consulta estado autoritativo.
- [ ] Raster, limite, dimensões e EXIF são controlados; original não é entregue; cleanup é idempotente.
- [ ] Dependências/lockfile, Docker e exemplos de ambiente são avaliados sem revelar valores.

## Testes e relatório

- [ ] Há testes negativos de autenticação, autorização, CSRF, expiração, replay, enumeração e rate limit.
- [ ] Há testes para concorrência/idempotência, upload, erro sanitizado e ausência de PII/segredo.
- [ ] Achados possuem segunda evidência e remediação/teste concreto.
- [ ] Lacunas de teste/cobertura não são classificadas como vulnerabilidade sem prova.
