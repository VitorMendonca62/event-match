# 03 — Modelos de domínio e dados do EventMatch

## 1. Convenções

Este documento descreve o modelo conceitual derivado do DER v1.3. Não define tabelas nem escolhe ORM. Entidades de domínio não são entidades do ORM; adapters PostgreSQL fazem o mapeamento. Identificadores são opacos e datas persistidas em UTC, com fuso explícito quando relevante ao evento.

Toda coleção sensível deve ter classificação, política de acesso, retenção e trilha de auditoria. Requisitos canônicos: [`DER-EventMatch-MVP.md`](DER-EventMatch-MVP.md).

## 2. Agregados principais

### 2.1 Account

Raiz da identidade de acesso.

- `accountId`, `status`, `birthDate` privado, `ageBand` derivada, `createdAt`.
- Contatos confirmáveis: e-mail e celular, cada qual único entre contas ativas.
- Credencial, sessões, versões de aceites e configuração “manter conectado”.
- Estados sugeridos: `pending_verification`, `active`, `age_verification`, `recovery_restricted`, `deactivation_pending`, `deactivated`, `deletion_pending`, `deleted`, `suspended`.
- Invariantes: maioridade; ao menos um contato confirmado; troca de senha invalida outras sessões; não remover único meio confirmado.

Referências: RF001–RF011, RF057–RF062, RF075–RF078, RF088–RF089; RN001–RN016, RN078–RN106, RN124–RN130.

### 2.2 Profile

- `profileId`, `accountId`, `displayName`, foto, apresentação, região aproximada e intenção.
- Interesses (mínimo três), campos opcionais e uma política de visibilidade por campo.
- Nascimento completo, e-mail e celular nunca integram a visão pública.
- Habilitação de anfitrião é capacidade derivada, não papel permanente.

Referências: RF004, RF006, RF012–RF016, RF081; RN004, RN008–RN014, RN018, RN112–RN114.

### 2.3 Event

- `eventId`, anfitrião atual, atividade, título, descrição, data/início, região, ponto exato protegido, capacidade e modalidade de entrada.
- Opcionais: imagem, término, custo estimado informativo, acessibilidade, alimentação, faixa etária, itens e orientações.
- Estados: `draft`, `published_open`, `full`, `cancelled`, `completed`, `not_held`.
- Histórico de alterações importantes e transferências.
- Invariantes: presencial, informal, gratuito, local público, capacidade >= confirmados, um anfitrião confirmado.

Referências: RF017–RF024, RF033–RF038, RF071, RF084–RF087; RN017–RN031, RN042–RN049, RN137.

### 2.4 ParticipationRequest e Participation

Separe intenção pendente de participação confirmada.

- `ParticipationRequest`: estado `pending|accepted|rejected|withdrawn|closed`, mensagem opcional, decisão/motivo protegido e contagem de tentativa.
- `Participation`: estado `confirmed|reconfirmation_pending|withdrawn|removed|age_verification|cancelled`, origem e reserva de vaga.
- `Attendance`: `attended|not_attended|uncertain`, realização do evento e eventual contestação.
- Operações de aceite, desistência, retirada e restauração devem atualizar a vaga atomicamente.

Referências: RF028–RF035, RF037–RF038, RF045–RF046, RF069–RF070, RF079, RF088–RF089, RF103, RF107; RN022–RN046, RN124–RN130, RN167–RN168.

### 2.5 EventConversation

- Uma conversa por evento; `Message`, `MessageAttachment`, `HostNotice`, `ModerationAction`, `Mute` e `ModerationAppeal`.
- A mensagem preserva autor, versão atual, original protegido quando moderada, datas e estado de visibilidade.
- Aviso pode ser comum ou essencial; no máximo um fixado.
- Controle de escrita/leitura deriva do evento e da participação, não apenas de um booleano local.

Referências: RF039–RF044, RF077, RF090, RF097, RF104; RN050–RN069, RN131–RN136, RN160–RN163.

### 2.6 Block

- Relação direcionada `blockerAccountId -> blockedAccountId`, estado e timestamps.
- A projeção de interação aplica efeitos recíprocos sem revelar quem bloqueou.
- Desbloqueio encerra a relação, mas não recria solicitações, conversas ou participações.

Referências: RF053–RF056, RF079; RN054–RN058, RN107, RN120.

### 2.7 ReportCase e SafetyRestriction

- `ReportCase`: protocolo, alvo polimórfico autorizado, categoria, relato, risco, status, anexos e responsável profissional.
- Status mínimos: `received`, `under_review`, `awaiting_information`, `completed`.
- `Appeal` e `EvidenceRequest` pertencem ao caso; anexos têm metadados, classificação e storage key, nunca URL pública.
- `SafetyRestriction`: tipo, motivo, responsável, início, duração/condição de término, escopo e contestação.
- Conflito de interesse impede atribuição/decisão pelo profissional envolvido.

Referências: RF049–RF052, RF057–RF058, RF065, RF072, RF076, RF080, RF091–RF097, RF106; RN075–RN084, RN089, RN097–RN110, RN138, RN150–RN155.

### 2.8 Review

- `Review`: autor confirmado, evento, respostas obrigatórias, campos opcionais, validade e flags de abuso/fraude.
- `ReviewAggregate`: projeção publicada somente com cinco autores válidos distintos.
- Comentário e respostas de segurança permanecem privados e não compõem ranking individual.

Referências: RF047–RF048, RF098–RF099; RN070–RN074, RN139–RN146.

### 2.9 Notification

- `Notification`: categoria, essencial/opcional, ocorrência, objeto afetado, ação, prazo, destino e estado de leitura.
- `NotificationPreference`: canais por categoria, preservando ao menos um canal para categorias essenciais.

Referências: RF063–RF064, RF094, RF105; RN088, RN164–RN166.

### 2.10 ProfessionalIdentity e AuditEntry

- Identidade profissional separada de perfil pessoal: nome de atendimento, e-mail corporativo único, função, equipe, status, entrada e identificador interno.
- Papéis: Atendimento, Analista de Confiança e Segurança, Responsável de Confiança e Segurança, Operação e Administrador autorizado.
- `CaseAssignment` registra escopo e declaração de conflito.
- `AuditEntry` é append-only: ator profissional, ação, alvo, contexto, instante, resultado e correlação; não replica conteúdo sensível desnecessário.

Referências: RF066–RF067, RF082–RF083, RF095–RF101; RN089–RN090, RN114, RN137–RN138, RN152–RN155.

### 2.11 Catalog

- `Catalog`, `CatalogOption`, ordem, estado ativo e intervalo de vigência.
- Referências históricas apontam para opção imutável/versionada; desativação não altera registros passados.
- Catálogos iniciais constam no DER §3.10.

### 2.12 DataRequest e RetentionHold

- `DataExportRequest`: autenticação reforçada, status, prazo de geração, expiração do download e artefato protegido.
- `DeletionRequest`: janela de cancelamento, etapas, anonimização e conclusão irreversível.
- `RecoveryCase` e `BirthDateCorrectionCase`: evidências protegidas, decisão, contestação e descarte.
- `RetentionPolicy`: categoria, base/finalidade, prazo e ação.
- `RetentionHold`: investigação, disputa ou ordem válida que suspende eliminação de itens específicos.

Referências: RF057–RF062, RF068, RF073–RF078; RN080–RN106, RN115–RN123.

## 3. Value objects e enums centrais

| Tipo | Valores/regras |
|---|---|
| `AgeBand` | `18_24`, `25_34`, `35_44`, `45_54`, `55_64`, `65_PLUS` |
| `EventStatus` | `DRAFT`, `PUBLISHED_OPEN`, `FULL`, `CANCELLED`, `COMPLETED`, `NOT_HELD` |
| `JoinMode` | `MANUAL_APPROVAL` (default), `AUTOMATIC` |
| `RequestStatus` | `PENDING`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, `CLOSED` |
| `ReportStatus` | `RECEIVED`, `UNDER_REVIEW`, `AWAITING_INFORMATION`, `COMPLETED` |
| `SafetyRating` | `VERY_UNSAFE`, `UNSAFE`, `NEUTRAL`, `SAFE`, `VERY_SAFE` |
| `Visibility` | `PRIVATE`, `APPROXIMATE`, `PARTICIPANTS`, `PUBLIC` conforme o campo |
| `ProtocolNumber` | identificador público não sequencial, sem vazar volume interno |

## 4. Integridade e concorrência

- Unicidade parcial para e-mail/celular confirmado em contas ativas.
- Aceite automático/manual e liberação de vaga usam transação e proteção contra corrida.
- Um pedido pendente por pessoa/evento; uma participação ativa por pessoa/evento.
- Capacidade nunca abaixo de confirmados; alteração e reconfirmação produzem histórico.
- Um aviso fixado por evento e um silenciamento de anfitrião de duas horas por reincidência prevista.
- Agregados de avaliação contam autores válidos distintos, nunca quantidade bruta de registros.
- Ações profissionais sensíveis e transições irreversíveis geram auditoria.

## 5. Classificação de dados

| Classe | Exemplos | Acesso |
|---|---|---|
| Público | nome de exibição, foto pública, região aproximada, dados públicos do evento | visitante conforme regras |
| Privado de conta | e-mail, celular, nascimento, sessões | titular e fluxos autorizados |
| Compartilhado no evento | ponto exato, participantes confirmados, conversa | participantes autorizados |
| Sensível operacional | denúncias, anexos, evidências, documentos, mensagem original moderada | profissional autorizado por caso |
| Interno | motivos internos, sinais de risco, auditoria, permissões | papéis específicos e menor privilégio |

## 6. Retenção e ressalva jurídica

Implemente retenção por categoria conforme `docs/02-regras-de-negocio.md §9`, com eliminação verificável, anonimização quando prevista e legal hold granular. RF068, RF073, RF074, RN068, RN080–RN083, RN093, RN096, RN100–RN104, RN115–RN122 e RNF023 não podem ter política final liberada sem validação jurídica brasileira.
