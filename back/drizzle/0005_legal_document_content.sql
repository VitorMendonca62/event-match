-- ADR-028: legal document text lives in terms_document.content, byte-for-byte equal to
-- docs/legal/pt-BR/*.md. Legal authorized v1.0.0 and acceptance recording on 2026-09-28.
ALTER TABLE "terms_document" ADD COLUMN "content" text;
--> statement-breakpoint
UPDATE "terms_document" SET "content" = $eventmatch_legal$---
document_id: eventmatch-terms-pt-br-1.0.0
kind: terms
title: Termos de Uso do EventMatch
version: 1.0.0
locale: pt-BR
effective_at: 2026-09-28T00:00:00Z
status: approved
---

# Termos de Uso do EventMatch

**Versão 1.0.0 · Vigente a partir de 28 de setembro de 2026 · Idioma: português do Brasil**

Estes Termos de Uso regulam o acesso e o uso do EventMatch, serviço digital destinado a aproximar pessoas adultas por interesses e atividades locais para amizade, companhia e descoberta da cidade. O EventMatch não é um aplicativo de namoro.

Ao criar ou usar uma conta, você declara que leu e concorda com estes Termos, com a Política de Privacidade e com as Regras de Convivência.

## 1. Quem pode usar o EventMatch

Você deve ter **18 anos completos ou mais** para criar e manter uma conta. Não é permitido criar conta em nome de outra pessoa, fornecer dados falsos ou usar o serviço para fins ilícitos, discriminatórios, comerciais não autorizados ou incompatíveis com a proposta da comunidade.

Você é responsável por manter suas informações de acesso protegidas e por comunicar imediatamente qualquer uso não autorizado da sua conta pelos canais oficiais do EventMatch.

## 2. Como o serviço funciona

O EventMatch permite criar um perfil, indicar interesses, descobrir atividades locais, publicar ou participar de encontros e usar recursos de comunidade e segurança disponibilizados na plataforma.

No MVP, os encontros publicados devem ser presenciais, informais, gratuitos e realizados em locais públicos ou estabelecimentos identificáveis. Eventos em residências, encontros pagos, atividades comerciais, ilegais ou que coloquem participantes em risco não são permitidos.

O EventMatch facilita a organização e a descoberta de encontros; não é parte da relação entre participantes e anfitriões, não garante o comparecimento de pessoas nem assume a organização material de cada atividade. Isso não limita os deveres do EventMatch de aplicar suas regras, tratar denúncias e adotar medidas de segurança proporcionais.

## 3. Conta e perfil

Para concluir o cadastro, você deverá fornecer as informações solicitadas, confirmar ao menos um meio de contato, criar uma senha e aceitar os documentos vigentes. O nome de exibição não precisa ser único, mas deve respeitar as Regras de Convivência.

Seu e-mail, celular e data de nascimento não são exibidos a outras pessoas. A localização é tratada de forma aproximada no perfil; o ponto exato de um evento é reservado às pessoas autorizadas conforme as regras do produto.

Não compartilhe sua senha, código de verificação ou links de acesso. O EventMatch pode limitar, suspender ou encerrar uma conta quando houver indício consistente de fraude, violação destes Termos, risco à segurança ou obrigação legal, assegurando os canais de contestação aplicáveis.

## 4. Eventos e participação

Quem publica um evento deve fornecer informações corretas sobre atividade, data, horário, região, capacidade, acessibilidade e demais orientações relevantes. O anfitrião deve tratar solicitações de participação com respeito, aplicar apenas critérios legítimos divulgados ou previstos nas regras e nunca usar critérios discriminatórios.

Uma solicitação pendente não reserva vaga. A confirmação de participação depende de vaga disponível e das regras do evento. Cancelamentos, alterações importantes, desistências, reconfirmações e retiradas de participantes seguem as informações exibidas no evento e as Regras de Convivência.

O anfitrião não pode exigir pagamento, alterar um evento gratuito para pago, transferir a organização sem confirmação válida ou divulgar o ponto exato a pessoas não autorizadas. Participantes devem avaliar suas próprias condições de segurança, deslocamento, saúde e acessibilidade antes de comparecer.

## 5. Conteúdo e conduta

Você mantém a responsabilidade pelo conteúdo que publica, inclusive perfil, imagens, mensagens, avisos e informações de eventos. Ao publicar conteúdo no EventMatch, você concede ao serviço uma licença não exclusiva, gratuita, mundial e limitada ao necessário para hospedar, reproduzir, adaptar tecnicamente, exibir e distribuir esse conteúdo dentro das funcionalidades do produto.

É proibido publicar ou praticar conduta que viole direitos de terceiros, exponha dados pessoais sem autorização, envolva assédio, ameaça, discriminação, violência, fraude, spam, propaganda não autorizada, conteúdo sexual inadequado, exploração, discurso de ódio ou incentivo a atividade ilegal.

O EventMatch pode remover, restringir a visibilidade, preservar para auditoria ou encaminhar conteúdo e registros quando isso for necessário para aplicar as regras, proteger pessoas, cumprir obrigação legal ou responder a autoridade competente.

## 6. Segurança, bloqueio e denúncias

Em situação de perigo imediato, procure os serviços públicos de emergência da sua região. O EventMatch não substitui atendimento policial, médico, de emergência ou de assistência social.

Você pode bloquear outras pessoas e enviar denúncias pelos recursos disponíveis. Denúncias são analisadas com acesso restrito à equipe autorizada; o EventMatch busca preservar a privacidade das pessoas envolvidas e pode solicitar informações adicionais, aplicar restrições temporárias ou definitivas e oferecer contestação quando cabível.

Não use denúncias, bloqueios ou recursos de segurança de forma abusiva, para retaliação ou para obter vantagem indevida.

## 7. Disponibilidade e alterações

O EventMatch pode atualizar, corrigir, suspender ou descontinuar funcionalidades para manutenção, segurança, evolução do produto ou cumprimento de obrigações legais. Sempre que uma mudança nestes Termos exigir novo aceite, a nova versão será apresentada antes de seu uso produzir efeito.

O serviço é fornecido conforme sua disponibilidade. O EventMatch adota medidas razoáveis de segurança e continuidade, mas não garante funcionamento ininterrupto nem se responsabiliza por indisponibilidades causadas por fatores fora de seu controle razoável.

## 8. Encerramento e exclusão

Você pode solicitar a desativação ou exclusão da conta pelos canais disponibilizados no serviço. A exclusão considera eventos futuros, participações, obrigações de segurança, prevenção a fraude, exercício regular de direitos e prazos de guarda aplicáveis, conforme a Política de Privacidade.

O encerramento da conta não elimina obrigações, registros ou responsabilidades que precisem ser preservados por obrigação legal, segurança, defesa em processos ou prevenção a abuso.

## 9. Lei aplicável e contato

Estes Termos são regidos pelas leis brasileiras. Eventual controvérsia será tratada nos termos da legislação aplicável, sem restringir os direitos de consumidores quanto ao foro competente.

Para dúvidas, solicitações ou comunicações sobre estes Termos, utilize o canal de atendimento oficial disponibilizado no EventMatch.

$eventmatch_legal$
  WHERE "id" = '019c0000-0000-7000-8000-000000000001' AND "content" IS NULL;
--> statement-breakpoint
UPDATE "terms_document" SET "content" = $eventmatch_legal$---
document_id: eventmatch-privacy-pt-br-1.0.0
kind: privacy
title: Política de Privacidade do EventMatch
version: 1.0.0
locale: pt-BR
effective_at: 2026-09-28T00:00:00Z
status: approved
---

# Política de Privacidade do EventMatch

**Versão 1.0.0 · Vigente a partir de 28 de setembro de 2026 · Idioma: português do Brasil**

Esta Política explica como o EventMatch trata dados pessoais para operar uma comunidade de amizade, companhia e descoberta de atividades locais. O EventMatch trata dados pessoais de acordo com a legislação brasileira aplicável, inclusive a Lei Geral de Proteção de Dados Pessoais (LGPD).

## 1. Controlador e canais de contato

O EventMatch é o controlador dos dados pessoais tratados para disponibilizar o serviço. Os canais oficiais de atendimento e de privacidade são disponibilizados no aplicativo e na página institucional do EventMatch.

## 2. Dados tratados

Podemos tratar as seguintes categorias de dados, conforme as funcionalidades que você utiliza:

- **Dados de cadastro e acesso:** nome de exibição, e-mail ou celular confirmado, senha protegida, data de nascimento e registros de confirmação de contato.
- **Dados de perfil e preferências:** região aproximada, interesses, intenções de uso, apresentação, fotos e escolhas de visibilidade.
- **Dados de eventos e participação:** atividades, horários, região, capacidade, ponto exato protegido, solicitações, confirmações, desistências, avaliações e avisos.
- **Dados de comunicação e segurança:** mensagens coletivas de eventos, denúncias, bloqueios, recursos, evidências e contatos com o atendimento.
- **Dados técnicos:** informações necessárias para segurança, prevenção a fraude, funcionamento do serviço, registro de acessos e diagnóstico de falhas.

O EventMatch não exibe a outras pessoas seu e-mail, celular ou data de nascimento. Dados que possam ser sensíveis, como informações de acessibilidade, alimentação, pronomes ou outras preferências opcionais, permanecem privados por padrão e são tratados somente conforme sua configuração e a funcionalidade escolhida.

## 3. Finalidades e bases legais

Tratamos dados pessoais para:

- criar, autenticar, manter e proteger sua conta;
- validar maioridade e prevenir uso indevido do serviço por menores de 18 anos;
- permitir perfil, descoberta, criação e participação em eventos;
- viabilizar comunicação e avisos essenciais relacionados a conta, segurança e eventos;
- aplicar as Regras de Convivência, receber denúncias, prevenir fraude e proteger pessoas;
- atender obrigações legais, regulatórias e solicitações válidas de autoridades;
- melhorar a estabilidade, segurança e experiência do EventMatch;
- atender solicitações de privacidade, suporte, recursos, exclusão e portabilidade.

O tratamento ocorre conforme a base legal adequada a cada finalidade, como execução de contrato e procedimentos preliminares, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, legítimo interesse para segurança e prevenção a fraude, proteção da vida quando aplicável e consentimento para situações em que ele for necessário.

## 4. Compartilhamento

O EventMatch compartilha dados somente quando necessário para a finalidade informada e com controles proporcionais. Isso pode incluir:

- outras pessoas usuárias, apenas nos limites de visibilidade, participação e segurança definidos no produto;
- fornecedores que apoiam hospedagem, e-mail transacional, infraestrutura, suporte, segurança e operação, sujeitos a instruções e salvaguardas adequadas;
- autoridades públicas, órgãos reguladores ou terceiros quando houver obrigação legal, ordem válida ou necessidade de proteção de direitos e segurança;
- partes envolvidas em operação societária, respeitados os requisitos legais e esta Política.

Quando uma operação exigir transferência internacional de dados, o EventMatch adotará os mecanismos e salvaguardas exigidos pela legislação aplicável.

## 5. Segurança

Adotamos medidas técnicas e administrativas razoáveis para proteger dados contra acesso não autorizado, perda, alteração, destruição ou divulgação indevida. Entre as medidas aplicadas ao cadastro estão proteção criptográfica de contatos, armazenamento seguro de senhas e controles para reduzir fraude e tentativas de acesso indevido.

Nenhum sistema é absolutamente imune a riscos. Se identificarmos incidente de segurança com risco ou dano relevante, adotaremos as medidas previstas na legislação aplicável, incluindo comunicações às pessoas e autoridades quando cabíveis.

## 6. Retenção e eliminação

Mantemos dados pessoais pelo tempo necessário para as finalidades descritas nesta Política, para cumprir obrigações legais, prevenir fraude, proteger a comunidade, resolver disputas e exercer direitos. Os prazos podem variar conforme a categoria de dado e a situação da conta.

Como regra operacional do produto, dados públicos de conta excluída são removidos em até 30 dias; dados básicos necessários à conclusão da exclusão podem ser mantidos por até 90 dias; registros de denúncias e decisões de segurança podem ser mantidos por cinco anos após o encerramento; evidências sem denúncia confirmada, por um ano; e dados de eventos, participações e cancelamentos, por dois anos. Registros de aceite são preservados com a versão do documento e o contexto mínimo necessário enquanto forem necessários para demonstrar a concordância, atender obrigações legais ou exercer direitos.

Quando os dados não forem mais necessários, serão eliminados ou anonimizados, salvo hipótese de conservação permitida ou exigida por lei.

## 7. Seus direitos

Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação quando aplicável, portabilidade, informações sobre compartilhamento, revogação de consentimento e revisão de decisões automatizadas que afetem seus interesses, observados os limites legais.

Para exercer seus direitos, use o canal de privacidade do EventMatch. Poderemos solicitar informações adicionais para confirmar sua identidade e proteger sua conta. A revogação do consentimento não afeta tratamentos realizados antes dela nem tratamentos apoiados em outra base legal.

## 8. Cookies e tecnologias semelhantes

O EventMatch pode usar cookies e tecnologias semelhantes estritamente necessários ao funcionamento, à segurança e à manutenção da sessão. Tecnologias que não forem estritamente necessárias serão apresentadas com as informações e escolhas aplicáveis antes de seu uso, quando exigido.

## 9. Crianças e adolescentes

O EventMatch é destinado exclusivamente a pessoas com 18 anos completos ou mais. Se houver indício de uso por menor de idade, poderemos restringir a conta e solicitar as providências necessárias para proteger a pessoa e cumprir a legislação aplicável.

## 10. Atualizações desta Política

Podemos atualizar esta Política para refletir mudanças legais, de segurança ou do serviço. A versão vigente, sua data de vigência e as mudanças relevantes estarão disponíveis no EventMatch. Quando necessário, solicitaremos novo aceite antes de aplicar uma alteração material.

$eventmatch_legal$
  WHERE "id" = '019c0000-0000-7000-8000-000000000002' AND "content" IS NULL;
--> statement-breakpoint
UPDATE "terms_document" SET "content" = $eventmatch_legal$---
document_id: eventmatch-community-rules-pt-br-1.0.0
kind: community_rules
title: Regras de Convivência do EventMatch
version: 1.0.0
locale: pt-BR
effective_at: 2026-09-28T00:00:00Z
status: approved
---

# Regras de Convivência do EventMatch

**Versão 1.0.0 · Vigente a partir de 28 de setembro de 2026 · Idioma: português do Brasil**

O EventMatch existe para facilitar amizades, companhia e descoberta da cidade por meio de atividades locais. Estas Regras valem para perfis, eventos, mensagens, avisos, avaliações, denúncias e qualquer interação dentro da plataforma.

## 1. Respeito e inclusão

Trate todas as pessoas com respeito. Não são tolerados discriminação, assédio, perseguição, intimidação, ameaça, violência, discurso de ódio, humilhação, exposição de dados pessoais, conteúdo sexual não solicitado ou qualquer conduta que comprometa a dignidade ou a segurança de alguém.

Não use raça, cor, origem, nacionalidade, deficiência, religião, idade, orientação sexual, identidade de gênero, condição de saúde, aparência, classe social ou qualquer outra característica pessoal como motivo para excluir, recusar, atacar ou constranger alguém.

## 2. Perfis e informações verdadeiras

Use uma identidade compatível com quem você é e mantenha as informações do perfil corretas. Não crie contas falsas, não se passe por outra pessoa, não use imagens ou conteúdo sem autorização e não tente burlar bloqueios, restrições ou medidas de segurança.

Não publique dados pessoais seus ou de terceiros — como endereço residencial, documentos, telefone, e-mail ou localização precisa — sem necessidade e autorização adequada.

## 3. Eventos seguros e coerentes com a proposta

Eventos devem ser presenciais, informais, gratuitos e realizados em locais públicos ou estabelecimentos identificáveis. Não publique encontros em residências, atividades ilegais, eventos pagos, propaganda disfarçada, captação comercial, sorteios não autorizados ou atividades que exijam pagamento para participação.

Ao criar um evento, informe com clareza atividade, data, horário, região, capacidade e orientações relevantes. Não altere informações importantes de modo a surpreender participantes; mudanças de data, horário, cidade, ponto exato ou atividade devem ser comunicadas pelo recurso apropriado.

O ponto exato do evento é informação protegida. Anfitriões não devem divulgá-lo a pessoas não confirmadas, e participantes não devem repassá-lo sem autorização.

## 4. Participação e decisões de anfitriões

Peça participação apenas quando tiver real intenção de comparecer. Se não puder ir, desista pelo aplicativo assim que possível. Não pressione anfitriões ou participantes, não tente ocupar vagas fora do fluxo do EventMatch e não contorne uma recusa criando novas contas ou acionando outras pessoas.

Anfitriões devem decidir solicitações com critérios legítimos, objetivos e compatíveis com as informações divulgadas no evento. Não é permitido recusar, retirar ou privilegiar alguém por motivo discriminatório. Retiradas exigem motivo permitido, registro e respeito ao processo de contestação aplicável.

## 5. Conversas e conteúdo

Use as conversas coletivas do evento para assuntos relacionados à atividade e à convivência. Não envie spam, correntes, golpes, publicidade não autorizada, links maliciosos, conteúdo sexual explícito, conteúdo violento ou mensagens repetidas que prejudiquem a experiência das demais pessoas.

Respeite pedidos de limite, bloqueio e silêncio. Não tente contatar alguém por fora da plataforma para escapar de uma restrição. Não use imagens, mensagens ou informações obtidas no EventMatch fora do contexto autorizado pela pessoa envolvida.

## 6. Segurança e emergências

Priorize sua segurança e a de outras pessoas. Em risco imediato, procure os serviços públicos de emergência. Não use o EventMatch para organizar ou incentivar violência, exploração, fraude, venda de produtos ou serviços proibidos, atividades ilegais ou qualquer situação que exponha participantes a dano.

Se identificar comportamento preocupante, use os recursos de bloqueio e denúncia. Ao denunciar, forneça informações verdadeiras e relevantes. Denúncias de má-fé, retaliação ou tentativa de prejudicar alguém também violam estas Regras.

## 7. Consequências

O EventMatch pode adotar medidas proporcionais conforme a gravidade, o contexto, reincidência e o risco: orientação, remoção de conteúdo, limitação de recursos, cancelamento de evento, retirada de participação, suspensão temporária, encerramento de conta ou encaminhamento às autoridades quando necessário.

Medidas de segurança podem ser aplicadas de forma imediata quando houver risco relevante. Sempre que compatível com a segurança, a privacidade e a prevenção a fraude, o EventMatch disponibilizará informações sobre a decisão e canal de contestação.

## 8. Como pedir ajuda

Use os recursos de bloqueio, denúncia e atendimento do EventMatch sempre que precisar de ajuda relacionada à comunidade. Para assuntos urgentes ou risco imediato, acione os serviços públicos de emergência da sua região.

$eventmatch_legal$
  WHERE "id" = '019c0000-0000-7000-8000-000000000003' AND "content" IS NULL;
--> statement-breakpoint
ALTER TABLE "terms_document" ADD CONSTRAINT "terms_document_content_digest_check"
  CHECK ("content" IS NULL OR sha256(convert_to("content", 'UTF8')) = "content_digest");
--> statement-breakpoint
ALTER TABLE "terms_document" ADD CONSTRAINT "terms_document_approved_content_check"
  CHECK ("status" <> 'approved' OR "content" IS NOT NULL);
--> statement-breakpoint
CREATE FUNCTION "terms_document_guard_published"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('approved', 'retired') THEN
    IF NEW."kind" IS DISTINCT FROM OLD."kind"
      OR NEW."version" IS DISTINCT FROM OLD."version"
      OR NEW."locale" IS DISTINCT FROM OLD."locale"
      OR NEW."effective_at" IS DISTINCT FROM OLD."effective_at"
      OR NEW."content_digest" IS DISTINCT FROM OLD."content_digest"
      OR NEW."content" IS DISTINCT FROM OLD."content" THEN
      RAISE EXCEPTION 'published legal documents are immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW."status" IS DISTINCT FROM OLD."status"
      AND NOT (OLD."status" = 'approved' AND NEW."status" = 'retired') THEN
      RAISE EXCEPTION 'published legal documents can only move from approved to retired' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "terms_document_guard_published_trigger" BEFORE UPDATE ON "terms_document"
  FOR EACH ROW EXECUTE FUNCTION "terms_document_guard_published"();
--> statement-breakpoint
CREATE INDEX "terms_document_current_idx" ON "terms_document" ("locale", "kind", "effective_at" DESC)
  WHERE "status" = 'approved';
