# ADR-004: Validar configuração de ambiente com Zod antes de iniciar serviços

- **Status:** accepted
- **Data:** 2026-09-21
- **Decisores:** mantenedores de arquitetura e operação
- **Relacionado:** `specs/sdd-003-fundacao-tecnica-frontend/tasks.md`, `specs/sdd-004-fundacao-tecnica-backend/tasks.md`
- **Substitui/Substituído por:** N/A

## Contexto

Frontend e backend passarão a depender de configuração de ambiente para executar localmente e em containers. Sem validação centralizada, valores ausentes ou malformados causam falhas tardias, comportamento divergente entre ambientes ou exposição acidental de configuração. Ainda não existem segredos ou integrações de produto no escopo.

## Drivers da decisão

- Falhar antes de abrir a porta HTTP quando a configuração for inválida.
- Manter a validação e os tipos em uma única fonte por aplicação.
- Produzir diagnóstico acionável sem revelar valores, segredos ou ambiente completo.
- Impedir que variáveis de servidor sejam importadas pelo bundle do cliente.
- Integrar a validação ao `ConfigModule` do NestJS sem vazar Zod ao domínio ou à aplicação.

## Opções consideradas

1. Ler `process.env` diretamente em cada ponto de uso.
2. Validar variáveis apenas no Docker Compose.
3. Centralizar schemas Zod por aplicação e validar no bootstrap/configuração.

## Decisão

Adotar Zod como dependência de runtime nas duas aplicações. Cada serviço terá schema tipado, módulo de carregamento e exemplos de variáveis não secretas em arquivo versionável apropriado; arquivos com valores reais permanecem ignorados pelo Git.

O schema inicial valida somente variáveis efetivamente usadas pela fundação: `NODE_ENV`, `PORT` e host de escuta, com valores padrão documentados onde a ausência é segura. Variáveis `NEXT_PUBLIC_*` só serão incluídas quando houver necessidade de exposição ao browser; segredos, URLs de banco e credenciais ficam fora desta fundação. Todo valor recebido deve obedecer tipo, faixa e enumeração definidos pelo schema.

No frontend, o carregamento acontece em módulo estritamente server-only acionado pela inicialização do Next.js, de modo que configuração inválida interrompe `dev`, `build` ou `start` antes do servidor aceitar requisições. No backend, o `ConfigModule` recebe uma função de validação Zod executada durante o bootstrap, antes de criar o listener HTTP.

Falhas exibem em stderr apenas nomes de variáveis e mensagens de validação; valores fornecidos, tokens, URLs completas e objeto `process.env` nunca são impressos. O processo encerra com código diferente de zero e não sobe parcialmente.

## Consequências positivas

- Erros de configuração aparecem cedo e de forma consistente em local, CI e containers.
- Código consumidor recebe configuração tipada e validada.
- Reduz risco de logs com segredo e de variáveis server-only no cliente.

## Consequências negativas e riscos

- O build do frontend passa a depender de uma configuração válida, mesmo para páginas estáticas.
- Defaults podem esconder configuração omitida se forem aplicados a variáveis que deveriam ser obrigatórias.
- Um schema mal mantido pode divergir de novos serviços/integrações.

## Plano de adoção e rollback

Criar schemas mínimos, exemplos, formatter seguro de erros e testes de valores válidos/inválidos. Rodar comandos locais, containers de desenvolvimento e imagens de produção com valores válidos e inválidos, confirmando que não há listener após falha.

Ao introduzir variável de produto, atualizá-la primeiro no schema, exemplos, documentação e testes. Se uma validação bloquear rollout por requisito não previsto, corrigir o schema em mudança auditável; não contornar via leitura direta de `process.env`. Rollback da fundação remove o módulo validador e a dependência apenas se ainda não houver serviço que dependa dela.

## Evidências e referências

- `specs/tasks.txt`, Tasks 01 e 02
- `AGENTS.md` §5
- `docs/01-visao-geral-arquitetura.md` §§2 e 5
- `docs/04-integracoes-externas.md` §§1 e 6

