FROM oven/bun:1.3.14 AS base
WORKDIR /app

FROM base AS dependencies
COPY package.json bun.lock ./
COPY front/package.json ./front/package.json
COPY back/package.json ./back/package.json
RUN bun install --frozen-lockfile

FROM dependencies AS development
COPY back ./back
EXPOSE 3001
CMD ["bun", "run", "--cwd", "back", "start:dev"]

FROM dependencies AS builder
COPY back ./back
RUN bun run --cwd back build
RUN bun build back/src/shared/infrastructure/config/validate-env.ts --target=bun --outfile back/dist/validate-env.mjs

FROM base AS production-dependencies
COPY package.json bun.lock ./
COPY front/package.json ./front/package.json
COPY back/package.json ./back/package.json
RUN bun install --frozen-lockfile --production --filter @eventmatch/back

FROM oven/bun:1.3.14 AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV SWAGGER_ENABLED=true
ENV SWAGGER_PATH=docs
COPY --from=production-dependencies --chown=bun:bun /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=bun:bun /app/back/node_modules ./back/node_modules
COPY --from=builder --chown=bun:bun /app/back/dist ./back/dist
COPY --from=builder --chown=bun:bun /app/back/package.json ./back/package.json
USER bun
WORKDIR /app/back/dist
EXPOSE 3001
CMD ["sh", "-c", "bun validate-env.mjs && bun main.js"]
