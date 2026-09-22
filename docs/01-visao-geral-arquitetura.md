# 01 — Visão geral da arquitetura do EventMatch

## 1. Propósito e fonte funcional

O EventMatch conecta pessoas com 18 anos ou mais por interesses e atividades locais, para amizade, companhia e descoberta da cidade. Não é um aplicativo de namoro. O MVP cobre encontros presenciais, informais e gratuitos, com descoberta, participação, conversa coletiva, privacidade e operações de confiança e segurança.

A fonte funcional canônica é [`DER-EventMatch-MVP.md`](DER-EventMatch-MVP.md), versão 1.3. Este documento traduz o DER para limites arquiteturais; não substitui os RFs, RNs ou RNFs.

## 2. Stack e fronteiras técnicas

- Monorepo Bun.
- `front/`: Next.js App Router, responsável por experiência web e, quando necessário, Route Handlers usados somente como BFF/proxy.
- `back/`: NestJS com arquitetura hexagonal, responsável pela API de negócio, autorização, casos de uso, auditoria e integrações.
- PostgreSQL: acessado exclusivamente por adapters do backend.
- Armazenamento de arquivos: adapter externo a definir para fotos, imagens de conversa, anexos de denúncia e evidências protegidas.
- OpenAPI do NestJS: contrato de integração entre front e back.

### Fundação do frontend

A fundação em `front/` usa workspace Bun, TypeScript estrito e Next.js App Router. O layout e páginas permanecem React Server Components; `QueryProvider` é o boundary client-only mínimo para TanStack Query e não executa queries nesta etapa. A configuração de execução é validada com Zod antes do processo servir tráfego; diagnósticos omitem valores recebidos. Docker usa imagens multi-stage e compose separado para desenvolvimento e produção, conforme ADR-003 a ADR-005.

### Fundação do backend

A fundação em `back/` usa NestJS, TypeScript estrito e o mesmo workspace Bun. O módulo `health` mantém o caso de uso sem NestJS e expõe somente `GET /health`; `ConfigModule` recebe valores validados por Zod, `ValidationPipe` e filter HTTP são globais, e Swagger descreve o contrato técnico. Respostas com corpo usam envelope `data`, `message` e `statusCode`, conforme ADR-006. Não há acesso a PostgreSQL, ORM, migration ou integração externa nesta etapa.

```text
Browser -> front/ Next.js -> back/ NestJS -> PostgreSQL
            |                   |
            | BFF opcional      +-> storage/notificações/serviços externos
            +------------------->

back/presentation -> application/use-cases -> domain/ports
                                            <- infrastructure/adapters
```

## 3. Atores e superfícies

| Ator | Superfície principal | Limites relevantes |
|---|---|---|
| Visitante | Páginas públicas e cadastro | Vê somente dados públicos; compartilhar não reserva vaga. |
| Participante | Aplicação autenticada | Perfil, descoberta, participação, conversa, avaliação, denúncia e bloqueio. |
| Anfitrião | Aplicação autenticada | Criação e gestão dentro dos limites de experiência e segurança. |
| Confiança e Segurança | Console profissional | Acesso por caso, menor privilégio, conflito de interesse e auditoria. |
| Operação | Console profissional | Eventos, anfitriões, catálogos e saúde da comunidade; sem acesso irrestrito a conteúdo sensível. |
| Profissional | Identidade profissional separada | Ações sensíveis vinculadas a identidade, papel, contexto e data. |

Referência: DER §1.2, RF066–RF067, RF082–RF083, RF095–RF101 e RN089–RN090, RN114, RN138, RN152–RN155.

## 4. Contextos de domínio propostos

A decomposição abaixo é proposta no ADR-002 e deve ser aceita antes de orientar módulos de produção.

| Contexto | Responsabilidade | Requisitos principais |
|---|---|---|
| Identidade e Acesso | Cadastro, contatos, credenciais, sessões, maioridade e aceites. | RF001–RF011, RF059, RN001–RN016, RNF003–RNF005 |
| Perfis e Preferências | Perfil público/privado, interesses, visibilidade e habilitação de anfitrião. | RF012–RF016, RF081, RN008–RN014, RN112–RN113 |
| Eventos | Rascunho, publicação, estados, edição, capacidade, transferência e cancelamento. | RF017–RF021, RF033–RF038, RF071, RF084–RF087, RN017–RN031, RN042–RN049 |
| Descoberta | Busca, filtros, recomendações, salvos e compartilhamento público. | RF022–RF027, RF102, RN026–RN027, RN107, RN156–RN157 |
| Participações | Solicitações, confirmação, reconfirmação, desistência, retirada e presença. | RF028–RF035, RF037–RF038, RF045–RF046, RF069–RF070, RF079, RF088–RF089, RF103, RF107 |
| Conversas | Conversa de evento, avisos, anexos, moderação e silenciamento. | RF039–RF044, RF077, RF090, RF097, RF104, RN050–RN069, RN131–RN136 |
| Confiança e Segurança | Denúncia, bloqueio, restrição, recurso, recuperação excepcional e correção protegida. | RF049–RF058, RF065, RF072–RF080, RF088, RF091–RF097, RF106 |
| Avaliações | Avaliação privada e agregados públicos. | RF047–RF048, RF098–RF099, RN070–RN074, RN139–RN146 |
| Notificações | Preferências, avisos essenciais e direcionamento. | RF063–RF064, RF094, RF105, RN088, RN164–RN166 |
| Operações | Profissionais, papéis, permissões, auditoria, catálogos e eventos oficiais. | RF066–RF067, RF082–RF084, RF095–RF101, RN137–RN138, RN147–RN155 |
| Privacidade e Ciclo de Dados | Cópia, desativação, reativação, exclusão, retenção e anonimização. | RF060–RF062, RF068, RF073–RF074, RF078, RN080–RN087, RN100–RN106, RN115–RN123 |

## 5. Princípios transversais

- **Privacidade por padrão:** nascimento, contatos, ponto exato e campos potencialmente sensíveis não são públicos.
- **Autorização contextual:** acesso profissional a denúncias, documentos, conversas preservadas e ponto exato depende do papel e do caso.
- **Antienumeração:** login, recuperação e conflito de contatos usam respostas neutras.
- **Integridade concorrente:** capacidade e vagas exigem operação atômica; solicitação pendente não reserva vaga.
- **Auditoria:** ação sensível registra ator profissional, contexto, data e resultado.
- **Retenção por categoria:** prazos não são um delete global; casos jurídicos, denúncias e disputas podem suspender eliminação.
- **Sem automação punitiva opaca:** padrões de recusa, avaliações de risco e suspeitas exigem revisão humana quando previsto no DER.
- **Acessibilidade:** fluxos essenciais funcionam por teclado, leitor de tela e zoom de 200%.

## 6. Requisitos não funcionais arquiteturalmente relevantes

| Tema | Meta/obrigação | Origem |
|---|---|---|
| Performance de telas | 95% dos carregamentos principais com conteúdo em até 2 s em conexão móvel comum. | RNF013 |
| Ações interativas | Resposta visível em até 3 s para salvar, solicitar e enviar mensagem. | RNF014 |
| Disponibilidade | 99,5% mensal, exceto manutenção previamente comunicada. | RNF015–RNF016 |
| Acessibilidade | Teclado, leitor de tela, zoom 200%, sinais além de cor e verificação integral dos fluxos essenciais. | RNF017–RNF021 |
| Segurança e privacidade | Controle de acesso, minimização, tokens temporários, antienumeração e confidencialidade por papel/caso. | RNF001–RNF008, RNF022 |
| Consistência | Estados coerentes entre telas, conversas e notificações; vagas nunca excedem capacidade. | RNF011–RNF012 |

## 7. Restrições de lançamento

RF068, RF073, RF074, RN068, RN080–RN083, RN093, RN096, RN100–RN104, RN115–RN122 e RNF023 dependem de validação jurídica brasileira. A implementação pode ser planejada, mas lançamento e políticas definitivas ficam bloqueados até parecer jurídico e eventual revalidação do cliente.

## 8. Decisões

- ADR-001: monorepo Next.js + NestJS hexagonal + Bun.
- ADR-002: contextos e fronteiras de domínio do EventMatch, em estado `proposed`.
