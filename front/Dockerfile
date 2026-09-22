FROM oven/bun:1.3.14 AS base
WORKDIR /app

FROM base AS dependencies
COPY package.json bun.lock ./
COPY front/package.json ./front/package.json
RUN bun install --frozen-lockfile

FROM dependencies AS development
COPY front ./front
EXPOSE 3000
CMD ["bun", "run", "--cwd", "front", "dev"]

FROM dependencies AS builder
COPY front ./front
RUN bun run --cwd front build
RUN bun build front/src/shared/config/validate-env.ts --target=bun --outfile front/.next/standalone/front/validate-env.mjs

FROM oven/bun:1.3.14 AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=bun:bun /app/front/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/front/.next/static ./front/.next/static
COPY --from=builder --chown=bun:bun /app/front/public ./front/public
USER bun
WORKDIR /app/front
EXPOSE 3000
CMD ["sh", "-c", "bun validate-env.mjs && bun server.js"]
