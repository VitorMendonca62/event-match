# ADR-012: Separar placeholder visual de aceite jurídico efetivo

- **Status:** accepted
- **Data:** 2026-09-25
- **Decisores:** produto, jurídico, privacidade, frontend e backend
- **Relacionado:** `specs/sdd-006-modelagem-conceitual-cadastro/tasks.md`
- **Substitui/Substituído por:** N/A

## Contexto

RF005 exige registrar as versões aceitas de termos de uso, política de privacidade e regras de convivência. O conteúdo e as versões ainda não foram definidos. A decisão de produto permite lorem ipsum exclusivamente em testes de interface, com rolagem completa antes de habilitar a ação; os documentos definitivos serão criados posteriormente com respaldo jurídico.

## Decisão proposta

Usar lorem ipsum exclusivamente como placeholder em testes de interface e marcar qualquer confirmação associada como não jurídica/não efetiva. Esse placeholder não habilita cadastro real. O produto só poderá concluir cadastro com aceite efetivo quando os três documentos tiverem conteúdo aprovado, identificador de versão imutável, idioma, data de vigência, URL/artefato preservado e política de retenção validada juridicamente. A interface futura deve ser acessível por teclado e leitor de tela; rolagem não pode ser a única evidência de leitura ou impedir tecnologias assistivas.

## Opções consideradas

1. Placeholder sem efeito jurídico e aceite versionado apenas após aprovação — proposto.
2. Tratar lorem ipsum como termos aceitos — rejeitado; não informa o usuário nem atende RF005/RNF008.
3. Bloquear todo o protótipo até haver conteúdo final — aumenta dependência, mas continua disponível caso o jurídico exija.

## Consequências

- A futura tela pode validar a interação de rolagem, mas não deve declarar aceites legais nem permitir conclusão de conta ativa sem conteúdo aprovado.
- O backend futuro separa `TermsPresentation` de `TermsAcceptance` efetivo e registra versão, instante, sujeito e contexto mínimo auditável.
- A decisão final depende de validação jurídica brasileira, conforme RNF023 e RNF025.

## Condições de aceitação

Definir o conteúdo, as versões iniciais, responsabilidade de publicação, idioma, retenção e a regra de acessibilidade que substitui/complementa a rolagem para usuários de tecnologias assistivas.
