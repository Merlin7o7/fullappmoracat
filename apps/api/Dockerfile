# ── Moraqat API — multi-stage production image ───────────────────────────
# Build from the REPO ROOT:  docker build -f apps/api/Dockerfile .
FROM node:20-alpine AS build
# openssl: Prisma engine detection/runtime on alpine (linux-musl targets).
RUN apk add --no-cache openssl && corepack enable
WORKDIR /repo

# Install the full workspace (cached until lockfile changes). A frozen install
# needs EVERY workspace manifest present — including apps we don't build here.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# Build shared packages + the API.
COPY packages ./packages
COPY apps/api ./apps/api
# prisma generate needs no live DB — a placeholder URL satisfies the schema.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm --filter @moraqat/db build \
 && pnpm --filter @moraqat/core build \
 && pnpm --filter @moraqat/api build

# Produce a pruned, production-only bundle of the API + its workspace deps.
# `pnpm deploy` re-copies @prisma/client from the pristine store, DROPPING the
# generated .prisma client — so overwrite the deployed store entry with the
# repo's fully-generated one (built in this same alpine stage → musl engines).
# Deterministic: same lockfile ⇒ identical store-entry directory name.
RUN pnpm --filter @moraqat/api --prod deploy /app \
 && cp -r packages/db/prisma /app/prisma \
 && rm -rf /app/node_modules/.pnpm/@prisma+client* \
 && cp -a /repo/node_modules/.pnpm/@prisma+client* /app/node_modules/.pnpm/
WORKDIR /app

# ── Runtime ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=app:app /app /app
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1
COPY --from=build --chown=app:app /repo/apps/api/scripts/start.sh /app/start.sh
# Migrate, THEN boot — and a failed migration is FATAL (we refuse to serve on a
# possibly stale schema). Migrations run against DIRECT_DATABASE_URL (the direct,
# non-pooled Neon URL) because Prisma migrations can't run through pgbouncer;
# runtime keeps the pooled DATABASE_URL. See scripts/start.sh.
CMD ["sh", "/app/start.sh"]
