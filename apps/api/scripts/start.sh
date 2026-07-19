#!/bin/sh
# Production container entrypoint: migrate, then boot.
#
# Migrations run against DIRECT_DATABASE_URL when provided — Prisma cannot run
# migrations through a pgbouncer-pooled connection, so a pooled DATABASE_URL
# (correct for runtime) is unsuitable for `migrate deploy`. Falls back to
# DATABASE_URL for stacks that use a single direct URL.
#
# WHY THIS IS FATAL NOW
# ---------------------
# This step used to warn-and-continue, leaning on /health's schema probe to hold
# the deploy. That worked, but it failed in the least useful way: the container
# booted, answered 503 for ten minutes, and the deploy log said nothing about
# why — the actual migration error was never surfaced. Worse, the Prisma CLI was
# not present in the pruned production bundle at all (it was a dependency of
# @moraqat/db, not of the API), so the migrate step was silently skipped on
# every deploy and schema changes had to be applied by hand.
#
# The CLI is now a direct dependency of the API precisely so this step can run,
# and a failure stops the container. Render then holds the previous healthy
# revision and the error is the last thing in the log, where it belongs.
#
# /health's drift probe REMAINS as a second gate — it catches the case where
# migrations apply but the schema still doesn't match the code.
set -e

MIGRATE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}"

if [ -z "$MIGRATE_URL" ]; then
  echo "FATAL: neither DIRECT_DATABASE_URL nor DATABASE_URL is set — cannot start." >&2
  exit 1
fi

if [ ! -x node_modules/.bin/prisma ]; then
  echo "FATAL: prisma CLI missing from the production bundle — cannot apply migrations." >&2
  echo "       'prisma' must be a DEPENDENCY of apps/api (not only of packages/db)," >&2
  echo "       or 'pnpm --prod deploy' prunes it and every schema change silently" >&2
  echo "       has to be applied by hand." >&2
  exit 1
fi

echo "▶ Applying database migrations (migrate deploy)…"
if ! DATABASE_URL="$MIGRATE_URL" node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma; then
  echo "" >&2
  echo "FATAL: migrate deploy failed — refusing to boot against an unknown schema." >&2
  echo "  • If the error mentions prepared statements or DDL, DATABASE_URL is pooled:" >&2
  echo "    set DIRECT_DATABASE_URL to the non-pooled Neon URL." >&2
  echo "  • The previous revision keeps serving; nothing was half-deployed." >&2
  exit 1
fi
echo "✓ Migrations applied."

exec node dist/main.js
