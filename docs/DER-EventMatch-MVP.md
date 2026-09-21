# Documento de Especificação de Requisitos — EventMatch MVP

**Versão:** 1.3
**Data:** 10/09/2026  
**Situação:** aprovado funcionalmente com ressalva jurídica; retenção, cópia de dados e uso excepcional de documentos dependem de validação jurídica brasileira.

## 1. Visão geral do escopo

### 1.1 Objetivo

O EventMatch conecta pessoas maiores de 18 anos por interesses e atividades locais, facilitando encontros presenciais voltados à amizade, companhia e descoberta da cidade. O produto não é um aplicativo de namoro.

O MVP permite descobrir, criar e participar de encontros informais e gratuitos, com comunicação coletiva, privacidade, confiança, denúncia, bloqueio e suporte operacional.

### 1.2 Atores

- **Visitante:** consulta informações públicas de eventos compartilhados e pode iniciar o cadastro.
- **Participante:** descobre eventos, solicita ou confirma participação, conversa com o grupo, desiste, avalia, denuncia e bloqueia.
- **Anfitrião:** participante habilitado a criar e administrar eventos, decidir solicitações, orientar o grupo, registrar comparecimento, cancelar ou transferir eventos.
- **Equipe de Confiança e Segurança:** analisa denúncias, riscos, contestações, recuperações excepcionais e recursos.
- **Equipe de Operação:** acompanha a comunidade, os eventos e ações operacionais autorizadas.
- **Profissional do EventMatch:** atua com identidade profissional interna separada de eventual perfil pessoal.

### 1.3 Incluído no MVP

- Cadastro e autenticação por e-mail ou celular.
- Perfil, interesses e controles de privacidade.
- Descoberta, busca, filtros e compartilhamento de eventos.
- Criação e gerenciamento de encontros presenciais, informais e gratuitos.
- Participação automática ou dependente de aprovação.
- Conversa coletiva vinculada ao evento.
- Alteração, transferência, cancelamento, desistência e comparecimento.
- Avaliação pós-evento.
- Denúncia, bloqueio, desbloqueio e recurso básico.
- Recuperação de senha e recuperação excepcional básica.
- Desativação, reativação e exclusão de conta.
- Encerramento de todas as outras sessões.

### 1.4 Fora do MVP

- Lista de espera.
- Login com Google ou Apple.
- Gestão detalhada e individual de aparelhos.
- Eventos pagos, comerciais, recorrentes ou de grande porte.
- Assinaturas, benefícios, destaques pagos e parcerias com estabelecimentos.
- Grupos permanentes, mensagens privadas, áudios e chamadas.
- Recomendações altamente personalizadas.

### 1.5 Pendência externa

- Não restam decisões abertas de produto nos cinco blocos desta versão.
- **RF068, RF073, RF074, RN068, RN080–RN083, RN093, RN096, RN100–RN104, RN115–RN122 e RNF023** continuam como diretrizes de negócio pendentes de validação jurídica brasileira.
- Caso a orientação jurídica exija mudanças, os itens afetados deverão retornar à validação do cliente antes do lançamento.

## 2. Requisitos funcionais e critérios de aceite

| ID | Funcionalidade | Descrição e critério de aceite |
|---|---|---|
| RF001 | Validação de idade | Solicitar nascimento e impedir cadastro de menor de 18 anos. |
| RF002 | Cadastro por contato | Cadastrar por e-mail ou celular e concluir a confirmação apenas após código ou link válido. |
| RF003 | Criação de senha | Exigir senha válida e confirmação idêntica no cadastro direto. |
| RF004 | Dados obrigatórios | Exigir nome de exibição, cidade ou região e intenção de uso. |
| RF005 | Aceites | Registrar versões aceitas dos termos, política de privacidade e regras de convivência. |
| RF006 | Interesses | Impedir a conclusão do onboarding com menos de três interesses. |
| RF007 | Onboarding | Explicar brevemente proposta, localização, interesses, objetivo e segurança antes de abrir os eventos. |
| RF008 | Login | Autenticar por e-mail ou celular e senha, usando mensagem genérica em caso de falha. |
| RF009 | Manter conectado | Preservar a sessão quando solicitado pelo usuário. |
| RF010 | Recuperação de senha | Enviar instrução temporária sem revelar se a conta existe e invalidar as demais sessões após a troca. |
| RF011 | Encerramento de sessões | Encerrar todas as sessões, exceto a atual, e confirmar a operação. |
| RF012 | Edição de perfil | Editar livremente nome de exibição, foto, apresentação, interesses e campos opcionais; encaminhar contatos e nascimento aos fluxos protegidos correspondentes. |
| RF013 | Prévia do perfil | Mostrar ao usuário como seu perfil aparece publicamente, sem dados privados. |
| RF014 | Faixa etária | Calcular e atualizar a faixa sem revelar idade exata ou nascimento completo. |
| RF015 | Privacidade opcional | Aplicar a visibilidade escolhida e manter dados sensíveis privados por padrão. |
| RF016 | Habilitação de anfitrião | Liberar criação somente com foto, apresentação, três interesses, dois contatos confirmados e regras aceitas. |
| RF017 | Cadastro de evento | Registrar atividade, título, descrição, data, início, região, ponto exato, capacidade e anfitrião; aceitar opcionalmente imagem, término estimado, custo estimado, acessibilidade, alimentação, faixa etária, o que levar e orientações adicionais. |
| RF018 | Rascunho | Salvar e recuperar evento incompleto, inclusive ao abandonar o preenchimento. |
| RF019 | Validação do evento | Informar campos ausentes, data passada, horário inválido e capacidade ausente. |
| RF020 | Prévia do evento | Mostrar visão pública e distinguir informações públicas das reservadas. |
| RF021 | Publicação | Publicar somente após confirmação de evento presencial, gratuito, informal e em local público. |
| RF022 | Descoberta | Recomendar por região, interesses e intenção, mostrando dados essenciais e vagas. |
| RF023 | Busca e filtros | Buscar por texto e filtrar por data, horário, distância, categoria, vagas, acessibilidade e faixa etária. |
| RF024 | Detalhes | Exibir proposta, anfitrião, vagas e modalidade sem revelar o ponto exato a não confirmados. |
| RF025 | Salvar evento | Adicionar ou remover dos salvos sem reservar vaga. |
| RF026 | Compartilhar | Gerar convite com dados públicos, sem expor ponto exato ou dados privados. |
| RF027 | Não tenho interesse | Retirar o evento das recomendações e registrar o sinal. |
| RF028 | Solicitação manual | Criar uma única solicitação pendente, com mensagem opcional e sem reservar vaga. |
| RF029 | Retirada de solicitação | Permitir retirada e atualizar o estado para participante e anfitrião. |
| RF030 | Decisão da solicitação | Aceitar sem justificativa, ocupando vaga e liberando informações; para recusar, exigir motivo legítimo registrado e enviar aviso respeitoso sem detalhes internos. |
| RF031 | Entrada automática | Confirmar apenas com vaga e sem bloqueio ou restrição de segurança. |
| RF032 | Gerenciar evento | Organizar interessados, confirmados e não participantes, exibindo somente dados necessários. |
| RF033 | Editar evento | Registrar mudanças e notificar confirmados e interessados. |
| RF034 | Reconfirmação | Calcular prazo após alteração importante, reservar a vaga e cancelar ao expirar sem resposta. |
| RF035 | Capacidade | Liberar novas vagas ao aumentar e impedir redução abaixo dos confirmados. |
| RF036 | Cancelar evento | Encerrar vagas e solicitações, notificar envolvidos, registrar motivo e tornar a conversa somente leitura. |
| RF037 | Desistência | Liberar a vaga, avisar o anfitrião e impedir novas mensagens. |
| RF038 | Transferência | Manter o anfitrião atual até o aceite e nunca deixar evento sem responsável. |
| RF039 | Conversa coletiva | Liberar histórico e envio somente a participantes autorizados. |
| RF040 | Avisos do anfitrião | Identificar, destacar e permitir fixar orientações do anfitrião. |
| RF041 | Moderação | Permitir ao autor editar a própria mensagem; ao anfitrião ocultar mensagem de terceiro somente pelos motivos autorizados; e à equipe remover conteúdo por segurança, preservando a versão original para auditoria. |
| RF042 | Imagens na conversa | Aceitar até cinco imagens comuns por mensagem, com até 10 MB cada. |
| RF043 | Silenciamento | Silenciar mensagens comuns sem ocultar avisos essenciais. |
| RF044 | Encerramento da conversa | Manter escrita por 48 horas após evento concluído ou não realizado; em evento cancelado, impedir novas mensagens imediatamente; depois aplicar os prazos de consulta e eliminação. |
| RF045 | Comparecimento | Registrar compareceu, não compareceu, incerteza e realização do evento. |
| RF046 | Contestação de presença | Avisar sobre divergência e permitir contestação antes de consequência definitiva. |
| RF047 | Avaliação | Registrar experiência e segurança após evento concluído ou não realizado. |
| RF048 | Avaliação agregada | Publicar resumo somente após cinco avaliações válidas de pessoas diferentes. |
| RF049 | Denúncia | Registrar alvo, motivo, relato, data, risco e anexos, emitindo protocolo. |
| RF050 | Acompanhar denúncia | Mostrar recebida, em análise, aguardando informações e concluída. |
| RF051 | Atendimento | Solicitar esclarecimentos e apresentar conclusão compatível com a privacidade. |
| RF052 | Emergência | Orientar procura dos serviços públicos quando houver perigo imediato. |
| RF053 | Bloqueio | Interromper interações e recomendações recíprocas sem avisar a pessoa bloqueada. |
| RF054 | Bloqueio no evento | Alertar privadamente quem bloqueou e oferecer saída sem prejuízo, denúncia ou ajuda. |
| RF055 | Avisos sob bloqueio | Preservar comunicados essenciais do anfitrião sem restaurar interação direta. |
| RF056 | Desbloqueio | Reabilitar aparições futuras sem restaurar relações anteriores. |
| RF057 | Recuperação excepcional | Emitir protocolo e encaminhar múltiplas evidências à equipe; restringir ações somente quando sinais relevantes de risco forem identificados. |
| RF058 | Análise da recuperação | Registrar decisão, permitir contestação e interromper diante de suspeita de fraude. |
| RF059 | Alteração de contato | Substituir somente após confirmação e avisar o contato anterior. |
| RF060 | Desativação | Cancelar atividades futuras, ocultar perfil e exigir resolução dos eventos hospedados. |
| RF061 | Reativação | Confirmar identidade e termos sem restaurar participações canceladas. |
| RF062 | Exclusão | Confirmar identidade, resolver eventos, ocultar perfil e anonimizar históricos preservados. |
| RF063 | Notificações | Disponibilizar avisos no aplicativo e direcionar ao conteúdo relacionado. |
| RF064 | Preferências de aviso | Respeitar categorias opcionais e manter canal para avisos essenciais. |
| RF065 | Recurso | Registrar justificativa e evidências, emitir protocolo e informar resultado. |
| RF066 | Identidade profissional | Manter cadastro interno separado do perfil pessoal. |
| RF067 | Auditoria | Associar ação sensível à identidade profissional, data e contexto. |
| RF068 | Cópia de dados | Após autenticação reforçada, disponibilizar em até 15 dias perfil, fotos, preferências, eventos, participações, desistências, cancelamentos e avaliações, protegendo dados de terceiros e investigações. |
| RF069 | Retirada de confirmado | Exigir motivo registrado, notificar e oferecer denúncia ou contestação. |
| RF070 | Nova solicitação | Controlar novas tentativas conforme a situação anterior. |
| RF071 | Limites do anfitrião | Impedir publicação acima do limite do nível de experiência. |
| RF072 | Anexos de denúncia | Validar quantidade, formato e tamanho antes do envio. |
| RF073 | Documento de recuperação | Explicar finalidade, prazo e alternativas, permitindo ocultar dados desnecessários. |
| RF074 | Retenção | Controlar prazos de acesso, conservação e eliminação por categoria. |
| RF075 | Correção do nascimento | Receber data correta, justificativa, confirmação por contato e evidência; submeter à equipe, informar decisão e permitir contestação. |
| RF076 | Restrição por recuperação | Aplicar e informar restrições proporcionais quando houver sinal de risco, sem revelar detalhes que facilitem fraude. |
| RF077 | Moderação do anfitrião | Exigir motivo ao ocultar mensagem, mostrar marcador público, avisar o autor e permitir contestação ou denúncia. |
| RF078 | Cancelamento da exclusão | Permitir desistir do pedido durante sete dias, por acesso limitado à conta ou atendimento. |
| RF079 | Bloqueio prévio no evento | Impedir solicitação ou confirmação se já houver pessoa bloqueada entre os confirmados, usando mensagem neutra. |
| RF080 | Monitoramento de recusas | Permitir à equipe analisar padrões possivelmente discriminatórios, registrar revisão, aplicar medida proporcional e receber recurso. |
| RF081 | Campos opcionais do perfil | Manter pronomes, profissão, idiomas, fotos adicionais, preferências de atividades, disponibilidade, distância, redes sociais, acessibilidade e alimentação com seus controles de visibilidade. |
| RF082 | Cadastro profissional | Registrar nome, e-mail corporativo único, função, equipe, situação, data de entrada e identificador interno exclusivo. |
| RF083 | Atendimento identificado | Mostrar ao usuário nome de atendimento, vínculo com o EventMatch e área responsável, ocultando dados internos do profissional. |
| RF084 | Eventos oficiais | Identificar claramente eventos promovidos oficialmente pelo EventMatch. |
| RF085 | Estados do evento | Representar rascunho, publicado/aberto, lotado, cancelado, concluído e não realizado. |
| RF086 | Estados da solicitação | Representar pendente, aceita, recusada, retirada e encerrada. |
| RF087 | Modalidade padrão | Iniciar a criação com aprovação manual selecionada, permitindo ao anfitrião optar por entrada automática. |
| RF088 | Suspensão por possível menoridade | Suspender participações futuras, ocultar ponto exato e bloquear mensagens enquanto a maioridade é verificada, sem prejudicar o histórico. |
| RF089 | Restauração da participação | Após confirmar maioridade, solicitar reconfirmação e restaurar sem nova aprovação quando a vaga ainda estiver reservada. |
| RF090 | Silenciamento pelo anfitrião | Após reincidência no mesmo evento, permitir um único silenciamento de duas horas, com motivo, aviso e contestação. |
| RF091 | Categorias de denúncia | Oferecer assédio, discriminação, ameaça ou agressão, fraude, conteúdo impróprio, conduta no evento, evento enganoso ou inseguro, abandono do anfitrião e outro. |
| RF092 | Evidências de recuperação | Coletar contatos antigos, dados privados, período e região da conta, aparelhos, eventos, participações, fotos próprias, pagamentos e vínculos disponíveis. |
| RF093 | Resultado da correção | Informar aprovação ou recusa e, quando aprovada, atualizar nascimento e faixa etária automaticamente. |
| RF094 | Categorias de notificação | Permitir configurar mensagens, convites e solicitações, recomendações, lembretes, avaliações, novidades e promoções; exigir ao menos um canal para segurança e acesso à conta, mudanças de credenciais, alterações ou cancelamentos de evento confirmado, suspensão ou retirada de participação e decisões sobre denúncia, recuperação ou recurso. |
| RF095 | Conflito profissional | Exigir que o profissional declare o conflito e transfira denúncia, recurso, recuperação, correção cadastral ou outro caso quando envolver a si próprio, familiar, companheiro ou relação afetiva, amizade próxima, relação financeira ou profissional direta, disputa ou conflito pessoal. |
| RF096 | Autorização de evento oficial | Permitir identificação oficial somente por profissional ou área do EventMatch com permissão específica. |
| RF097 | Contestação da moderação | Registrar contestação da ocultação ou do silenciamento, preservar evidências e permitir revisão e reversão pela equipe. |
| RF098 | Formulário de avaliação | Coletar experiência geral, segurança e realização do evento como campos obrigatórios, além dos campos opcionais definidos, usando as escalas estabelecidas. |
| RF099 | Alerta pela avaliação | Ao receber nota 1 ou 2 ou percepção insegura/muito insegura, oferecer acesso imediato à denúncia sem criá-la automaticamente. |
| RF100 | Gestão de catálogos | Permitir a profissional autorizado acrescentar, desativar e reorganizar opções de catálogos sem alterar registros históricos. |
| RF101 | Papéis profissionais | Aplicar permissões conforme Atendimento, Confiança e Segurança, Responsável de Confiança e Segurança, Operação e Administrador autorizado. |
| RF102 | Compartilhamento público | Gerar página ou convite somente com os dados públicos definidos e exigir cadastro para participação, sem reservar vaga. |
| RF103 | Gestão de participantes | Permitir ao anfitrião administrar solicitações e participações dentro das permissões e restrições definidas. |
| RF104 | Avisos do evento | Permitir avisos comuns e essenciais, mantendo no máximo um aviso fixado e impedindo uso abusivo. |
| RF105 | Conteúdo da notificação | Informar ocorrência, objeto afetado, ação necessária, prazo aplicável e destino para continuidade. |
| RF106 | Gestão de restrições | Registrar e aplicar restrição com motivo, responsável, início, duração ou condição de encerramento e contestação aplicável. |
| RF107 | Liberação após desistência | Liberar a vaga imediatamente e permitir uma única nova tentativa sujeita à modalidade, disponibilidade e restrições do evento. |

## 3. Regras de negócio

### 3.1 Conta, perfil e privacidade

- **RN001:** somente pessoas com 18 anos completos ou mais poderão criar conta.
- **RN002:** cada e-mail confirmado poderá pertencer a apenas uma conta ativa.
- **RN003:** cada celular confirmado poderá pertencer a apenas uma conta ativa.
- **RN004:** nome de exibição não precisará ser único e não haverá nome de usuário exclusivo no MVP.
- **RN005:** o cadastro exigirá ao menos um contato confirmado; a criação de eventos exigirá ambos.
- **RN006:** a senha terá no mínimo oito caracteres, não poderá conter apenas espaços nem constar na lista de senhas óbvias.
- **RN007:** não será obrigatória a combinação de maiúsculas, minúsculas, números e símbolos.
- **RN008:** o perfil deverá conter ao menos três interesses.
- **RN009:** nascimento completo, e-mail e celular nunca serão exibidos a outros usuários.
- **RN010:** a faixa pública será 18–24, 25–34, 35–44, 45–54, 55–64 ou 65+.
- **RN011:** cidade ou região será informada manualmente e exibida de forma aproximada.
- **RN012:** localização do aparelho será opcional, autorizada e confirmada, sem acompanhamento de deslocamento.
- **RN013:** endereço residencial e documento não serão pedidos nos fluxos comuns.
- **RN014:** dados opcionais potencialmente sensíveis serão privados por padrão.
- **RN015:** contatos não poderão ser alterados simultaneamente e o atual valerá até a confirmação do novo.
- **RN016:** contas não serão mescladas automaticamente.

### 3.2 Eventos e participação

- **RN017:** a mesma pessoa poderá ser participante e anfitriã em eventos diferentes.
- **RN018:** anfitrião deverá ter foto, apresentação, três interesses, ambos os contatos confirmados e regras aceitas.
- **RN019:** somente encontros presenciais, informais e gratuitos serão publicados no MVP.
- **RN020:** eventos ocorrerão em locais públicos ou estabelecimentos identificáveis; residências serão proibidas.
- **RN021:** o ponto exato será visível ao anfitrião e aos confirmados; a equipe só poderá acessá-lo diante de necessidade concreta de atendimento, segurança ou análise de denúncia, por profissional autorizado para o caso.
- **RN022:** solicitação pendente não reservará vaga e não poderá haver duplicidade.
- **RN023:** entrada automática será impedida em evento lotado, cancelado, iniciado ou com restrição aplicável.
- **RN024:** bloqueio entre usuário e anfitrião impedirá nova participação.
- **RN025:** lista completa de interessados não será pública; confirmados poderão ver os demais, respeitadas medidas de segurança.
- **RN026:** eventos indisponíveis não aparecerão como disponíveis; lotados poderão aparecer identificados.
- **RN027:** recomendações não favorecerão eventos pagos por receita.
- **RN028:** alteração de data, horário, cidade, ponto exato ou atividade será importante.
- **RN029:** encontro gratuito publicado não poderá ser convertido em pago.
- **RN030:** capacidade não poderá ficar abaixo do número de confirmados.
- **RN031:** cancelamento será irreversível e evento nunca ficará sem anfitrião confirmado.
- **RN032:** a desistência liberará imediatamente a vaga e encerrará a participação existente; o participante não recuperará a vaga nem terá prioridade, mas poderá realizar uma única nova tentativa, sujeita à modalidade do evento, à disponibilidade e às restrições aplicáveis.
- **RN033:** marcação negativa de presença não gerará punição automática sem contestação.

### 3.3 Recusa, retirada e nova solicitação

- **RN034:** serão motivos legítimos de recusa: falta de vaga; requisito divulgado não atendido; perfil incompleto; conteúdo ofensivo, comercial ou falso; bloqueio; restrição de segurança; ocorrência negativa comprovável; recomendação da equipe.
- **RN035:** raça, deficiência, religião, orientação sexual, identidade de gênero ou outro critério discriminatório nunca serão motivos legítimos.
- **RN036:** retirada de confirmado exigirá violação das regras, risco, fraude, requisito divulgado não atendido, falsidade relevante, abuso da conversa, ausência de reconfirmação ou restrição de segurança.
- **RN037:** ninguém poderá ser retirado para favorecer outra pessoa; toda retirada terá motivo, notificação e possibilidade de contestação.
- **RN038:** solicitação recusada não poderá ser refeita; o anfitrião poderá reverter e convidar.
- **RN039:** solicitação retirada antes da decisão poderá ser refeita uma vez.
- **RN040:** desistente voluntário poderá solicitar novamente uma vez, se houver vaga.
- **RN041:** participante retirado não poderá retornar ao mesmo evento.

### 3.4 Reconfirmação e limites de anfitrião

- **RN042:** com mais de 72 horas até o evento, o prazo de reconfirmação será 48 horas.
- **RN043:** entre 24 e 72 horas, o prazo será 12 horas.
- **RN044:** com menos de 24 horas, será possível responder até duas horas antes do início.
- **RN045:** se a mudança ocorrer faltando menos de duas horas, será possível responder até o início.
- **RN046:** a vaga ficará reservada no prazo; silêncio cancelará a participação sem prejuízo ao histórico.
- **RN047:** anfitrião novo terá um evento futuro ativo e até dois publicados a cada 30 dias.
- **RN048:** deixará de ser novo após dois eventos realizados e encerrados corretamente, sem ocorrência grave ou denúncia relevante em análise.
- **RN049:** anfitrião experiente poderá manter até três eventos futuros simultâneos.

### 3.5 Conversa e bloqueio

- **RN050:** não haverá mensagens privadas entre usuários no MVP.
- **RN051:** o anfitrião e os participantes confirmados acessarão a conversa; novos confirmados verão o histórico anterior.
- **RN052:** o sistema avisará que mensagens anteriores ficam visíveis a futuros confirmados.
- **RN053:** avisos essenciais permanecerão visíveis mesmo com conversa silenciada ou bloqueio entre participantes.
- **RN054:** bloqueio será imediato, interromperá interações e não será comunicado ao bloqueado.
- **RN055:** bloqueio entre confirmados não removerá ninguém automaticamente.
- **RN056:** quem bloqueou poderá sair sem prejuízo; o caso só irá automaticamente à equipe com denúncia ou risco.
- **RN057:** a equipe poderá retirar alguém ou aplicar medida quando houver risco relevante.
- **RN058:** desbloqueio não restaurará conversas, solicitações ou participações anteriores.
- **RN059:** conversa aceitará até cinco imagens comuns por mensagem, com 10 MB cada; documentos, vídeos e áudios serão rejeitados.
- **RN060:** conversa de evento concluído ou não realizado ficará aberta por 48 horas; conversa de evento cancelado ficará somente para consulta imediatamente.
- **RN061:** anfitrião e confirmados consultarão por 90 dias; desistentes, por 30 dias e somente até a saída; removidos perderão acesso imediato.
- **RN062:** conteúdo relevante para denúncia poderá ser preservado e acessado pela área de atendimento.
- **RN063:** usuários serão avisados antes do fim de seu acesso à conversa.
- **RN064:** o autor poderá editar somente sua própria mensagem.
- **RN065:** o anfitrião poderá ocultar mensagem de terceiro por assédio, ameaça, discriminação, ofensa, conteúdo sexual ou impróprio, exposição de dado sensível, propaganda, fraude, repetição, orientação perigosa ou conteúdo alheio que prejudique a conversa.
- **RN066:** o anfitrião não poderá editar, eliminar definitivamente nem ocultar crítica apenas por ser negativa.
- **RN067:** mensagem ocultada mostrará “Mensagem removida pelo anfitrião”; o autor será avisado e poderá contestar ou denunciar.
- **RN068:** a versão original ficará acessível somente à equipe por 180 dias, ou pelo prazo do caso de segurança quando vinculada a denúncia.
- **RN069:** abuso da moderação poderá retirar do anfitrião a permissão de moderar conversas ou criar eventos.

### 3.6 Avaliações, denúncias e anexos

- **RN070:** comentários individuais não serão publicados nem haverá ranking público de participantes.
- **RN071:** resultados agregados exigirão cinco avaliações válidas de pessoas confirmadas e diferentes.
- **RN072:** antes do mínimo será exibido “Ainda não há avaliações suficientes”.
- **RN073:** avaliações fraudulentas ou abusivas serão excluídas do cálculo.
- **RN074:** segurança e denúncias nunca integrarão nota pública.
- **RN075:** denunciante, relato completo e anexos não serão revelados automaticamente ao denunciado.
- **RN076:** anexos serão acessíveis somente à equipe autorizada.
- **RN077:** denúncia aceitará até dez anexos: imagens de 10 MB, PDFs de 20 MB e vídeos de 50 MB por arquivo.

### 3.7 Recuperação, contas e equipe

- **RN078:** recuperação excepcional exigirá múltiplas evidências; nenhuma isolada será suficiente.
- **RN079:** senha antiga e conteúdo de conversas privadas não serão solicitados.
- **RN080:** documento será último recurso voluntário, analisado apenas por profissionais autorizados.
- **RN081:** o documento deverá conter nome, nascimento e foto, podendo ter número, endereço e filiação ocultados.
- **RN082:** não haverá reconhecimento facial automático; documento será usado somente para recuperação.
- **RN083:** a cópia será eliminada em até 30 dias após a conclusão, preservando apenas o resultado.
- **RN084:** suspeita de fraude interromperá a recuperação e permitirá revisão; recusas poderão ser contestadas.
- **RN085:** desativação será reversível; exclusão concluída será definitiva.
- **RN086:** anfitrião resolverá eventos futuros antes de desativar ou excluir a conta.
- **RN087:** reativação não restaurará participações ou solicitações canceladas.
- **RN088:** avisos promocionais poderão ser desativados; avisos essenciais manterão ao menos um canal.
- **RN089:** profissional não analisará denúncia ou recurso em que esteja envolvido e, sempre que possível, a revisão será feita por outra pessoa.
- **RN090:** identidade profissional permanecerá separada do perfil pessoal.
- **RN091:** lista de espera não fará parte do MVP.
- **RN092:** nascimento não será editado diretamente; sua correção exigirá solicitação, justificativa, confirmação por contato, evidência e análise humana autorizada.
- **RN093:** serão aceitos documento oficial, certidão equivalente ou informação já verificada em vínculo confiável; dados desnecessários poderão ser ocultados.
- **RN094:** durante a correção, data e faixa atuais permanecerão válidas e a conta não será normalmente restringida.
- **RN095:** se a data solicitada indicar menoridade, criação de eventos e novas participações serão suspensas; participações futuras existentes também ficarão temporariamente suspensas até a decisão.
- **RN096:** evidência de correção do nascimento será usada somente para essa finalidade e eliminada em até 30 dias após a conclusão.
- **RN097:** sinais de risco na recuperação incluirão incompatibilidade com o histórico, tentativas com contatos distintos, proximidade de mudança de credencial, ações sensíveis simultâneas, acesso do provável titular, falta de confirmação privada, evidência suspeita, disputa ou conta anfitriã com evento ativo.
- **RN098:** diante desses sinais poderão ser bloqueadas mudanças de credenciais, remoção de acesso, desativação, exclusão, cópia de dados, criação, cancelamento ou transferência de eventos, mudança de perfil e ações profissionais.
- **RN099:** mensagens e participações existentes só serão bloqueadas diante de risco alto de invasão, fraude ou perigo.
- **RN100:** cópia de dados será entregue em até 15 dias corridos, após confirmação pela sessão conectada e código enviado a contato confirmado.
- **RN101:** sem acesso aos contatos, o usuário concluirá antes a recuperação excepcional.
- **RN102:** a cópia ficará disponível por sete dias; o usuário será avisado quando estiver pronta e antes de expirar.
- **RN103:** a cópia protegerá informações de terceiros, detalhes internos de segurança e conteúdo que possa prejudicar investigação.
- **RN104:** resultado da análise documental será conservado por 180 dias sem número, imagem ou reprodução do documento; fraude, denúncia ou disputa ativa seguirá o prazo do caso.
- **RN105:** o pedido de exclusão poderá ser cancelado por sete dias; nesse período o perfil ficará oculto, sessões encerradas e a conta servirá apenas para cancelar o pedido ou buscar atendimento.
- **RN106:** após sete dias, a exclusão será irreversível; nova conta não recuperará automaticamente perfil ou histórico.
- **RN107:** eventos com pessoa bloqueada não serão recomendados reciprocamente; acesso indireto permitirá apenas consulta pública e impedirá participação com mensagem neutra.
- **RN108:** padrões de recusa serão analisados por repetição de motivos, diferenças persistentes, concentração após características pessoais, justificativas discriminatórias, denúncias semelhantes, requisitos posteriores ou critérios não divulgados.
- **RN109:** padrão suspeito não gerará punição automática; a equipe revisará contexto, requisitos, justificativas e denúncias.
- **RN110:** medidas poderão evoluir de orientação e correção até perda da aprovação manual, restrição de novos eventos, suspensão ou exclusão; o anfitrião poderá recorrer.
- **RN111:** aprovação manual será a modalidade padrão, mas o anfitrião poderá escolher entrada automática.
- **RN112:** informações de acessibilidade e alimentação serão privadas por padrão e usadas somente com finalidade clara e conhecimento do usuário.
- **RN113:** o usuário não poderá remover seu único meio confirmado de acesso ou recuperação.
- **RN114:** funcionário que usar o produto pessoalmente terá perfil comum sujeito às mesmas regras dos demais usuários.

### 3.8 Retenção

- **RN115:** dados públicos de conta excluída serão removidos em até 30 dias; dados básicos necessários à conclusão, em até 90 dias.
- **RN116:** denúncias e decisões de segurança serão mantidas por cinco anos após o encerramento.
- **RN117:** evidências de casos sem denúncia confirmada serão mantidas por um ano.
- **RN118:** recuperação excepcional será registrada por 180 dias.
- **RN119:** histórico de eventos, participações e cancelamentos será mantido por dois anos.
- **RN120:** bloqueios serão mantidos enquanto a conta existir ou até o desbloqueio.
- **RN121:** conversas sem denúncia serão eliminadas após os períodos de acesso definidos.
- **RN122:** dados ligados a investigação, disputa ou ordem válida poderão permanecer enquanto o caso estiver aberto.
- **RN123:** obrigação legal poderá alterar os prazos definidos pelo produto.
- **RN124:** durante suspensão por possível menoridade, o usuário não poderá comparecer como confirmado, ver o ponto exato nem enviar mensagens, mas continuará vendo informações públicas sem prejuízo no histórico.
- **RN125:** a vaga ficará reservada por até 48 horas, desde que o evento não comece antes; se a análise não terminar até duas horas antes do início, a participação será cancelada sem prejuízo.
- **RN126:** o anfitrião será informado de que a participação está sob verificação, sem menção a idade, documento ou motivo específico.
- **RN127:** confirmação de menoridade cancelará todas as participações e retirará o acesso da conta ao EventMatch.
- **RN128:** confirmada a maioridade com vaga reservada, o participante deverá reconfirmar e retornará sem nova aprovação do anfitrião.
- **RN129:** se a vaga já tiver sido liberada, será necessária nova solicitação, que não contará como repetição ou desistência; evento iniciado ou cancelado não permitirá restauração.
- **RN130:** o anfitrião será avisado apenas quando a participação for efetivamente restaurada.
- **RN131:** após ocultar mensagem permitida e ocorrer reincidência no mesmo evento, o anfitrião poderá aplicar um único silenciamento de duas horas, sem alterar sua duração.
- **RN132:** durante o silenciamento, o participante poderá ler conversa e avisos essenciais, mas não enviar mensagens ou anexos; receberá motivo, duração e opção de contestar ou denunciar.
- **RN133:** contestação não encerrará automaticamente a medida; a equipe poderá encerrá-la antecipadamente se constatar abuso.
- **RN134:** o anfitrião não poderá aplicar silenciamentos sucessivos; nova reincidência exigirá denúncia à equipe.
- **RN135:** a equipe poderá restringir mensagens até o encerramento, retirar o participante ou aplicar medida proporcional.
- **RN136:** ameaça, assédio grave ou risco imediato permitirá ocultação e intervenção da equipe sem exigir reincidência.
- **RN137:** somente profissional ou área com permissão específica poderá marcar um evento como oficial do EventMatch.
- **RN138:** o profissional não poderá atuar em caso que envolva a si próprio, familiar, companheiro ou relacionamento afetivo, amizade próxima, relação financeira ou profissional direta, ou pessoa com quem mantenha disputa ou conflito pessoal; deverá declarar o conflito e transferir o caso a outro profissional, preferindo a transferência sempre que houver dúvida razoável sobre sua imparcialidade.

### 3.9 Avaliações

- **RN139:** experiência geral será obrigatória e usará escala de 1 a 5.
- **RN140:** sensação de segurança será obrigatória e usará: muito inseguro, inseguro, neutro, seguro ou muito seguro.
- **RN141:** realização do evento e desejo de relatar problema serão respostas obrigatórias de sim ou não.
- **RN142:** organização, acolhimento e atuação do anfitrião serão opcionais e usarão escala de 1 a 5.
- **RN143:** participar novamente será opcional e usará sim, talvez ou não; nova conexão será opcional e usará sim, não ou prefiro não responder; comentário será opcional e privado.
- **RN144:** nota 1 ou 2, inseguro ou muito inseguro oferecerá o fluxo de denúncia, sem abertura automática.
- **RN145:** anfitrião avaliará a experiência geral do grupo e registrará comparecimento, sem atribuir nota individual pública.
- **RN146:** resultados públicos serão agregados após cinco respostas válidas e poderão resumir experiência, organização, acolhimento e atuação do anfitrião, sem comentários, segurança, denúncias ou ranking individual.

### 3.10 Catálogos iniciais

- **RN147:** interesse representa gosto amplo; tipo de atividade representa o que acontecerá no evento; preferência de atividade representa características desejadas para a experiência.
- **RN148:** profissional autorizado poderá acrescentar, desativar ou reorganizar opções, preservando o significado dos registros anteriores.
- **RN149:** os catálogos iniciais serão os definidos nas tabelas desta seção.

#### Interesses

| Opções iniciais |
|---|
| Café e gastronomia; corrida e caminhada; ciclismo; esportes e atividades físicas; jogos de tabuleiro; videogames; música; cinema; teatro; exposições e museus; literatura e clubes de leitura; fotografia; tecnologia; idiomas; natureza; voluntariado; cultura local; dança; bem-estar; empreendedorismo e networking. |

#### Tipos de atividade

| Opções iniciais |
|---|
| Café ou conversa; refeição; caminhada; corrida; pedalada; prática esportiva; jogos de tabuleiro; sessão de videogame; show ou apresentação musical; cinema; teatro; museu ou exposição; clube de leitura; prática de idiomas; passeio cultural; atividade na natureza; voluntariado; oficina ou atividade criativa; outro encontro informal. |

#### Preferências de atividades

| Opções iniciais |
|---|
| Ao ar livre; ambiente interno; ambiente tranquilo; ambiente movimentado; grupo pequeno; grupo médio; atividade física leve; atividade física moderada; experiência cultural; conversa e socialização; atividade estruturada; atividade espontânea. |

#### Motivos de denúncia

| Opções iniciais |
|---|
| Assédio ou comportamento ofensivo; discriminação; ameaça, agressão ou risco físico; perfil falso ou fraude; conteúdo sexual ou impróprio; conduta inadequada no evento; evento enganoso; local inseguro; ausência recorrente ou abandono pelo anfitrião; propaganda indevida; exposição de informação pessoal; outro motivo. |

#### Motivos de desistência

| Opções iniciais |
|---|
| Mudança de planos; problema pessoal; problema de saúde; dificuldade de transporte; horário incompatível; alteração importante no evento; desconforto ou insegurança; outro motivo. |

#### Motivos de cancelamento do evento

| Opções iniciais |
|---|
| Indisponibilidade do anfitrião; local indisponível; condição climática; participantes insuficientes; problema de segurança; imprevisto pessoal; erro nas informações; outro motivo. |

#### Restrições aplicáveis

| Opções iniciais |
|---|
| Impedimento de criar eventos; limite reduzido de eventos; participação somente com análise; impedimento de novas participações; restrição de mensagens; perda da moderação; entrada automática obrigatória; suspensão temporária; exclusão da conta. |

- **RN150:** toda restrição terá motivo, responsável, início, duração ou condição de encerramento e possibilidade de contestação quando aplicável.
- **RN151:** cancelamentos reiterados por participantes insuficientes poderão ser analisados pela equipe para identificar abuso, sem punição automática.

### 3.11 Matriz de papéis e permissões profissionais

| Papel | Pode realizar | Não pode realizar |
|---|---|---|
| Atendimento | Responder dúvidas, consultar dados básicos necessários, acompanhar protocolos e encaminhar casos | Consultar anexos de denúncia sem autorização no caso |
| Analista de Confiança e Segurança | Analisar denúncias, evidências, riscos, mensagens preservadas e aplicar medidas temporárias autorizadas | Decidir caso com conflito de interesse |
| Responsável de Confiança e Segurança | Revisar casos graves, recursos, suspensões e exclusões | Decidir caso com conflito de interesse |
| Operação | Acompanhar eventos, anfitriões, catálogos, cancelamentos e saúde da comunidade | Acessar livremente denúncias, documentos ou conversas restritas |
| Administrador autorizado | Gerenciar profissionais, funções e permissões | Obter acesso automático ao conteúdo sensível dos casos |

- **RN152:** ponto exato será acessado pela equipe somente diante de atendimento, segurança ou denúncia concreta.
- **RN153:** documentos serão acessados somente por profissionais especificamente autorizados.
- **RN154:** suspensão ou exclusão por segurança deverá admitir revisão por outro profissional.
- **RN155:** toda ação profissional sensível será auditada; afastamento ou desligamento retirará imediatamente as permissões profissionais.

### 3.12 Contratos de experiência

- **RN156:** compartilhamento mostrará título, atividade, data, horário, região aproximada, imagem pública, vagas e identificação pública do anfitrião; ocultará ponto exato, contatos, lista de pessoas, conversa e dados privados.
- **RN157:** visitante poderá consultar a página pública, mas precisará cadastrar-se para participar; compartilhamento não reservará vaga.
- **RN158:** anfitrião poderá consultar perfil público e apresentação, aceitar, recusar legitimamente, retirar legitimamente, avisar o grupo e acompanhar vagas e estados.
- **RN159:** anfitrião não poderá consultar dados privados, remover para favorecer alguém, criar exigência retroativa, acessar denúncia ou observação interna nem suspender conta.
- **RN160:** avisos essenciais do anfitrião serão limitados a mudança de data, horário ou local, cancelamento, segurança, ponto de encontro ou orientação indispensável.
- **RN161:** apenas um aviso ficará fixado; o seguinte substituirá o anterior; avisos não poderão fazer publicidade, constranger ou expor participantes.
- **RN162:** silenciar notificações será escolha pessoal; silenciamento do anfitrião seguirá o limite de duas horas; restrição da equipe será proporcional e terá prazo informado.
- **RN163:** silenciamento impedirá mensagens e anexos, mas preservará leitura e avisos essenciais; medidas terão motivo, duração, registro e contestação aplicável.
- **RN164:** notificação informará o que ocorreu, evento, participação ou solicitação afetada, ação necessária, prazo e destino.
- **RN165:** mensagens, convites, solicitações, recomendações, lembretes, avaliações, novidades e promoções serão configuráveis.
- **RN166:** segurança e acesso, mudanças de credenciais, alterações e cancelamentos, suspensão ou retirada e decisões de denúncia, recuperação ou recurso manterão ao menos um canal ativo e aparecerão no aplicativo.

### 3.13 Desistência e liberação de vaga

- **RN167:** nova tentativa após desistência exigirá evento não iniciado nem cancelado, vaga disponível e ausência de bloqueio, retirada anterior ou restrição.
- **RN168:** em aprovação manual, a nova solicitação dependerá novamente do anfitrião; em entrada automática, será confirmada imediatamente se as condições forem atendidas.

## 4. Requisitos não funcionais

- **RNF001 — Privacidade:** aplicar controle de acesso conforme a visibilidade de cada dado.
- **RNF002 — Minimização:** não coletar endereço residencial ou documento nos fluxos comuns.
- **RNF003 — Segurança:** códigos e links de confirmação e recuperação deverão ser temporários e vinculados ao fluxo correspondente.
- **RNF004 — Antienumeração:** autenticação, recuperação e conflito de contatos não revelarão existência ou identidade de contas.
- **RNF005 — Sessões:** troca de senha invalidará as demais sessões; o usuário poderá encerrá-las pelo MVP.
- **RNF006 — Auditoria:** ações sensíveis terão autoria, data, contexto e resultado rastreáveis.
- **RNF007 — Segregação:** identidades profissional e pessoal permanecerão separadas.
- **RNF008 — Transparência:** ações relevantes informarão efeitos, afetados e irreversibilidade antes da confirmação.
- **RNF009 — Usabilidade:** onboarding será curto e integrado, sem tutorial extenso obrigatório.
- **RNF010 — Clareza:** erros e estados indicarão resultado e próxima ação sem expor dados privados.
- **RNF011 — Integridade:** ocupação e liberação de vagas não poderão exceder a capacidade.
- **RNF012 — Consistência:** mudanças deverão refletir coerentemente em telas, conversas e notificações.
- **RNF013 — Desempenho de telas:** 95% dos carregamentos principais apresentarão conteúdo em até dois segundos em conexão móvel comum.
- **RNF014 — Desempenho de ações:** salvar, solicitar participação e enviar mensagem apresentarão resposta visível em até três segundos.
- **RNF015 — Disponibilidade:** disponibilidade mensal mínima de 99,5%, excluídas manutenções previamente comunicadas.
- **RNF016 — Manutenção:** manutenção planejada será comunicada com 24 horas de antecedência.
- **RNF017 — Acessibilidade operacional:** cadastro, descoberta, participação, denúncia e bloqueio funcionarão por teclado e leitor de tela.
- **RNF018 — Ampliação:** textos e operações permanecerão utilizáveis com zoom de 200%.
- **RNF019 — Percepção:** estado, erro e confirmação não dependerão somente de cor.
- **RNF020 — Alternativas:** imagens informativas terão descrição e vídeos futuros terão legendas.
- **RNF021 — Verificação:** 100% dos fluxos essenciais passarão por verificação de acessibilidade antes do lançamento.
- **RNF022 — Confidencialidade:** denúncias, recuperações, recursos e documentos serão acessíveis apenas a profissionais autorizados.
- **RNF023 — Retenção controlada (pendente de validação jurídica):** conservação e eliminação seguirão a categoria e o prazo propostos neste documento somente após confirmação jurídica brasileira.
- **RNF024 — Neutralidade:** descoberta e participação não introduzirão favorecimento comercial oculto ou quebra das regras definidas.
- **RNF025 — Validação jurídica:** retenção e tratamento excepcional de documentos serão revisados por assessoria jurídica brasileira antes do lançamento.
