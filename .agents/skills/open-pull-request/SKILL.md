---
name: open-pull-request
description: Abre pull request somente quando explicitamente invocada.
---

# Open Pull Request

Carregue somente mediante pedido explícito.

Pré-condições: Git válido; remote configurado; CLI autenticada; branch diferente da base e publicada; mudanças existentes; plano revisado; `code-reviewer` aprovado; ADRs coerentes.

1. Determine a base (`main`, `develop` ou equivalente).
2. Valide `git status` e `git diff --stat`.
3. Verifique PR existente.
4. Infira título Conventional Commit.
5. Gere body com What, How, ADRs, Database/Migrations, Testing, Impact/Rollback e Checklist.
6. Crie o PR pela CLI do forge e informe o link.
