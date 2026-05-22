#!/usr/bin/env bash
# Fork test against Base mainnet v4 PoolManager. Uses public RPC by default;
# override with BASE_RPC_URL env for higher rate limits.

set -euo pipefail
cd "$(dirname "$0")/.."

RPC="${BASE_RPC_URL:-https://mainnet.base.org}"

echo "[fork] running fork test against: $RPC"
forge test \
  --match-path test/MochiHook.fork.t.sol \
  --fork-url "$RPC" \
  -vv
