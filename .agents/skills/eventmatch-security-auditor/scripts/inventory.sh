#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f AGENTS.md || ! -d front || ! -d back ]]; then
  printf '%s\n' 'Execute este script na raiz do repositório EventMatch.' >&2
  exit 2
fi

print_matches() {
  local title="$1"
  shift
  printf '\n## %s\n' "$title"
  rg -l --glob '!**/.env*' "$@" 2>/dev/null | sort -u || true
}

printf '%s\n' '# Inventário de auditoria — EventMatch'
printf 'Commit: %s\n' "$(git rev-parse --short HEAD 2>/dev/null || printf 'indisponível')"
printf 'Branch: %s\n' "$(git branch --show-current 2>/dev/null || printf 'indisponível')"

print_matches 'Route Handlers do BFF' --glob 'front/src/app/api/**/route.ts' '.' front/src/app/api
print_matches 'Controllers, guards e DTOs do backend' --glob 'back/src/**/*.ts' 'Controller|Guard|ValidationPipe|Dto' back/src
print_matches 'Sessão, cookies e origem' --glob '*.{ts,tsx}' 'cookie|Cookie|Origin|Sec-Fetch-Site|SameSite|HttpOnly|__Host-' front/src back/src
print_matches 'Autorização e limites' --glob 'back/src/**/*.ts' 'capabilit|authoriz|rate.?limit|thrott|ownership|audience' back/src
print_matches 'Integrações externas e mídia' --glob '*.{ts,tsx}' 'Cloudinary|Brevo|fetch\(|URL\(' front/src back/src
print_matches 'Configuração declarada' --glob '.env.example' '^[A-Z][A-Z0-9_]*=' front back

printf '\n## ADRs de segurança relevantes\n'
printf '%s\n' \
  docs/adrs/ADR-014-protecao-de-contatos-segredos-e-senhas.md \
  docs/adrs/ADR-015-limites-de-abuso-persistidos-em-postgresql.md \
  docs/adrs/ADR-023-origem-confiavel-para-limites-do-cadastro.md \
  docs/adrs/ADR-033-sessoes-autenticadas-opacas-e-stateful.md \
  docs/adrs/ADR-034-cookie-http-only-e-bff-para-sessao.md \
  docs/adrs/ADR-035-limites-de-abuso-do-login.md \
  docs/adrs/ADR-036-autorizacao-de-sessao-por-estado-e-capacidade.md \
  docs/adrs/ADR-039-cloudinary-para-foto-principal-do-perfil.md \
  docs/adrs/ADR-042-remover-expiracao-da-url-de-foto.md
