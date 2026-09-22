# 04 — APIs e integrações externas do EventMatch

## 1. Princípios do contrato

- NestJS em `back/` expõe a API de negócio e publica OpenAPI.
- Route Handlers do Next.js são BFF/proxy opcional; não acessam PostgreSQL nem implementam regras do domínio.
- DTOs HTTP são validados com `ValidationPipe` e `class-validator`; respostas nunca expõem stack trace, segredo ou sinal antifraude interno.
- Autorização considera identidade, papel, relação com evento/caso, bloqueios, restrições e estado do recurso.
- Operações irreversíveis, concorrentes ou reexecutáveis declaram idempotência e conflito (`409`) explicitamente.
- Erros de autenticação/recuperação respeitam antienumeração.

## 2. Grupos de API esperados

Os paths finais serão definidos por contrato OpenAPI e plano de feature. Esta tabela delimita capacidades, não prescreve endpoints.

| Grupo | Capacidades | Requisitos |
|---|---|---|
| Auth e sessões | cadastro, confirmação, login, recuperação, troca de senha, encerrar sessões | RF001–RF011, RNF003–RNF005 |
| Perfil | leitura/edição, prévia pública, interesses, visibilidade, contatos e nascimento protegido | RF012–RF016, RF059, RF075, RF081 |
| Eventos | rascunho, prévia, publicação, edição, transferência, cancelamento, estados | RF017–RF021, RF033–RF038, RF084–RF087 |
| Descoberta | feed, busca, filtros, salvos, desinteresse e compartilhamento público | RF022–RF027, RF102 |
| Participações | solicitar, retirar, decidir, entrar, desistir, remover, reconfirmar e presença | RF028–RF35, RF037–RF038, RF045–RF046, RF069–RF071, RF079, RF088–RF089, RF103, RF107 |
| Conversa | histórico, mensagem, imagem, aviso, edição, moderação, silêncio e contestação | RF039–RF044, RF077, RF090, RF097, RF104 |
| Avaliações | formulário, agregados e atalho de denúncia | RF047–RF048, RF098–RF099 |
| Segurança | denúncia, anexos, acompanhamento, bloqueio, restrições, recursos | RF049–RF058, RF065, RF072–RF076, RF080, RF091, RF097, RF106 |
| Conta e dados | desativação, reativação, exclusão/cancelamento, exportação | RF060–RF062, RF068, RF073–RF074, RF078 |
| Notificações | inbox, preferências e categorias essenciais | RF063–RF064, RF094, RF105 |
| Operação | profissionais, papéis, casos, auditoria, catálogos, eventos oficiais | RF066–RF067, RF082–RF084, RF095–RF101 |

### Contrato técnico inicial

Enquanto os grupos de produto não forem implementados, o backend expõe somente `GET /health`, sem autenticação, como liveness do processo — não como readiness de PostgreSQL ou integrações ainda inexistentes. A resposta 200 é `{ "data": { "status": "ok" }, "message": "API disponível", "statusCode": 200 }`.

Toda resposta HTTP com corpo segue o envelope público `data` (objeto), `message` (string) e `statusCode` (número serializado de `HttpStatus`). A camada de apresentação converte erros conhecidos e inesperados nesse formato sem retornar stack trace, erro bruto de validação ou detalhe de infraestrutura. O OpenAPI do NestJS fica disponível no caminho configurado pelo ambiente e pode ser desabilitado sem alterar `/health`.

## 3. Exposição por audiência

| Audiência | Pode receber | Nunca recebe |
|---|---|---|
| Visitante | dados públicos do evento e anfitrião | ponto exato, contatos, lista de pessoas, conversa |
| Participante autenticado | dados permitidos por perfil/evento/estado | nascimento, contatos alheios, motivos internos, denúncias alheias |
| Confirmado | ponto exato, conversa e lista permitida de confirmados | anexos de denúncia, sinais internos de risco |
| Anfitrião | perfis públicos necessários, solicitações e estados | dados privados, denúncia/nota interna, poder de suspender conta |
| Profissional | somente dados necessários ao papel e caso atribuído | acesso irrestrito por ser funcionário/administrador |

Referência: RN021, RN025, RN075–RN077, RN152–RN159.

## 4. Integrações externas necessárias

| Integração | Finalidade | Requisitos/controles |
|---|---|---|
| E-mail | confirmação, recuperação, alertas e avisos essenciais | links/códigos temporários; antienumeração; templates versionados |
| SMS | confirmação, recuperação e avisos essenciais | códigos temporários, rate limit e mascaramento |
| Object storage | fotos, imagens de conversa, anexos e evidências | buckets/prefixos por classe, URLs assinadas, malware scan, retenção e exclusão |
| Geocodificação/mapas | região aproximada, distância e ponto de encontro | consentimento, minimização e não rastrear deslocamento |
| Push/web notification | avisos configuráveis e essenciais | preferências por categoria e ao menos um canal essencial |
| Observabilidade | logs, métricas, traces e alertas | redaction de PII/segredos; correlação sem conteúdo sensível |

Provedor, região, SLA, DPA, residência de dados e estratégia de fallback exigem ADR antes de implementação.

## 5. Arquivos e limites

| Fluxo | Limite |
|---|---|
| Imagem de conversa | até 5 por mensagem, 10 MB cada; sem documentos, vídeos ou áudio |
| Denúncia | até 10 anexos; imagem 10 MB, PDF 20 MB, vídeo 50 MB por arquivo |
| Documento excepcional | último recurso, voluntário, finalidade explícita e dados desnecessários ocultáveis |

Valide extensão, MIME real, tamanho, assinatura, malware e autorização tanto antes quanto depois do upload. Objetos não são públicos por padrão.

## 6. Segurança e abuso

- Rate limit por IP, conta, contato e operação sensível, com cuidado para não bloquear vítimas.
- Tokens de confirmação/recuperação têm finalidade, expiração, uso único e armazenamento seguro.
- Respostas de login/recuperação não confirmam existência da conta.
- Downloads de cópia de dados usam autenticação reforçada, URL temporária e expiração de sete dias.
- Webhooks externos exigem assinatura, replay protection, idempotência e auditoria.
- Eventos de auditoria são separados de logs comuns e têm acesso restrito.

## 7. Observabilidade e SLOs

- Métricas de latência suportam RNF013 e RNF014, segmentadas por operação sem labels com PII.
- SLO de disponibilidade mensal: 99,5%, excluída manutenção comunicada com 24 h.
- Alertas para falha de confirmação, inconsistência de vagas, atraso em notificações essenciais, erro de upload e jobs de retenção.
- Logs de segurança não expõem relato, anexo, documento, contato completo ou sinais antifraude.

## 8. Pendência jurídica

Exportação de dados, documentos excepcionais e retenção permanecem condicionados à validação jurídica brasileira: RF068, RF073, RF074, RN068, RN080–RN083, RN093, RN096, RN100–RN104, RN115–RN122, RNF023 e RNF025.
