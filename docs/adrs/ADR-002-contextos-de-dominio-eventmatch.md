# ADR-002: Decompor o EventMatch em contextos de domínio

- **Status:** proposed
- **Data:** 2026-09-21
- **Decisores:** mantenedores de produto e arquitetura
- **Relacionado:** `specs/sdd-002-alinhar-documentacao-der-eventmatch/tasks.md`
- **Substitui/Substituído por:** N/A

## Contexto

O DER v1.3 contém 107 requisitos funcionais, 168 regras de negócio e 25 requisitos não funcionais, atravessando identidade, eventos, conversa, segurança, operações profissionais e ciclo de dados. Um único módulo de negócio aumentaria acoplamento, risco de acesso indevido e dificuldade de evolução.

## Drivers da decisão

- Coesão por capacidade de negócio.
- Limites claros para dados sensíveis e permissões profissionais.
- Integridade transacional de vagas e participações.
- Evolução independente de conversa, segurança, notificações e retenção.
- Aderência à arquitetura hexagonal definida no ADR-001.

## Opções consideradas

1. Um módulo NestJS por entidade/tabela.
2. Um único módulo de negócio para todo o MVP.
3. Bounded contexts por capacidade, com contratos explícitos entre eles.

## Decisão proposta

Adotar os contextos: Identidade e Acesso; Perfis e Preferências; Eventos; Descoberta; Participações; Conversas; Confiança e Segurança; Avaliações; Notificações; Operações; Privacidade e Ciclo de Dados.

Cada contexto possuirá domínio, aplicação, adapters de entrada/saída e composition root NestJS. Compartilhamento de tabela não implica compartilhamento de modelo de domínio. Integrações entre contextos serão síncronas por porta ou assíncronas por evento conforme consistência e criticidade definidas em planos futuros.

## Consequências positivas

- Regras e permissões ficam localizadas por capacidade.
- Reduz risco de módulos comuns virarem acesso irrestrito a dados sensíveis.
- Permite testar casos de uso e políticas isoladamente.

## Consequências negativas e riscos

- Mais contratos e coordenação entre módulos.
- Fronteiras de Eventos/Participações e Segurança/Privacidade precisarão de revisão durante modelagem detalhada.
- Consistência eventual não pode ser aplicada a ocupação/liberação de vaga sem desenho explícito.

## Plano de adoção e rollback

Validar este ADR antes do primeiro scaffolding de módulos. Implementar contextos incrementalmente por vertical slice. Se uma fronteira se mostrar artificial, criar novo ADR que a revise, preservando contratos e migração de dados.

## Evidências e referências

- `docs/DER-EventMatch-MVP.md`
- `docs/01-visao-geral-arquitetura.md §4`
- `docs/02-regras-de-negocio.md`
- `docs/03-modelos-de-dominio.md`
- ADR-001
