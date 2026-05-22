#!/usr/bin/env bash
# End-to-end anvil exercise: start anvil, deploy fresh, drive the full scenario.
# Aborts on any failure. Designed to be run from contracts/.

set -euo pipefail

cd "$(dirname "$0")/.."

ANVIL_LOG="/tmp/mochi-e2e-anvil.log"
RPC="http://127.0.0.1:8545"

# Anvil default keys (deterministic). Source these from a local .env or your shell;
# they are NOT committed because secret scanners flag the literal values.
: "${PRIVATE_KEY:?set PRIVATE_KEY to anvil account 0 key}"
: "${ALICE_PK:?set ALICE_PK to anvil account 1 key}"
: "${BOB_PK:?set BOB_PK to anvil account 2 key}"

# Forge auto-loads .env; we have to override (not unset) chain-specific values so the
# deploy script does not point at e.g. Sepolia's PoolManager. address(0) → deploy fresh.
export POOL_MANAGER=0x0000000000000000000000000000000000000000
unset DEV_TREASURY
# Cap initial pool seed so the deployer's 25M MOCHI is enough. At curve-start price
# (1 ETH = 100M MOCHI), 0.1 ETH needs 10M MOCHI matched.
export SEED_ETH=100000000000000000

echo "[e2e] killing any existing anvil on 8545"
pkill -f "anvil.*8545" 2>/dev/null || true
sleep 0.5

echo "[e2e] starting fresh anvil (log: $ANVIL_LOG)"
anvil --silent --port 8545 > "$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!
trap "echo '[e2e] killing anvil pid $ANVIL_PID'; kill $ANVIL_PID 2>/dev/null || true" EXIT

# wait for anvil to be ready
for i in {1..30}; do
  if cast block-number --rpc-url "$RPC" >/dev/null 2>&1; then break; fi
  sleep 0.2
done
echo "[e2e] anvil is up at $RPC"

echo "[e2e] running DeployMochi"
forge script script/DeployMochi.s.sol:DeployMochi \
  --rpc-url "$RPC" \
  --broadcast \
  --skip-simulation \
  > /tmp/mochi-e2e-deploy.log 2>&1 || { tail -50 /tmp/mochi-e2e-deploy.log; exit 1; }

echo "[e2e] deployment written:"
cat deployments/31337.json

export DEPLOYMENT_PATH=./deployments/31337.json

echo
echo "[e2e] running E2EAnvil scenario"
forge script script/E2EAnvil.s.sol:E2EAnvil \
  --rpc-url "$RPC" \
  --broadcast \
  --skip-simulation \
  --ffi \
  -vvv

echo
echo "[e2e] ALL GREEN"
