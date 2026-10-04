.DEFAULT_GOAL := help

COMPOSE := docker compose
BACK_DEV := $(COMPOSE) -f docker-compose.back.dev.yml --env-file back/.env.development.local
BACK_PROD := $(COMPOSE) -f docker-compose.back.yml --env-file back/.env
BACK_TEST := $(COMPOSE) --env-file back/.env.test.local -f docker-compose.back.test.yml
FRONT_DEV := $(COMPOSE) -f docker-compose.front.dev.yml
FRONT_PROD := $(COMPOSE) -f docker-compose.front.yml

.PHONY: help \
	back-dev-up back-dev-down back-prod-up back-prod-down back-test-up back-test-down \
	front-dev-up front-dev-down front-prod-up front-prod-down

help: ## Lista os ambientes Docker disponíveis
	@awk 'BEGIN {FS = ":.*##"} /^[a-z][a-z0-9-]*:.*##/ {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

back-dev-up: ## Sobe o backend e PostgreSQL em desenvolvimento
	$(BACK_DEV) up --build

back-dev-down: ## Para o backend de desenvolvimento e preserva o volume PostgreSQL
	$(BACK_DEV) down --remove-orphans

back-prod-up: ## Sobe o backend na imagem de produção
	$(BACK_PROD) up --build

back-prod-down: ## Para o backend de produção
	$(BACK_PROD) down --remove-orphans

back-test-up: ## Sobe PostgreSQL, Brevo falso e backend para testes
	$(BACK_TEST) up --build

back-test-down: ## Para o ambiente de teste e remove volumes descartáveis
	$(BACK_TEST) down --volumes --remove-orphans

front-dev-up: ## Sobe o frontend Next.js em desenvolvimento
	$(FRONT_DEV) up --build

front-dev-down: ## Para o frontend de desenvolvimento
	$(FRONT_DEV) down --remove-orphans

front-prod-up: ## Sobe o frontend na imagem de produção
	$(FRONT_PROD) up --build

front-prod-down: ## Para o frontend de produção
	$(FRONT_PROD) down --remove-orphans
