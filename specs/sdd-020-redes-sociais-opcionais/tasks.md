# Task: Adicionar redes sociais opcionais e controladas ao perfil

- **Slug:** redes-sociais-opcionais
- **Autor do plano:** Code-Planner (SDD)
- **Data:** 2026-10-07
- **Status:** ready
- **Versão-alvo:** workspace/front `0.17.0`; back `0.16.0` (próximas versões menores disponíveis)
- **Tipo:** feature
- **Impacto público:** additive

## 1. Contexto e Motivação

A Task 18 implementa “redes sociais” como campo opcional do RF081. A pessoa deve poder compartilhar presença social com controle de privacidade, sem criar diretório de contatos, importar pessoas, buscar conteúdo remoto ou prometer que o perfil externo é verificado.

Rastreabilidade: `docs/DER-EventMatch-MVP.md` RF015 e RF081; RN009, RN014 e RN112; RNF001. Também se aplicam `docs/02-regras-de-negocio.md` §2, `docs/03-modelos-de-dominio.md` §2.2, `docs/04-integracoes-externas.md` §§4–5, ADR-038 e ADR-049. A superfície é o brief `front/.impeccable/surfaces/src-app-perfil-page-tsx.md` em modo Operate.

> **Gate de execução:** concluído em 2026-10-07 com o aceite da ADR-049.

## 2. Escopo

### Inclui

- [ ] Vínculos sociais opcionais, removíveis, ordenáveis, privados por padrão e independentes da foto principal, interesses, completude e capacidades.
- [ ] Persistir somente provedor permitido e identificador canônico; derivar URL de saída a partir da configuração confiável do provedor.
- [ ] Aceitar URL colada ou identificador apenas como entrada, normalizar no backend e rejeitar esquemas, hosts, credenciais, portas, query strings, fragmentos, redirecionadores e caminhos que não sejam perfil pessoal permitido.
- [ ] Visibilidade individual `private | authenticated` no contrato editável; `public` continua reservado e sem exposição real nesta entrega.
- [ ] Atualizar visão própria, prévia, DTOs/OpenAPI, BFF, documentação e testes, sem fazer fetch remoto.

### Exclui

- Campo genérico para URL, OAuth, login social, importação de amigos, scraping, preview de perfil, avatar externo ou confirmação de propriedade.
- Fetch server-side/client-side, resolução de redirecionamento, DNS, webhook ou telemetria com URL/identificador.
- Perfil público, diretório, busca, ranking, recomendação ou visibilidade efetiva a terceiros enquanto a superfície autorizada e a moderação não existirem.
- Alteração de dados obrigatórios, completude, capacidades, cadastro, sessão ou modelo de eventos.

## 3. Impacto Arquitetural e ADRs

### Estrutura prevista

```text
back/drizzle/0012_profile_social_links.sql

back/src/modules/profiles/
├── domain/
│   ├── entities/profile.ts                         (+ socialLinks no snapshot)
│   ├── value-objects/social-link.ts                (+ provider registry, parser e normalização)
│   └── ports/outbound/profile-repository.port.ts
├── application/use-cases/profile.use-cases.ts      (+ snapshot completo)
├── infrastructure/persistence/
│   ├── schema/profiles.schema.ts                   (+ profileSocialLink)
│   └── drizzle-profile-repository.adapter.ts        (+ leitura/substituição ordenada)
└── presentation/http/dto/
    ├── profile-request.dto.ts
    └── profile-response.dto.ts

front/src/
├── features/profile/components/profile-social-links-field.tsx
├── features/profile/{contracts,messages}.ts
├── app/perfil/page.tsx
└── app/api/profile/route.ts                         (BFF existente, sem rota nova)
```

### Fluxo

```text
GET /perfil (RSC)
  -> GET /api/v1/profiles/me -> socialLinks próprios { id, provider, identifier, position, visibility }
  -> ilha ProfileForm recebe somente a lista necessária

PUT /api/profile
  -> BFF valida origem, JSON e schema estrito; não chama URL externa
  -> PUT /api/v1/profiles/me
     -> ValidationPipe + UpdateOwnProfile [UoW + revision]
        -> Profile normaliza e valida provider/identificador
        -> adapter substitui profile_social_link em ordem canônica
  <- visão própria com URL derivada somente para apresentação

GET /perfil/previa
  -> ProfilePreviewProjector inclui apenas vínculos authenticated autorizados;
     nesta entrega, a rota segue exclusiva da titular e não entrega a terceiros.
```

### Hexagonal, DI e NestJS (`nestjs-expert`, `nestjs-hexagonal-architecture`)

- `SocialLink` e o registro de provedores pertencem ao domínio `profiles`, sem NestJS, Drizzle, `URL` do Node exposto a controllers ou host vindo do browser.
- `Profile.update` é a autoridade de limite, unicidade de provedor, ordem e audiência. DTOs repetem somente forma para devolver `400` cedo; parser/normalização não ficam no controller nem BFF.
- O adapter Drizzle lê e substitui a relação na mesma UoW e compare-and-set que o snapshot atual. Não há módulo, integração externa, provider de Nest ou `forwardRef()` novo.
- Controller existente usa constructor injection, `ValidationPipe`, DTOs `class-validator`, Swagger e o filter de erros já empregado; sem retorno de URL bruta ou erro que ecoe o valor informado.

### RSC, BFF e performance (`vercel-react-best-practices`, `nextjs-architecture`)

- A leitura entra no `GET /profiles/me` já usado pelo RSC; não cria cascata (`async-parallel`, `server-serialization`, `server-no-shared-module-state`).
- A ilha cliente recebe lista pequena, sem catálogo/fetch adicional. Opções de provedores e rótulos são módulos estáticos importados diretamente (`bundle-barrel-imports`, `bundle-analyzable-paths`).
- `ProfileSocialLinksField` mantém estado derivado durante a renderização e edita no handler (`rerender-derived-state-no-effect`, `rerender-move-effect-to-event`). Não há SDK de rede social nem script de terceiro.
- O Route Handler existente permanece BFF: autentica, valida origem e proxy; não valida semântica duplicada, não acessa PostgreSQL e não segue links (`server-auth-actions`).

### PostgreSQL e migration

Migration `0012_profile_social_links.sql`, aditiva e forward-only:

| Objeto | Colunas | Integridade |
|---|---|---|
| `profile_social_link` | `id uuid`, `account_id uuid`, `provider text`, `canonical_identifier text`, `position smallint`, `visibility text`, timestamps | PK `id`; FK `account` com cascade; único `(account_id, provider)`; único `(account_id, position)`; `provider IN ('instagram','linkedin','x')`; posição `1..3`; checks de audiência e tamanho |

Os provedores são Instagram, LinkedIn e X, com no máximo um vínculo de cada e três vínculos no total. Contas existentes começam com zero linhas. A URL não é coluna, não é persistida e não aparece em índice, log ou telemetria. A exclusão/expiração da conta remove relações por cascade/purga do perfil.

Rollback: desligar a UI e retornar aplicações, preservando schema e vínculos privados; sem down migration destrutiva.

### ADRs

| Decisão | ADR | Status | Razão |
|---|---|---|---|
| Allowlist de provedores, identificador canônico, URL derivada, privacidade e ausência de fetch externo | `docs/adrs/ADR-049-redes-sociais-opcionais-do-perfil.md` | accepted | Evita URL arbitrária, SSRF, rastreamento e personificação de host. |
| Snapshot, revisão otimista e projeção por audiência | ADR-038 | accepted | Padrão existente do perfil. |

Toda ADR necessária deve estar `accepted` antes da implementação.

## 4. Contratos e Interfaces

### 4.1 Domínio (pseudocódigo)

```ts
type SocialProvider = 'instagram' | 'linkedin' | 'x';
type SocialLink = Readonly<{
  id: string;
  provider: SocialProvider;
  canonicalIdentifier: string;
  position: number;
  visibility: 'private' | 'authenticated' | 'public';
}>;

function parseSocialLink(input: { provider: string; identifierOrUrl: string }): {
  provider: SocialProvider;
  canonicalIdentifier: string;
};
function toSocialProfileUrl(link: SocialLink): string;

ProfileState += { socialLinks: readonly SocialLink[] };
// Profile.update valida limite, providers únicos, posições 1..N, identificadores e audience editável.
```

O domínio aceita somente os provedores e padrões aprovados pela ADR-049. Receber um `https://` é conveniência de entrada; o valor bruto é descartado após o parse. Qualquer esquema, host, credencial, query, fragmento, porta, caminho fora da regra ou duplicata resulta em `INVALID_PROFILE_CONTENT` (`400`) sem mutação parcial.

### 4.2 HTTP NestJS e BFF

| Método e rota | Mudança | Sucesso | Falhas |
|---|---|---|---|
| `GET /api/v1/profiles/me` | `+ socialLinks[]` próprios, ordenados; URL de exibição derivada somente na resposta | `200` | existentes |
| `PUT /api/v1/profiles/me` | `+ socialLinks[]` como chave obrigatória do snapshot: `{ id?, provider, identifierOrUrl, position, visibility }` | `200` | `400`, `401`, `403`, `409`, `503` |
| `GET /api/v1/profiles/me/preview` | adiciona somente vínculos `authenticated` autorizados; não há entrega a terceiro nesta tarefa | `200` | existentes |
| `PUT /api/profile` | BFF existente valida/passa `socialLinks[]`, mesma origem e sem retry | `200` | mesmos mapeamentos |

Compatibilidade: leitura aditiva; a escrita exige a chave nova para preservar o snapshot atômico, portanto backend e frontend são publicados coordenadamente. `public` continua conhecido pelo domínio/schema, mas é rejeitado no DTO e Zod editáveis, como os demais campos do perfil.

### 4.3 UX e acessibilidade (`impeccable`)

- Inserir “Presença social (opcional)” em `/perfil`, após “Identidade e comunicação” e antes de “O que você busca”. Explicar que o EventMatch não verifica os perfis externos e que links ficam privados inicialmente.
- Seleção de provedor controlada, campo claramente rotulado para identificador ou link, ajuda específica por provedor e erro associado. Nunca usar placeholder como único rótulo.
- Itens permitem remover, mover para cima/baixo e escolher audiência. Reordenação por teclado é equivalente a qualquer drag-and-drop; todos os alvos têm pelo menos 44 px, foco visível e anúncio de posição.
- A prévia mostra somente o que estaria compartilhado; em nenhuma tela desta entrega um vínculo abre automaticamente, faz preview remoto ou parece uma confirmação de identidade.
- Atualizar o surface brief antes da UI. Validar desktop, mobile, teclado, leitor de tela e zoom de 200%; executar detector e finish review em no máximo dois passes.

## 5. Regras de Negócio

| # | Regra atual | Após a mudança | Origem |
|---|---|---|---|
| 1 | Perfil não possui vínculos sociais. | Pode conter zero até o limite aprovado de vínculos, por provedor permitido e sem repetição. | RF081; ADR-049 |
| 2 | Não há URL social persistida. | Persiste apenas identificador canônico; URL é derivada de configuração confiável. | Task 18; ADR-049 |
| 3 | Campos opcionais começam privados. | Cada vínculo começa `private`; edição permite somente `private | authenticated`; `public` é recusado. | RF015, RN014; ADR-038 |
| 4 | Sem projeção social. | Prévia inclui apenas vínculo autorizado, ainda acessível apenas pela titular nesta entrega. | RF015; ADR-038 |
| 5 | Perfil atualiza por revisão. | Adição, edição, remoção e reordenação participam do mesmo snapshot e conflito `409`. | ADR-038 |
| 6 | Nenhuma integração social externa. | Não há OAuth, fetch, scrape, redirect resolution, token, webhook ou confirmação de propriedade. | Task 18; RN009 |

## 6. Critérios de Aceitação

- Apenas provider/host/formato aprovados entram no banco; identificador canônico não contém URL, query, fragmento, credencial ou espaço.
- Uma conta não duplica provedor, não excede o limite e não tem posições duplicadas; operações concorrentes geram um sucesso e um `409`, nunca relação parcial.
- Todo vínculo novo é privado; `public` recebe `400`; `authenticated` não é entregue fora de superfície autorizada.
- `GET /me` devolve vínculos em ordem estável, sem tokens; remoção os exclui de visão própria/prévia sem alterar interesses ou dados restantes.
- Backend/BFF/RSC não chamam domínio externo informado e logs/métricas/erros não incluem URL, identificador ou host de entrada.
- DTOs, Swagger, Zod, domínio e checks do banco convergem; adapters são injetados e não há acesso frontend→PostgreSQL.
- UI é acessível por teclado/leitor de tela/zoom 200%, usa labels persistentes, estados textuais e não induz confiança no perfil externo.

## 7. Plano de Testes

### Backend unitário

- Parser por provedor: identificador válido, URL colada válida, caixa/normalização, host falso, subdomínio, credenciais, porta, query, fragmento, caminho errado, redirector e esquema não HTTPS.
- `Profile`: limite, um vínculo por provedor, posições, reorder, `private | authenticated`, rejeição de `public` e conflito.
- Projeção: omite privados e nunca inclui URL crua; telemetria contém somente operação/resultado/correlação.
- DTO/controller via `Test.createTestingModule`: `400`, Swagger e guards.

### Backend integração e E2E

- Upgrade `0011 -> 0012`: FK cascade, checks, unicidades e contas existentes vazias.
- UoW com falha e duas revisões concorrentes não deixam posições/links parciais.
- Supertest: ownership, BFF token/sessão, snapshot completo, `409`, preview e OpenAPI.

### Frontend unitário, integração e E2E

- Schemas estritos, serialização mínima, recusa de `public`, rótulos e ordenação.
- BFF não faz fetch para valor de link e retorna falha neutra para upstream inválido.
- Playwright: adicionar, editar, mover por teclado, remover, salvar/recarregar, preview, conflito de abas, mobile, axe e zoom 200%.

Ao implementar: `bun run --cwd back lint`, `bun run --cwd back typecheck`, `bun run --cwd back test`, `bun run --cwd back test:e2e`, `bun run --cwd front lint`, `bun run --cwd front typecheck`, `bun run --cwd front test`, `bun run --cwd front test:e2e`, ambos os builds e `bun run --cwd back db:migrate` em banco descartável.

## 8. Dependências e Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Formatos de provedores mudam | média | médio | Registro versionado por provedor, testes de parser e mudança revisada/ADR quando material. |
| Link malicioso ou host parecido | alta | alto | allowlist exata, persistir identificador, URL derivada e zero fetch/redirecionamento. |
| Personificação externa | média | médio | texto “não verificado”, ausência de OAuth e denúncia futura; não tratar como identidade. |
| Exposição indevida | média | alto | privado por padrão, `public` bloqueado e nenhuma superfície de terceiro nesta entrega. |
| Conflito de ordem/snapshot | média | médio | revisão otimista, UoW e índices únicos. |

Rollout: flag de UI desligada → migration → backend → frontend → smoke/E2E → habilitar UI. Rollback desliga a UI e preserva dados/schema; migrations corretivas são forward-only.

## 9. Perguntas em Aberto (bloqueantes)

- [x] Provedores iniciais: Instagram, LinkedIn e X, restritos a perfis pessoais. WhatsApp fica em estudo e fora deste escopo por poder revelar telefone e iniciar contato direto.
- [x] Máximo de um vínculo por provedor; com os três provedores iniciais, o perfil comporta no máximo três vínculos.
- [x] A UI aceita identificador ou URL colada; o backend persiste somente o identificador canônico.
- [x] A edição aceita `private | authenticated`; `authenticated` aparece somente na prévia da titular nesta entrega. Exposição real aguarda perfil de terceiros, moderação e denúncia.

## 10. Checklist de Conformidade

- [x] Decisões citam `docs/` e ADRs.
- [x] Um ADR `proposed` foi criado para cada decisão material.
- [x] Nenhum código de produção foi escrito.
- [x] Contratos front/back, OpenAPI e PostgreSQL estão explícitos.
- [x] Performance, segurança e observabilidade foram tratadas.
- [x] `vercel-react-best-practices`, `nestjs-expert`, `nextjs-architecture`, `nestjs-hexagonal-architecture` e Impeccable foram aplicadas conforme o escopo.
- [x] Testes, migration e rollback estão planejados.
- [x] Perguntas em aberto foram exauridas.
