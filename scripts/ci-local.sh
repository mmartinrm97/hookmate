#!/usr/bin/env bash
# HookMate CI Emulator - Run the full CI pipeline locally
# Cross-platform: Linux, macOS, Windows (Git Bash/WSL)
# Usage: ./scripts/ci-local.sh

set -euo pipefail

# Colors
GREEN='\033[32m'
RED='\033[31m'
YELLOW='\033[33m'
CYAN='\033[36m'
RESET='\033[0m'
BOLD='\033[1m'

FAILURES=()

write_step() {
    echo -e "\n${CYAN}${BOLD}━━━ 🔍 $1 ━━━${RESET}"
}

write_pass() {
    echo -e "${GREEN}✅ PASS: $1${RESET}"
}

write_fail() {
    echo -e "${RED}❌ FAIL: $1${RESET}"
}

run_step() {
    local name="$1"
    shift
    write_step "$name"
    if "$@"; then
        write_pass "$name"
    else
        write_fail "$name"
        FAILURES+=("$name")
    fi
}

# ============================================================
# PHASE 0: Setup Docker services
# ============================================================
write_step "Setting up Docker services 🐳"

# Stop any existing hookmate containers
docker stop hookmate-floci hookmate-postgres hookmate-redis 2>/dev/null || true
docker rm hookmate-floci hookmate-postgres hookmate-redis 2>/dev/null || true

# Start Floci
echo -e "${CYAN}Starting Floci...${RESET}"
docker run -d --name hookmate-floci -p 4566:4566 \
    -e FLOCI_DEFAULT_REGION=us-east-1 \
    -e FLOCI_STORAGE_MODE=memory \
    hectorvent/floci:latest

# Start Postgres (port 5432 to match CI)
echo -e "${CYAN}Starting Postgres on port 5432...${RESET}"
docker run -d --name hookmate-postgres -p 5432:5432 \
    -e POSTGRES_USER=hookmate \
    -e POSTGRES_PASSWORD=hookmate \
    -e POSTGRES_DB=hookmate \
    postgres:16-alpine

# Start Redis
echo -e "${CYAN}Starting Redis...${RESET}"
docker run -d --name hookmate-redis -p 6379:6379 redis:7-alpine

# Wait for services
echo -e "${CYAN}Waiting for services to be ready...${RESET}"
sleep 10

# Verify Floci
for i in $(seq 1 30); do
    if curl -sf http://localhost:4566/health >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

# Verify Postgres
for i in $(seq 1 30); do
    if docker exec hookmate-postgres pg_isready -U hookmate >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

echo -e "${GREEN}Services ready!${RESET}"

# ============================================================
# Environment variables (CI-matching)
# ============================================================
export AWS_ENDPOINT_URL="http://localhost:4566"
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="test"
export AWS_SECRET_ACCESS_KEY="test"
export POSTGRES_HOST="localhost"
export POSTGRES_PORT="5432"
export POSTGRES_USER="hookmate"
export POSTGRES_PASSWORD="hookmate"
export POSTGRES_DB="hookmate"
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
export SQS_INGESTION_QUEUE_URL="http://localhost:4566/000000000000/ingestion"

# ============================================================
# PHASE 1: Quality Checks
# ============================================================
run_step "Quality Checks" bash -c '
    pnpm lint:lockfile &&
    pnpm --filter @hookmate/shared build &&
    pnpm typecheck &&
    pnpm lint &&
    pnpm format:check
'

# ============================================================
# PHASE 2: Unit Tests
# ============================================================
run_step "Unit Tests" bash -c '
    pnpm --filter @hookmate/shared build &&
    pnpm test:unit
'

# ============================================================
# PHASE 3: Integration Tests
# ============================================================
run_step "Integration Tests Setup" bash -c '
    aws sqs create-queue --queue-name ingestion --endpoint-url http://localhost:4566 &&
    aws sqs create-queue --queue-name dlq --endpoint-url http://localhost:4566 &&
    PGPASSWORD=hookmate psql -h localhost -p 5432 -U hookmate -d hookmate \
        -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null || true
'

run_step "Integration Tests (e2e)" bash -c '
    pnpm --filter @hookmate/api test:e2e
'

# ============================================================
# PHASE 4: CDK Synthesize
# ============================================================
run_step "CDK Synthesize" bash -c '
    pnpm --filter @hookmate/shared build &&
    pnpm --filter @hookmate/api build &&
    pnpm infra:synth
'

# ============================================================
# PHASE 5: CDK Deploy + Drift Check (Floci)
# ============================================================
run_step "CDK Deploy + Drift Check (Floci)" bash -c '
    pnpm --filter @hookmate/shared build &&
    pnpm --filter @hookmate/api build &&
    pnpm --filter @hookmate/infrastructure build &&
    cd infrastructure &&
    npx cdk bootstrap aws://000000000000/us-east-1 --force &&
    npx cdk deploy --all --require-approval never &&
    npx cdk diff --all --fail
'

# ============================================================
# Cleanup
# ============================================================
write_step "Cleaning up Docker containers 🧹"
docker stop hookmate-floci hookmate-postgres hookmate-redis
docker rm hookmate-floci hookmate-postgres hookmate-redis

# ============================================================
# Summary
# ============================================================
echo -e "\n${BOLD}━━━ CI Local Summary ━━━${RESET}"
if [ ${#FAILURES[@]} -eq 0 ]; then
    echo -e "${GREEN}${BOLD}🎉 ALL CHECKS PASSED!${RESET}"
    echo -e "${GREEN}Safe to push to origin.${RESET}"
else
    echo -e "${RED}${BOLD}❌ ${#FAILURES[@]} check(s) failed:${RESET}"
    for f in "${FAILURES[@]}"; do
        echo -e "${RED}   - $f${RESET}"
    done
    echo -e "${YELLOW}Fix the failures before pushing.${RESET}"
fi
