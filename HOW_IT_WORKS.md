# Mochi Garden — How It Works (Noob Edition)

This doc explains every piece of Mochi Garden in plain language. Read top to bottom; later sections refer back to earlier ones. No prior Uniswap knowledge required.

---

## The 30-second pitch

You spend ETH. You get MOCHI (a token). You ALSO get SEEDs (a game counter). You can plant SEEDs into "gardeners" who grow more SEEDs while you sleep. Later you cash SEEDs back out for MOCHI, and MOCHI back out for ETH.

There are **two ways to buy MOCHI:**
1. **Mint from the garden curve** — pay ETH at a rising price. Cheap at first, gets pricier as more is minted. Each mint feeds the flywheel.
2. **Swap on the v4 pool** — buy from existing liquidity at market price.

It's a Tamagotchi pet that lives on Uniswap.

---

## The three places MOCHI lives

Mochi Garden has **three distinct sources of MOCHI**. Each one works differently. Don't mix them up.

### 1. The v4 Pool (Uniswap-style market AMM)

A **real, normal Uniswap v4 pool**. ETH on one side, MOCHI on the other. People swap. Anyone can provide liquidity. The pool's price floats with market activity.

### 2. The Garden Curve (rising-price mint mechanism)

The hook holds **700 million MOCHI** as a primary-issuance bonding curve. Players can call `mintFromGarden()` paying ETH at the current curve price. Each mint:
- Sends MOCHI to the buyer at the current price
- Adds SEEDs to the buyer's game state
- **Raises the price for the next minter** (linear curve)

The curve starts very cheap (~`1e-8` ETH/MOCHI) and rises ~71× as inventory drains. Total ETH raised at full drain ≈ 245 ETH.

### 3. The Treasury (harvest payout reserve)

The hook also holds **200 million MOCHI** as a separate stash for **game harvests**. When players call `sell()` to cash out their SEED yield, MOCHI comes from this treasury. **The treasury is NOT a pool** — it's just a balance the hook spends from. It refills via the `refillTreasury()` flywheel.

### The hook bridges all three

The `MochiHook` smart contract is what:
- Runs the rising curve (mints + raises price)
- Pays out harvests from the treasury
- Updates SEED/gardener counters on actions
- Hooks into the v4 pool to drip SEEDs on swaps, charge dev entry fee, etc.

So minting from the curve, harvesting yield, and trading on the pool are all separate primary mechanisms — but they all reference the same MOCHI token in your wallet.

---

## The three things you'll hear about a lot

These names trip everyone up at first. Pin them down.

| Name        | What it actually is                                          | Where it lives                       | Can you trade it?              |
|-------------|--------------------------------------------------------------|--------------------------------------|--------------------------------|
| **$MOCHI**  | A real ERC20 token. Like USDC or DAI but for this game.      | Your wallet. The pool. The hook (treasury + curve inventory). | Yes — swap on the v4 pool, mint via the curve, harvest from the treasury |
| **$SEED**   | A number. Not a token. Just an integer the hook tracks for you. | Inside the hook contract, per address | No — you can only cast or harvest |
| **gardener**| Another number. Counts how many tiny workers you own.        | Inside the hook contract, per address | No — you can only grow more     |
| **curve**   | A rising linear price formula `price = BASE + SLOPE × supplyMinted`. Each mint pushes the next mint's price up. | A `gardenSupplyMinted` counter in the hook. | n/a — it's a formula, not a holding. |
| **treasury**| A stash of MOCHI inside the hook for paying out harvest cashouts. Drains as people harvest. Refillable. | A `mochiTreasury` counter in the hook. | n/a — it's a reserve, not tradeable. |

> ❗ **SEEDs and gardeners are not tokens.** They won't show up in MetaMask. They're just integers inside the smart contract. The frontend reads them and displays them like a Tamagotchi screen.

---

## The pool — where it gets its ETH and MOCHI

This is the part you were confused about. Let me walk through it slowly.

### What's inside the pool

A Uniswap pool is a vault that holds two tokens. Our pool holds:
- ETH (on the "side 0")
- MOCHI (on the "side 1")

When you swap ETH for MOCHI, you're putting ETH INTO the pool and pulling MOCHI OUT. The pool's price floats based on the ratio of the two reserves.

### Who puts the ETH and MOCHI in?

**Liquidity providers ("LPs").** Regular people (or the deployer, or you) deposit BOTH ETH and MOCHI together into the pool. In return, they get an LP NFT — a receipt that says "I own this much of the pool."

When other people swap, LPs earn a slice of the swap fee. When LPs want their money back, they burn their NFT and get their ETH+MOCHI back (plus accrued fees, possibly minus IL).

### Where does the *initial* ETH come from on day 1?

The pool starts empty (zero ETH, zero MOCHI). It can't be used until **someone** deposits the first chunk. On Mochi Garden, that's:

| Environment   | First LP                                                                                |
|---------------|------------------------------------------------------------------------------------------|
| Anvil (local) | Anvil hands the deployer 10,000 fake ETH for free. Deploy script seeds 1,000 ETH + matching MOCHI. |
| Base Sepolia  | Deployer's faucet ETH (a tiny amount — testnet ETH is hard to come by).                  |
| Base mainnet  | Deployer (you) puts in their own real ETH + MOCHI from the deployer wallet.              |

> ⚠️ **The hook doesn't conjure ETH out of thin air.** Every wei in the pool came from a real wallet. On mainnet, *you* are the first LP. You put in real ETH.

### What about more liquidity over time?

After the initial seed, anyone can LP. They click "add liquidity" on the Uniswap UI (or call `PositionManager.mint`), supply ETH + MOCHI in the current ratio, and get an LP NFT. They join the pool. Their tokens are now part of the reserves that swaps draw from.

The more LPs, the more liquidity, the smaller the slippage when people swap. That's why the dev-entry fee (explained later) is designed to accumulate ETH for the deployer — so they can keep adding to their LP position and deepen liquidity over time.

---

## What the heck is a SEED?

Let me make this very concrete.

A SEED is a `uint256` (just a number) stored in a `mapping(address => uint256)` inside the MochiHook smart contract. The mapping is named `claimedSeeds`.

When the contract says "alice has 984,000 SEEDs," what it literally means is:

```
claimedSeeds[alice] = 984000
```

That's it. A SEED is not a token. It's not transferable. It's just an entry in a lookup table. You can think of it like a video game's currency: in Stardew Valley, your gold isn't an ERC20, it's just a number in a save file. Same thing here.

### How SEEDs get created

Three ways:

1. **Buying MOCHI through the pool.** Every time someone swaps ETH→MOCHI, the hook bumps their `claimedSeeds` by an amount proportional to the MOCHI they got. (Specifically, ~1 million SEEDs per 1 MOCHI bought.)
2. **Owning gardeners that produce them passively.** If you have 11 gardeners, you accumulate 11 SEEDs per second, capped at 1 day's worth between actions.
3. **Getting a referral bonus.** When someone you referred casts for the first time, the contract bumps your `claimedSeeds` by 12% of theirs.

### How SEEDs get destroyed

Two ways:

1. **You cast them.** SEEDs go to zero in exchange for gardeners (`seeds / 86,400` of them).
2. **You harvest them.** SEEDs go to zero in exchange for MOCHI from the treasury.

That's the whole lifecycle. SEEDs enter, SEEDs leave. They never live in a wallet.

---

## What's a gardener?

Same deal as SEEDs — it's a number in a mapping. `gardeners[alice] = 11` means alice has 11 gardeners.

A gardener does ONE thing: it produces 1 SEED per second, for up to 1 day, between your "actions" (cast or harvest). After 1 day idle, it stops accumulating (you have to come back and cast/harvest to "reset the clock").

### Why the 1-day cap?

It's the original eggs/beans mechanic — forces you to come back daily if you want max yield. Idle players lose to active players. Stardew Valley rules.

### Math example

Alice has **11 gardeners**, casts at noon Monday.
- By 6pm Monday (6 hours later, 21,600 sec): she has 11 × 21,600 = **237,600 SEEDs**
- By noon Tuesday (24 hours): she has 11 × 86,400 = **950,400 SEEDs** (max, capped)
- By noon Wednesday (48 hours, no action): still **950,400 SEEDs** (gardeners stopped at 1 day)

If she casts at noon Tuesday: 950,400 / 86,400 = **11 more gardeners** → 22 total.

That's the compounding loop. Cast every day. Numbers go up.

---

## The treasury — what it is, why it exists

The hook contract has a balance of MOCHI tokens just sitting in it. That's the **treasury**. At deploy time, we mint 1B MOCHI total and put 300M of it in the treasury.

The treasury's job: when a player harvests (cashes SEEDs into MOCHI), the hook takes MOCHI **out of the treasury** and gives it to the player. The pool is not involved. No swap happens.

### Why a treasury and not the pool?

If harvest used the pool, every harvest would:
1. Increase MOCHI supply in circulation (someone gets MOCHI)
2. Push down MOCHI price (sell pressure on the pool)
3. Pay slippage to LPs

Using a treasury instead:
1. MOCHI was *already* minted at deploy — no new supply on harvest
2. Pool price untouched (no swap)
3. Pay 1% protocol fee to dev wallet, no LP slippage

The treasury is finite. As people harvest, it shrinks. When it runs out, harvests fail until it's refunded. In v1 we haven't built auto-refunding — the owner could top it up manually if needed.

---

## The hook — what it actually does

The hook is a smart contract that Uniswap v4 **calls automatically** at specific moments. You don't call the hook directly when you swap; you call a regular Uniswap router, and the router calls the pool, and the pool calls our hook in the middle of doing its work.

Here's what gets called automatically by v4 when:

| When Uniswap is doing this... | Our hook does this:                                                  |
|-------------------------------|----------------------------------------------------------------------|
| About to do a swap            | Set the dynamic fee. **If ETH→MOCHI:** skim 1% ETH for the dev.       |
| Just finished a swap          | **If ETH→MOCHI:** add SEEDs to the buyer's garden.                    |
| Just took a new LP position   | Tag the LP as active (so they get fee rebate later).                  |
| Just removed LP position      | Untag.                                                                |

The hook also has its own functions you call directly (not through Uniswap):

| Function                  | Who can call    | What it does                                                  |
|---------------------------|-----------------|---------------------------------------------------------------|
| `mintFromGarden()` payable| Anyone          | Pay ETH at the rising curve price, get MOCHI + SEEDs drip.    |
| `cast(referrer)`          | Anyone          | Consume SEEDs to mint gardeners. 12% bonus to referrer.       |
| `sell()`                  | Anyone          | Convert SEED yield → MOCHI from treasury (1% harvest cap).    |
| `refillTreasury()` payable| Anyone, capped  | Pay ETH, hook swaps it for MOCHI, adds to treasury.           |
| `deepenPool(amount)`      | Anyone          | Use hook's accumulated ETH + MOCHI from `lpReserve` to LP the v4 pool. |
| `fundLpReserve(amount)`   | Anyone          | One-way deposit of MOCHI into the LP reserve. The reserve fuels auto-deepen + manual deepenPool. |
| (auto-deepen)             | Internal — fires inside `mintFromGarden` | Every 5 ETH of cumulative mint inflow, the next mint silently triggers a 0.1 ETH `deepenPool`. Skips quietly if lpReserve is empty. |
| `withdrawDevEth(amt, to)` | Owner only      | Withdraw hook's accumulated ETH to a recipient.               |
| `setDevTreasury(addr)`    | Owner only      | Change where future mint/swap fees land.                      |
| `fundTreasury(amount)`    | Owner only      | Deposit MOCHI directly into the harvest treasury.             |

`mintFromGarden` is the headline mechanic — it's how MOCHI primarily gets distributed and how the protocol funds itself.

---

## The rising-curve mint — the headline new mechanic

### What it is

The hook starts with **700 million MOCHI** in a virtual "garden curve" inventory. Players can mint MOCHI from this inventory by paying ETH. The price follows a linear formula:

```
price(s) = BASE_PRICE + SLOPE × supplyMintedSoFar
```

With our constants:
- `BASE_PRICE` = `1e10` wei per MOCHI = `0.00000001` ETH/MOCHI
- `SLOPE` = `1000` wei per (MOCHI minted)
- After 700M MOCHI minted, price = `1e10 + 1000 × 7e8 = 7.1e11` wei/MOCHI ≈ `0.0000007` ETH/MOCHI
- That's a **~71× rise** over the full curve

### How a mint works (step by step)

You call `mintFromGarden{value: 0.1 ether}()` from your wallet:

1. The hook computes how many MOCHI tokens 0.1 ETH buys at the current curve state. This involves solving a quadratic (the integral of the linear price function).
2. The hook checks: do we have enough inventory left? If not, it gives you a partial fill and refunds the unused ETH.
3. The hook **deducts that MOCHI from `gardenSupplyMinted`** (which increases — the curve gets more expensive).
4. The hook **sends 1% of your ETH to the dev wallet** (`devTreasury`).
5. The hook **keeps the other 99% in its own contract balance** — to be used later for `deepenPool` or `refillTreasury`.
6. The hook **drips SEEDs to your address** at the standard `SEED_DRIP_PER_MOCHI` rate (same as pool buys). Garden mints also count as "entering the game."
7. The hook transfers your MOCHI to your wallet.

### Why "rising price" matters

It does two important things:

1. **Anti-whale.** A single big buyer can't drain the curve cheaply. The first ETH spent gets a lot of MOCHI; subsequent ETH gets less. Compounding mints fight each other.
2. **Time-honest distribution.** Earlier players pay less. This rewards conviction over capital — if you believe in the project early, you get the best terms.

### Example math

Starting state (curve untouched, 700M available):
- Spend 1 ETH → receive ~35.8M MOCHI (5.1% of inventory)
- Curve price rises from `1e10` to `4.58e10` (4.58× rise)

Same 1 ETH spent a moment later:
- Now spends 1 ETH → receive only ~18.2M MOCHI (down from 35.8M)
- Price rises from `4.58e10` to `6.40e10`

Each subsequent 1 ETH mint extracts fewer tokens. **The curve self-defends against rapid drain.**

### Where the ETH from mints actually goes

For every 1 ETH spent on a mint:

```
1 ETH ──┬── 0.01 ETH → dev wallet (devTreasury)
        │
        └── 0.99 ETH → hook contract balance (stays here)
                          │
                          ├── owner can call deepenPool(X) → LPs into the v4 pool
                          │   (pairs ETH with matching MOCHI from garden inventory)
                          │
                          ├── anyone can call refillTreasury(X) (with their own ETH)
                          │   → buys MOCHI from pool, adds to treasury
                          │
                          └── owner can call withdrawDevEth(X) → personal use
```

The **deepenPool** path is the heart of the flywheel: ETH from mints automatically gets used to deepen the Uniswap pool's liquidity. The Uniswap pool gets richer with every mint.

---

## The fee system in plain words

There are **four** fees in play (updated for v2). They all do different things and go to different places.

### 1. The dev entry fee — 1% of ETH on every buy

When you swap ETH for MOCHI:
- You spend, say, 1 ETH
- The hook immediately skims **0.01 ETH** and sends it to the dev's wallet
- The remaining **0.99 ETH** goes into the actual swap
- You end up with ~0.984 MOCHI (after the LP fee too)

This is the dev's "house cut" for entering the game. It's how the dev funds initial pool liquidity — every buy contributes a little to the deployer's wallet, and they can use that ETH to add more LP later.

### 2. The LP swap fee — 0.5%–1% of every swap, both directions

This is the standard Uniswap fee that every swap pays:
- Goes to **LPs** (people who deposited ETH+MOCHI in the pool)
- Rate floats between 0.5% and 1% based on how much game activity is happening (more gardeners → higher fee)
- LPs themselves get **50% off** when they swap (the LP rebate)

This fee is **not** the dev's. It's the LPs' reward for providing liquidity and bearing impermanent loss.

### 3. The game harvest fee — 1% of MOCHI on every harvest

When you call `sell()` to cash SEEDs into MOCHI:
- The treasury pays out MOCHI based on the bonding curve (more on this below)
- **Capped:** no single harvest can exceed **0.1%** of the current treasury balance
- 1% of the (capped) payout gets routed to the dev wallet (this is a separate "protocol fee" on the cashout amount, NOT the cap)
- 99% goes to you

This is **separate from any pool fee** because harvest doesn't touch the pool. It's a direct treasury-to-you transfer.

The 0.1% cap is the main anti-drain protection. Combined with the cast-bump penalty (each cast inflates `marketSeeds` by full S instead of S/5), this means even an attacker with infinite gardener compounding needs ~1000+ sequential harvests to drain a meaningful share of the treasury. Treasury runway: years.

### 4. The garden mint protocol fee — 1% of ETH on every mint (v2)

When you call `mintFromGarden{value: X}()`:
- 1% (`X / 100`) goes to the dev wallet immediately
- 99% stays in the hook contract for `deepenPool` / `refillTreasury` / dev withdrawal

This is the dev's primary revenue stream now. The 1% pool entry fee still exists for direct-pool buys, but most ETH flow is expected through garden mints.

### Quick tally — who earns what (updated for v2)

| Role           | Earns…                                                                |
|----------------|------------------------------------------------------------------------|
| **Dev**        | 1% of ETH on every pool buy + 1% of ETH on every garden mint + 1% of MOCHI on every harvest |
| **LP**         | 0.5–1% of every swap (both directions). Auto-deepened by `deepenPool` flywheel. |
| **Referrer**   | 12% of SEEDs from the people they referred (one-time per referee)     |
| **Player**     | Everything else: MOCHI from buys/mints, SEEDs from drips/gardeners, MOCHI from harvests, ETH from selling MOCHI |

---

## The bonding curve — how harvests get priced

When you harvest SEEDs, how much MOCHI do you get? Not 1:1. It's based on a formula ported from the original eggs/beans game:

```
mochi_out = (10000 × treasury) / (5000 + (10000 × marketSeeds + 5000 × your_seeds) / your_seeds)
```

`marketSeeds` is a global counter that grows every time anyone casts or sells. The bigger it gets, the **less MOCHI** you get per SEED.

The intuition:
- Treasury full + few people farming → harvests are great
- Treasury empty OR lots of farming pressure → harvests are stingy
- Early players are rewarded more than late players (the classic compounding-game dynamic)

It's the same curve as `sp0oby/ponzi`'s `calculateTrade`. We just changed the currencies from ETH to MOCHI.

---

## A full walkthrough — alice plays for two days

Setting: Anvil is up. Deployer has seeded 1000 ETH + matching MOCHI into the pool. Treasury has 300M MOCHI.

**Day 1, 12:00pm — alice connects her wallet with 10 ETH**

Alice clicks "swap" for 1 ETH → MOCHI.

Behind the scenes:
1. Wallet sends 1 ETH to the swap router
2. Router calls `poolManager.swap(...)` on the v4 PoolManager
3. PoolManager calls **our hook's `beforeSwap`**
   - Hook computes dynamic fee (0.5%, since no one has played yet)
   - Hook skims **0.01 ETH** for the dev via `take()`
   - Hook returns a delta saying "swap with 0.99 ETH, not 1 ETH"
4. PoolManager executes the swap (0.99 ETH → ~0.984 MOCHI, after the 0.5% LP fee)
5. PoolManager calls **our hook's `afterSwap`**
   - Hook drips ~984,000 SEEDs to alice's `claimedSeeds`
6. Router settles: alice paid 1 ETH total, receives 0.984 MOCHI

**Alice's state after the buy:**
- Wallet: 9 ETH + 0.984 MOCHI
- claimedSeeds[alice] = 984,000
- gardeners[alice] = 0
- Dev wallet: +0.01 ETH

**Day 1, 12:01pm — alice clicks "cast seeds"**

Alice calls `hook.cast(0x0)` (no referrer).

Behind the scenes:
1. Hook reads `getMySeeds(alice) = 984,000`
2. New gardeners = 984,000 / 86,400 = **11 gardeners**
3. `gardeners[alice] = 11`
4. `claimedSeeds[alice] = 0`
5. `lastActionTime[alice] = now`
6. `marketSeeds += 984,000 / 5 = 196,800`

**Alice's state after the cast:**
- Wallet: 9 ETH + 0.984 MOCHI (unchanged — cast doesn't touch the pool)
- claimedSeeds[alice] = 0
- gardeners[alice] = **11**

**Day 1, 8:00pm — alice goes to bed**

Eight hours pass. Alice's 11 gardeners have produced:
- 11 × 28,800 seconds = **316,800 SEEDs**

The frontend shows this number ticking up in real time. The contract doesn't actually move the seeds yet — they only get "claimed" when she does another action.

**Day 2, 12:00pm — alice wakes up, opens Mochi Garden**

24 hours since her last action. Her gardeners hit the 1-day cap:
- 11 × 86,400 = **950,400 SEEDs available**

She clicks "cast" again. New gardeners = 950,400 / 86,400 = **11 more gardeners → 22 total**.

She could also have hit "harvest" instead:
- `calculateSeedSell(950,400)` runs the bonding curve
- Treasury pays her some amount of MOCHI (something like ~3,000 MOCHI depending on marketSeeds growth)
- 1% (~30 MOCHI) goes to dev
- ~2,970 MOCHI goes to her wallet
- She could then swap that MOCHI for ETH on the pool

**Day 2 onward — compound or cash out, her choice**

Each day she's online, she can cast (double down) or harvest (extract MOCHI). If she also wants ETH she swaps her harvested MOCHI back through the pool. That's the loop.

---

## "What if I just swap MOCHI for ETH and ignore the game?"

You can. The pool is fully usable as a regular Uniswap pool. You'll pay the 0.5–1% LP fee. You won't pay the dev entry fee (that's only on the ETH→MOCHI direction). You won't get any SEED drip. You just trade.

The game's economic pressure mostly comes from people *playing* — they're the ones casting, growing, and harvesting MOCHI back into circulation. Pure swappers are arbitragers between the bonding-curve treasury price and the pool price.

---

## "What if I just LP and ignore the game?"

You can. Deposit ETH + MOCHI to the pool, earn fees on every swap. You don't have to cast anything. You don't have to harvest. You're a normal Uniswap LP.

Bonus: as soon as you LP, your address gets tagged as an active LP. Your own swaps get 50% off the dynamic fee. So if you're also a player, LP-ing is a free upgrade.

Downside: impermanent loss is a real thing. If MOCHI's price moves a lot relative to ETH, your LP value can underperform "just holding both tokens."

---

## "What if I never harvest?"

You compound forever. Your gardener count grows. Your SEED production accelerates. The MOCHI in your "potential harvest" gets bigger and bigger.

But: the bonding curve gets stingier as `marketSeeds` grows. And the treasury can run dry. So infinite compounding isn't free — at some point you have to harvest to actually realize the value.

---

## "What if the treasury runs out?"

Harvests revert with `TreasuryEmpty`. Players who want MOCHI have to use the pool instead (which they always could). The game's "game cashout" path dies, but the "trade MOCHI for ETH" path keeps working.

In v1, only the owner can refill the treasury (via `fundTreasury`). A future version could auto-refill from dev-entry-fee ETH or some other mechanism.

## How much ETH does it take to drain the treasury?

**v2 update: the treasury is now effectively un-drainable in any reasonable timeframe.**

In v1, with no harvest cap and a weak cast-bump penalty, 1 ETH + 15 days of aggressive compounding could extract ~83% of the treasury (250M MOCHI of the 300M total) in a single mega-harvest.

In v2, two changes kill that attack:

1. **`MAX_HARVEST_BPS = 10` (0.1% cap)** — no single `sell()` call can extract more than 0.1% of the treasury, regardless of how compounded your gardener stack is. Drains require many sequential harvests.
2. **Cast bump is now full `seeds` (was `seeds / 5`)** — compounding inflates `marketSeeds` 5× faster than v1, so subsequent harvests under the cap pay even less.

So instead of "drain 83% in one transaction," draining now requires roughly:
- 1000+ separate harvests to drain even 50% (geometric: 0.999^693 ≈ 0.5)
- But each harvest also inflates `marketSeeds`, so successive harvests pay less than the cap allows
- Geometric decay → treasury asymptotes toward zero, never fully drains
- Even at max-frequency harvesting (every block, ~30/min), treasury would take months to halve

### The new flywheel that refills the treasury

`refillTreasury()` lets anyone (typically the dev, using accumulated mint-flow ETH) pay ETH to the hook. The hook swaps that ETH for MOCHI via its own pool and deposits the MOCHI into the treasury. **Treasury refills happen organically with usage** — every mint contributes ETH to the hook, the dev can deploy that to refill.

So the equation flips from "how fast can attackers drain" to "are refills outpacing harvests." With healthy mint volume, the treasury grows over time, not shrinks.

### The bonding curve simplified

After algebra, the harvest formula reduces to:

```
mochi_out = treasury × seeds / (seeds + marketSeeds)
```

After every harvest:
- Treasury becomes `treasury × marketSeeds / (seeds + marketSeeds)`
- marketSeeds becomes `marketSeeds + seeds`

So the treasury halves when you harvest with `seeds == marketSeeds`. It asymptotically approaches zero but **never fully drains** — the curve gets stingier as you go.

### Initial conditions

- Treasury starts at **300M MOCHI**
- marketSeeds starts at **86.4M**
- 0.01 ETH at curve start ≈ ~954K MOCHI ≈ ~954K SEEDs (drip rate 1 per MOCHI) → 11 gardeners after cast
- Each gardener produces 86,400 SEEDs/day (capped at 1 day per cycle)

### Strategy 1 — patient bootstrap (1 ETH, 1 year)

1. Buy 1 ETH worth of MOCHI → 11 gardeners
2. Don't compound. Just harvest daily.
3. Each day: 11 × 86,400 = 950,400 SEEDs ready

Day-1 harvest: `300M × 950,400 / (950,400 + 86.4M) ≈ 3.26M MOCHI`

After 365 daily harvests, the treasury asymptotes from 300M down to ~50M (~83% drained). Total cost: 1 ETH.

### Strategy 2 — aggressive compound (1 ETH, 15 days)

1. Buy 1 ETH → 11 gardeners
2. Cast every day for 15 days. Gardener count doubles each day. marketSeeds also grows from the cast bump (1/5 of seeds-used per cast).
3. After 15 days: **~360,000 gardeners**, marketSeeds ~6.3B
4. Day-16 single mega-harvest:

```
S = 360,000 × 86,400 = 31.1B SEEDs
mochi_out = 300M × 31.1B / (31.1B + 6.3B) ≈ 250M MOCHI
```

**250M MOCHI extracted in one transaction. ~83% of treasury, in 15 days, for 1 ETH.**

After this harvest: treasury = 50M, marketSeeds = 37.4B. The curve is now extremely stingy — subsequent harvests get nearly nothing.

### Strategy 3 — industrial parallel (100 ETH, 2 days)

1. Buy 100 ETH worth of MOCHI → 1100 gardeners immediately
2. Wait 1 day → 95M SEEDs accumulated
3. Harvest day 2:

```
mochi_out = 300M × 95M / (95M + 86.4M) ≈ 157M MOCHI
```

**157M MOCHI extracted (~52% of treasury) for 100 ETH and 2 days.** Less efficient per-ETH than Strategy 2 (slower compounding) but faster wall-clock time.

### The catch — pool depth caps the actual realized value

Extracting 250M MOCHI from the treasury sounds amazing. But to turn that into ETH you have to **sell on the pool**. With v1's seeded liquidity of ~1000 MOCHI in pool reserves, dumping 250M MOCHI would:

- Crash MOCHI/ETH price by orders of magnitude
- Get a tiny fraction of "spot value" — most of your MOCHI sells at near-zero
- Probably hit slippage caps in your wallet long before you exit

This is exactly the dynamic that made the original eggs/beans games work: **the treasury isn't ETH — it's MOCHI you have to find buyers for.** The real exit cap is pool depth, not treasury size.

### Anti-drain mechanics in v2

- **0.1% harvest cap** — `MAX_HARVEST_BPS = 10` enforces per-call cap
- **Cast bump full S** — compounding pays the same `marketSeeds` tax as harvesting
- **refillTreasury flywheel** — anyone can refill with their own ETH
- **Treasury runway %** visible on the frontend so the system's health is transparent
- **Dynamic pool fee** rises with marketSeeds activity — natural throttle on volume during heavy game phase
- **Curve-side drain protection** — the rising garden curve self-defends by raising prices on each mint
- **No emergency pause** — by design, to preserve "fair game" trust

---

## Providing liquidity via the Mochi Garden UI

There's a panel in the frontend ("add liquidity ♡" card, below Garden and Pool) that lets you deposit ETH + MOCHI into the pool directly from the Mochi Garden site. You don't need to leave for Uniswap.

### What happens when you click "add liquidity"

1. Your wallet approves MOCHI to be pulled by the liquidity router (one-time per session)
2. The router calls `PoolManager.modifyLiquidity` with the PoolKey, your ETH value, your matching MOCHI, and a tick range (default `-600` to `+600`, ≈ ±6% around current price)
3. Our hook's `afterAddLiquidity` fires and sets `isActiveLP[your address] = true`
4. You become an LP and the panel shows the **"active LP — 50% off swap fees ✨"** sticker
5. From now on, every swap you do on Mochi Garden pays half the dynamic fee

### What you're committing

When you deposit X ETH, the panel pulls approximately X MOCHI from your wallet (at current pool ratio, ±slippage). The combined deposit becomes your share of the pool's reserves. You earn a proportional cut of every swap fee while your liquidity is in.

### What you can lose (impermanent loss, in plain words)

If MOCHI's price moves a lot up or down relative to ETH while you're LP'd, the value of your position when you withdraw will be less than if you'd just held the original ETH + MOCHI separately. The swap fees you earn while LP'd partially compensate for this. In a quiet, ranging market: fees win. In a runaway pump or crash: IL wins.

For v1 the panel uses **PoolModifyLiquidityTest** on Anvil (no NFT). For Sepolia/mainnet we'll switch it to the real **PositionManager** which mints a position NFT you can hold or trade.

### Why LP'ing benefits the game (and the LP)

| Reason                  | Why it matters                                                |
|-------------------------|---------------------------------------------------------------|
| Deeper liquidity        | Players get better swap prices, less slippage                 |
| Drain protection        | Treasury harvesters can't dump as easily — preserves the game |
| You earn dynamic fees   | 0.5–1% of every swap, in proportion to your share             |
| You get the LP rebate   | Your own swaps cost half — useful if you're also playing      |
| You're tagged on-chain  | `isActiveLP` is publicly visible; future v1.x mechanics may reward LPs further |

---

## What the frontend shows you now

Two zones on the Stats card:

**◆ pool ◆**
- **Pool liquidity** — total active v4 liquidity units in the range
- **Pool MOCHI** — how much MOCHI the PoolManager currently holds
- **Spot price** — MOCHI per 1 ETH, computed from `sqrtPriceX96`
- **Dynamic fee + tick** — current effective fee + the pool's tick

**◆ game ◆**
- **Treasury** — current MOCHI in the hook, with **% runway remaining** (starts at 100%, drops as people harvest)
- **Market seeds** — global bonding-curve denominator (grows with casts and sells)
- **Gardeners** — total minted across all players
- **Total $MOCHI** — fixed 1B supply
- **Circulating** — `totalSupply - treasury - poolReserve` (in user wallets)

The runway % is the most game-relevant signal: at 100%, harvests pay maximally. As it drops, you can see the curve getting worse in real time.

---

## What happens when the curve is fully minted

If all 700M MOCHI are sold from the curve (i.e., `gardenSupplyMinted == 700M × 1e18`):

- `mintFromGarden()` reverts with `GardenInventoryEmpty` — no more new MOCHI can be sold from the curve
- `deepenPool()` still works (it pulls MOCHI from `lpReserve`, not garden inventory). Auto-deepen pauses once mints stop, since it's triggered by mint inflow.
- Some ETH will be sitting in the hook (the 99% slice across ~245 ETH raised, minus whatever was committed to LP by auto-deepens during the lifecycle)
- ~2.45 ETH will have landed in the dev wallet over the lifecycle (the 1% slice on each mint)

The pool keeps trading. Harvests keep working as long as the treasury has MOCHI. The dev (you) can:
- `withdrawDevEth(<all hook ETH>, <wallet>)` to drain the hook's accumulated balance
- Use that ETH + your remaining MOCHI to LP via the frontend (`Liquidity` panel uses YOUR wallet's funds, doesn't touch hook reserves)
- Call `fundTreasury` with MOCHI you've reclaimed to extend the harvest game's runway

In short: the curve has a definite end (700M MOCHI sold), but the rest of the system — pool trading, harvesting — continues. It's a "mint phase" + "trading phase" split.

---

## Admin operations (deployer only)

The hook has owner-only functions for managing accumulated ETH and pool liquidity. See the [Admin operations runbook in the README](./README.md#admin-operations-deployer-runbook) for copy-paste cast commands covering:

- Withdrawing accumulated mint-fee ETH from the hook
- Manually deepening the pool with hook ETH + garden inventory
- Refilling the treasury (anyone can do this)
- Funding the treasury directly with your own MOCHI
- Changing the dev wallet
- Wind-down steps when the curve is fully minted

None of this is automatic. The dev (you) controls all of it manually.

---

## Recap — the absolutely-must-know parts (v2)

1. **One pool. One curve. One treasury.** All three live inside the same `MochiHook` contract. The v4 pool is for swaps; the curve is for primary issuance; the treasury is for harvest payouts. They're independent.
2. **MOCHI supply is fixed at 1 BILLION.** Forever. Allocation: **200M treasury / 700M garden curve / 75M lpReserve (pre-funded for auto-LP) / 25M deployer**.
3. **SEED is not a token.** It's a counter inside the hook. Doesn't show up in MetaMask. Can only be cast or harvested.
4. **gardener is not a token.** Another counter. Produces 1 SEED/sec, capped at 1 day between actions.
5. **Two ways to buy MOCHI:** rising-curve mint via `mintFromGarden()` OR swap on the v4 pool. The curve is cheaper early, pricier late. The pool is whatever the market says.
6. **Four fee surfaces, all separate:**
   - 1% ETH → dev on **pool buys**
   - 1% ETH → dev on **garden mints**
   - 0.5–1% → LPs on every swap (both directions)
   - 1% MOCHI → dev on game harvests
7. **The 1% harvest cap** is hard-enforced. No single sell extracts more than 1% of treasury. Drain attacks are dead.
8. **The flywheel runs without the dev** (decentralized by design):
   - Garden mints → 99% of ETH stays in hook, tracked in `cumulativeMintInflow`
   - Every 5 ETH of accumulated inflow auto-fires a 0.1 ETH `deepenPool` inside the mint that crossed the threshold
   - That 0.1 ETH pairs with MOCHI from `lpReserve` (price-matched) and gets LP'd into the v4 pool. Hook owns the position.
   - Small per-trigger commitment lets the 75M lpReserve sustain many deepens across the curve lifecycle
   - Anyone can also call `deepenPool` manually (permissionless), or top up `lpReserve` with `fundLpReserve`
   - Anyone calls `refillTreasury()` → pays ETH → swap for MOCHI on the pool → adds to treasury
   - The dev is not a bottleneck; aligned actors (LPs, players, dev) keep the flywheel turning

That's the whole system. Read the [README](./README.md) for the precise constants and the [contract source](./contracts/src/MochiHook.sol) for the exact code.

(づ｡◕‿‿◕｡)づ
