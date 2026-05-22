# Mochi Garden 🍡

A kawaii on-chain garden powered by a **Uniswap v4 hook**. Buy MOCHI through the pool → mochi-chan drips SEEDs into your garden → cast SEEDs into gardeners → gardeners produce more SEEDs over time → compound forever, or harvest SEEDs into MOCHI from the hook's treasury.

It's a modern fork of the classic [`sp0oby/ponzi`](https://github.com/sp0oby/ponzi) "eggs/miners" game, rebuilt from scratch so the entire game loop *is* a Uniswap v4 pool. Every swap touches the game; every game action talks to the pool.

> **v1 status:** Live on Base Sepolia ([MochiHook](https://sepolia.basescan.org/address/0xef386C13D7B8E3Cc03B598159005Cc1AA83DA5c8) · [MochiToken](https://sepolia.basescan.org/address/0x4051BC1fCC067BdD5F4eb11fAf3E8C8A1DaefEcf)). 51 passing Foundry tests, Slither-audited, single-page frontend with mint/cast/harvest/pool/liquidity/referrals + auto-deepen flywheel.
> Mainnet deploy: after public QA.

---

## The pitch

The original Ponzi game was a closed-economy contract: pay ETH for "eggs," hatch eggs into "miners," sell eggs back for ETH. The contract held the ETH; bigger contract balance = bigger sell payout. Pure compounding curve, no real DEX.

Mochi Garden keeps that exact compounding loop but lifts the value side onto a real Uniswap v4 pool. Every ETH⇄MOCHI swap goes through the same pool everyone else uses — price is fully market-driven. The *game* sits on the hook and tags along: buying MOCHI passively drips SEEDs into your garden, casting compounds, harvesting pays out from a MOCHI treasury via the original game's bonding-curve math.

Result: you can play the game as a game (cast → compound → sell), or treat it as a normal Uniswap pool (just swap), or both. Active LPs get a fee rebate on their own swaps.

---

## Theme & mascot

**Mochi-chan**: a round mochi with one too-big leaf and a straw sun hat. She tends the garden while you're gone. Her leaf shifts hue with the game's compounding rate (vibrant green = SEEDs piling up fast, pale = stale). Three styles per the kawaiicore mascot rule — sprite (in-game), sticker (marketing), doodle (about page).

Visual grammar is pure kawaiicore: cream `#fff8e7` base, ink `#3a2c3a` (never pure black), Yusei Magic display + Klee One body + Pixelify Sans labels, nested-border frames, sticker tape at prime-degree rotations. See `/Users/brandonmccall/Desktop/here/kawaiicore-design/SKILL.md` for the full ruleset.

---

## Mechanics (the long version)

### Tokens & state

| What         | Where                                  | Notes                                                   |
|--------------|----------------------------------------|---------------------------------------------------------|
| `$MOCHI`     | ERC20 contract (`MochiToken.sol`)      | Paired with ETH in the v4 pool. Tradable, transferable. Fixed supply 1B. |
| `$SEED`      | `mapping(address => uint256)` in hook  | Per-user game counter. Not a token. Not transferable.   |
| `gardeners`  | `mapping(address => uint256)` in hook  | Per-user count. Each produces 1 SEED/sec, capped 1 day. |
| `marketSeeds`| `uint256` in hook                      | Drives the harvest bonding-curve math (and the dyn. fee). |
| treasury     | `uint256` in hook (MOCHI balance)      | Funds harvest payouts. Funded at deploy with **200M** MOCHI (20%). |
| garden curve | `uint256 gardenSupplyMinted` in hook   | Rising-price bonding curve for primary MOCHI issuance. 700M inventory at deploy, drains as players `mintFromGarden()`. |
| lpReserve    | `uint256 lpReserve` in hook            | MOCHI committed to LP via `fundLpReserve`. Used by auto-deepen + manual `deepenPool`. 75M pre-funded at deploy. |

### The loop

```
            ┌──────────────────────────┐
            │  swap ETH → MOCHI        │ ← anyone using the pool
            │  (any v4 router)         │
            └────────────┬─────────────┘
                         │ afterSwap drips SEEDs to buyer (tx.origin)
                         ▼
        ┌──────────────────────────────────┐
        │  your garden: SEEDs accumulating │
        │  + gardeners producing/sec       │
        └────────────┬─────────────────────┘
                     │
       cast(referrer)│                 sell()
                     │                  ┌───────────────────────────┐
                     ▼                  ▼                           │
        ┌─────────────────────┐     ┌────────────────────────────┐  │
        │ +gardeners          │     │ MOCHI ←── hook treasury    │  │
        │ SEEDs → 0           │     │ via PSN/PSNH curve         │  │
        │ marketSeeds += 1/5  │     │ marketSeeds += seeds       │  │
        │ referrer +12% one   │     │ 1% protocol fee taken           │  │
        │   -time bonus       │     └────────────────────────────┘  │
        └─────────────────────┘                                     │
                                  swap MOCHI → ETH ─────────────────┘
                                  (you decide when, via the pool)
```

### Constants (in `MochiHook.sol`)

| Constant                  | Value      | What it controls                                        |
|---------------------------|------------|---------------------------------------------------------|
| `SEEDS_PER_GARDENER`      | `86_400`   | SEEDs needed to mint 1 gardener (1 SEED/sec × 1 day)    |
| `MAX_PRODUCTION_WINDOW`   | `86_400`   | Production capped at 1 day per cycle — must cast or stale |
| `SEED_DRIP_PER_MOCHI`     | `1`        | SEED awarded per whole MOCHI bought / minted. 1 MOCHI = 1 SEED. Fractional MOCHI rounds down to 0 SEEDs. |
| `REFERRAL_BPS`            | `12`       | Referrer's one-time bonus: 12% of referee's first cast  |
| `DEV_FEE_BPS`             | `1`        | 1% of every harvest payout routes to `devTreasury`      |
| `DEV_ENTRY_FEE_BPS`       | `100`      | 1% of the ETH input on pool ETH→MOCHI buys → `devTreasury` |
| `DEV_MINT_FEE_BPS`        | `100`      | **NEW:** 1% of the ETH input on garden mints → `devTreasury` |
| `MAX_HARVEST_BPS`         | `10`       | Max 0.1% of treasury per single `sell()` call. ~1000 harvests to drain even at max frequency. Treasury runway: years. |
| `MAX_REFILL_ETH`          | `5 ether`  | Per-call cap on `refillTreasury()`                      |
| `MAX_DEEPEN_ETH`          | `5 ether`  | Per-call cap on `deepenPool()`                          |
| `AUTO_DEEPEN_TRIGGER`     | `5 ether`  | Cumulative mint inflow per auto-deepen trigger          |
| `AUTO_DEEPEN_AMOUNT`      | `0.1 ether`| ETH committed to LP per auto-deepen. Small per-trigger commitment lets the 75M lpReserve sustain many deepens across the curve lifecycle. |
| `BASE_PRICE`              | `1e10` wei | **NEW:** Starting curve price (~1e-8 ETH/MOCHI; cheap entry) |
| `SLOPE`                   | `1_000`    | **NEW:** Curve slope. Final price after full drain ≈ 71× base. ~245 ETH raised total. |
| `GARDEN_INITIAL_INVENTORY`| `700M ether`| **NEW:** MOCHI in the garden curve at deploy            |
| `BASE_FEE` / `PEAK_FEE`   | `5_000` / `10_000` | Dynamic swap fee floor (0.5%) and ceiling (1%)  |
| `LP_REBATE_BPS`           | `5_000`    | Active LPs get 50% off the dynamic fee on their swaps    |
| `PSN` / `PSNH`            | `10_000` / `5_000` | Harvest bonding-curve constants (ported from sp0oby/ponzi) |

### Economics: where every fee goes

There are three distinct fee surfaces. Be careful not to conflate them.

| Action                          | What happens                                                                 | Fee                                          | Goes to              |
|---------------------------------|------------------------------------------------------------------------------|----------------------------------------------|----------------------|
| **Swap ETH → MOCHI** (pool buy) | User pays X ETH. **1% (`DEV_ENTRY_FEE_BPS`) is skimmed via `beforeSwap`-return-delta + `poolManager.take()` before the swap.** Swap proceeds with 0.99·X ETH. LP fee (dynamic 0.5–1%) applied on top. | 1% of ETH input + 0.5–1% LP fee on the rest  | dev gets 1% ETH ; LPs get the dynamic fee on 0.99·X |
| **Swap MOCHI → ETH** (pool sell) | Normal v4 swap, just the dynamic fee. No protocol cut here.                       | 0.5–1% LP fee only                           | LPs                  |
| **`hook.sell()`** (game cashout) | Player consumes SEED yield, hook transfers MOCHI from treasury via the PSN/PSNH curve. **NOT a pool swap** — no LP fee, no pool slippage. | 1% (`DEV_FEE_BPS`) of MOCHI payout            | dev gets 1% MOCHI ; player gets 99% |
| **Referral on first `cast()`**  | One-time bonus to referrer in SEEDs (not a fee on anyone)                    | 12% (`REFERRAL_BPS`) of cast SEEDs            | referrer (in SEEDs)  |

**The dev's revenue streams in v1:**
- ETH from every pool buy (entry fee)
- MOCHI from every game harvest (sell() cashouts)

**The LP's revenue stream:**
- 0.5–1% dynamic fee on every swap, both directions

So entering the game (buying MOCHI) pays *both* dev *and* LPs. Exiting via the pool pays *only LPs*. Exiting via the game `sell()` pays *only dev* (treasury-funded, no pool involvement). LPs eat regardless of direction.

The dev-entry fee on buys exists specifically so the deployer can accumulate ETH to bootstrap initial liquidity. It mirrors the original eggs/beans model where the dev took a slice of every ETH-in action.

### The bonding curve

The original Ponzi used this for both buys and sells:

```
calculateTrade(rt, rs, bs) = (PSN × bs) / (PSNH + ((PSN × rs + PSNH × rt) / rt))
```

In Mochi Garden, `calculateSeedSell(seeds)` calls it as `calculateTrade(seeds, marketSeeds, mochiTreasury)`. Bigger treasury → better MOCHI payout per SEED. Bigger marketSeeds → smaller payout (everyone's farming, scarcity drops). It's the same dynamic that drove the original loop, just denominated in MOCHI instead of ETH.

### Dynamic fee

The hook overrides the pool's swap fee on every swap via `beforeSwap`:

```
fee = BASE_FEE + (marketSeeds − bootstrap) × (PEAK_FEE − BASE_FEE) / (bootstrap × 10)
    ≤ PEAK_FEE
```

So the more compounding/selling activity in the game, the more the pool charges. Quiet → 0.5%. Hot → 1%. The pool stays liquid under load because casual swappers see a slightly steeper fee while the game's churning.

### LP rebate

When someone adds liquidity through the pool, the hook's `afterAddLiquidity` records `tx.origin` as an active LP. When that same EOA swaps, `beforeSwap` shaves `LP_REBATE_BPS` (5000 bps = 50%) off the dynamic fee. Removing all liquidity untracks them.

**v1 limitation:** the hook reads `tx.origin` because the swap routers wrap the user — the `sender` we receive in callbacks is the router contract, not the EOA. Fine for EOA users; doesn't work for account-abstraction / smart-contract callers. Documented & intentional for v1.

### Referrals

`cast(address referrer)` pays the referrer 12% of the consumed SEEDs as a one-time SEED bonus on the first cast. Self-referral and `address(0)` are ignored. No ongoing cut; it's the simplest version of the original mechanic.

### What hook permissions are enabled

The contract address has these permission bits encoded in its lower 14 bits (mined via `HookMiner` at deploy):

- `beforeInitialize` — validate the pool is ETH/MOCHI with dynamic-fee flag, lock the `poolId`
- `beforeSwap` — return the current dynamic fee (with LP rebate applied)
- `afterSwap` — drip SEEDs to `tx.origin` on ETH→MOCHI swaps
- `afterAddLiquidity` — register `tx.origin` as active LP
- `afterRemoveLiquidity` — unregister on full or partial remove

No `beforeDonate`, no return-delta hooks (yet — limit orders need them).

---

## Architecture

```
ponzi/
├─ contracts/                Foundry workspace
│   ├─ src/
│   │   ├─ MochiToken.sol    ERC20 + Permit, owner-set minter
│   │   └─ MochiHook.sol     BaseHook — game state + dynamic fee + drip
│   ├─ test/
│   │   └─ MochiHook.t.sol   16 tests: unit, fuzz, swap-drip, cast/sell
│   ├─ script/
│   │   └─ DeployMochi.s.sol Mine hook salt, deploy via CREATE2, seed liquidity
│   ├─ deployments/<chainId>.json   Written by deploy script
│   └─ foundry.toml          solc 0.8.26, cancun, evm, OZ v5 + v4-core
│
├─ web/                      Vite + React + TypeScript
│   ├─ src/
│   │   ├─ config/           wagmi + chains + deployment registry
│   │   ├─ abi/              forge inspect <C> abi --json
│   │   ├─ hooks/            useMochi, usePoolStats, useUserGameState, useActions
│   │   ├─ components/       Frame, Tape, Sticker, Stat, Marquee, MochiChan
│   │   ├─ sections/         Hero, Garden, Pool, Stats, Footer
│   │   └─ App.tsx           single page (no routes)
│   └─ tailwind.config.js    kawaiicore palette + animations
│
└─ README.md
```

### Where the ETH in the v4 pool comes from

The hook does **not** mint or hold ETH for liquidity. Every wei in the pool was contributed by a liquidity provider.

| Environment    | Seed ETH source                                                                                  |
|----------------|--------------------------------------------------------------------------------------------------|
| Anvil          | Deployer (Anvil account 0, pre-funded with 10000 ETH). Script seeds 1000 ETH + matching MOCHI.   |
| Base Sepolia   | Deployer's faucet ETH. We'll seed a small amount (e.g. 0.05 ETH + matching MOCHI) — enough to test swaps. |
| Base mainnet   | Whoever bootstraps the pool puts in their own ETH and becomes the initial LP — they earn the LP fee + the LP rebate + bear IL. |

The `DEV_ENTRY_FEE_BPS` (1% of every ETH buy) is specifically designed so the deployer can **accumulate ETH from gameplay to top up their LP position** over time. Bootstrap with a small seed, let the dev-entry fee compound, deepen liquidity gradually.

### Why a fresh PoolManager on Anvil

On real chains the v4 PoolManager is already deployed (Base mainnet: `0x498581ff…b2b`). On Anvil there is no v4 deployment, so the deploy script spins up its own PoolManager + test routers (PoolSwapTest, PoolModifyLiquidityTest) + seeds 1000 ETH of liquidity in a `±600` tick range. When we deploy to Base Sepolia we'll point at the existing PoolManager and add liquidity through PositionManager + Permit2 instead of the test router.

### Why state lives in the hook (not a separate contract)

The hot path — swap → afterSwap → drip SEED — touches one storage write. If the game state lived in a sibling contract, every swap would pay a cross-contract `CALL` + extra `SLOAD`s. The trade-off is that the hook bytecode is bigger and the address has to be salt-mined. Cold-path features (achievements, leaderboard cache, limit orders) will live in a sibling contract once they exist.

---

## Run it locally

You need: [Foundry](https://book.getfoundry.sh/getting-started/installation), Node 22+, and `yarn`.

### 1. Anvil

```bash
anvil --block-time 1
```

### 2. Deploy + seed liquidity

```bash
cd contracts
# Use any anvil default key (anvil prints them on startup)
PRIVATE_KEY=<anvil-account-0-key> \
  forge script script/DeployMochi.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

The script writes `deployments/31337.json`, which the frontend imports.

### 3. Frontend

```bash
cd web
yarn install        # first time only
yarn dev
```

Open <http://localhost:5173>.

### 4. Connect MetaMask to Anvil

- Network: custom RPC `http://127.0.0.1:8545`, chain ID `31337`, currency `ETH`
- Import an Anvil test account (anvil prints addresses + private keys on startup).
  - e.g. account 1 address `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
  - Gives you 10000 ETH

### 5. Play

- **Pool**: swap 0.5 ETH → MOCHI. Watch SEED count tick up.
- **Garden**: hit `cast` — gardeners mint, SEEDs zero, lastActionTime resets.
- Wait a bit. Refresh. Gardeners are producing SEEDs/sec.
- `harvest yield` — MOCHI hits your wallet from the treasury (minus 1% protocol fee).
- Swap MOCHI → ETH on the Pool card to cash out (no drip on this direction).

---

## Security review (v2)

Manual review + Slither pass + 48-test suite. One HIGH finding (reentrancy-eth in `mintFromGarden`'s refund path) was resolved by reordering CEI; remaining MEDIUM findings are intentional (div-before-multiply in unit-conversion, `== 0` zero-guards, deliberate `unused-return` on `settle`/`take`/`unlock`).

| Concern                              | Mitigation                                                       |
|--------------------------------------|------------------------------------------------------------------|
| Reentrancy on `mintFromGarden`       | `nonReentrant` + CEI: state changes before any external calls. Refund happens AFTER state writes. |
| Reentrancy on `refillTreasury` / `deepenPool` | `nonReentrant` + unlock-callback pattern (single entry point) |
| Sender-spoofing on internal-swap guard | Guard checks `sender == address(this)` — only the hook itself can satisfy this when calling `poolManager.swap` from its own unlock-callback |
| Integer overflow                     | Solidity 0.8.26 native checks. Curve math stays well under 2²⁵⁶ for any plausible inputs. |
| Refund-path DoS                      | `mintFromGarden` refund uses `.call{value:}` — if caller is a contract that reverts on receive, the whole tx reverts. Bad-receiver contracts can't extract refunds, but they also can't prevent others' mints. |
| Treasury inflation attack            | `MAX_HARVEST_BPS = 10` (0.1%) cap per harvest. Drain attacks are bounded; treasury runway is years. |
| Frontrun of `mintFromGarden`         | Rising curve — frontrunner pays more for the same amount. They can't sell back to the curve. Pool sell is normal MEV. |
| Sybil-farmed referrals               | `referrerOf[user]` lock-in on first valid cast. Referrer must have `gardeners > 0` (anti-sybil — each alt needs real ETH commit). |
| Garden inventory overflow            | `gardenSupplyMinted ≤ GARDEN_INITIAL_INVENTORY` enforced. Last-mile mints get partial fill + ETH refund. |
| Hook ETH custody                     | `withdrawDevEth` is `onlyOwner`. Only the deployer can pull ETH out. `deepenPool` is owner-only too; `refillTreasury` takes caller-supplied ETH. |
| Access control                       | `onlyOwner` on: `fundTreasury`, `setDevTreasury`, `withdrawDevEth`, `deepenPool`. Everything else permissionless. |

**Tested invariants (fuzz with 1000 runs):**
- `mintFromGarden` never returns 0 for valid inputs
- inventory drops by exactly the mint amount
- price is monotonically non-decreasing after a mint
- supply tracker stays ≤ initial inventory

**Known limitations:**
- Hook callbacks resolve the user from `hookData` first (32-byte address) and fall back to `tx.origin` if empty. The fallback works for EOAs through any router. **AA wallets / smart-contract callers must use a router that passes their address in `hookData`** (our frontend does this automatically; external aggregators like Universal Router will fall back to `tx.origin` which gives the sponsor address for AA, not the user — those users won't be credited for SEED drips / LP rebate).
- No emergency pause. By design — promotes "fair game" trust. If a critical issue emerges, redeployment is the only fix.

## Live deployment (Base Sepolia)

| Contract | Address |
|---|---|
| **MochiHook** | [`0xDAdD86A83ee89B549E45E082B39C6045753DA5C8`](https://sepolia.basescan.org/address/0xDAdD86A83ee89B549E45E082B39C6045753DA5C8) ✓ verified |
| **MochiToken** | [`0x41FB2095BE399e5E2e426BC1Edc9AEa57AAa97EC`](https://sepolia.basescan.org/address/0x41FB2095BE399e5E2e426BC1Edc9AEa57AAa97EC) ✓ verified |
| Liquidity router | `0xa279F67030347149E9e8781042b0eDf998D34262` |
| Swap router | `0xA2B1d2aB6fC59952b8A351ea18A54eA9226e5447` |
| v4 PoolManager (existing) | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` |

---

## Supply allocation (1B fixed, set at deploy)

| Bucket | Amount | Purpose |
|---|---|---|
| **Treasury** | 200M (20%) | Funds `sell()` harvest payouts. Drains as players cash out, can be refilled via `refillTreasury` or `fundTreasury`. |
| **Garden inventory** | 700M (70%) | Sold via the rising bonding curve in `mintFromGarden`. Drains as players mint. Once exhausted, the curve closes. |
| **lpReserve** | 75M (7.5%) | Pre-funded at deploy. Used by auto-deepen + manual `deepenPool` to commit MOCHI into the v4 pool. Anyone can top up with `fundLpReserve`. |
| **Deployer** | 25M (2.5%) | Sent to the deployer wallet at deploy. For team grants, airdrops, future ops. No protocol obligations attached. |

---

## Money flow — what every action does to ETH and MOCHI

| Action | ETH movement | MOCHI movement |
|---|---|---|
| **Garden mint** `hook.mintFromGarden{value: X}()` | 1% of X → `devTreasury` wallet immediately. 99% stays in the hook contract. Tracked in `cumulativeMintInflow`. | MOCHI flows from hook's garden inventory → buyer's wallet. `gardenSupplyMinted` increments. SEEDs drip (1 per MOCHI). |
| **Auto-deepen** (triggered inside `mintFromGarden` every 5 ETH of cumulative inflow) | 0.1 ETH from hook's ETH balance → v4 pool as LP. | Matching MOCHI from `lpReserve` (price-bounded) → pool. Hook owns the LP position. Triggers silently skip if lpReserve is empty. |
| **Cast** `hook.cast(referrer)` | none | none — pure game state. SEEDs → gardeners. `marketSeeds += seedsUsed`. Referrer gets 12% bonus on first cast. |
| **Harvest** `hook.sell()` | none | MOCHI flows from treasury → user (99%) + dev (1%). Capped at 0.1% of treasury per call. |
| **Pool swap ETH → MOCHI** | 1% of X → dev wallet. 99% into the pool. | MOCHI flows from pool → buyer. SEEDs drip (1 per MOCHI). |
| **Pool swap MOCHI → ETH** | ETH from pool → seller. Dev gets nothing here. | MOCHI from seller → pool. |
| **Anyone: `deepenPool(X)`** (permissionless) | X from hook ETH → pool as LP. Capped at 5 ETH per call. | Matching MOCHI from `lpReserve` → pool. Hook owns the LP. |
| **Anyone: `fundLpReserve(X)`** (permissionless) | none | X MOCHI from caller → `lpReserve`. One-way deposit; only exits via deepenPool LP'ing. |
| **Anyone: `refillTreasury{value: X}()`** | X from caller's wallet → hook swaps it for MOCHI on the pool. | Resulting MOCHI → treasury. |
| **Owner: `withdrawDevEth(X, recipient)`** | X from hook ETH → recipient. | none |
| **Owner: `fundTreasury(X)`** | none | X MOCHI from caller → treasury. |

**The flywheel in one paragraph:** users pay ETH to mint MOCHI from the curve. 1% of that ETH goes immediately to the dev. The other 99% accumulates in the hook contract. Every 5 ETH of accumulated mint inflow triggers an automatic `deepenPool(1 ETH)` — that 1 ETH plus matching MOCHI from `lpReserve` get LP'd into the v4 pool, where the hook owns the position. As mints proceed, the pool naturally gets deeper without anyone clicking anything. When the dev (or anyone) wants to manually deepen more, they call `deepenPool` directly. When the dev wants to take out the remaining ETH for ops, they call `withdrawDevEth`. No bottleneck on the dev for the flywheel.

---

## Admin operations (deployer runbook)

All commands below run from `contracts/`, assume `.env` is sourced (so `$PRIVATE_KEY` and `$BASE_SEPOLIA_RPC_URL` resolve).

```bash
cd contracts
set -a; source .env; set +a

# Quick reference vars
HOOK=0xDAdD86A83ee89B549E45E082B39C6045753DA5C8
MOCHI=0x41FB2095BE399e5E2e426BC1Edc9AEa57AAa97EC
DEV=0x6d606cc634F20f5534fba072757F2c2C7B835Bb9
```

### Check what the hook holds

```bash
echo "Hook ETH:            $(cast balance $HOOK --rpc-url $BASE_SEPOLIA_RPC_URL) wei"
echo "Treasury MOCHI:      $(cast call $HOOK 'mochiTreasury()(uint256)' --rpc-url $BASE_SEPOLIA_RPC_URL)"
echo "Garden inv left:     $(cast call $HOOK 'gardenInventoryRemaining()(uint256)' --rpc-url $BASE_SEPOLIA_RPC_URL)"
echo "lpReserve MOCHI:     $(cast call $HOOK 'lpReserve()(uint256)' --rpc-url $BASE_SEPOLIA_RPC_URL)"
echo "Cumulative inflow:   $(cast call $HOOK 'cumulativeMintInflow()(uint256)' --rpc-url $BASE_SEPOLIA_RPC_URL)"
echo "Last auto-deepen at: $(cast call $HOOK 'lastAutoDeepenAt()(uint256)' --rpc-url $BASE_SEPOLIA_RPC_URL)"
echo "Total dev ETH (pool):$(cast call $HOOK 'totalDevEthAccrued()(uint256)' --rpc-url $BASE_SEPOLIA_RPC_URL)"
```

### Pull accumulated hook ETH to your wallet

Owner-only. Use whenever you want the mint-fee ETH for ops, team, etc.

```bash
# Withdraw 0.005 ETH (5e15 wei) to deployer
cast send $HOOK "withdrawDevEth(uint256,address)" 5000000000000000 $DEV \
  --private-key $PRIVATE_KEY --rpc-url $BASE_SEPOLIA_RPC_URL
```

### Deepen the v4 pool from hook reserves (permissionless)

Hook ETH + MOCHI from `lpReserve` → LP'd into the pool. Hook owns the position. **Anyone can call this** — the auto-deepen inside `mintFromGarden` does it automatically every 5 ETH of inflow, but a manual call is fine too.

```bash
# Deepen with 0.001 ETH (1e15 wei)
cast send $HOOK "deepenPool(uint256)" 1000000000000000 \
  --private-key $PRIVATE_KEY --rpc-url $BASE_SEPOLIA_RPC_URL
```

Caps: max 5 ETH per call, must have hook ETH + lpReserve > 0. **`deepenPool` keeps working even after the curve is fully minted**, since it draws MOCHI from `lpReserve` (not garden inventory). The auto-deepen also keeps firing whenever new mint inflow accumulates.

### Top up the LP reserve (permissionless)

If `lpReserve` runs low, anyone can add MOCHI to it. Use this if you have spare MOCHI and want to keep the auto-deepen flywheel running.

```bash
# Approve hook to pull 1M MOCHI
cast send $MOCHI "approve(address,uint256)" $HOOK 1000000000000000000000000 \
  --private-key $PRIVATE_KEY --rpc-url $BASE_SEPOLIA_RPC_URL

# Fund the reserve
cast send $HOOK "fundLpReserve(uint256)" 1000000000000000000000000 \
  --private-key $PRIVATE_KEY --rpc-url $BASE_SEPOLIA_RPC_URL
```

One-way deposit. MOCHI in `lpReserve` can only leave by becoming pool LP.

### Refill the harvest treasury (anyone can call)

Pays ETH from the caller's wallet, hook swaps it for MOCHI on the pool, deposits the MOCHI into the treasury.

```bash
# Refill with 0.001 ETH
cast send $HOOK "refillTreasury()" --value 1000000000000000 \
  --private-key $PRIVATE_KEY --rpc-url $BASE_SEPOLIA_RPC_URL
```

Cap: max 5 ETH per call.

### Fund the treasury with your own MOCHI directly

```bash
# Approve hook to pull MOCHI
cast send $MOCHI "approve(address,uint256)" $HOOK 1000000000000000000000 \
  --private-key $PRIVATE_KEY --rpc-url $BASE_SEPOLIA_RPC_URL

# fundTreasury (owner-only)
cast send $HOOK "fundTreasury(uint256)" 1000000000000000000000 \
  --private-key $PRIVATE_KEY --rpc-url $BASE_SEPOLIA_RPC_URL
```

### LP via the frontend (your wallet's ETH + MOCHI)

Easier than the cast commands. Connect deployer wallet at <http://localhost:5173>, open the Liquidity panel, enter amounts. Position is tracked in localStorage so you can remove it later via the same panel.

### Change the dev wallet for future fees

```bash
cast send $HOOK "setDevTreasury(address)" 0xNEW_DEV \
  --private-key $PRIVATE_KEY --rpc-url $BASE_SEPOLIA_RPC_URL
```

Owner-only. Past accrued ETH stays in your old wallet — only future mint fees route to the new address.

### When the curve is fully minted (~700M MOCHI sold)

At full drain you'll have:
- ETH accumulated in the hook = the 99% slice across ~245 ETH total raised, MINUS however much the auto-deepen committed to LP. If lpReserve was fully consumed over the lifecycle, this is ~243 ETH. Otherwise more (auto-deepens silently skip when lpReserve hits zero).
- ~2.45 ETH in your dev wallet (the 1% direct slice on every mint)
- Zero garden inventory → `mintFromGarden` reverts from this point
- `deepenPool` still works (uses `lpReserve`, not garden inventory) — assuming lpReserve has MOCHI

Wind-down steps:
1. `withdrawDevEth(<hook ETH>, $DEV)` to take whatever ETH is left in the hook
2. (Optional) Use the Liquidity panel to LP that ETH paired with MOCHI from your 25M deployer allocation
3. (Optional) `fundTreasury` with MOCHI to extend the harvest game's runway
4. The pool keeps trading and harvests keep working as long as the treasury has MOCHI

---

## Tests

```bash
cd contracts
forge test -vv
```

51 passing tests (50 deterministic + 1 fuzz with 1000 runs):

- **Math**: `calculateTrade` known-vector, `rt=0` guard, fuzz `out ≤ bs` (1000 runs)
- **Game state**: fresh user, gardeners accumulating, production capped at 1 day
- **cast**: creates gardeners, zeros seeds, pays 12% referral, ignores self-referral, reverts when no seeds
- **sell**: pays MOCHI from treasury, deducts 1% protocol fee, reverts when no seeds
- **Swap drip**: ETH→MOCHI drips SEEDs to buyer, MOCHI→ETH does not
- **Dev entry fee**: ETH→MOCHI buys skim exactly 1% to `devTreasury`; MOCHI→ETH does not
- **Dynamic fee**: default is `BASE_FEE`, rises with `marketSeeds`

---

## What's NOT in v1

- **Limit-order selling** — scoped in but deferred. Will be a sibling contract that escrows MOCHI and fills via unlock callback when the pool tick crosses a user-set threshold.
- **Worker NFTs** — gardeners are a `uint256` counter for v1 (cheaper, simpler). NFT skins are a v1.x candidate.
- **Subgraph / indexer** — front-end reads directly from the hook; fine for v1 but a Graph deployment would back leaderboards & history.
- **Mainnet deploy** — currently live on Base Sepolia. Mainnet only after a public QA pass against ethskills' `qa/` checklist.
- **Dark-chibi register** — Mochi Garden v1 is pure cream-kawaii. The sister skill (cute-but-cruel) stays in reserve for v1.x.

---

## Resources

- Original game: <https://github.com/sp0oby/ponzi>
- Uniswap v4 core: <https://github.com/Uniswap/v4-core>
- v4-hooks-public (where `BaseHook` lives): <https://github.com/Uniswap/v4-hooks-public>
- Frontend skill bundle (local): `/Users/brandonmccall/Desktop/here/{kawaiicore-design,kawaii-motion,dark-chibi}/SKILL.md`
- Onchain skill index: <https://ethskills.com/SKILL.md>

---

## Voice notes

written w/ love, tested on anvil first, best viewed in firefox lol
(づ｡◕‿‿◕｡)づ tysm for reading
