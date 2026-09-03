#!/bin/sh
set -eu

KNOWN_FAILED_MIGRATION_1="20260503014059_contract_views_and_reviews"
KNOWN_FAILED_MIGRATION_2="20260521112200_add_escrow_fields_and_contract_type"

echo "[startup] resolving known duplicate migration if present"
./node_modules/.bin/prisma migrate resolve --rolled-back "$KNOWN_FAILED_MIGRATION_1" >/dev/null 2>&1 || true
./node_modules/.bin/prisma migrate resolve --rolled-back "$KNOWN_FAILED_MIGRATION_2" >/dev/null 2>&1 || true

echo "[startup] applying prisma migrations"
./node_modules/.bin/prisma migrate deploy

echo "[startup] standardizing contract categories"
npm run migrate:standardize-categories

echo "[startup] registering application release"
APP_VERSION="$(./node_modules/.bin/tsx scripts/register-app-release.ts)"
export APP_VERSION
echo "[startup] application version $APP_VERSION"

echo "[startup] archiving inactive contracts"
npm run cron:archive-contracts || true

DEAL_DEADLINE_PROCESS_INTERVAL_SECONDS="${DEAL_DEADLINE_PROCESS_INTERVAL_SECONDS:-60}"
echo "[startup] starting deal deadline processor every ${DEAL_DEADLINE_PROCESS_INTERVAL_SECONDS}s"
(while true; do
  if ! ./node_modules/.bin/tsx scripts/cron/process-deal-deadlines.ts; then
    echo "[deal-deadlines] processing cycle failed; retrying" >&2
  fi
  sleep "$DEAL_DEADLINE_PROCESS_INTERVAL_SECONDS"
done) &

AUCTION_RECONCILE_INTERVAL_SECONDS="${CATEGORY_AUCTION_RECONCILE_INTERVAL_SECONDS:-10}"
echo "[startup] starting category auction reconciler every ${AUCTION_RECONCILE_INTERVAL_SECONDS}s"
(while true; do
  if ! ./node_modules/.bin/tsx scripts/cron/reconcile-category-auctions.ts; then
    echo "[category-auctions] reconciliation cycle failed; retrying" >&2
  fi
  sleep "$AUCTION_RECONCILE_INTERVAL_SECONDS"
done) &

SUBSCRIPTION_RECONCILE_INTERVAL_SECONDS="${SUBSCRIPTION_RECONCILE_INTERVAL_SECONDS:-60}"
echo "[startup] starting subscription reconciler every ${SUBSCRIPTION_RECONCILE_INTERVAL_SECONDS}s"
(while true; do
  sleep "$SUBSCRIPTION_RECONCILE_INTERVAL_SECONDS"
  if ! ./node_modules/.bin/tsx scripts/cron/remove-expired-premium.ts; then
    echo "[subscriptions] reconciliation cycle failed; retrying" >&2
  fi
done) &

echo "[startup] starting telegram bot"
node bot/src/app/start-bot.js &

echo "[startup] starting next.js"
exec node server.mjs
