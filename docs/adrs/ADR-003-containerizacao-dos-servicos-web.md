# ADR-003: Padronizar a containerização dos serviços web

- **Status:** accepted
- **Data:** 2026-09-21
- **Decisores:** mantenedores de arquitetura e operação
- **Relacionado:** `specs/sdd-003-fundacao-tecnica-frontend/tasks.md`, `specs/sdd-004-fundacao-tecnica-backend/tasks.md`
- **Substitui/Substituído por:** N/A

## Contexto

As fundações de `front/` e `back/` precisam funcionar localmente com Bun e também em containers distintos para desenvolvimento e produção. O ambiente de desenvolvimento deve refletir alterações sem rebuild manual, enquanto as imagens de produção devem ser reproduzíveis, mínimas e independentes de volumes de código-fonte. O ADR-001 definiu o monorepo Bun e a separação Next.js/NestJS, mas não decidiu a estratégia de containerização.

## Drivers da decisão

- Preservar a separação operacional entre frontend e backend.
- Reaproveitar o lockfile Bun da raiz em builds reproduzíveis.
- Evitar dependências de desenvolvimento e fontes desnecessárias nas imagens finais.
- Oferecer hot reload com bind mount apenas no ambiente de desenvolvimento.
- Permitir evolução posterior para uma composição integrada sem acoplar os ciclos de vida dos serviços.
- Executar processos sem privilégios de root na imagem final.

## Opções consideradas

1. Uma única imagem e um único Compose para frontend e backend.
2. Imagens multi-stage e arquivos Compose separados por serviço e ambiente.
3. Executar produção diretamente a partir de bind mounts, como no desenvolvimento.

## Decisão

Adotar um Dockerfile multi-stage por serviço e quatro arquivos Compose na raiz: produção e desenvolvimento para frontend, produção e desenvolvimento para backend.

Os stages de dependências e build usam o manifesto do workspace e o lockfile Bun com instalação congelada. O stage final copia somente artefatos e dependências necessários para execução, usa usuário não privilegiado, recebe configuração por ambiente e não contém segredos. O frontend deve usar uma saída de produção compatível com implantação autocontida, caso suportada pela versão fixada do Next.js; o backend executa o artefato compilado.

Em desenvolvimento, o Compose constrói um target próprio, monta somente os caminhos necessários ao código-fonte e preserva dependências instaladas no container em volume separado. Watch mode deve escutar interfaces do container e, quando necessário no host suportado, usar polling configurável. Volumes de código-fonte são proibidos na composição de produção.

Cada Compose continua executável isoladamente. Uma composição conjunta, proxy reverso, TLS, orquestrador, registry e estratégia de deploy permanecem fora deste ADR.

## Consequências positivas

- Imagens de produção menores e com superfície de ataque reduzida.
- Desenvolvimento em container sem rebuild a cada alteração.
- Build reproduzível a partir do lockfile único do workspace.
- Serviços continuam escaláveis e implantáveis de forma independente.

## Consequências negativas e riscos

- Quatro arquivos Compose geram alguma duplicação de configuração.
- Bind mounts e file watching variam entre Linux, macOS e Windows.
- A poda de dependências do workspace deve ser validada com as versões reais de Bun, Next.js e NestJS.
- Uma saída standalone do Next.js pode exigir configuração adicional de file tracing no monorepo.

## Plano de adoção e rollback

Adotar primeiro na fundação do frontend e reutilizar o padrão na fundação do backend. Validar build limpo, execução como usuário não privilegiado, hot reload e encerramento gracioso em ambos os serviços.

Se a instalação/pruning do workspace não for compatível com as versões fixadas, manter os Dockerfiles multi-stage e copiar o conjunto mínimo comprovadamente executável, documentando a exceção. Se o modelo separado se mostrar inviável, criar novo ADR antes de consolidar imagens ou composições. O rollback consiste em remover apenas os artefatos Docker ainda não publicados; a execução local via Bun permanece disponível.

## Evidências e referências

- `specs/tasks.txt`, Tasks 01 e 02
- `AGENTS.md` §§1–5
- `docs/adrs/ADR-001-separar-backend-nestjs-hexagonal-e-adotar-bun.md`
- `docs/01-visao-geral-arquitetura.md` §2
- Regra Vercel `bundle-analyzable-paths`, relevante ao file tracing do frontend

