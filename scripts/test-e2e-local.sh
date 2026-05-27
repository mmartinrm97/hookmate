#!/usr/bin/env bash
# Local e2e test runner. Starts docker-compose services, creates SQS queues,
# cleans the DB, and runs the API e2e suite.
# Usage:
#   bash scripts/test-e2e-local.sh          # e2e only
#   bash scripts/test-e2e-local.sh --cdk    # e2e + CDK deploy + drift check
set -euo pipefail

WITH_CDK="${1:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# On Windows, Docker Desktop uses a named pipe instead of a Unix socket.
# If /var/run/docker.sock doesn't exist, fall back to the named pipe so
# docker commands work from Git Bash or PowerShell on Windows.
if ! [ -S /var/run/docker.sock ]; then
  export DOCKER_HOST="npipe:////./pipe/docker_engine"
fi

# ---------------------------------------------------------------------------
# Docker-compose environment (postgres service needs these)
# ---------------------------------------------------------------------------
export POSTGRES_USER="${POSTGRES_USER:-hookmate}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-hookmate}"
export POSTGRES_DB="${POSTGRES_DB:-hookmate}"

# ---------------------------------------------------------------------------
# Test environment (read by the NestJS app during e2e)
# ---------------------------------------------------------------------------
export POSTGRES_HOST=localhost
export POSTGRES_PORT="${POSTGRES_PORT:-5433}"
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export SQS_INGESTION_QUEUE_URL="http://localhost:4566/000000000000/ingestion"
export REDIS_HOST=localhost
export REDIS_PORT="${REDIS_PORT:-6379}"
export API_KEYS=dev-key-123

# ---------------------------------------------------------------------------
wait_for() {
  local name="$1" cmd="$2"
  echo "  Waiting for $name..."
  for _ in $(seq 1 30); do
    if eval "$cmd" &>/dev/null; then
      echo "  $name ready."
      return 0
    fi
    sleep 1
  done
  echo "  ERROR: $name did not become healthy in 30s" >&2
  exit 1
}
# ---------------------------------------------------------------------------

echo ""
echo "▶  Starting docker-compose services..."
docker compose up -d

wait_for "Postgres" \
  "docker compose exec -T postgres pg_isready -U $POSTGRES_USER -q"

wait_for "Redis" \
  "docker compose exec -T redis redis-cli ping | grep -q PONG"

wait_for "Floci" \
  "aws sqs list-queues --endpoint-url http://localhost:4566 --region us-east-1"

echo ""
echo "▶  Creating SQS queues..."
aws sqs create-queue --queue-name ingestion \
  --endpoint-url http://localhost:4566 --region us-east-1 >/dev/null 2>&1 || true
aws sqs create-queue --queue-name dlq \
  --endpoint-url http://localhost:4566 --region us-east-1 >/dev/null 2>&1 || true

echo ""
echo "▶  Cleaning database schema..."
docker compose exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null

echo ""
echo "▶  Building shared types..."
pnpm --filter @hookmate/shared build

echo ""
echo "▶  Running e2e tests..."
pnpm --filter @hookmate/api test:e2e
E2E_EXIT=$?

# ---------------------------------------------------------------------------
# Optional CDK smoke test (--cdk flag)
# ---------------------------------------------------------------------------
if [ "$WITH_CDK" = "--cdk" ]; then
  echo ""
  echo "▶  Building API (Lambda asset)..."
  pnpm --filter @hookmate/api build

  echo ""
  echo "▶  Building infrastructure..."
  pnpm --filter @hookmate/infrastructure build

  echo ""
  echo "▶  CDK bootstrap (Floci)..."
  (cd infrastructure && npx cdk bootstrap aws://000000000000/us-east-1)

  echo ""
  echo "▶  CDK deploy (Floci)..."
  (cd infrastructure && npx cdk deploy --all --require-approval never)

  echo ""
  echo "▶  CDK diff — asserting no drift..."
  (cd infrastructure && npx cdk diff --all --fail)
fi

# ---------------------------------------------------------------------------
echo ""
if [ "$E2E_EXIT" -eq 0 ]; then
  echo "✅  All checks passed."
else
  echo "❌  e2e tests failed — see output above."
  exit "$E2E_EXIT"
fi
