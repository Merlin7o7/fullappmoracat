# ── Moraqat API — multi-stage production image ───────────────────────────
# Build from the REPO ROOT:  docker build -f apps/api/Dockerfile .
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo

# Install the full workspace (cached until lockfile changes).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
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
RUN pnpm --filter @moraqat/api --prod deploy /app \
 && cp -r packages/db/prisma /app/prisma
# Regenerate the Prisma client inside the deployed tree so the engine binary
# and generated client land where /app/node_modules resolves them.
WORKDIR /app
RUN npx prisma@5.22.0 generate --schema=prisma/schema.prisma

# ── Runtime ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=app:app /app /app
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "dist/main.js"]
