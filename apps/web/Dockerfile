# ── Moraqat Web — multi-stage production image (Next.js standalone) ──────
# Build from the REPO ROOT:  docker build -f apps/web/Dockerfile .
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo

# A frozen install needs EVERY workspace manifest present.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/ui/package.json packages/ui/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/web ./apps/web
# Build-time public env (override with --build-arg for real deployments).
ARG NEXT_PUBLIC_API_BASE_URL="http://localhost:4000"
ARG NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_STANDALONE=1
RUN pnpm --filter @moraqat/core build && pnpm --filter @moraqat/web build

# ── Runtime — Next standalone output only (small image) ──────────────────
FROM node:20-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
# Next standalone does NOT bundle public/ — copy it explicitly or every static
# asset (brand logo on the Cat ID card, favicons, OG images) 404s.
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
