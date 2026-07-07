#!/bin/sh
# Production container entrypoint.
#
# 1) Apply database migrations, then boot the API. Migrations run against
#    DIRECT_DATABASE_URL when provided — Prisma cannot run migrations through a
#    pgbouncer-pooled connection, so DATABASE_URL (pooled, used at runtime) is
#    unsuitable for `migrate deploy`. Falls back to DATABASE_URL for local /
#    self-hosted stacks that use a single direct URL.
#
# 2) A migrate failure here is LOUD but NOT process-fatal: the real gate is the
#    app's /health check, which validates SCHEMA COMPATIBILITY (not just DB
#    connectivity). If a migration genuinely left the schema behind the code,
#    /health returns 503 and the platform holds the deploy on the previous
#    healthy revision. This avoids bricking on a pgbouncer no-op migrate while
#    still refusing to serve real drift.
set -e

MIGRATE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}"

if [ -z "$MIGRATE_URL" ]; then
  echo "FATAL: neither DIRECT_DATABASE_URL nor DATABASE_URL is set — cannot start." >&2
  exit 1
fi

if [ -x node_modules/.bin/prisma ]; then
  echo "▶ Applying database migrations (migrate deploy)…"
  if DATABASE_URL="$MIGRATE_URL" node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma; then
    echo "✓ Migrations applied."
  else
    echo "⚠ WARNING: migrate deploy did not complete (e.g. DIRECT_DATABASE_URL not set, or the pooled URL rejects DDL)." >&2
    echo "  Booting anyway — /health validates schema compatibility and returns 503 if the schema is actually behind the code." >&2
  fi
else
  echo "⚠ WARNING: prisma CLI not found in the image — skipping migrate; relying on /health schema probe." >&2
fi

exec node dist/main.js
