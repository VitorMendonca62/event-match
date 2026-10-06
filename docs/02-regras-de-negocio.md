# 02 — Regras de negócio do EventMatch MVP

## 1. Fonte e uso

As regras normativas completas são RN001–RN168 em [`DER-EventMatch-MVP.md`](DER-EventMatch-MVP.md), versão 1.3. Este documento é um mapa operacional de invariantes e transições; em divergência, consulte o DER e registre a correção documental.

## 2. Conta, perfil e acesso

- Somente pessoas com 18 anos completos podem criar conta; nascimento nunca é público (RN001, RN009).
- E-mail e celular confirmados são únicos por conta ativa. Cadastro exige ao menos um contato; anfitrião exige ambos (RN002–RN005, RN018).
- Senha tem mínimo de oito caracteres, não aceita somente espaços nem senha óbvia; não há composição artificial obrigatória (RN006–RN007).
- Perfil exige ao menos três interesses. Nome de exibição não é único e não existe username no MVP (RN004, RN008).
- Faixas públicas: 18–24, 25–34, 35–44, 45–54, 55–64 e 65+ (RN010).
- Localização do aparelho é opcional e pontual; não há rastreamento. Dados sensíveis/opcionais são privados por padrão (RN011–RN014, RN112).
- Contatos não mudam simultaneamente; o atual permanece válido até confirmação do novo. O único meio confirmado não pode ser removido (RN015, RN113).
- Correção do nascimento é fluxo protegido com análise humana; suspeita de menoridade suspende ações e protege o histórico conforme RN092–RN096 e RN124–RN130.

### Cadastro, verificação e retomada

- O fluxo é nascimento/elegibilidade → contato → verificação → senha com aceite dos documentos (só em memória até a conclusão, ADR-031) → dados obrigatórios → interesses → revisão com nova validação do nascimento → campos opcionais. A confirmação do contato acontece antes de criar o registro provisório de cadastro.
- OTP é válido por 15 minutos; são permitidas cinco falhas por desafio e, então, bloqueio de 20 minutos, sem contar tentativas posteriores. Há reenvio após 60 segundos, até três por desafio e por contato/hora; cada reenvio gera novo código e renova a validade. Há no máximo cinco desafios por contato/hora; um novo pedido substitui o desafio aberto, exceto durante o bloqueio. Há no máximo dez desafios por origem/hora, contados pela fingerprint derivada pelo BFF sem persistir IP (ADR-023); acima do limite a resposta continua neutra e nenhum desafio é criado.
- E-mail usa OTP e link de uso único; o link expira junto com o desafio, é invalidado por reenvio ou por confirmação via OTP e pode ser aberto em outro navegador, que passa a deter a continuação. WhatsApp permanece como canal futuro para celular no Brasil, mas na primeira publicação aparece desabilitado com “Em breve” e não pode iniciar cadastro (ADR-025). Todas as respostas para contato já associado, OTP inválido, expirado ou bloqueado são neutras e não revelam a existência de conta.
- Após contato e senha válidos, `Registration` permanece em progresso por até 24 horas sem atualização. Ao salvar os dados obrigatórios do RF004 (nome de exibição, cidade/região e intenção de uso), a `Account` é persistida como incompleta e somente pode retomar o cadastro; após 15 dias sem atualização, expira com anulação imediata dos dados pessoais e libera o contato (ADR-017).
- A data de nascimento é a primeira informação após a apresentação e é validada pelo backend antes da coleta do contato. Ela não é persistida nessa etapa nem no navegador; após refresh, deve ser informada novamente. Na conclusão, a data é solicitada outra vez, revalidada e só então persistida na conta ativa. Data de menor de idade é recusada sem persistência. A conta torna-se ativa somente em transação que revalida maioridade, contato confirmado, senha, dados obrigatórios, ao menos três interesses e aceites efetivos versionados. Placeholder lorem ipsum não habilita conclusão nem gera aceite jurídico. Só a versão vigente de cada documento (Termos de Uso, Política de Privacidade e Regras de Convivência) é oferecida e aceita: cada aceite é um controle explícito e desmarcado por padrão (“Li e concordo com …”, com o nome do documento como link que abre o texto num diálogo com Aceitar e Recusar; versão e vigência não são exibidas), e a recusa explica que sem os três aceites a conta não é ativada, permite rever os documentos ou cancelar o cadastro e não grava aceite algum. Cancelar o cadastro (botão “Cancelar cadastro”, no cabeçalho ou no aviso de recusa) executa de imediato a expiração de cadastro abandonado: dados retidos anulados, conta incompleta expirada, contato liberado e continuação revogada (ADR-030). Se uma nova versão entrar em vigor durante o cadastro, a conclusão é recusada, os documentos são recarregados e a pessoa aceita novamente; o aceite já gravado nunca é alterado (ADR-028).
- A retomada entre etapas usa exclusivamente a continuação opaca emitida após a elegibilidade (ADR-021): cada etapa só aceita o estágio anterior esperado, mudanças de privilégio rotacionam a continuação e a conclusão a revoga. Identificadores internos nunca autorizam operações.
- O navegador pode reter por no máximo 30 minutos, em `sessionStorage` versionado, apenas etapa, nome de exibição, cidade/região, intenção, interesses e campos opcionais. Segredos, contato, nascimento, OTP, tokens, aceites e respostas do backend não são retidos localmente.

### Login, sessão e primeiro acesso (SDD-013)

- Concluir o cadastro não autentica: `/cadastro/concluido` oferece “Entrar no EventMatch” (`/entrar`) e o login é sempre explícito (ADR-037). A continuação do cadastro nunca autoriza `/inicio` nem `/api/auth/**`, e a sessão comum nunca autoriza operações do cadastro.
- Somente conta `active`, com e-mail confirmado e senha correta, recebe sessão comum. Contato inexistente, senha errada e qualquer outro estado (`account_incomplete`, `expired`, `age_verification`, `recovery_restricted`, `deactivation_pending`, `deactivated`, `deletion_pending`, `deleted`, `suspended`) recebem a mesma recusa neutra, sem sessão (ADR-036). O caminho de contato inexistente também executa uma verificação Argon2id (dummy).
- Sem “Manter conectado” (padrão desmarcado): 12 horas absolutas, 30 minutos de inatividade e cookie que termina com o navegador. Com “Manter conectado”: 30 dias absolutos, 7 dias de inatividade, cookie persistente até o limite absoluto e rotação transparente do segredo a cada 24 horas. Atividade renova só a inatividade (gravada no máximo a cada 5 minutos); o prazo absoluto exige novo login (ADR-033).
- Uma conta mantém até cinco sessões; o sexto login remove a sessão válida menos recentemente usada. Logout revoga só a sessão atual e apaga o cookie; reutilizar o segredo depois é recusado. Encerrar as outras sessões (RF011) fica para tarefa futura.
- Estado e capacidade são reavaliados em cada requisição protegida: conta que deixa de estar `active` perde a sessão imediatamente (recusa neutra `401`); conta `active` com capacidade negada recebe `403` genérico e mantém a sessão. As capacidades liberadas são `authenticated_home`, `logout`, `profile_read` e `profile_write`; o resto é negado por padrão.
- Falhas de login consomem dois limites independentes em janela deslizante de 15 minutos: 5 por contato (inclusive inexistente) e 30 por origem. Cada tentativa reserva nos dois antes da consulta à conta; sucesso libera a reserva, então logins bem-sucedidos não contam. Acima de qualquer limite a resposta é genérica, sem escopo nem tempo de espera, e a janela libera sozinha; não há bloqueio permanente (ADR-035).
- `/inicio` confirma o acesso sem contato ou id. “Completar perfil” é acionável quando a completude autoritativa está incompleta; “Descobrir encontros” continua “Em breve”. A recuperação de senha ainda não existe e `/entrar` informa isso sem link quebrado.

### Completar perfil (SDD-015)

- Nome, região aproximada, intenções e interesses existentes podem ser editados; permanecem obrigatórios ao menos uma intenção e três interesses ativos. Apresentação (1–500 caracteres quando presente) e foto principal são opcionais para uso comum e privadas por padrão.
- Completude deriva de seis itens: nome, região, intenção, três interesses, apresentação e foto. Ela não é persistida, não bloqueia sessão e não concede capacidade de anfitrião.
- Toda mutação exige a revisão observada. Revisão obsoleta retorna conflito e não sobrescreve outra aba.
- A API/UI desta entrega aceita somente visibilidade `private | authenticated`; `public` permanece reservado até existir exposição, moderação e denúncia.
- A prévia pertence somente à titular e omite campos privados, contato, nascimento, estado/restrição e ids internos.
- “Agora não” adia o convite por sete dias naquele navegador e conta; o cookie não altera dados, completude ou autorização.
- Foto aceita JPEG/PNG/WebP estático até 5 MiB e mínimo 320×320. Upload incompleto/forjado não ativa asset; substituição e remoção convergem por cleanup idempotente.

### Identidade opcional do perfil (SDD-016)

- Pronomes, profissão e idiomas são opcionais, removíveis, privados por padrão e não alteram os seis itens de completude nem concedem capacidades.
- Pronomes usam `ela_dela`, `ele_dele`, `elu_delu`, `other` ou `prefer_not_to_say`. `other` exige texto de até 40 caracteres; `prefer_not_to_say` força audiência privada e nunca aparece na prévia. Trocar entre as demais opções preserva a escolha de compartilhamento; sair de `prefer_not_to_say` sempre reabre o grupo como `private`, nunca restaura um compartilhamento anterior.
- Profissão é autodeclaração textual de até 80 caracteres, sem selo ou verificação. Textos livres rejeitam controles e contato evidente.
- A pessoa escolhe até cinco códigos únicos do catálogo de idiomas, sem proficiência. Idioma inativo já selecionado pode ser preservado, mas não readicionado após remoção.
- Pronomes, profissão e idiomas possuem controles independentes entre `private` e `authenticated`; `public` continua reservado.

## 3. Eventos e anfitriões

- Apenas encontros presenciais, informais, gratuitos e em local público/estabelecimento identificável podem ser publicados (RN019–RN020).
- Ponto exato é visível ao anfitrião e confirmados; acesso profissional exige necessidade concreta e autorização no caso (RN021, RN152).
- Aprovação manual é a modalidade padrão; entrada automática é opcional e respeita capacidade, bloqueios e restrições (RN023–RN024, RN111).
- Mudança de data, horário, cidade, ponto exato ou atividade exige reconfirmação (RN028, RN042–RN046).
- Evento gratuito não vira pago; capacidade não fica abaixo dos confirmados; cancelamento é irreversível; evento nunca fica sem anfitrião confirmado (RN029–RN031).
- Anfitrião novo: um evento futuro ativo e dois publicados por 30 dias. Torna-se experiente após dois eventos válidos sem ocorrência relevante; experiente pode manter três futuros simultâneos (RN047–RN049).

### Estados canônicos

| Agregado | Estados | Origem |
|---|---|---|
| Evento | `draft`, `published_open`, `full`, `cancelled`, `completed`, `not_held` | RF085 |
| Solicitação | `pending`, `accepted`, `rejected`, `withdrawn`, `closed` | RF086 |

Transições devem registrar ator, instante, motivo quando exigido e efeitos em vagas, conversa e notificações.

## 4. Participação, vagas e presença

- Solicitação pendente é única e não reserva vaga (RN022).
- Aceite/entrada ocupa vaga atomicamente; desistência libera imediatamente e encerra a participação (RN032, RNF011).
- Recusa só usa motivo legítimo; critérios discriminatórios são proibidos (RN034–RN035).
- Retirada de confirmado exige causa prevista, notificação e contestação; nunca serve para favorecer outra pessoa (RN036–RN037).
- Recusado não solicita novamente; retirada antes da decisão e desistência voluntária permitem uma nova tentativa nas condições definidas; removido não retorna (RN038–RN041, RN167–RN168).
- Presença divergente admite contestação e não gera punição automática (RN033).
- Bloqueio prévio com pessoa confirmada impede nova participação com mensagem neutra (RN107).

## 5. Conversa, avisos e moderação

- Não há mensagens privadas. Conversa pertence ao evento e é acessível ao anfitrião e confirmados; novos confirmados veem o histórico (RN050–RN052).
- Até cinco imagens comuns de 10 MB por mensagem; documentos, vídeos e áudios são rejeitados (RN059).
- Evento concluído/não realizado mantém escrita por 48 h; cancelado fica somente leitura imediatamente. Consulta: anfitrião/confirmados por 90 dias, desistentes por 30 dias até a saída e removidos perdem acesso imediatamente (RN060–RN063).
- Autor edita somente sua mensagem. Anfitrião oculta conteúdo apenas pelas causas autorizadas, nunca crítica somente por ser negativa; original fica preservado conforme política aplicável (RN064–RN069).
- Aviso essencial permanece visível sob silêncio/bloqueio. Apenas um aviso fica fixado e seu conteúdo é limitado às finalidades definidas (RN053, RN160–RN161).
- Silenciamento do anfitrião exige reincidência, dura uma única janela de duas horas, preserva leitura e contestação; risco grave permite intervenção imediata da equipe (RN131–RN136, RN162–RN163).

## 6. Bloqueio, denúncias e segurança

- Bloqueio é imediato, recíproco nas interações/recomendações e não é comunicado ao bloqueado; desbloqueio não restaura relações anteriores (RN054–RN058).
- Denunciante, relato e anexos não são revelados automaticamente. Anexos são exclusivos da equipe autorizada (RN075–RN077).
- Denúncia aceita até dez anexos: imagens de 10 MB, PDFs de 20 MB e vídeos de 50 MB por arquivo (RN077).
- Padrão suspeito de recusas demanda revisão humana; não gera punição automática. Medidas são graduais e recorríveis (RN108–RN110).
- Toda restrição registra motivo, responsável, início, duração/condição de encerramento e contestação aplicável (RN150).
- Profissional declara conflito de interesse e transfere o caso; ações sensíveis são auditadas (RN089, RN138, RN155).

## 7. Avaliações

- Agregados públicos exigem cinco avaliações válidas de pessoas confirmadas e diferentes; antes disso, mostrar insuficiência (RN071–RN073).
- Segurança, denúncias, comentários individuais e ranking de participantes não entram em resultado público (RN070, RN074, RN146).
- Experiência geral: 1–5; segurança: cinco níveis; realização e desejo de relatar: sim/não. Campos adicionais seguem RN139–RN143.
- Nota 1/2 ou percepção insegura oferece fluxo de denúncia, sem abertura automática (RN144).

## 8. Conta, recuperação e privacidade

- Recuperação excepcional exige múltiplas evidências e não solicita senha antiga nem conversa privada (RN078–RN079).
- Documento é último recurso voluntário, sem reconhecimento facial, com minimização e acesso profissional restrito (RN080–RN083, RN153).
- Risco pode restringir operações sensíveis de forma proporcional; mensagens/participações só são bloqueadas em risco alto (RN097–RN099).
- Desativação é reversível; exclusão concluída é definitiva. Eventos futuros devem ser resolvidos e reativação não restaura participações (RN085–RN087).
- Exclusão tem janela de cancelamento de sete dias; depois é irreversível (RN105–RN106).
- Cópia de dados exige autenticação reforçada, prazo de até 15 dias e download por sete dias, protegendo terceiros e investigações (RN100–RN103).

## 9. Retenção

| Categoria | Prazo/regra | Origem |
|---|---|---|
| Dados públicos de conta excluída | remoção em até 30 dias | RN115 |
| Dados básicos para concluir exclusão | até 90 dias | RN115 |
| Denúncias e decisões de segurança | 5 anos após encerramento | RN116 |
| Evidência sem denúncia confirmada | 1 ano | RN117 |
| Recuperação excepcional | 180 dias | RN118 |
| Eventos, participações e cancelamentos | 2 anos | RN119 |
| Bloqueios | enquanto conta existir ou até desbloqueio | RN120 |
| Conversas sem denúncia | conforme períodos de acesso, depois eliminação | RN121 |
| Investigação, disputa ou ordem válida | enquanto o caso estiver aberto | RN122–RN123 |

Os itens RN068, RN080–RN083, RN093, RN096, RN100–RN104 e RN115–RN122 dependem de validação jurídica brasileira.

## 10. Catálogos e permissões

- Catálogos iniciais de interesses, atividades, preferências, motivos e restrições estão no DER §3.10; opções podem ser adicionadas, desativadas e reordenadas sem mudar o significado histórico (RN147–RN149).
- Papéis profissionais e limites estão no DER §3.11. Administrador não recebe acesso automático a conteúdo sensível; permissões cessam imediatamente no afastamento/desligamento (RN152–RN155).

## 11. Fora do MVP

Lista de espera, login Google/Apple, gestão individual detalhada de aparelhos, eventos pagos/comerciais/recorrentes/de grande porte, monetização, grupos permanentes, mensagens privadas, áudios, chamadas e recomendação altamente personalizada.
