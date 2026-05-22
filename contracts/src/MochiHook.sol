// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaseHook} from "v4-hooks-public/base/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary, toBeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {MochiToken} from "./MochiToken.sol";

/// @title MochiHook
/// @notice Uniswap v4 hook that runs the Mochi Garden game on top of an ETH/MOCHI pool.
/// @dev Game state:
///        SEED — off-pool internal accumulator (uint256 per user)
///        gardeners — uint256 per user; each gardener passively produces SEED over time
///      Player actions:
///        - Buy MOCHI via the pool → afterSwap drips SEED to the buyer (entry)
///        - cast(referrer) → consume SEED, mint gardeners (compound)
///        - sell() → consume SEED yield, transfer MOCHI from treasury to user (cashout)
///      Pool behaviour:
///        - Dynamic swap fee adjusted by hook (rises with marketSeeds activity)
///        - Active LPs receive a fee rebate on their own swaps
contract MochiHook is BaseHook, IUnlockCallback, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using LPFeeLibrary for uint24;
    using StateLibrary for IPoolManager;
    using CurrencyLibrary for Currency;

    // ============ Constants ============

    /// @notice SEEDs required to create one gardener (mirrors original PONZI's egg-per-miner-per-day).
    uint256 public constant SEEDS_PER_GARDENER = 86_400; // 1 SEED/sec × 1 day

    /// @notice Bonding-curve constants (PSN / PSNH) ported from sp0oby/ponzi.
    uint256 public constant PSN = 10_000;
    uint256 public constant PSNH = 5_000;

    /// @notice Maximum production window — capped to 1 day to mirror original behaviour.
    uint256 public constant MAX_PRODUCTION_WINDOW = 86_400;

    /// @notice Referral bonus paid on a referee's first cast (basis: /100). Mirrors PONZI's 12%.
    uint256 public constant REFERRAL_BPS = 12;

    /// @notice Dev fee on game cashouts via sell() (basis: /100).
    uint256 public constant DEV_FEE_BPS = 1;

    /// @notice Maximum fraction of the treasury a single sell() can extract
    ///         (parts per million: /1_000_000). 10 ppm = 0.001%.
    /// @dev    Combined with the per-address HARVEST_COOLDOWN_SECONDS, treasury runway
    ///         is multi-year even against persistent farming. Geometric decay further
    ///         shrinks per-call payouts as treasury drains.
    uint256 public constant MAX_HARVEST_PPM = 10;

    /// @notice Minimum seconds between sell() calls per address. Rate-limits the
    ///         mint→sell→mint→sell drain loop without blocking casual harvest.
    uint256 public constant HARVEST_COOLDOWN_SECONDS = 1 hours;

    /// @notice Max ETH per refillTreasury() call. Caps griefing where someone tries to
    ///         dump huge ETH against the pool to manipulate state.
    uint256 public constant MAX_REFILL_ETH = 5 ether;

    /// @notice Max ETH per deepenPool() call. Same rationale as MAX_REFILL_ETH.
    uint256 public constant MAX_DEEPEN_ETH = 5 ether;

    /// @notice Auto-deepen flywheel constants. On every garden mint, cumulative ETH
    ///         inflow is tracked; once it crosses the next AUTO_DEEPEN_TRIGGER multiple,
    ///         a 0.1 ETH (= AUTO_DEEPEN_AMOUNT) auto-deepenPool is invoked using hook
    ///         ETH and MOCHI from lpReserve.
    /// @dev    Small per-trigger commitment lets the 75M lpReserve sustain many deepens
    ///         across the curve lifecycle. At curve start (~100M MOCHI per ETH), each
    ///         deepen consumes ~10M MOCHI; as the curve price rises, less MOCHI is needed
    ///         per deepen so the reserve stretches further. When lpReserve is exhausted,
    ///         auto-deepens silently skip until anyone calls fundLpReserve.
    /// @dev TESTNET BUILD: both constants reduced 100× from production values so the
    ///      flywheel can be exercised with the small ETH available on Sepolia.
    ///      Production: TRIGGER = 5 ether, AMOUNT = 0.1 ether (= 2% LP rate).
    ///      Testnet:    TRIGGER = 0.05 ether, AMOUNT = 0.01 ether (= 20% LP rate).
    ///      IMPORTANT: the TRIGGER must be ≥ AMOUNT or the deepen check will skip
    ///      silently because the hook won't have enough ETH yet.
    ///      Restore BOTH before any mainnet deploy.
    uint256 public constant AUTO_DEEPEN_TRIGGER = 0.05 ether;
    uint256 public constant AUTO_DEEPEN_AMOUNT = 0.01 ether;

    // ============ Garden bonding curve constants ============

    /// @notice Total MOCHI seeded into the garden curve at deploy.
    /// @dev    700M of the 1B total supply. Drains as players mint.
    uint256 public constant GARDEN_INITIAL_INVENTORY = 700_000_000 ether;

    /// @notice Initial price of MOCHI on the curve. ~1e-8 ETH/MOCHI ("cheap in").
    uint256 public constant BASE_PRICE = 1e10; // wei ETH per 1 MOCHI

    /// @notice Price rise per MOCHI minted (linear curve slope).
    /// @dev    Calibrated so fully draining 700M MOCHI raises ~245 ETH total.
    ///         final_price = BASE + SLOPE × 700M = 1e10 + 1000 × 7e8 = 7.1e11 ≈ 71× rise.
    uint256 public constant SLOPE = 1_000;

    /// @notice Dev cut on garden mints (basis points: /10_000). 100 = 1%.
    uint256 public constant DEV_MINT_FEE_BPS = 100;

    /// @notice Dev entry fee on ETH → MOCHI buys via the pool (basis points: /10_000).
    ///         100 bps = 1% of the buyer's ETH input is skimmed to devTreasury before the swap.
    /// @dev    This intentionally mirrors the original eggs/beans contracts where every ETH-in
    ///         action paid the dev. Skimmed via beforeSwap-return-delta + poolManager.take().
    uint256 public constant DEV_ENTRY_FEE_BPS = 100;

    /// @notice SEED awarded per MOCHI bought via the pool / minted from the garden.
    /// @dev Scaled to 1 SEED per whole MOCHI token. Keeps SEED counters human-readable
    ///      (a 0.01 ETH mint at curve start yields ~11 gardeners, not 11 million).
    ///      Fractional MOCHI buys round down to 0 — by design, only meaningful buys
    ///      earn SEEDs.
    uint256 public constant SEED_DRIP_PER_MOCHI = 1;

    /// @notice Base dynamic fee (5_000 = 0.5%). Subject to multiplier scaling.
    uint24 public constant BASE_FEE = 5_000;

    /// @notice Peak dynamic fee during high market activity (10_000 = 1%).
    uint24 public constant PEAK_FEE = 10_000;

    /// @notice Rebate granted to active LPs on their own swaps (basis points off the dynamic fee).
    uint24 public constant LP_REBATE_BPS = 5_000; // 50% off

    // ============ State ============

    /// @notice The MOCHI token paired with ETH in the pool.
    MochiToken public immutable mochi;

    /// @notice Pool id this hook is bound to. Set on first initialize, then frozen.
    PoolId public poolId;
    bool public poolBound;

    /// @notice Whether currency0 is ETH (Currency.unwrap == 0). Set at initialize.
    bool public mochiIsCurrency1;

    /// @notice Treasury for sell-side payouts (denominated in MOCHI).
    /// @dev Funded at deploy + replenished by dev portion of accrued fees.
    uint256 public mochiTreasury;

    /// @notice Bootstrap value used in the calculateTrade bonding curve.
    uint256 public marketSeeds = 86_400_000;

    /// @notice Per-user gardener counts.
    mapping(address => uint256) public gardeners;

    /// @notice Per-user accumulated (but un-compounded) SEED.
    mapping(address => uint256) public claimedSeeds;

    /// @notice Timestamp of the user's last cast or sell (production reference).
    mapping(address => uint256) public lastActionTime;

    /// @notice Timestamp of the user's last sell() (harvest). Used to enforce the
    ///         per-address HARVEST_COOLDOWN_SECONDS rate limit. Separate from
    ///         lastActionTime so casts and gardener-production timing aren't entangled
    ///         with the harvest cooldown.
    mapping(address => uint256) public lastHarvestTime;

    /// @notice Tracked LP positions (eligible for fee rebate). True == has any liquidity.
    mapping(address => bool) public isActiveLP;

    /// @notice First referrer locked-in per user. address(0) means "no referrer locked yet".
    /// @dev    Once set, all subsequent casts pay this referrer regardless of the arg
    ///         the caller passes. Prevents switching referrers between casts.
    mapping(address => address) public referrerOf;

    /// @notice Total ever-minted gardeners across all players (for stats).
    uint256 public totalGardeners;

    /// @notice Address receiving dev-fee MOCHI payouts (from sell()) and dev-entry ETH (from buys).
    address payable public devTreasury;

    /// @notice Total ETH skimmed via the dev-entry fee on ETH→MOCHI buys (for visibility).
    uint256 public totalDevEthAccrued;

    /// @notice Running total of MOCHI minted out of the garden curve so far. Caps at GARDEN_INITIAL_INVENTORY.
    uint256 public gardenSupplyMinted;

    /// @notice MOCHI deposited specifically for use by deepenPool / auto-deepen. Separate
    ///         from garden curve inventory so curve buyers aren't implicitly diluted by
    ///         protocol LP activity.
    uint256 public lpReserve;

    /// @notice Cumulative ETH inflow from garden mints (sum of 99% slices). Used to
    ///         decide when the auto-deepen threshold has been crossed.
    uint256 public cumulativeMintInflow;

    /// @notice Snapshot of cumulativeMintInflow at the last auto-deepen trigger. Next
    ///         trigger fires when cumulativeMintInflow ≥ lastAutoDeepenAt + AUTO_DEEPEN_TRIGGER.
    uint256 public lastAutoDeepenAt;

    // ============ Events ============

    event SeedsAccrued(address indexed user, uint256 amount, string reason);
    event Cast(address indexed user, uint256 seedsUsed, uint256 newGardeners, address referrer);
    event Sold(address indexed user, uint256 seedsUsed, uint256 mochiOut, uint256 mochiFee);
    event TreasuryFunded(uint256 amount);
    event LPRegistered(address indexed lp);
    event LPUnregistered(address indexed lp);
    event DevTreasuryUpdated(address indexed newDevTreasury);
    event DevEntryFeePaid(address indexed buyer, uint256 ethAmount);
    event TreasuryRefilled(address indexed funder, uint256 ethIn, uint256 mochiOut);
    event GardenMint(address indexed buyer, uint256 ethIn, uint256 mochiOut, uint256 newSupplyMinted, uint256 newPrice);
    event PoolDeepened(uint256 ethUsed, uint256 mochiUsed, int128 liquidityDelta);
    event DevEthWithdrawn(address indexed recipient, uint256 amount);
    event ReferrerLocked(address indexed referee, address indexed referrer);
    event LpReserveFunded(address indexed funder, uint256 amount, uint256 newReserve);
    event AutoDeepenTriggered(uint256 cumulativeInflow, uint256 ethUsed);

    // ============ Errors ============

    error PoolAlreadyBound();
    error WrongPool();
    error NoSeeds();
    error TreasuryEmpty();
    error HarvestCooldownActive(uint256 secondsRemaining);
    error InsufficientTreasury(uint256 requested, uint256 available);
    error NotEthMochiPool();
    error RefillTooLarge(uint256 sent, uint256 max);
    error RefillZero();
    error OnlyPoolManager();
    error GardenInventoryEmpty();
    error MintTooSmall();
    error DeepenTooLarge(uint256 sent, uint256 max);
    error InsufficientHookEth(uint256 requested, uint256 available);
    error InsufficientGardenInventory(uint256 needed, uint256 available);

    constructor(IPoolManager _manager, MochiToken _mochi, address _devTreasury, address _owner)
        BaseHook(_manager)
        Ownable(_owner)
    {
        require(_devTreasury != address(0), "zero dev");
        require(_owner != address(0), "zero owner");
        mochi = _mochi;
        devTreasury = payable(_devTreasury);
    }

    // ============ Admin ============

    /// @notice Owner funds the sell-side treasury with MOCHI (pulled from caller).
    function fundTreasury(uint256 amount) external onlyOwner {
        IERC20(address(mochi)).safeTransferFrom(msg.sender, address(this), amount);
        mochiTreasury += amount;
        emit TreasuryFunded(amount);
    }

    function setDevTreasury(address _devTreasury) external onlyOwner {
        require(_devTreasury != address(0), "zero dev");
        devTreasury = payable(_devTreasury);
        emit DevTreasuryUpdated(_devTreasury);
    }

    // ============ Hook permissions ============

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: true,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ============ Internal helpers ============

    /// @notice Resolve the actual user from an EIP-712 / v4 swap call.
    /// @dev    v4 swap routers wrap the user — `sender` to the hook is the router, not the
    ///         EOA. To support both EOA users and account-abstraction wallets without
    ///         requiring everyone to route through a hook-aware contract, we accept a
    ///         caller-supplied user address in `hookData`. Routers that care about the
    ///         LP rebate / SEED drip should pass `abi.encode(userAddress)`.
    ///         When `hookData` is empty (e.g., a stock v4 Universal Router call), we fall
    ///         back to `tx.origin`. Works for EOAs through any router; AA wallets MUST go
    ///         through a router that passes their address via `hookData` to be credited.
    function _resolveUser(bytes calldata hookData) internal view returns (address) {
        if (hookData.length == 32) {
            return abi.decode(hookData, (address));
        }
        return tx.origin;
    }

    // ============ Hook callbacks ============

    function _beforeInitialize(address, PoolKey calldata key, uint160) internal override returns (bytes4) {
        if (poolBound) revert PoolAlreadyBound();

        // Validate pool is ETH/MOCHI and uses dynamic fees.
        bool currency0IsEth = Currency.unwrap(key.currency0) == address(0);
        bool currency1IsMochi = Currency.unwrap(key.currency1) == address(mochi);
        if (!currency0IsEth || !currency1IsMochi) revert NotEthMochiPool();
        require(key.fee == LPFeeLibrary.DYNAMIC_FEE_FLAG, "must be dynamic-fee pool");

        poolId = key.toId();
        poolBound = true;
        mochiIsCurrency1 = true; // by construction

        return this.beforeInitialize.selector;
    }

    function _beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (PoolId.unwrap(key.toId()) != PoolId.unwrap(poolId)) revert WrongPool();

        // Internal protocol swap (refillTreasury) — pass through, no dev fee, no rebate.
        // We're the buyer here, paying ETH for MOCHI we'll deposit into our own treasury.
        // Charging ourselves a fee would be self-cannibalising and break the flywheel.
        if (sender == address(this)) {
            return (
                this.beforeSwap.selector,
                BeforeSwapDeltaLibrary.ZERO_DELTA,
                _currentDynamicFee() | LPFeeLibrary.OVERRIDE_FEE_FLAG
            );
        }

        uint24 dynamicFee = _currentDynamicFee();

        // LP rebate: use the resolved user (hookData-encoded address, fallback tx.origin).
        // Supports AA wallets via the hookData path.
        address user = _resolveUser(hookData);
        if (isActiveLP[user]) {
            uint24 rebate = uint24((uint256(dynamicFee) * LP_REBATE_BPS) / 10_000);
            dynamicFee = dynamicFee > rebate ? dynamicFee - rebate : 0;
        }

        // Dev entry fee — 1% of ETH input on ETH→MOCHI exact-input swaps gets skimmed to
        // devTreasury before the swap proceeds. The flow:
        //   1. poolManager.take(ETH, devTreasury, devCut)
        //        — moves devCut of ETH out of the PoolManager's flash balance to devTreasury
        //        — records a -devCut debt against this hook
        //   2. return BeforeSwapDelta(+devCut, 0)
        //        — credits the hook with +devCut, netting the take() debt to zero
        //        — also tells the pool the swap input is reduced by devCut
        //   3. v4-core later does swapDelta -= hookDelta, so the caller (router) settles
        //      the full original ETH amount with the pool, which replenishes the borrowed
        //      flash balance. End-state: user paid full amount, pool got (full - devCut),
        //      devTreasury got devCut.
        BeforeSwapDelta deltaReturn = BeforeSwapDeltaLibrary.ZERO_DELTA;
        if (params.zeroForOne && params.amountSpecified < 0) {
            uint256 inputAmount = uint256(-params.amountSpecified);
            uint256 devCut = (inputAmount * DEV_ENTRY_FEE_BPS) / 10_000;
            if (devCut > 0) {
                // CEI: state + event before the external `take` call.
                totalDevEthAccrued += devCut;
                deltaReturn = toBeforeSwapDelta(int128(int256(devCut)), 0);
                emit DevEntryFeePaid(tx.origin, devCut);
                poolManager.take(key.currency0, devTreasury, devCut);
            }
        }

        return (this.beforeSwap.selector, deltaReturn, dynamicFee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function _afterSwap(address sender, PoolKey calldata key, SwapParams calldata params, BalanceDelta delta, bytes calldata hookData)
        internal
        override
        returns (bytes4, int128)
    {
        if (PoolId.unwrap(key.toId()) != PoolId.unwrap(poolId)) revert WrongPool();

        // Internal protocol swap — no SEED drip for ourselves.
        if (sender == address(this)) {
            return (this.afterSwap.selector, 0);
        }

        // Drip SEED to the buyer on ETH → MOCHI swaps. Use the resolved user so AA wallets
        // (passing their address via hookData) get credited correctly. Stock EOA routers
        // without hookData fall back to tx.origin and still work.
        if (params.zeroForOne) {
            int128 amount1 = delta.amount1();
            if (amount1 > 0) {
                uint256 mochiOut = uint256(uint128(amount1));
                uint256 seedDrip = (mochiOut * SEED_DRIP_PER_MOCHI) / 1e18;
                if (seedDrip > 0) {
                    address recipient = _resolveUser(hookData);
                    claimedSeeds[recipient] += seedDrip;
                    emit SeedsAccrued(recipient, seedDrip, "swap-drip");
                }
            }
        }

        return (this.afterSwap.selector, 0);
    }

    function _afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata hookData
    ) internal override returns (bytes4, BalanceDelta) {
        // Track LP via the resolved user. hookData-encoded address takes precedence so
        // AA wallets get tagged correctly; fallback to tx.origin otherwise.
        address lp = _resolveUser(hookData);
        if (!isActiveLP[lp]) {
            isActiveLP[lp] = true;
            emit LPRegistered(lp);
        }
        return (this.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function _afterRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata params,
        BalanceDelta,
        BalanceDelta,
        bytes calldata hookData
    ) internal override returns (bytes4, BalanceDelta) {
        // Soft policy: untrack on any remove. Same resolution rule as add.
        address lp = _resolveUser(hookData);
        if (params.liquidityDelta < 0 && isActiveLP[lp]) {
            isActiveLP[lp] = false;
            emit LPUnregistered(lp);
        }
        return (this.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    // ============ Game actions ============

    /// @notice Consume accumulated SEEDs to mint gardeners. Pays 12% kickback to a locked
    ///         referrer.
    /// @dev    Referrer rules (anti-sybil):
    ///           1. If the caller already has a `referrerOf[caller]` set, the on-chain lock
    ///              wins — the `referrer` arg is IGNORED. Lock is permanent.
    ///           2. Otherwise, if the `referrer` arg is valid (non-zero, not self, AND has
    ///              `gardeners > 0` — i.e., they're a real player who paid for gardeners),
    ///              the lock is set and bonus paid.
    ///           3. Otherwise the cast still succeeds — just no bonus.
    ///         Why `gardeners > 0`? It forces sybil rings to commit ETH on each alt (each
    ///         alt must mint MOCHI → cast → have gardeners before being eligible as a
    ///         referrer). The ETH cost of that mint quickly exceeds the bonus they'd earn.
    function cast(address referrer) external nonReentrant {
        uint256 seeds = getMySeeds(msg.sender);
        if (seeds == 0) revert NoSeeds();

        uint256 newGardeners = seeds / SEEDS_PER_GARDENER;

        gardeners[msg.sender] += newGardeners;
        totalGardeners += newGardeners;
        claimedSeeds[msg.sender] = 0;
        lastActionTime[msg.sender] = block.timestamp;

        // Resolve final referrer: existing lock wins; otherwise validate + maybe-lock the arg.
        address paidReferrer = referrerOf[msg.sender];
        if (paidReferrer == address(0) && referrer != address(0) && referrer != msg.sender
                && gardeners[referrer] > 0) {
            referrerOf[msg.sender] = referrer;
            paidReferrer = referrer;
            emit ReferrerLocked(msg.sender, referrer);
        }

        // Pay 12% bonus to the locked referrer (if any).
        if (paidReferrer != address(0)) {
            uint256 bonus = (seeds * REFERRAL_BPS) / 100;
            claimedSeeds[paidReferrer] += bonus;
            emit SeedsAccrued(paidReferrer, bonus, "referral");
        }

        // Boost market activity. We bump by the FULL `seeds` (was `seeds / 5`) so that
        // compounding pays the same marketSeeds tax as harvesting. This is the main lever
        // that makes long-compound-then-mega-harvest strategies unprofitable.
        marketSeeds += seeds;

        emit Cast(msg.sender, seeds, newGardeners, paidReferrer);
    }

    /// @notice Convert accumulated SEED yield to MOCHI from the treasury.
    /// @dev Per-harvest cap of MAX_HARVEST_PPM (0.001%) of current treasury, plus a
    ///      per-address cooldown of HARVEST_COOLDOWN_SECONDS. Combined, this caps
    ///      the rate at which a single address can drain treasury and keeps the
    ///      protocol's runway in multi-year territory even under sustained farming.
    function sell() external nonReentrant {
        // Cooldown check (skip on first-ever call for this address)
        uint256 lastSell = lastHarvestTime[msg.sender];
        if (lastSell != 0 && block.timestamp < lastSell + HARVEST_COOLDOWN_SECONDS) {
            revert HarvestCooldownActive(lastSell + HARVEST_COOLDOWN_SECONDS - block.timestamp);
        }

        uint256 seeds = getMySeeds(msg.sender);
        if (seeds == 0) revert NoSeeds();
        if (mochiTreasury == 0) revert TreasuryEmpty();

        uint256 mochiValue = calculateSeedSell(seeds);

        // Cap: no single harvest exceeds MAX_HARVEST_PPM of treasury.
        uint256 maxHarvest = (mochiTreasury * MAX_HARVEST_PPM) / 1_000_000;
        if (mochiValue > maxHarvest) mochiValue = maxHarvest;

        uint256 fee = (mochiValue * DEV_FEE_BPS) / 100;
        uint256 payout = mochiValue - fee;

        // CEI: state first.
        mochiTreasury -= mochiValue;
        claimedSeeds[msg.sender] = 0;
        lastActionTime[msg.sender] = block.timestamp;
        lastHarvestTime[msg.sender] = block.timestamp;
        marketSeeds += seeds;

        // Interactions.
        if (fee > 0) IERC20(address(mochi)).safeTransfer(devTreasury, fee);
        IERC20(address(mochi)).safeTransfer(msg.sender, payout);

        emit Sold(msg.sender, seeds, payout, fee);
    }

    // ============ Garden bonding curve ============

    /// @notice Mint MOCHI from the garden at the current curve price.
    /// @dev    Linear curve: price(s) = BASE_PRICE + SLOPE × s, where s is total minted so far.
    ///         Solves the quadratic for `dS` given the caller's `msg.value`.
    ///         Inventory cap: gardenSupplyMinted + dS ≤ GARDEN_INITIAL_INVENTORY.
    ///         ETH split:
    ///           - DEV_MINT_FEE_BPS (1%) → devTreasury wallet
    ///           - remainder → held in hook for deepenPool / refillTreasury / dev use
    ///         SEED drip: same formula as pool buys (mochiOut × SEED_DRIP_PER_MOCHI / 1e18).
    function mintFromGarden() external payable nonReentrant returns (uint256 mochiOut) {
        if (msg.value == 0) revert MintTooSmall();

        uint256 inventoryLeft = GARDEN_INITIAL_INVENTORY - gardenSupplyMinted;
        if (inventoryLeft == 0) revert GardenInventoryEmpty();

        mochiOut = _computeMintOut(msg.value);
        if (mochiOut == 0) revert MintTooSmall();

        uint256 actualCost = msg.value;
        uint256 refund = 0;
        if (mochiOut > inventoryLeft) {
            // Last-mile mint: cap to remaining inventory and refund the unused ETH.
            mochiOut = inventoryLeft;
            actualCost = _costToMint(mochiOut);
            refund = msg.value - actualCost;
        }

        // CEI: do all state writes + token transfer FIRST, then external ETH sends.
        _applyMint(msg.sender, actualCost, mochiOut);

        if (refund > 0) {
            (bool ok,) = msg.sender.call{value: refund}("");
            require(ok, "refund failed");
        }
    }

    /// @dev CEI-ordered: state writes first, ERC20 transfer next, ETH sends last.
    function _applyMint(address buyer, uint256 ethIn, uint256 mochiOut) internal {
        // ─── State changes (Effects) ───
        gardenSupplyMinted += mochiOut;
        uint256 seedDrip = (mochiOut * SEED_DRIP_PER_MOCHI) / 1e18;
        if (seedDrip > 0) {
            claimedSeeds[buyer] += seedDrip;
            emit SeedsAccrued(buyer, seedDrip, "garden-mint");
        }

        // Track cumulative inflow (the 99% slice that lands in the hook).
        uint256 devCut = (ethIn * DEV_MINT_FEE_BPS) / 10_000;
        uint256 hookSlice = ethIn - devCut;
        cumulativeMintInflow += hookSlice;

        // ─── Interactions ───
        IERC20(address(mochi)).safeTransfer(buyer, mochiOut);

        emit GardenMint(buyer, ethIn, mochiOut, gardenSupplyMinted, currentMintPrice());

        if (devCut > 0) {
            (bool ok,) = devTreasury.call{value: devCut}("");
            require(ok, "dev send failed");
        }

        // Auto-deepen trigger: every AUTO_DEEPEN_TRIGGER ETH of cumulative inflow, fire
        // a deepenPool for AUTO_DEEPEN_AMOUNT ETH. Requires hook ETH + lpReserve to have
        // enough. Failures are silent — the mint still succeeds.
        if (cumulativeMintInflow >= lastAutoDeepenAt + AUTO_DEEPEN_TRIGGER) {
            uint256 ethForDeepen = AUTO_DEEPEN_AMOUNT;
            if (
                address(this).balance >= ethForDeepen &&
                lpReserve > 0 &&
                ethForDeepen <= MAX_DEEPEN_ETH
            ) {
                lastAutoDeepenAt = cumulativeMintInflow;
                emit AutoDeepenTriggered(cumulativeMintInflow, ethForDeepen);
                poolManager.unlock(abi.encode(uint8(2), ethForDeepen, lpReserve));
            }
        }
    }

    /// @notice Compute MOCHI received (in wei units) for a given ETH input (in wei) at
    ///         the current curve state.
    /// @dev    We do the curve math in *token units* (where 1 token = 1e18 wei of MOCHI),
    ///         then convert the result back to wei. This keeps the price coefficients
    ///         (BASE_PRICE, SLOPE) in human-tractable wei-per-token units.
    ///
    ///         Quadratic in token-space:
    ///           (SLOPE/2)·dS_t² + (BASE + SLOPE·s_t)·dS_t − ETH = 0
    ///         dS_t = (−b + √(b² + 2·SLOPE·ETH)) / SLOPE   where b = BASE + SLOPE·s_t.
    function _computeMintOut(uint256 ethIn) internal view returns (uint256) {
        uint256 s_t = gardenSupplyMinted / 1e18; // current minted, in token units
        uint256 b = BASE_PRICE + SLOPE * s_t;     // wei per token
        // discriminant = b² + 2·SLOPE·ETH. SLOPE×ETH is at most ~1e22 in practice, safe.
        uint256 disc = b * b + 2 * SLOPE * ethIn;
        uint256 root = Math.sqrt(disc);
        if (root <= b) return 0;
        uint256 dS_t = (root - b) / SLOPE;        // mint amount in token units
        return dS_t * 1e18;                       // convert back to wei
    }

    /// @notice Compute exact ETH cost (in wei) to mint a specific MOCHI amount (in wei).
    function _costToMint(uint256 mochiAmountWei) internal view returns (uint256) {
        uint256 s_t = gardenSupplyMinted / 1e18;
        uint256 dS_t = mochiAmountWei / 1e18;
        // ETH = BASE·dS + SLOPE·dS·(s + dS/2)
        uint256 baseCost = BASE_PRICE * dS_t;
        uint256 slopeCost = SLOPE * dS_t * (s_t + dS_t / 2);
        return baseCost + slopeCost;
    }

    /// @notice Current marginal price per 1 MOCHI (in wei) at the curve.
    function currentMintPrice() public view returns (uint256) {
        return BASE_PRICE + SLOPE * (gardenSupplyMinted / 1e18);
    }

    /// @notice MOCHI still available to mint from the garden.
    function gardenInventoryRemaining() public view returns (uint256) {
        return GARDEN_INITIAL_INVENTORY - gardenSupplyMinted;
    }

    /// @notice Quote without spending ETH — useful for frontend previews.
    function previewMint(uint256 ethIn) external view returns (uint256 mochiOut, uint256 newPrice) {
        mochiOut = _computeMintOut(ethIn);
        uint256 inv = gardenInventoryRemaining();
        if (mochiOut > inv) mochiOut = inv;
        newPrice = BASE_PRICE + SLOPE * ((gardenSupplyMinted + mochiOut) / 1e18);
    }

    /// @notice Owner-only: withdraw accumulated ETH from the hook to a recipient.
    /// @dev    Used for dev compensation. Does NOT touch the existing 1% pool-buy dev fee
    ///         (that goes directly to devTreasury wallet during beforeSwap).
    function withdrawDevEth(uint256 amount, address payable recipient) external onlyOwner {
        require(recipient != address(0), "zero recipient");
        if (amount > address(this).balance) revert InsufficientHookEth(amount, address(this).balance);
        emit DevEthWithdrawn(recipient, amount);
        (bool ok,) = recipient.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    /// @notice Anyone can fund the LP reserve with their own MOCHI. The reserve is used
    ///         exclusively for deepenPool / auto-deepen — separate from the garden curve
    ///         inventory so curve buyers don't get diluted.
    /// @dev    One-way deposit. Once in the reserve, MOCHI can only leave via deepening
    ///         (becoming pool LP held by the hook). Permissionless: dev funds it; aligned
    ///         actors (LPs, large holders) can chip in too.
    function fundLpReserve(uint256 mochiAmount) external nonReentrant {
        if (mochiAmount == 0) revert RefillZero();
        IERC20(address(mochi)).safeTransferFrom(msg.sender, address(this), mochiAmount);
        lpReserve += mochiAmount;
        emit LpReserveFunded(msg.sender, mochiAmount, lpReserve);
    }

    /// @notice Permissionless: deepen the v4 pool by pairing accumulated hook ETH with
    ///         MOCHI from the dev-funded lpReserve. The hook becomes the LP.
    /// @dev    Caps (MAX_DEEPEN_ETH per call, hook ETH balance, lpReserve balance)
    ///         protect against griefing. Callers don't get a direct reward — their
    ///         motivation is being an LP themselves or a player. This is the manual
    ///         path; an auto-trigger fires from inside garden mints every
    ///         AUTO_DEEPEN_TRIGGER ETH of cumulative inflow.
    function deepenPool(uint256 ethAmount) external nonReentrant {
        if (ethAmount > MAX_DEEPEN_ETH) revert DeepenTooLarge(ethAmount, MAX_DEEPEN_ETH);
        if (ethAmount > address(this).balance) revert InsufficientHookEth(ethAmount, address(this).balance);
        if (lpReserve == 0) revert InsufficientGardenInventory(1, 0);

        // Encoded action 2 = deepen. mochiBudget = full lpReserve; the actual settled
        // MOCHI (<= lpReserve) is deducted from lpReserve after modifyLiquidity returns.
        poolManager.unlock(abi.encode(uint8(2), ethAmount, lpReserve));
    }

    // ============ Treasury flywheel ============

    /// @notice Anyone can pay ETH to refill the treasury. The hook swaps the ETH for MOCHI
    ///         via the v4 pool and deposits the MOCHI into `mochiTreasury`.
    /// @dev    Designed for the deployer to use accumulated dev-fee ETH for keeping the
    ///         game's harvest pool alive, but permissionless so any aligned party (LPs,
    ///         bots, players) can also fund it. Per-call cap = MAX_REFILL_ETH.
    ///         Sender-guarded `beforeSwap` and `afterSwap` ensure this internal swap
    ///         skips the dev entry fee and SEED drip.
    function refillTreasury() external payable nonReentrant {
        if (msg.value == 0) revert RefillZero();
        if (msg.value > MAX_REFILL_ETH) revert RefillTooLarge(msg.value, MAX_REFILL_ETH);
        poolManager.unlock(abi.encode(uint8(1), msg.value, msg.sender));
    }

    /// @inheritdoc IUnlockCallback
    /// @dev Only the PoolManager can invoke this. Decodes the action byte and dispatches
    ///      to either the refill (swap) or deepen (modifyLiquidity) path.
    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        uint8 action = uint8(data[31]); // first uint8 is right-padded to 32 bytes in abi.encode

        if (action == 1) {
            (, uint256 ethIn, address funder) = abi.decode(data, (uint8, uint256, address));
            _doRefillSwap(ethIn, funder);
        } else if (action == 2) {
            (, uint256 ethAmount, uint256 mochiAmount) = abi.decode(data, (uint8, uint256, uint256));
            _doDeepenLiquidity(ethAmount, mochiAmount);
        }
        return "";
    }

    function _doRefillSwap(uint256 ethIn, address funder) internal {
        PoolKey memory key = _buildKey();
        SwapParams memory swapParams = SwapParams({
            zeroForOne: true,
            amountSpecified: -int256(ethIn),
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });
        BalanceDelta swapDelta = poolManager.swap(key, swapParams, "");
        poolManager.settle{value: ethIn}();
        int128 mochiOut = swapDelta.amount1();
        require(mochiOut > 0, "no mochi out");
        uint256 mochiAmount = uint256(uint128(mochiOut));
        poolManager.take(Currency.wrap(address(mochi)), address(this), mochiAmount);
        mochiTreasury += mochiAmount;
        emit TreasuryRefilled(funder, ethIn, mochiAmount);
    }

    function _doDeepenLiquidity(uint256 ethAmount, uint256 mochiReserved) internal {
        PoolKey memory key = _buildKey();

        // Read current pool price and tick; compute LP range RELATIVE to current tick
        // (instead of hardcoded [-600, +600]) so deepenPool works regardless of where the
        // pool's price is — supports launches at any starting price + later drift.
        (uint160 sqrtPriceX96, int24 currentTick,,) = poolManager.getSlot0(poolId);
        int24 spacing = 60;
        int24 alignedTick = (currentTick / spacing) * spacing;
        int24 tickLower = alignedTick - 600;
        int24 tickUpper = alignedTick + 600;

        uint160 sqrtPriceAX96 = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtPriceBX96 = TickMath.getSqrtPriceAtTick(tickUpper);

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            sqrtPriceAX96,
            sqrtPriceBX96,
            ethAmount,
            mochiReserved
        );
        if (liquidity > 100) liquidity -= liquidity / 1000; // 0.1% slack

        int128 liquidityDelta = int128(int256(uint256(liquidity)));

        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: int256(liquidityDelta),
            salt: bytes32(0)
        });
        // hookData encodes the hook's own address so _afterAddLiquidity tags address(this)
        // (the real LP) instead of tx.origin (which would give random mint-callers free
        // LP-rebate status without them actually providing liquidity).
        (BalanceDelta delta,) = poolManager.modifyLiquidity(key, params, abi.encode(address(this)));

        // delta is what the hook owes (negative) — pay it.
        int128 owed0 = -delta.amount0();
        int128 owed1 = -delta.amount1();

        if (owed0 > 0) {
            uint256 ethDue = uint256(uint128(owed0));
            require(ethDue <= ethAmount, "eth budget exceeded");
            poolManager.settle{value: ethDue}();
        }
        if (owed1 > 0) {
            uint256 mochiDue = uint256(uint128(owed1));
            require(mochiDue <= mochiReserved, "mochi budget exceeded");
            // Debit the lpReserve by exactly what was consumed
            require(lpReserve >= mochiDue, "lpReserve depleted");
            lpReserve -= mochiDue;
            // For non-native currency: sync sets the baseline balance, then transfer in,
            // then settle credits the hook for the delta.
            poolManager.sync(Currency.wrap(address(mochi)));
            IERC20(address(mochi)).safeTransfer(address(poolManager), mochiDue);
            poolManager.settle();
        }

        emit PoolDeepened(uint256(uint128(owed0)), uint256(uint128(owed1)), liquidityDelta);
    }

    function _buildKey() internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(mochi)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: this
        });
    }

    /// @notice Hook must accept ETH for the unlock-callback settle path.
    receive() external payable {}

    // ============ Views ============

    function getMySeeds(address user) public view returns (uint256) {
        return claimedSeeds[user] + getSeedsSinceLastAction(user);
    }

    function getSeedsSinceLastAction(address user) public view returns (uint256) {
        uint256 last = lastActionTime[user];
        if (last == 0) return 0;
        uint256 elapsed = block.timestamp - last;
        if (elapsed > MAX_PRODUCTION_WINDOW) elapsed = MAX_PRODUCTION_WINDOW;
        return elapsed * gardeners[user];
    }

    /// @notice The PSN/PSNH bonding curve. Maps `rt` units of resource into `bs` reserve given `rs` market depth.
    function calculateTrade(uint256 rt, uint256 rs, uint256 bs) public pure returns (uint256) {
        // (PSN * bs) / (PSNH + ((PSN * rs + PSNH * rt) / rt))
        if (rt == 0) return 0;
        uint256 denominator = PSNH + ((PSN * rs + PSNH * rt) / rt);
        return (PSN * bs) / denominator;
    }

    function calculateSeedSell(uint256 seeds) public view returns (uint256) {
        return calculateTrade(seeds, marketSeeds, mochiTreasury);
    }

    function currentDynamicFee() external view returns (uint24) {
        return _currentDynamicFee();
    }

    /// @notice Pool state for the frontend in one call: spot price (sqrtX96), tick, liquidity.
    function poolState() external view returns (uint160 sqrtPriceX96, int24 tick, uint128 liquidity) {
        (sqrtPriceX96, tick,,) = poolManager.getSlot0(poolId);
        liquidity = poolManager.getLiquidity(poolId);
    }

    function _currentDynamicFee() internal view returns (uint24) {
        // Scale BASE_FEE → PEAK_FEE based on marketSeeds growth relative to bootstrap.
        // Cap at PEAK_FEE.
        uint256 bootstrap = 86_400_000;
        if (marketSeeds <= bootstrap) return BASE_FEE;
        uint256 growth = marketSeeds - bootstrap;
        uint256 scaled = BASE_FEE + (growth * (PEAK_FEE - BASE_FEE)) / (bootstrap * 10);
        if (scaled > PEAK_FEE) return PEAK_FEE;
        return uint24(scaled);
    }
}
