# Task: Implementar o fluxo de cadastro no Next.js

- **Slug:** frontend-nextjs-fluxo-cadastro
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-09-26
- **Status:** ready
- **Versão-alvo:** 0.10.0
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A TASK 07 de `specs/tasks.txt` pede a primeira experiência de produto do EventMatch: um cadastro responsivo e acessível no Next.js App Router, consumindo exclusivamente o contrato HTTP v1 entregue pela SDD-009. O fluxo deve validar maioridade antes do contato, confirmar e-mail por OTP ou link, coletar senha e dados obrigatórios, apresentar documentos jurídicos aprovados, exigir ao menos três interesses e concluir a ativação sem expor credenciais ou ids internos.

Os pré-requisitos estão satisfeitos: `specs/sdd-009-api-http-entrega-verificacao-cadastro/tasks.md` está `ready`; ADR-020 a ADR-026 estão `accepted`; o backend publica o contrato em `/api/v1`, possui OpenAPI e mantém as rotas de cadastro atrás de `REGISTRATION_HTTP_ENABLED` até este BFF existir. A entrega operacional continua impedida de ativar contas reais enquanto os três documentos jurídicos aprovados não estiverem disponíveis, mas isso não bloqueia a implementação nem os testes com fixtures não jurídicas.

Rastreabilidade: `docs/DER-EventMatch-MVP.md` v1.3, RF001–RF007, RN001–RN016, RN147–RN149 e RNF002–RNF004/RNF009/RNF013–RNF021; `docs/01-visao-geral-arquitetura.md` §§2, 5–8; `docs/02-regras-de-negocio.md` §2; `docs/03-modelos-de-dominio.md` §§2.1 e 4; `docs/04-integracoes-externas.md` §§1, 2, 4, 6 e 7; ADR-008 a ADR-012 e ADR-019 a ADR-026.

Versão: elevar raiz e frontend de `0.9.0`/`0.4.0` para `0.10.0`; o backend permanece em `0.9.0`, pois seu contrato não muda. Atualizar `CHANGELOG.md`, `front/README.md`, `.env.example` e a documentação da jornada.

## 2. Escopo

Inclui:

- [ ] Substituir a página técnica por uma entrada de produto que direcione para `/cadastro`, mantendo a rota de cadastro como Server Component por padrão.
- [ ] Implementar uma máquina de etapas explícita e testável para apresentação, nascimento, canal/contato, OTP, senha, dados obrigatórios, documentos, interesses, confirmação final e conclusão.
- [ ] Criar Client Components pequenos por etapa somente onde houver formulário, temporizador, seleção, rolagem, foco ou `sessionStorage`; cabeçalho, layout, conteúdo estático e carregamento inicial permanecem server-side.
- [ ] Criar um cliente server-only tipado para o NestJS e Route Handlers BFF em `front/src/app/api/registration/**`, além do proxy de catálogo necessário, sem SQL, regra de negócio ou estado mutável de requisição em módulo.
- [ ] Implementar cookie de continuação, proteção de mesma origem/CSRF, fingerprint de origem Vercel, credencial interna do BFF, idempotência, redaction e tradução conservadora dos envelopes públicos.
- [ ] Implementar confirmação por link com consumo único e redirecionamento `303` para URL limpa, sem token em UI, log, analytics ou resposta ao browser.
- [ ] Implementar progresso mínimo em `sessionStorage`, schema versionado, TTL deslizante de até 30 minutos, reconciliação com snapshot do backend e limpeza segura.
- [ ] Buscar snapshot, interesses ativos e documentos aprovados no servidor em paralelo quando a etapa permitir; serializar aos Client Components somente campos visíveis e necessários.
- [ ] Mostrar e-mail como canal disponível e WhatsApp como controle desabilitado com nome acessível e texto “Em breve”, sem campo de telefone, consentimento ou chamada HTTP.
- [ ] Implementar OTP de seis dígitos, expiração informada pelo backend, reenvio apenas após `nextResendAt`, feedback neutro e prevenção de envio duplo.
- [ ] Implementar senha/confirmação, dados obrigatórios, três documentos vigentes, nova entrada de nascimento na conclusão e seleção de no mínimo três interesses ativos.
- [ ] Centralizar a paleta obrigatória em `globals.css`, remover o tema claro e criar layout mobile-first com estados de loading, erro, sucesso, foco, teclado, leitor de tela, contraste, zoom de 200% e alvos de toque adequados.
- [ ] Aplicar o fluxo `impeccable`: `PRODUCT.md` e a direção **Convite Cívico** já foram confirmados; preservar o comp aprovado durante a implementação, registrar a documentação final do sistema construído e concluir com revisão visual independente.
- [ ] Atualizar documentação, configuração, versão, changelog e testes unitários, integração, E2E e acessibilidade.

### 2.1 Direção visual confirmada — Convite Cívico

O gate visual do `impeccable shape cadastro` foi aprovado pelo usuário em 2026-09-26, antes de qualquer edição da UI. A implementação seguirá o caminho **comp-first** e usará como referência composicional autoritativa `.impeccable/mocks/decision/cadastro-convite-civico.png`, apoiada pelo hero e pelo board de qualidade em `.impeccable/references/wpa-hero.webp` e `.impeccable/references/wpa-board.webp`. O comp não deve ser regenerado do zero; adaptações responsivas e de conteúdo preservam sua hierarquia, seu ritmo editorial e sua linguagem de cartaz cívico urbano.

Objetivo da superfície: transmitir confiança e explicar o propósito do EventMatch antes de solicitar a data de nascimento. A apresentação inicial deve comunicar amizade, companhia para atividades e descoberta da cidade, identificar o produto como exclusivo para pessoas adultas e dizer explicitamente que não é um aplicativo de namoro. O CTA primário é “Começar meu cadastro”; nenhum dado é solicitado antes dele.

Princípios obrigatórios da direção:

- manter personalidade adulta, urbana, direta, inclusiva e acolhedora, sem códigos visuais ou verbais de namoro, conquista, rede corporativa ou gamificação infantil;
- usar a paleta semântica obrigatória de `AGENTS.md`; a distinção da direção vem de composição editorial, escala tipográfica, grafismos, textura e ilustração urbana, sem cores hexadecimais avulsas;
- substituir no produto a frase romântica “Mesmas paixões” do estudo por “Interesses em comum. Mais vida na sua cidade.” ou texto equivalente aprovado com o mesmo sentido não romântico;
- explicar junto de cada dado sensível por que ele é solicitado e o que libera, sem repetir políticas extensas nem criar tutorial obrigatório;
- manter uma coluna principal mobile-first, uma ação primária evidente por tela e progresso textual/visual que continue compreensível sem cor;
- concentrar ilustrações urbanas na apresentação e na conclusão; nas etapas densas, priorizar formulário, legibilidade, foco e redução de carga cognitiva;
- ampliar no desktop a área editorial sem transformar o cadastro em dashboard nem separar visualmente a explicação do formulário correspondente;
- preservar indicação de etapa, estados de foco, seleção, carregamento, sucesso, erro, indisponibilidade e bloqueio por forma, texto e semântica, não apenas por cor.

Jornada visual coberta: apresentação/confiança → nascimento/elegibilidade → canal e e-mail → OTP/link → senha → dados obrigatórios → documentos → interesses → revisão com novo nascimento → conclusão. O desenho também deve cobrir menoridade, OTP inválido/expirado/bloqueado, cooldown de reenvio, resposta neutra para contato, senha comum, sessão expirada, retomada, divergência local/remota, catálogos indisponíveis, documentos ausentes, menos de três interesses, falha de rede, confirmação por link em outro navegador e limpeza após conclusão.

Copy e feedback seguem português simples, adulto e acionável: explicar antes de pedir, não culpar a pessoa, não prometer entrega de e-mail, não enumerar conta/contato e não usar metáforas românticas. Cada estado assíncrono ou de erro mantém foco administrado, associação programática e `aria-live` quando aplicável.

Ordem de implementação:

1. **Gate concluído:** `impeccable init`, contexto do produto, exploração `new-work`/`shape` em modo **Operate**, caminho comp-first e direção **Convite Cívico** confirmados; nenhum arquivo de UI foi editado antes desse gate.
2. Contratos tipados, schemas Zod, configuração server-only e primitives seguras do BFF.
3. Route Handlers, cookie, origem confiável, callback por link e testes de contrato/segurança.
4. Máquina de etapas e persistência local permitida, com testes unitários antes da UI.
5. Rota/RSC, formulários Client Components e sistema visual/acessibilidade conforme o brief visual aprovado.
6. Integração full-stack, E2E, auditoria, passes visuais limitados, finish review, documentação, rollout e versão.

Exclui:

- Login, sessão geral da conta, recuperação de senha completa, perfil, eventos, recomendações e painel administrativo.
- Campos opcionais do onboarding posterior, salvo encaminhamento neutro após a conclusão; nenhuma persistência adicional será criada.
- Conteúdo jurídico definitivo, administração/publicação de documentos ou ativação com placeholder.
- WhatsApp funcional, coleta de telefone, consentimento de mensagens ou qualquer chamada ao provedor Meta.
- Acesso do Next.js ao PostgreSQL, importação de Drizzle, regras do domínio em componentes/Route Handlers ou uso de ids como autorização.
- Mudança no contrato OpenAPI da SDD-009, no schema PostgreSQL ou nas migrations existentes.
- Analytics de produto no cadastro nesta versão; sua adoção futura deve provar redaction de segredos/PII.

## 3. Impacto Arquitetural e ADRs

```text
Browser
  -> GET /cadastro (RSC)
       -> Next.js server-only registration backend client
            -> NestJS /api/v1 (snapshot + catálogos em paralelo)
       -> RegistrationFlow client boundary
            -> /api/registration/** (same-origin BFF)
                 - valida Origin/Content-Type/idempotência
                 - lê/grava/expira cookie HttpOnly
                 - deriva fingerprint HMAC da origem confiável
                 - injeta BFF token e continuação
                 - remove headers sensíveis
                 -> NestJS /api/v1/registration/**

E-mail -> GET /api/registration/contact-verification/confirm-link?token=...
           -> NestJS confirm-link -> cookie HttpOnly -> 303 /cadastro?email-verificado=1
```

Arquivos/limites previstos:

- `PRODUCT.md`, surface brief em `.impeccable/` e, ao terminar um sistema visual novo ou uma mudança durável aprovada, `DESIGN.md` + `.impeccable/design.json`, produzidos pelo fluxo da skill e nunca entregues ao browser.
- `front/src/app/cadastro/page.tsx`, `loading.tsx`, `error.tsx` e `concluido/page.tsx` como superfície App Router.
- `front/src/app/api/registration/**/route.ts` e `front/src/app/api/catalog/interests/route.ts` como adaptadores BFF finos.
- `front/src/features/registration/` para contratos, schemas, máquina de etapas, componentes, cliente browser e persistência local; imports diretos, sem barrel amplo.
- `front/src/shared/server/` para cliente do backend, cookie, CSRF, idempotência e resolvedor de origem, sempre server-only.
- `front/src/app/globals.css` como fonte dos tokens visuais sem hexadecimais avulsos nos componentes.
- `front/tests/unit`, `front/tests/integration` e `front/tests/e2e` para a pirâmide de testes; o runner full-stack reutiliza o PostgreSQL descartável da SDD-008.

O RSC lê o cookie somente no servidor e consulta o snapshot quando ele existe. Interesses e documentos são iniciados juntos e aguardados com `Promise.all` apenas na etapa que os requer; não há fetch sequencial escondido. O browser recebe somente `stage`, prazos e campos públicos dos catálogos. Contato, nascimento, OTP, senha, token do link, continuação e ids internos nunca são props serializadas.

Não usar TanStack Query inicialmente no fluxo: mutações são lineares, não devem sofrer retry implícito e o snapshot do backend é a fonte de verdade no carregamento/ressincronização. Os catálogos chegam pelo RSC. O provider existente permanece disponível, mas não duplica formulário, máquina de etapas ou snapshot; uma adoção posterior exige benefício mensurável de cache/deduplicação.

Formulários usam React e Zod já instalados. Schemas de transporte/UX ficam em um único módulo do frontend e são reutilizados por componentes, cliente e BFF. Eles reproduzem formato e limites públicos do OpenAPI para feedback antecipado, mas não reimplementam maioridade, senha comum, elegibilidade, ativação ou outras regras de domínio; respostas do NestJS prevalecem. Nenhuma dependência nova de formulário/estado é necessária.

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Progresso mínimo em `sessionStorage` com schema e TTL | `docs/adrs/ADR-011-progresso-de-cadastro-no-navegador.md` | accepted | Define allowlist, 30 minutos, limpeza e autoridade do backend. |
| Placeholder jurídico sem efeito real | `docs/adrs/ADR-012-conteudo-e-registro-de-aceites-do-cadastro.md` | accepted | Separa testes visuais de aceite juridicamente válido. |
| Contrato HTTP v1 e erros seguros | `docs/adrs/ADR-020-contrato-http-v1-do-cadastro.md` | accepted | É o único contrato consumido pelo frontend. |
| Continuação opaca, rotativa e revogável | `docs/adrs/ADR-021-credencial-de-continuacao-do-cadastro.md` | accepted | IDs não autorizam e o token não pode chegar ao JavaScript. |
| Next.js BFF como única entrada do navegador | `docs/adrs/ADR-022-bff-nextjs-para-o-cadastro.md` | accepted | Define cookie, CSRF/CORS e separação entre proxy e domínio. |
| Origem Vercel transformada em fingerprint | `docs/adrs/ADR-023-origem-confiavel-para-limites-do-cadastro.md` | accepted | Ativa rate limit sem confiar em headers genéricos nem persistir IP. |
| Link de e-mail de uso único | `docs/adrs/ADR-024-entrega-de-verificacao-e-link-de-email.md` | accepted, parcialmente superseded pela ADR-026 | Define token, expiração, consumo e callback; somente o provedor foi substituído. |
| WhatsApp adiado | `docs/adrs/ADR-025-adiar-whatsapp-no-cadastro.md` | accepted | Canal aparece desabilitado e não integra o contrato. |
| Brevo como entrega de e-mail | `docs/adrs/ADR-026-substituir-resend-por-brevo.md` | accepted | O frontend mantém mensagens neutras, independentemente do resultado do provedor. |

Não há nova decisão arquitetural material: rotas, formulários e composição são escolhas locais dentro dos ADRs aceitos. Se a implementação exigir chamada direta browser→NestJS, outro armazenamento, nova dependência estrutural, cookie diferente no ambiente publicado ou alteração de contrato, deve voltar ao planejamento e criar ADR próprio; não editar ADR aceito silenciosamente.

Não há migration PostgreSQL. Pool, transações e persistência continuam integralmente no NestJS; o BFF não importa cliente de banco e não mantém transação durante I/O.

## 4. Contratos e Interfaces

### 4.1 Rotas do frontend e navegação

| Rota | Tipo | Comportamento |
|---|---|---|
| `/` | RSC | Apresentação curta do EventMatch e CTA para `/cadastro`; não inicia sessão. |
| `/cadastro` | RSC + ilha cliente | Carrega snapshot/catálogos necessários, reconcilia a etapa e conduz o fluxo sem pôr a etapa sensível na URL. |
| `/cadastro/concluido` | RSC | Confirma conclusão sem mostrar id, contato ou dado de conta e encaminha para a futura experiência autenticada. |
| `/api/registration/...` | Route Handlers | Espelha somente as operações públicas necessárias e delega para `/api/v1/registration/...`. |
| `/api/catalog/interests` | Route Handler GET | Proxy tipado/no-store do catálogo público quando houver refetch; o primeiro carregamento é server-side. |
| `/api/registration/contact-verification/confirm-link?token=...` | Route Handler GET | Valida formato, consome no backend, grava cookie somente em sucesso e responde `303` para `/cadastro?email-verificado=1` ou `/cadastro?email-verificado=0`, sempre com `Referrer-Policy: no-referrer` e `Cache-Control: no-store`. |

Atualizar/reabrir: com cookie válido, o RSC consulta `GET /api/v1/registration` e a etapa do backend prevalece; dados permitidos do `sessionStorage` apenas preenchem campos ainda editáveis. Sem cookie ou com `401`, limpar estado local e cookie e recomeçar pela apresentação com “Seu cadastro expirou. Comece novamente.” Um `409` dispara uma única ressincronização do snapshot; se persistir, mostra ação para reiniciar. Nunca avançar baseado apenas na etapa local.

Voltar: botão visível permite navegar somente entre subetapas locais ainda compatíveis com o mesmo estágio do backend. Transições persistidas (contato verificado, senha registrada, conta incompleta) não são revertidas; passos anteriores aparecem concluídos/read-only. O botão Back do navegador não restaura campos secretos porque a rota é estável e `autocomplete`/estado não são tratados como persistência autorizada.

Fechar aba: `sessionStorage` sobrevive apenas na mesma aba e expira em até 30 minutos de inatividade; o cookie segue o TTL do backend. Ao retornar, reconciliar ambos. Cancelar exige confirmação, apaga storage e cookie via Route Handler e volta à apresentação; revogação server-side de uma sessão válida deve ser delegada se o contrato a oferecer futuramente, sem inventar endpoint nesta task.

### 4.2 BFF, cookie, CSRF e origem

- Cookie publicado: `__Host-eventmatch_registration`, valor opaco nunca lido por JavaScript, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sem `Domain`, `Max-Age` limitado ao `expiresAt` recebido. Rotação sobrescreve atomicamente; conclusão, `401` e cancelamento local expiram o cookie. Callback inválido/consumido não cria, substitui nem apaga uma continuação válida existente.
- Desenvolvimento/testes HTTP usam nome e atributo não seguro explicitamente restritos a `NODE_ENV != production`; produção falha cedo se não puder usar o cookie `__Host-` seguro. Esse desvio não é publicado.
- Toda mutação browser→BFF exige `Content-Type: application/json` e `Origin` exatamente igual à origem pública configurada; ausência, valor múltiplo ou divergente retorna erro genérico antes de chamar o backend. GET do callback é a exceção deliberada e aceita somente token no formato OpenAPI.
- O BFF não habilita CORS; respostas same-origin não incluem credenciais/header internos. `Authorization`, `X-Registration-Continuation`, `X-EventMatch-BFF-Token`, fingerprint e token do link são redigidos e nunca ecoados.
- Em Vercel publicada, o resolvedor aceita exclusivamente um `x-vercel-forwarded-for` bem-formado, normaliza IPv4/IPv6 e gera `base64url(HMAC-SHA-256(ORIGIN_FINGERPRINT_KEY, ip))`. `x-forwarded-for`, `x-real-ip` e headers enviados pelo cliente não são fallback. Local/teste usa adapter fixture explícito.
- Configuração server-only validada por Zod: `BACKEND_INTERNAL_URL`, `FRONTEND_PUBLIC_URL`, `BFF_INTERNAL_TOKEN`, `ORIGIN_FINGERPRINT_KEY` e `EDGE_PROVIDER=vercel|fixture`; segredos nunca usam prefixo `NEXT_PUBLIC_`.

### 4.3 Operações browser → BFF → NestJS

O BFF preserva método, corpo seguro, envelope e status do contrato abaixo; injeta bearer do cookie, `X-EventMatch-BFF-Token` e, apenas no pedido inicial, fingerprint. Respostas têm `Cache-Control: no-store`. `Idempotency-Key` é gerada no browser por envio lógico, mantida somente em memória e reutilizada em retry explícito da mesma tentativa; tem 16–128 caracteres válidos e nunca vai ao `sessionStorage`. O BFF valida e encaminha sem criar retry automático.

| Browser/BFF | NestJS | Corpo/sucesso usado pela UI |
|---|---|---|
| `POST /api/registration/eligibility` | `POST /api/v1/registration/eligibility` | `{ birthDate }` → `200 { eligible }`; nascimento não é persistido. |
| `POST /api/registration/contact-verification` | mesma rota v1 | `{ channel:'email', contact }` → `202 { expiresAt, nextResendAt }`; resposta sempre neutra. |
| `POST /api/registration/contact-verification/resend` | mesma rota v1 | `{}` → `202` neutro; só habilitar em/apos `nextResendAt`. |
| `POST /api/registration/contact-verification/confirm` | mesma rota v1 | `{ otp }` → `200 { verified }`; falso não revela causa. |
| callback GET acima | `POST .../confirm-link` | BFF converte query token em `{ token }`; nunca retorna token ao componente. |
| `PUT /api/registration/password` | mesma rota v1 | `{ password, passwordConfirmation }` → `{ stage, expiresAt }`; browser descarta ambos os campos após settle. |
| `PUT /api/registration/required-data` | mesma rota v1 | `{ displayName, region, usageIntents[] }` → `{ stage, expiresAt }`. |
| `GET /api/registration` | `GET /api/v1/registration` | `{ stage, expiresAt, nextResendAt? }`; sem contato ou ids. |
| `GET /api/registration/legal-documents?locale=pt-BR` | mesma rota v1 | `{ documents:[id,kind,version,locale,effectiveAt] }`; apenas aprovados. |
| `GET /api/catalog/interests?locale=pt-BR` | `GET /api/v1/catalog/interests` | `{ interests:[id,slug,label] }`; ativos e estáveis. |
| `POST /api/registration/complete` | mesma rota v1 | `{ birthDate, documentIds[], interestIds[] }` → `{ status:'active' }`; expira cookie e limpa estado local. |

O endpoint temporário `email-delivery-test` não é exposto na UI nem proxyado ao browser.

### 4.4 Estado local e máquina de etapas

Schema permitido:

```text
RegistrationDraftV1 {
  schemaVersion: 1
  touchedAt: ISO-8601
  localStep: 'intro' | 'birth' | 'contact' | 'otp' | 'password' |
             'required_data' | 'legal' | 'interests' | 'review'
  displayName?: string
  region?: string
  usageIntents?: ('friendship'|'activity_company'|'explore_city'|'networking')[]
  interestIds?: UUID[]
}
```

Contato, OTP, senha/confirmação, nascimento, token, cookie, ids internos, aceites/documentIds, respostas do backend e chaves de idempotência são proibidos. Toda escrita renova `touchedAt`, sem ultrapassar 30 minutos de inatividade; parse inválido, versão incompatível, expiração, conclusão ou cancelamento apaga a chave inteira. O utilitário de storage aceita somente a estrutura allowlisted e possui teste que falha se uma chave proibida surgir.

Mapeamento autoritativo: sem snapshot→`intro/birth`; `age_eligible`→`contact`; `verification_pending`→`otp`; `contact_verified`→`password`; `registration_in_progress`→`required_data`; `account_incomplete`→`legal/interests/review`. A conclusão acontece somente pela resposta `active`; depois disso não há snapshot de cadastro porque a sessão foi revogada.

### 4.5 Formulários, conteúdo e erros

- Nascimento: input de data com label/instrução; validar somente forma/calendário no frontend. Menoridade usa a resposta `eligible:false`, não cria cookie e mostra explicação sem persistir a data.
- Canal: cartões/radios acessíveis; e-mail selecionável, WhatsApp `disabled`, `aria-disabled` quando necessário e descrição “Em breve”. Nenhum telefone é renderizado.
- Contato/pedido: “Se for possível usar este e-mail, enviaremos um código. Confira também spam e lixo eletrônico.” Não afirmar existência, disponibilidade ou entrega.
- OTP: seis dígitos, `inputMode=numeric`, autocomplete apropriado, instrução associada e região `aria-live`. `verified:false`, expirado, bloqueado ou indisponível usa “Não foi possível confirmar o código. Verifique e tente novamente.” Countdown é derivado do relógio e das datas do backend, sem ser fonte de autorização.
- Senha: requisitos públicos (8–256, confirmação) são visíveis; erro `weak_password` informa que a senha é muito comum sem ecoar, medir força por telemetria ou manter valor após envio.
- Dados: nome 60, região 80 e uma ou mais intenções; os limites são UX/contrato, e semântica continua no backend.
- Documentos: exibir os três tipos, versão, vigência e conteúdo/URL quando o contrato vier a fornecê-lo. Como o contrato atual fornece apenas metadados, esta task não inventa conteúdo: lista vazia ou documento sem artefato aprovado bloqueia conclusão real com mensagem segura. Fixture lorem ipsum existe apenas no teste visual e é marcada “conteúdo de teste — aceite sem efeito”.
- A confirmação de leitura combina rolagem completa no teste visual com alternativa acessível explícita (checkbox/ação por documento operável por teclado e leitor de tela); rolagem não é a única evidência. `documentIds` permanece somente em memória até o submit.
- Interesses: lista pública com labels, seleção por teclado e contador textual; botão final exige visualmente três, enquanto o backend revalida ids ativos e quantidade.
- Conclusão: solicita novamente nascimento, resume apenas dados não sensíveis e chama uma vez. Sucesso limpa memória/storage/cookie e usa navegação substitutiva para `/cadastro/concluido`.

Mapeamento seguro: `400` destaca formato conhecido sem ecoar payload; `401` expira sessão e reinicia; `409` ressincroniza; `422` traduz somente os `reason` públicos do OpenAPI; `404` indica fluxo indisponível no rollout; `5xx` mostra indisponibilidade e tentativa manual. Respostas `202` de pedido/reenvio mantêm texto idêntico. Nenhuma mensagem diferencia contato existente, rate limit, desafio ausente, bloqueio, retenção ou falha Brevo.

Compatibilidade: contrato frontend novo e aditivo. Qualquer divergência entre schemas e OpenAPI deve falhar em teste contratual e ser resolvida no plano/contrato canônico, nunca por coerção silenciosa no BFF.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Não há jornada frontend. | Nascimento é a primeira informação após a apresentação; menor não avança nem informa contato. | RF001, RN001, ADR-019. |
| 2 | Backend aceita somente e-mail. | UI oferece e-mail e mostra WhatsApp desabilitado “Em breve”, sem requisição ou consentimento. | RF002, ADR-025. |
| 3 | OTP/link existem apenas na API. | UI respeita seis dígitos, 15 min, reenvio após 60 s e resposta neutra; link termina em URL limpa. | RN002–RN005, ADR-009, ADR-024. |
| 4 | Senha é validada no backend. | UI mostra requisitos contratuais, confirma localmente e deixa senha comum/semântica como autoridade do NestJS. | RF003, RN006, ADR-018. |
| 5 | Conta incompleta recebe dados obrigatórios. | UI coleta nome, região e ao menos uma intenção sem persistir além da allowlist local. | RF004, RN007, ADR-011. |
| 6 | API retorna documentos aprovados, hoje vazios. | UI nunca substitui conteúdo ausente por placeholder e bloqueia ativação real sem os três documentos válidos. | RF005, RN008, ADR-012. |
| 7 | Catálogo expõe interesses ativos. | UI exige ao menos três seleções e envia ids; backend revalida atividade e quantidade. | RF006, RN009, RN147–RN149. |
| 8 | Backend oferece snapshot mínimo e continuação HttpOnly via BFF. | Retomada usa estágio remoto como fonte de verdade e somente dados locais não sensíveis por 30 min. | RF007, ADR-011, ADR-021/022. |
| 9 | Conclusão revalida nascimento/aceites/interesses. | UI recolhe nascimento novamente, envia aceite em memória e só declara sucesso após `status:'active'`. | ADR-019, ADR-020. |

## 6. Critérios de Aceitação

- Fluxo por e-mail completo funciona contra a API SDD-009; nenhum componente, BFF ou estado local conhece Drizzle/PostgreSQL ou contém regra de domínio.
- Antes de alterar a UI, `impeccable init` registra a verdade durável do produto e `new-work`/`shape` confirma **Convite Cívico** em modo Operate e caminho comp-first; as referências ficam apenas nos artefatos de desenvolvimento e nunca entram em JSX, RSC payload, metadata ou bundle.
- A primeira tela transmite confiança antes de pedir dados: explica amizade, companhia para atividades e descoberta da cidade, informa 18+, afirma “Não é app de namoro” e oferece somente o CTA “Começar meu cadastro”. A data de nascimento aparece apenas após essa ação.
- A composição implementada preserva a hierarquia do comp aprovado, usa exclusivamente os tokens semânticos de `AGENTS.md`, mantém linguagem adulta/cívica e não publica “Mesmas paixões” nem outra formulação com leitura romântica.
- Mobile e desktop mantêm uma ação primária por etapa, progresso compreensível sem cor, justificativa curta junto de dados sensíveis e ilustração subordinada à legibilidade dos formulários.
- `/cadastro` é RSC por padrão; `'use client'` aparece somente em formulários/temporizador/storage/foco/seleção. Dados independentes são buscados em paralelo (`async-parallel`, `server-parallel-fetching`), awaits ficam no ramo de uso (`async-defer-await`) e props são minimizadas (`server-serialization`).
- Nenhum estado mutável por requisição vive em módulo (`server-no-shared-module-state`). Imports são diretos/analisáveis; não há nova dependência nem bundle pesado (`bundle-barrel-imports`, `bundle-analyzable-paths`).
- Estado derivado (etapa habilitada, contagem, requisitos, countdown) é calculado durante render (`rerender-derived-state-no-effect`); envio e foco motivados por interação ficam no handler/transição correspondente (`rerender-move-effect-to-event`).
- Storage implementa `client-localstorage-schema` para `sessionStorage`: versão, parse Zod, allowlist, TTL deslizante, invalidação e limpeza. Teste prova ausência de contato, OTP, senha, nascimento, token, aceite e resposta sensível.
- BFF aplica cookie HttpOnly/secure, origem/CSRF, headers internos, fingerprint, timeout e `no-store`; nunca deixa continuação/token/header interno chegar ao JavaScript, log ou analytics.
- Mutações não têm retry automático, usam chave idempotente por tentativa lógica, desabilitam controles enquanto pendentes e permitem retry manual com a mesma chave somente enquanto o resultado é desconhecido.
- WhatsApp é perceptível como indisponível e “Em breve”, não recebe foco como opção acionável e não dispara rede.
- Ausência de documentos aprovados/conteúdo preservado bloqueia conclusão real; lorem ipsum só aparece em fixture/snapshot de teste claramente não jurídico.
- Cada mudança de etapa move foco para o título; erro move foco para resumo associado aos campos; atualizações assíncronas usam `aria-live` sem anúncios repetitivos. Todos os controles têm label, descrição e erro programaticamente ligados.
- Fluxo inteiro funciona por teclado e leitor de tela, mantém informação fora da cor, contraste WCAG AA, reflow/zoom 200%, sem scroll horizontal e alvos de toque de pelo menos 44×44 CSS px.
- Paleta de `AGENTS.md` está centralizada em `:root`; componentes usam variáveis semânticas e não introduzem hex avulso. Estados focus/disabled/success/warning/error permanecem distinguíveis.
- Conteúdo principal visa RNF013 (95% até 2 s em conexão móvel comum) e cada ação oferece feedback imediato e resultado visível em até 3 s quando a dependência responde no SLO RNF014; medir sem PII.
- Logs server-side registram rota/operação, status, duração e correlation id gerado, nunca body, query do callback, cookies, headers sensíveis, e-mail, nascimento, OTP ou senha. Erro do client não inclui valores de formulário.
- Configuração inválida falha cedo e de modo redigido. Produção não inicia com provider de origem fixture, URL não HTTPS ou segredo ausente.
- `front/package.json` e raiz ficam em `0.10.0`; README, `.env.example`, docs e changelog refletem BFF, jornada, segurança, comandos e rollout.
- A implementação visual termina com uma rodada batched desktop/mobile, no máximo uma rodada de correção e uma confirmação, detector Impeccable aplicável, finish reviewer independente e documentação final em `DESIGN.md`/`.impeccable/design.json` quando o sistema visual for novo ou materialmente alterado.

## 7. Plano de Testes

Unitários (`bun run --cwd front test`):

- Schemas/envelopes: casos válidos/limites e rejeição de propriedades/valores fora do OpenAPI sem ecoar input.
- Máquina de etapas: todas as transições, estágio remoto dominante, voltar permitido/proibido, conclusão e reinício em `401`/expiração.
- Storage: schema v1, allowlist, TTL deslizante de 30 min, relógio limite, versão incompatível, JSON corrompido, conclusão/cancelamento e prova de que campos proibidos não são gravados.
- Countdown: relógio antes/no/depois de `nextResendAt` e `expiresAt`, aba suspensa e correção ao recuperar foco, sempre recalculando pela data absoluta.
- Formulários: prevenção de duplo envio, idempotency key reutilizada apenas na tentativa incerta, senha descartada, OTP de seis dígitos, ao menos três interesses e documentos ausentes.
- Componentes: WhatsApp desabilitado/“Em breve”, labels/descrições, foco por etapa/erro, live regions e navegação por teclado.
- Direção visual: entrada de confiança antes do nascimento, copy não romântica, hierarquia do comp **Convite Cívico**, uma ação primária, progresso fora da cor e justificativas de dados sensíveis.
- Segurança: serializer de props e logger/redactor rejeitam/omitem nomes de campos sensíveis.

Integração Next/BFF:

- Route Handlers contra servidor NestJS fake validam métodos, paths, bodies, status/envelopes, `no-store`, timeout, idempotência e ausência de retry implícito.
- Cookie: emissão, rotação, atributos publicados, TTL, expiração em `401`/conclusão e ausência em resposta/JavaScript; configuração local fica isolada.
- CSRF/CORS: mesma origem aceita; Origin ausente/múltipla/divergente, content type incorreto e preflight/cross-origin não autorizado falham sem chamada upstream.
- Origem: somente header Vercel singular e IP válido produz HMAC; `X-Forwarded-For`/`X-Real-IP` forjados são ignorados; nenhum IP entra no request do backend/log.
- Callback: token válido/inválido/consumido, `303`, URL final limpa, `Referrer-Policy: no-referrer`, query/token ausentes de log e cookie somente quando `verified:true`.
- Contrato: snapshot dos DTOs públicos ou cliente gerado/fixture validado contra OpenAPI da SDD-009; mudança incompatível falha explicitamente.
- RSC: snapshot, documentos e interesses independentes iniciam em paralelo; somente payload mínimo é serializado ao Client Component.

E2E full-stack pelo runner descartável:

- caminho feliz e-mail: nascimento elegível → pedido → OTP → senha → dados → documentos fixture aprovados → três interesses → nascimento final → conclusão/limpeza;
- callback por link e histórico/URL final sem token;
- menor de idade; WhatsApp sem request; OTP inválido, expirado e bloqueado; reenvio antes/depois do cooldown; reload em cada estágio; aba fechada/retomada; TTL local expirado; sessão backend expirada; `409` e `401`;
- falha Brevo mantém resposta neutra; contato existente e rate limit não alteram copy/shape observável;
- senha comum; menos de três interesses; interesse inativo; documentos ausentes/incompletos e placeholder incapaz de ativar;
- teclado em todo o caminho, foco, leitor de tela por inspeção semântica, contraste automatizado e manual, zoom 200% e viewport móvel/desktop;
- nenhum fixture, snapshot, trace, screenshot ou log contém PII/segredo real; usar domínios reservados e tokens fictícios.

Validação final:

- `bun run --cwd front lint`
- `bun run --cwd front typecheck`
- `bun run --cwd front test`
- `bun run --cwd front build`
- runner E2E do frontend/full-stack adicionado por esta implementação, usando Bun e o PostgreSQL descartável da SDD-008;
- `bun run --cwd back test:e2e` como regressão do contrato e `bun run --cwd back build` se configuração/documentação compartilhada tocar o backend;
- revisão manual com navegador real sem extensão, rede móvel simulada e JavaScript storage/cookies inspecionados.
- capturas válidas de 1440 px e 390 px na mesma rodada, inspeção dos arquivos gerados, correção material em lote e uma única confirmação adicional, conforme o limite do `impeccable`.
- comparação visual explícita das capturas com `.impeccable/mocks/decision/cadastro-convite-civico.png`, registrando desvios materiais de hierarquia, densidade, tipografia, ritmo editorial e responsividade antes da confirmação final.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---:|---:|---|
| Schema frontend divergir do OpenAPI | média | alto | Módulo único de contratos, teste de contrato e backend como autoridade; sem coerção silenciosa. |
| Token/cookie vazar por callback, log ou header | baixa | crítico | BFF server-only, redaction allowlist, `303`, `no-referrer`, `no-store` e testes negativos. |
| CSRF ou spoofing de origem no BFF | média | alto | Origin estrito, JSON, SameSite, header Vercel exclusivo, HMAC e credencial interna. |
| Progresso local guardar campo proibido | média | alto | Serializer por allowlist, Zod, TTL, chave única e teste que enumera propriedades sensíveis. |
| Etapa local divergir do backend após reload/rotação | média | alto | Snapshot autoritativo, ressincronização única em `409` e limpeza/restart em `401`. |
| Retry/duplo clique repetir efeito | média | alto | Controle pending, chave por tentativa lógica, sem retry automático e cobertura concorrente. |
| Documento sem conteúdo ser tratado como aceite | alta enquanto jurídico pendente | crítico | Bloqueio explícito, fixtures só em teste e backend revalida três documentos aprovados. |
| Countdown incorreto por suspensão/clock | média | médio | Datas absolutas do backend e recálculo por tick/foco; servidor decide cooldown/expiração. |
| RSC serializar dado excessivo ou criar waterfall | média | médio | View models mínimos, fetch paralelo e testes de ordem/props; regras Vercel citadas. |
| Acessibilidade degradar em máquina de etapas | média | alto | Semântica nativa, foco testado, live region, teclado, leitor de tela, contraste e zoom manual. |
| Brevo aceitar pedido mas entrega falhar | média | médio | Copy neutra, expiração/reenvio claros e observabilidade apenas no backend. |
| Ambiente local não suportar cookie `Secure` | alta | médio | Configuração local/teste explicitamente não publicada; produção exige `__Host-` seguro e HTTPS. |
| Catálogo/documentos indisponíveis afetarem a página inteira | média | médio | Suspense/error boundary por região, retry manual e etapas anteriores ainda utilizáveis. |

Rollout:

1. Publicar configuração server-only e BFF com `REGISTRATION_HTTP_ENABLED=false` no backend; validar health/build sem expor a rota ao público.
2. Configurar Vercel direta, HTTPS, `BACKEND_INTERNAL_URL`, `FRONTEND_PUBLIC_URL`, `BFF_INTERNAL_TOKEN`, `ORIGIN_FINGERPRINT_KEY` e `EDGE_PROVIDER=vercel`; confirmar que os segredos correspondem ao backend e não possuem prefixo público.
3. Executar testes de contrato e E2E com Brevo fake e documentos fixture não jurídicos; depois smoke operacional com conta/cota, remetente individual verificado, API key e URL pública.
4. Confirmar três documentos reais aprovados e artefatos preservados antes de liberar ativação; sem eles, publicar somente ambiente de teste com conclusão bloqueada.
5. Habilitar `REGISTRATION_HTTP_ENABLED`, fazer canário interno, auditar logs/headers/cookies e então liberar `/cadastro`.

Rollback: desligar `REGISTRATION_HTTP_ENABLED` e a rota/feature do frontend, expirar o cookie no BFF e reimplantar frontend anterior. Não alternar para chamada direta ao NestJS nem para origem/header genérico. Não há migration ou dado frontend a reverter; sessões backend expiram/revogam conforme ADR-021.

## 9. Perguntas em Aberto (bloqueantes)

Nenhuma. O contrato OpenAPI, a continuação, BFF, CORS/CSRF e origem confiável estão definidos pelos ADRs aceitos e pela SDD-009 `ready`. Conteúdo jurídico e credenciais Brevo são gates de rollout, não ambiguidades de implementação; ativação real permanece bloqueada até esses pré-requisitos operacionais existirem.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Toda decisão material está coberta por ADR aceito; nenhuma nova decisão material exige ADR `proposed`.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back e OpenAPI estão explícitos; PostgreSQL permanece inacessível ao frontend e não há migration.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices`, `nextjs-architecture`, `impeccable` e, para validar a fronteira existente, `nestjs-expert` foram aplicadas conforme o escopo.
- [x] Testes, ausência de migration, rollout e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.
