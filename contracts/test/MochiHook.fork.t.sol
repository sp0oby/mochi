// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {HookMiner} from "v4-hooks-public/utils/HookMiner.sol";

import {MochiToken} from "../src/MochiToken.sol";
import {MochiHook} from "../src/MochiHook.sol";

/// @notice Fork test against Base mainnet. Validates that MochiHook works against the
///         actual deployed v4 PoolManager bytecode (in case our lib/v4-core has drifted
///         from what's live).
///
/// Run with:
///   forge test --match-path test/MochiHook.fork.t.sol --fork-url https://mainnet.base.org -vv
///
/// CI/local convenience: also runs against $BASE_RPC_URL if set; otherwise skips.
contract MochiHookForkTest is Test {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    /// @dev Base mainnet v4 PoolManager (Uniswap-canonical).
    address internal constant BASE_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;

    /// @dev Universal CREATE2 deployer. Same address on every EVM chain.
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    IPoolManager internal pm;
    MochiToken internal mochi;
    MochiHook internal hook;
    PoolKey internal mKey;
    PoolModifyLiquidityTest internal lpRouter;
    PoolSwapTest internal swapRouter;

    address internal devTreasury = makeAddr("dev-fork");
    address internal alice = makeAddr("alice-fork");
    address internal bob = makeAddr("bob-fork");

    uint256 internal constant INITIAL_SUPPLY = 1_000_000_000 ether;
    uint256 internal constant TREASURY_ALLOC = 200_000_000 ether;
    uint256 internal constant GARDEN_INVENTORY = 700_000_000 ether;
    uint256 internal constant LP_RESERVE_ALLOC = 75_000_000 ether;

    /// @dev sqrtPriceX96 matching the curve's BASE_PRICE (1e10 wei/MOCHI).
    uint160 internal constant SQRT_PRICE_CURVE_START =
        uint160(10_000) * uint160(79228162514264337593543950336);

    function setUp() public {
        // Skip cleanly if we're not on a Base fork.
        if (block.chainid != 8453) {
            console.log("[fork] skipping (not on Base mainnet fork) chainid:", block.chainid);
            vm.skip(true);
            return;
        }

        pm = IPoolManager(BASE_POOL_MANAGER);
        require(address(pm).code.length > 0, "PoolManager has no code at fork height");

        // Deploy MOCHI as the deployer (this contract).
        mochi = new MochiToken(INITIAL_SUPPLY, address(this));

        // Mine a salt for the hook's permission bits.
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        (address predicted, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(MochiHook).creationCode,
            abi.encode(pm, mochi, devTreasury, address(this))
        );

        // CREATE2 via the universal deployer so the address matches what HookMiner predicted.
        bytes memory initCode = abi.encodePacked(
            type(MochiHook).creationCode,
            abi.encode(pm, mochi, devTreasury, address(this))
        );
        (bool ok, bytes memory ret) = CREATE2_DEPLOYER.call(abi.encodePacked(salt, initCode));
        require(ok && ret.length == 20, "CREATE2 deploy failed");
        hook = MochiHook(payable(predicted));
        require(address(hook) == predicted, "hook addr mismatch");

        // Fund treasury, garden, lpReserve identically to the production deploy script.
        mochi.approve(address(hook), TREASURY_ALLOC);
        hook.fundTreasury(TREASURY_ALLOC);
        mochi.transfer(address(hook), GARDEN_INVENTORY);
        mochi.approve(address(hook), LP_RESERVE_ALLOC);
        hook.fundLpReserve(LP_RESERVE_ALLOC);

        // Initialize the pool on the REAL Base PoolManager.
        mKey = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(mochi)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        pm.initialize(mKey, SQRT_PRICE_CURVE_START);

        // Deploy fresh test routers against the real PoolManager. These are plain
        // PoolManager-consumer contracts; they work the same on any chain.
        lpRouter = new PoolModifyLiquidityTest(pm);
        swapRouter = new PoolSwapTest(pm);

        // Seed a small amount of pool liquidity (10M MOCHI / 0.1 ETH) so swaps have depth.
        vm.deal(address(this), 1 ether);
        mochi.approve(address(lpRouter), type(uint256).max);
        int24 currentTick = TickMath.getTickAtSqrtPrice(SQRT_PRICE_CURVE_START);
        int24 spacing = 60;
        int24 alignedTick = (currentTick / spacing) * spacing;
        int24 tickLower = alignedTick - 3_000;
        int24 tickUpper = alignedTick + 3_000;
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            SQRT_PRICE_CURVE_START,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            0.1 ether,
            10_000_000 ether
        );
        lpRouter.modifyLiquidity{value: 0.1 ether}(
            mKey,
            ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: int256(uint256(liquidity)),
                salt: bytes32(0)
            }),
            ""
        );

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    /// PoolManager refunds excess ETH back to the LP after modifyLiquidity. The test
    /// contract acts as the LP in setUp(), so it needs to accept ETH.
    receive() external payable {}

    function test_Fork_PoolWasInitializedOnRealManager() public view {
        if (block.chainid != 8453) return;
        PoolId id = mKey.toId();
        (uint160 sqrtPriceX96,,,) = pm.getSlot0(id);
        assertEq(sqrtPriceX96, SQRT_PRICE_CURVE_START, "pool not initialized at curve-start price");
        assertTrue(hook.poolBound(), "hook didn't bind to pool");
    }

    function test_Fork_GardenMint_Works() public {
        if (block.chainid != 8453) return;
        uint256 supplyBefore = hook.gardenSupplyMinted();
        uint256 inflowBefore = hook.cumulativeMintInflow();
        vm.prank(alice);
        hook.mintFromGarden{value: 0.05 ether}();
        assertGt(hook.gardenSupplyMinted(), supplyBefore, "supply didn't grow on real PM");
        assertGt(hook.cumulativeMintInflow(), inflowBefore, "inflow didn't grow on real PM");
    }

    function test_Fork_Swap_RoutesThroughRealManager() public {
        if (block.chainid != 8453) return;
        uint256 bobMochiBefore = mochi.balanceOf(bob);
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -0.005 ether,
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });
        PoolSwapTest.TestSettings memory s = PoolSwapTest.TestSettings({
            takeClaims: false,
            settleUsingBurn: false
        });
        vm.prank(bob);
        swapRouter.swap{value: 0.005 ether}(mKey, params, s, "");
        assertGt(mochi.balanceOf(bob), bobMochiBefore, "swap didn't deliver MOCHI on real PM");
    }

    function test_Fork_AutoDeepen_TriggersAgainstRealManager() public {
        if (block.chainid != 8453) return;
        uint256 lpReserveBefore = hook.lpReserve();
        uint256 lastAutoBefore = hook.lastAutoDeepenAt();

        // 0.05 ETH trigger, mint 0.01 at a time until it fires.
        for (uint256 i = 0; i < 15; i++) {
            vm.prank(alice);
            hook.mintFromGarden{value: 0.01 ether}();
            if (hook.lastAutoDeepenAt() > lastAutoBefore) break;
        }
        assertGt(hook.lastAutoDeepenAt(), lastAutoBefore, "auto-deepen never fired on real PM");
        assertLt(hook.lpReserve(), lpReserveBefore, "lpReserve didn't shrink on real PM");
    }

    function test_Fork_HarvestCapAndCooldown_Hold() public {
        if (block.chainid != 8453) return;
        // Alice mints to get seed drip, then sells, then attempts immediate resell.
        vm.prank(alice);
        hook.mintFromGarden{value: 0.05 ether}();

        uint256 treasuryBefore = hook.mochiTreasury();
        uint256 balBefore = mochi.balanceOf(alice);
        vm.prank(alice);
        hook.sell();
        uint256 payout = mochi.balanceOf(alice) - balBefore;
        uint256 maxAllowed = (treasuryBefore * hook.MAX_HARVEST_PPM()) / 1_000_000;
        assertLe(payout, maxAllowed, "harvest cap violated on real PM");

        // Immediate re-sell must revert with cooldown error.
        vm.expectRevert();
        vm.prank(alice);
        hook.sell();
    }
}
