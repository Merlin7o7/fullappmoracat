#!/bin/sh
# Production container entrypoint.
#
# 1) Apply database migrations, then boot the API. A migration failure is FATAL:
#    we exit non-zero instead of serving on a schema the code no longer matches.
#    Render (and any orchestrator watching the exit code / health check) then
#    keeps the previous healthy revision instead of silently running on drift.
#
# 2) Migrations run against DIRECT_DATABASE_URL when provided — Prisma cannot run
#    migrations through a pgbouncer-pooled connection, so DATABASE_URL (pooled,
#    used at runtime) is unsuitable for `migrate deploy`. Falls back to
#    DATABASE_URL for local/self-hosted stacks that use a single direct URL.
set -e

MIGRATE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}"

if [ -z "$MIGRATE_URL" ]; then
  echo "FATAL: neither DIRECT_DATABASE_URL nor DATABASE_URL is set — cannot migrate." >&2
  exit 1
fi

if [ ! -x node_modules/.bin/prisma ]; then
  echo "FATAL: prisma CLI not found in the image — cannot apply migrations." >&2
  exit 1
fi

echo "▶ Applying database migrations (migrate deploy)…"
if ! DATABASE_URL="$MIGRATE_URL" node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma; then
  echo "FATAL: database migration failed — refusing to boot on a possibly stale schema." >&2
  echo "       Fix the migration (or the DIRECT_DATABASE_URL) and redeploy." >&2
  exit 1
fi
echo "✓ Migrations applied."

exec node dist/main.js
