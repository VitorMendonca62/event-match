# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Qualquer pessoa com 18 anos ou mais que queira criar ou fortalecer uma vida social. Não há um contexto inicial específico, como mudança recente de cidade ou uma faixa etária prioritária. Visitantes podem conhecer a proposta e iniciar o cadastro; participantes descobrem, criam e frequentam atividades; anfitriões organizam encontros; equipes internas cuidam de operação, confiança e segurança.

## Product Purpose

O EventMatch ajuda pessoas adultas a construir uma vida social por meio de interesses compartilhados e atividades locais. O produto facilita a descoberta, criação e participação em encontros presenciais, informais e gratuitos voltados a amizade, companhia e exploração da cidade. Sucesso significa transformar afinidades em oportunidades seguras e claras de convivência no mundo real.

## Positioning

O mecanismo central combina interesses, intenção de uso e atividades locais em grupo para facilitar conexões sociais presenciais. O EventMatch não é um aplicativo de namoro e não usa dinâmica romântica como proposta, linguagem ou modelo de interação.

## Operating Context

- A experiência começa com cadastro, confirmação de contato, dados obrigatórios, aceites e escolha de interesses.
- Participantes descobrem encontros locais, solicitam ou confirmam participação, conversam coletivamente e avaliam a experiência.
- Anfitriões criam e administram encontros presenciais em locais públicos, dentro de regras de capacidade e segurança.
- Os encontros do MVP são informais, gratuitos e não comerciais.
- Privacidade, confiança, denúncia, bloqueio, suporte e comunicação de segurança fazem parte da experiência principal, não de um fluxo periférico.

## Capabilities and Constraints

- O produto atende exclusivamente pessoas com 18 anos completos ou mais.
- A localização pública é aproximada; ponto exato e dados privados são protegidos conforme papel e estado da participação.
- Não há mensagens privadas entre participantes no MVP; a comunicação social acontece em conversas coletivas vinculadas aos eventos.
- O frontend é Next.js e consome a API de negócio NestJS exclusivamente por contratos públicos e BFF quando definido; não acessa PostgreSQL.
- Bun é o runtime e gerenciador de pacotes do monorepo.
- O MVP não inclui eventos pagos, comerciais, recorrentes ou de grande porte, grupos permanentes ou recomendações altamente personalizadas.
- Retenção, cópia de dados e uso excepcional de documentos continuam condicionados à validação jurídica brasileira antes do lançamento.

## Brand Commitments

- Ausência de dinâmica romântica em proposta, linguagem e interação.
- Inclusão de pessoas adultas com diferentes perfis, rotinas e necessidades.
- Comunicação direta, acolhedora e respeitosa, sem tom infantilizado, burocrático ou evasivo.
- Segurança e privacidade tratadas de forma compreensível, sem alarmismo e sem esconder consequências relevantes.
- O nome do produto é EventMatch.

## Evidence on Hand

- `docs/DER-EventMatch-MVP.md` v1.3 é a fonte funcional canônica e está aprovado com ressalvas jurídicas explícitas.
- `docs/01-visao-geral-arquitetura.md`, `docs/02-regras-de-negocio.md`, `docs/03-modelos-de-dominio.md` e `docs/04-integracoes-externas.md` traduzem o DER para arquitetura, regras, domínio e contratos.
- Os fluxos de cadastro e sua API possuem planos SDD, ADRs e implementação backend testável no repositório.
- Não há atualmente logotipo, fotografia, ilustração, família tipográfica própria, depoimentos, clientes, métricas públicas ou outros ativos de prova aprovados. Trabalho futuro não deve fabricá-los.

## Product Principles

1. **Vida social antes de engajamento vazio:** cada fluxo deve aproximar a pessoa de uma atividade ou conexão social significativa no mundo real.
2. **Interesses viram encontros locais:** afinidade, intenção e contexto da atividade orientam a descoberta e a participação.
3. **Segurança sem opacidade:** proteção, privacidade e antienumeração convivem com orientações claras sobre o que a pessoa pode fazer em seguida.
4. **Inclusão prática:** linguagem, interação e acessibilidade devem acolher diferentes pessoas sem pressupor contexto social, capacidade ou familiaridade técnica.
5. **Sem ambiguidade romântica:** conteúdo, padrões de interação e decisões de produto preservam o posicionamento não romântico do EventMatch.

## Accessibility & Inclusion

Fluxos essenciais devem funcionar por teclado, leitor de tela e zoom de 200%, com foco visível, estrutura semântica, alvos de toque adequados e feedback que não dependa apenas de cor. O produto deve evitar pressupostos sobre gênero, estado civil, experiência social, capacidade, localização precisa ou familiaridade digital. Dados potencialmente sensíveis permanecem privados por padrão e são solicitados apenas com finalidade clara.
