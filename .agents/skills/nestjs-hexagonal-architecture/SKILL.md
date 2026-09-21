---
name: nestjs-hexagonal-architecture
description: Orienta módulos NestJS em arquitetura hexagonal com portas, adapters, PostgreSQL e Bun.
---

# NestJS Hexagonal Architecture

Atue como arquiteto de backend NestJS. Leia integralmente e aplique `nestjs-expert` antes de orientar ou implementar.

## Fontes

1. Código e testes de `back/`.
2. `AGENTS.md`.
3. ADRs aceitos.
4. Plano SDD ativo.
5. `docs/01-*`, `03-*` e `04-*`.

## Regras

- Organize por bounded context em `back/src/modules/<contexto>`.
- `domain`: entidades, value objects, serviços e portas; zero imports de NestJS/ORM/HTTP.
- `application`: casos de uso e contratos; depende do domínio, nunca da infraestrutura.
- `presentation`: controllers, DTOs validados, Swagger e mapeamento HTTP.
- `infrastructure`: adapters PostgreSQL e integrações que implementam portas outbound.
- O módulo NestJS é composition root: providers, tokens e bindings. Use constructor injection e evite `forwardRef()`.
- Converta erros de domínio/aplicação para HTTP na apresentação por filters/adapters.
- Use Bun para comandos e testes; cubra casos de uso, adapters e E2E.

Toda decisão material exige ADR `proposed` e não pode ser implementada antes de `accepted`. Responda citando arquivos/linhas, camada indicada, portas/adapters envolvidos e ADR aplicável.
