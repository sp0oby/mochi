// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, StdInvariant} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {MochiToken} from "../src/MochiToken.sol";
import {MochiHook} from "../src/MochiHook.sol";

/// @notice Handler used by the invariant runner. Each external function is a candidate
///         action chosen at random per step. Inputs are bounded into useful ranges and
///         actions that legitimately fail are caught so the run keeps progressing.
contract MochiHandler is Test {
    MochiHook public immutable hook;
    MochiToken public immutable mochi;
    address[5] public actors;

    // Bookkeeping observed by invariants
    uint256 public lastTotalGardeners;
    uint256 public lastGardenSupplyMinted;
    uint256 public lastCumulativeMintInflow;
    uint256 public lastLastAutoDeepenAt;
    uint256 public lpReserveCumulativeFunded;
    uint256 public maxHarvestRatioPpm;
    uint256 public sellCount;
    uint256 public mintCount;

    constructor(MochiHook _hook, MochiToken _mochi, address[5] memory _actors) {
        hook = _hook;
        mochi = _mochi;
        actors = _actors;
        lpReserveCumulativeFunded = _hook.lpReserve();
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function mintFromGarden(uint256 actorSeed, uint256 ethSeed) external {
        address u = _actor(actorSeed);
        uint256 ethIn = bound(ethSeed, 1e14, 0.5 ether);
        if (hook.gardenInventoryRemaining() == 0) return;
        vm.deal(u, u.balance + ethIn);
        vm.prank(u);
        try hook.mintFromGarden{value: ethIn}() {
            mintCount++;
        } catch {}
    }

    function cast(uint256 actorSeed, uint256 refSeed) external {
        address u = _actor(actorSeed);
        address r = _actor(refSeed);
        vm.prank(u);
        try hook.cast(r) {} catch {}
    }

    function warp(uint256 secondsSeed) external {
        uint256 dt = bound(secondsSeed, 1, 2 days);
        vm.warp(block.timestamp + dt);
    }

    function sell(uint256 actorSeed) external {
        address u = _actor(actorSeed);
        uint256 treasuryBefore = hook.mochiTreasury();
        uint256 balBefore = mochi.balanceOf(u);
        uint256 devBalBefore = mochi.balanceOf(hook.devTreasury());

        vm.prank(u);
        try hook.sell() {
            uint256 totalOut = (mochi.balanceOf(u) - balBefore)
                + (mochi.balanceOf(hook.devTreasury()) - devBalBefore);
            if (treasuryBefore > 0) {
                uint256 ratio = (totalOut * 1_000_000) / treasuryBefore;
                if (ratio > maxHarvestRatioPpm) maxHarvestRatioPpm = ratio;
            }
            sellCount++;
        } catch {}
    }

    function fundLpReserve(uint256 actorSeed, uint256 amtSeed) external {
        address u = _actor(actorSeed);
        uint256 amount = bound(amtSeed, 1 ether, 100_000 ether);
        if (mochi.balanceOf(address(this)) < amount) return;
        mochi.transfer(u, amount);
        vm.startPrank(u);
        mochi.approve(address(hook), amount);
        try hook.fundLpReserve(amount) {
            lpReserveCumulativeFunded += amount;
        } catch {}
        vm.stopPrank();
    }

    /// Helper for the invariant suite to refresh monotonic-tracking variables.
    function recordMonotonic() external {
        uint256 g = hook.totalGardeners();
        require(g >= lastTotalGardeners, "totalGardeners shrank");
        lastTotalGardeners = g;

        uint256 s = hook.gardenSupplyMinted();
        require(s >= lastGardenSupplyMinted, "gardenSupplyMinted shrank");
        lastGardenSupplyMinted = s;

        uint256 c = hook.cumulativeMintInflow();
        require(c >= lastCumulativeMintInflow, "cumulativeMintInflow shrank");
        lastCumulativeMintInflow = c;

        uint256 la = hook.lastAutoDeepenAt();
        require(la >= lastLastAutoDeepenAt, "lastAutoDeepenAt shrank");
        lastLastAutoDeepenAt = la;
    }
}

contract MochiHookInvariantTest is StdInvariant, Test, Deployers {
    using PoolIdLibrary for PoolKey;

    MochiToken internal mochi;
    MochiHook internal hook;
    MochiHandler internal handler;
    PoolKey internal mKey;
    PoolId internal pid;

    address internal devTreasury = makeAddr("dev-inv");
    uint256 internal constant INITIAL_SUPPLY = 1_000_000_000 ether;
    uint256 internal constant TREASURY_ALLOC = 200_000_000 ether;
    uint256 internal constant GARDEN_INVENTORY = 700_000_000 ether;
    uint256 internal constant LP_RESERVE_ALLOC = 75_000_000 ether;
    uint256 internal constant HANDLER_LP_BUFFER = 20_000_000 ether;

    function setUp() public {
        deployFreshManagerAndRouters();
        mochi = new MochiToken(INITIAL_SUPPLY, address(this));

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        address payable hookAddr = payable(address(uint160(type(uint160).max & clearAllHookPermissionsMask | flags)));
        deployCodeTo("MochiHook", abi.encode(manager, mochi, devTreasury, address(this)), hookAddr);
        hook = MochiHook(hookAddr);

        mochi.approve(address(hook), TREASURY_ALLOC);
        hook.fundTreasury(TREASURY_ALLOC);
        mochi.transfer(address(hook), GARDEN_INVENTORY);
        mochi.approve(address(hook), LP_RESERVE_ALLOC);
        hook.fundLpReserve(LP_RESERVE_ALLOC);

        mKey = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(mochi)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        pid = mKey.toId();
        manager.initialize(mKey, SQRT_PRICE_1_1);

        mochi.approve(address(modifyLiquidityRouter), type(uint256).max);
        vm.deal(address(this), 5_000 ether);
        modifyLiquidityRouter.modifyLiquidity{value: 1_000 ether}(
            mKey,
            ModifyLiquidityParams({
                tickLower: -600,
                tickUpper: 600,
                liquidityDelta: 1_000 ether,
                salt: bytes32(0)
            }),
            ""
        );

        address[5] memory actors = [
            makeAddr("actor0"),
            makeAddr("actor1"),
            makeAddr("actor2"),
            makeAddr("actor3"),
            makeAddr("actor4")
        ];
        handler = new MochiHandler(hook, mochi, actors);
        mochi.transfer(address(handler), HANDLER_LP_BUFFER);

        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = MochiHandler.mintFromGarden.selector;
        selectors[1] = MochiHandler.cast.selector;
        selectors[2] = MochiHandler.warp.selector;
        selectors[3] = MochiHandler.sell.selector;
        selectors[4] = MochiHandler.fundLpReserve.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    // ============ Invariants ============

    /// lpReserve can only grow through fundLpReserve; the only way out is the deepen path.
    /// Therefore current lpReserve must never exceed total ever funded.
    function invariant_lpReserveBoundedByFunded() public view {
        assertLe(
            hook.lpReserve(),
            handler.lpReserveCumulativeFunded(),
            "lpReserve exceeded cumulative funded"
        );
    }

    function invariant_gardenSupplyMintedCapped() public view {
        assertLe(hook.gardenSupplyMinted(), GARDEN_INVENTORY, "gardenSupplyMinted > inventory");
    }

    /// lastAutoDeepenAt can only catch up to cumulativeMintInflow — never overshoot.
    function invariant_autoDeepenInflowConsistent() public view {
        assertLe(
            hook.lastAutoDeepenAt(),
            hook.cumulativeMintInflow(),
            "lastAutoDeepenAt > cumulativeMintInflow"
        );
    }

    /// Per-call harvest cap: across every observed sell() the payout never exceeded
    /// MAX_HARVEST_PPM (10ppm = 0.001%) of the pre-sell treasury.
    function invariant_harvestCapHolds() public view {
        assertLe(
            handler.maxHarvestRatioPpm(),
            hook.MAX_HARVEST_PPM(),
            "harvest exceeded MAX_HARVEST_PPM cap"
        );
    }

    /// Treasury only shrinks while the run is in progress (no refillTreasury action).
    function invariant_treasuryNeverGrows() public view {
        assertLe(hook.mochiTreasury(), TREASURY_ALLOC, "treasury grew without refill");
    }

    /// poolBound flips once and stays.
    function invariant_poolBoundSticky() public view {
        assertTrue(hook.poolBound(), "pool unbound");
    }

    /// All-time monotonicity: counters never decrease step-over-step. This calls the
    /// handler's bookkeeping function, which will revert (failing the invariant) if a
    /// monotonic counter regressed since the previous check.
    function invariant_monotonicCounters() public {
        handler.recordMonotonic();
    }
}
