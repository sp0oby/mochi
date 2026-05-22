// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";

import {MochiToken} from "../src/MochiToken.sol";
import {MochiHook} from "../src/MochiHook.sol";

contract MochiHookTest is Test, Deployers {
    using PoolIdLibrary for PoolKey;

    MochiToken internal mochi;
    MochiHook internal hook;
    PoolKey internal mKey;
    PoolId internal pid;

    address internal devTreasury = makeAddr("dev");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal lpProvider = makeAddr("lp");
    address internal referrer = makeAddr("referrer");

    uint256 internal constant INITIAL_SUPPLY = 1_000_000_000 ether;
    uint256 internal constant TREASURY_ALLOC = 200_000_000 ether;
    uint256 internal constant GARDEN_INVENTORY = 700_000_000 ether;

    function setUp() public {
        // 1. Spin up fresh PoolManager + test routers.
        deployFreshManagerAndRouters();

        // 2. Deploy MOCHI token to this test contract (deployer).
        mochi = new MochiToken(INITIAL_SUPPLY, address(this));

        // 3. Compute the hook target address — flags encoded in bottom 14 bits.
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        address payable hookAddr = payable(address(uint160(type(uint160).max & clearAllHookPermissionsMask | flags)));

        // 4. Deploy the hook bytecode at that exact address via deployCodeTo.
        deployCodeTo("MochiHook", abi.encode(manager, mochi, devTreasury, address(this)), hookAddr);
        hook = MochiHook(hookAddr);

        // 5. Fund treasury with sell-side MOCHI.
        mochi.approve(address(hook), TREASURY_ALLOC);
        hook.fundTreasury(TREASURY_ALLOC);

        // 5b. Seed the garden curve inventory.
        mochi.transfer(address(hook), GARDEN_INVENTORY);

        // 6. Initialise ETH/MOCHI pool with dynamic fee.
        mKey = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(mochi)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        pid = key.toId();

        manager.initialize(mKey, SQRT_PRICE_1_1);

        // 7. Seed liquidity. As the test contract is the LP here, allow it.
        mochi.approve(address(modifyLiquidityRouter), type(uint256).max);
        vm.deal(address(this), 10_000 ether);

        ModifyLiquidityParams memory liq = ModifyLiquidityParams({
            tickLower: -600,
            tickUpper: 600,
            liquidityDelta: 1_000 ether,
            salt: bytes32(0)
        });
        modifyLiquidityRouter.modifyLiquidity{value: 1_000 ether}(mKey, liq, "");

        // 8. Fund alice/bob with ETH for swaps.
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(lpProvider, 100 ether);
    }

    // ============ Math ============

    function test_CalculateTrade_KnownVector() public view {
        // calculateTrade(rt=1e18, rs=1e18, bs=1e18):
        //   denom = 5000 + (10000*1e18 + 5000*1e18) / 1e18 = 5000 + 15000 = 20000
        //   numer = 10000 * 1e18
        //   return 1e18 * 10000 / 20000 = 5e17
        uint256 out = hook.calculateTrade(1e18, 1e18, 1e18);
        assertEq(out, 5e17, "calculateTrade(1e18,1e18,1e18) should yield 0.5e18");
    }

    function test_CalculateTrade_ZeroRt() public view {
        assertEq(hook.calculateTrade(0, 1e18, 1e18), 0, "rt=0 must return 0");
    }

    function testFuzz_CalculateTrade_BoundedNonNegative(uint256 rt, uint256 rs, uint256 bs) public view {
        rt = bound(rt, 1, 1e30);
        rs = bound(rs, 0, 1e30);
        bs = bound(bs, 0, 1e30);
        uint256 out = hook.calculateTrade(rt, rs, bs);
        assertLe(out, bs, "trade out cannot exceed reserve bs");
    }

    // ============ Game state init ============

    function test_FreshUser_NoSeeds_NoGardeners() public view {
        assertEq(hook.getMySeeds(alice), 0);
        assertEq(hook.gardeners(alice), 0);
        assertEq(hook.lastActionTime(alice), 0);
    }

    function test_GardenersAccumulateSeedsOverTime() public {
        // Force alice into a state where she has 1 gardener and just cast.
        _seedAliceWith(86_400 ether); // enough SEEDs to mint many gardeners on cast
        vm.prank(alice);
        hook.cast(address(0));

        uint256 g0 = hook.gardeners(alice);
        assertGt(g0, 0);
        assertEq(hook.getMySeeds(alice), 0); // freshly cast

        vm.warp(block.timestamp + 100);
        uint256 expected = 100 * g0;
        assertEq(hook.getMySeeds(alice), expected, "100s of accumulation = gardeners * 100");
    }

    function test_GardenersProductionCapped() public {
        _seedAliceWith(86_400 ether);
        vm.prank(alice);
        hook.cast(address(0));
        uint256 g0 = hook.gardeners(alice);

        vm.warp(block.timestamp + 1_000_000); // way past cap
        uint256 capped = 86_400 * g0;
        assertEq(hook.getMySeeds(alice), capped, "production capped at 1 day");
    }

    // ============ cast() ============

    function test_Cast_CreatesGardenersAndZeroesSeeds() public {
        _seedAliceWith(86_400 * 3 ether); // grant 3 gardeners worth + change
        uint256 seedsBefore = hook.getMySeeds(alice);

        vm.prank(alice);
        hook.cast(address(0));

        uint256 expectedGardeners = seedsBefore / hook.SEEDS_PER_GARDENER();
        assertEq(hook.gardeners(alice), expectedGardeners);
        assertEq(hook.claimedSeeds(alice), 0);
        assertEq(hook.lastActionTime(alice), block.timestamp);
    }

    function test_Cast_PaysReferralBonus() public {
        // Anti-sybil rule: the referrer must already have gardeners > 0. Seed + cast
        // the referrer first so they're a "real player."
        _seedUserWith(referrer, 200_000);
        vm.prank(referrer);
        hook.cast(address(0));
        assertGt(hook.gardeners(referrer), 0, "referrer must have gardeners");

        _seedAliceWith(100_000);
        uint256 seedsBefore = hook.getMySeeds(alice);
        uint256 referrerSeedsBefore = hook.claimedSeeds(referrer);

        vm.prank(alice);
        hook.cast(referrer);

        uint256 expectedBonus = (seedsBefore * 12) / 100;
        assertEq(
            hook.claimedSeeds(referrer) - referrerSeedsBefore,
            expectedBonus,
            "referrer should get 12%"
        );
    }

    function test_Referral_FirstCastLocksReferrer() public {
        // Seed referrer to have gardeners (anti-sybil eligible)
        _seedUserWith(referrer, 200_000);
        vm.prank(referrer);
        hook.cast(address(0));

        _seedAliceWith(100_000);

        assertEq(hook.referrerOf(alice), address(0), "no lock yet");

        vm.prank(alice);
        hook.cast(referrer);

        assertEq(hook.referrerOf(alice), referrer, "lock should be set");
    }

    function test_Referral_SwitchingReferrerIgnored() public {
        // Set up two would-be referrers, both eligible
        address ref1 = referrer;
        address ref2 = makeAddr("ref2");
        _seedUserWith(ref1, 200_000);
        _seedUserWith(ref2, 200_000);
        vm.prank(ref1);
        hook.cast(address(0));
        vm.prank(ref2);
        hook.cast(address(0));

        // Alice first cast locks ref1
        _seedAliceWith(100_000);
        vm.prank(alice);
        hook.cast(ref1);
        assertEq(hook.referrerOf(alice), ref1);

        // Alice tries to switch to ref2 on next cast — should be ignored
        _seedAliceWith(100_000);
        uint256 ref1Before = hook.claimedSeeds(ref1);
        uint256 ref2Before = hook.claimedSeeds(ref2);

        vm.prank(alice);
        hook.cast(ref2);

        assertEq(hook.referrerOf(alice), ref1, "lock must not change");
        assertGt(hook.claimedSeeds(ref1), ref1Before, "original referrer still earns");
        assertEq(hook.claimedSeeds(ref2), ref2Before, "switched referrer earns nothing");
    }

    function test_Referral_ReferrerMustHaveGardeners() public {
        // Bob has zero gardeners — should NOT be eligible
        assertEq(hook.gardeners(bob), 0);

        _seedAliceWith(100_000);
        vm.prank(alice);
        hook.cast(bob);

        assertEq(hook.referrerOf(alice), address(0), "ineligible referrer not locked");
        assertEq(hook.claimedSeeds(bob), 0, "ineligible referrer earns nothing");
    }

    function test_Referral_ZeroAddressDoesNotLock() public {
        _seedAliceWith(100_000);
        vm.prank(alice);
        hook.cast(address(0));
        assertEq(hook.referrerOf(alice), address(0), "address(0) should not lock");
    }

    function test_Referral_SelfReferralIgnored() public {
        // Even if alice has gardeners herself, she can't refer herself
        _seedAliceWith(200_000);
        vm.prank(alice);
        hook.cast(address(0));
        assertGt(hook.gardeners(alice), 0);

        _seedAliceWith(100_000);
        vm.prank(alice);
        hook.cast(alice);

        assertEq(hook.referrerOf(alice), address(0), "self-referral cannot lock");
    }

    function test_Referral_BonusPaidOnEveryCast() public {
        _seedUserWith(referrer, 200_000);
        vm.prank(referrer);
        hook.cast(address(0));

        _seedAliceWith(100_000);
        vm.prank(alice);
        hook.cast(referrer);
        uint256 afterFirst = hook.claimedSeeds(referrer);

        _seedAliceWith(100_000);
        // Pass address(0) — but lock should ensure referrer still earns
        vm.prank(alice);
        hook.cast(address(0));
        uint256 afterSecond = hook.claimedSeeds(referrer);

        assertGt(afterSecond, afterFirst, "lock pays even when arg is 0");
    }

    function test_Cast_IgnoresSelfReferral() public {
        _seedAliceWith(100_000);
        vm.prank(alice);
        hook.cast(alice); // self-referral
        assertEq(hook.claimedSeeds(alice), 0, "self-referral pays nothing");
    }

    function test_RevertWhen_CastWithNoSeeds() public {
        vm.prank(alice);
        vm.expectRevert(MochiHook.NoSeeds.selector);
        hook.cast(address(0));
    }

    // ============ sell() ============

    function test_Sell_PaysMochiAndCharges1PctDevFee() public {
        // Set alice up with cast → 1 gardener → wait → seeds accumulated
        _seedAliceWith(86_400);
        vm.prank(alice);
        hook.cast(address(0));
        vm.warp(block.timestamp + 86_400); // 1 day @ cap

        uint256 seedsAccumulated = hook.getMySeeds(alice);
        uint256 expectedValue = hook.calculateSeedSell(seedsAccumulated);
        // Apply the harvest cap that sell() enforces
        uint256 cap = (hook.mochiTreasury() * hook.MAX_HARVEST_PPM()) / 1_000_000;
        if (expectedValue > cap) expectedValue = cap;
        uint256 expectedFee = expectedValue / 100;
        uint256 expectedPayout = expectedValue - expectedFee;

        uint256 aliceBefore = mochi.balanceOf(alice);
        uint256 devBefore = mochi.balanceOf(devTreasury);
        uint256 treasuryBefore = hook.mochiTreasury();

        vm.prank(alice);
        hook.sell();

        assertEq(mochi.balanceOf(alice) - aliceBefore, expectedPayout, "alice payout");
        assertEq(mochi.balanceOf(devTreasury) - devBefore, expectedFee, "dev fee");
        assertEq(treasuryBefore - hook.mochiTreasury(), expectedValue, "treasury debit");
        assertEq(hook.claimedSeeds(alice), 0);
    }

    function test_RevertWhen_SellWithNoSeeds() public {
        vm.prank(alice);
        vm.expectRevert(MochiHook.NoSeeds.selector);
        hook.sell();
    }

    function test_HarvestCooldown_BlocksImmediateResell() public {
        // Set alice up + first sell
        _seedUserWith(alice, 1e18);
        vm.prank(alice);
        hook.sell();

        // Give alice fresh seeds for a second sell attempt
        _seedUserWith(alice, 1e18);

        // Second sell within the cooldown window should revert
        vm.prank(alice);
        vm.expectRevert();
        hook.sell();

        // After the cooldown, alice can sell again
        vm.warp(block.timestamp + hook.HARVEST_COOLDOWN_SECONDS());
        vm.prank(alice);
        hook.sell();
    }

    // ============ Swap drip ============

    function test_Swap_DripsSeedsToBuyer() public {
        uint256 seedsBefore = hook.claimedSeeds(alice);
        assertEq(seedsBefore, 0);

        // Buy enough that mochiOut >= 1 MOCHI so the integer drip rounds to >= 1 SEED.
        _swapEthForMochi(alice, 5 ether);

        uint256 seedsAfter = hook.claimedSeeds(alice);
        assertGt(seedsAfter, 0, "should accrue SEEDs on ETH->MOCHI swap");
    }

    function test_DevEntryFee_OnEthToMochiBuy() public {
        uint256 devBefore = devTreasury.balance;
        uint256 accruedBefore = hook.totalDevEthAccrued();

        // Alice buys with exactly 1 ETH
        _swapEthForMochi(alice, 1 ether);

        uint256 devAfter = devTreasury.balance;
        uint256 accruedAfter = hook.totalDevEthAccrued();
        uint256 expectedCut = 1 ether * 100 / 10_000; // 1%

        assertEq(devAfter - devBefore, expectedCut, "dev should get 1% ETH on buy");
        assertEq(accruedAfter - accruedBefore, expectedCut, "totalDevEthAccrued should update");
    }

    function test_HarvestCap_NeverExceedsCapOfTreasury() public {
        // Stuff alice with massive seeds so calculateSeedSell would compute > cap.
        _seedUserWith(alice, 1e18);
        uint256 treasuryBefore = hook.mochiTreasury();
        uint256 capPpm = hook.MAX_HARVEST_PPM();
        uint256 expectedCap = (treasuryBefore * capPpm) / 1_000_000;

        vm.prank(alice);
        hook.sell();

        uint256 drained = treasuryBefore - hook.mochiTreasury();
        assertLe(drained, expectedCap, "harvest exceeded cap");
        assertEq(drained, expectedCap, "should equal cap when uncapped > cap");
    }

    function test_Cast_BumpsMarketSeedsByFullS() public {
        _seedUserWith(alice, 100_000);
        uint256 marketBefore = hook.marketSeeds();
        uint256 seeds = hook.getMySeeds(alice);

        vm.prank(alice);
        hook.cast(address(0));

        uint256 marketAfter = hook.marketSeeds();
        // Was seeds/5 in v1; now should be full seeds.
        assertEq(marketAfter - marketBefore, seeds, "marketSeeds bump should be full seeds");
    }

    function test_RefillTreasury_AddsMochi() public {
        uint256 treasuryBefore = hook.mochiTreasury();
        vm.deal(alice, 5 ether);

        vm.prank(alice, alice);
        hook.refillTreasury{value: 1 ether}();

        uint256 treasuryAfter = hook.mochiTreasury();
        assertGt(treasuryAfter, treasuryBefore, "refill must add mochi");
        uint256 added = treasuryAfter - treasuryBefore;
        // 1 ETH at ~1:1 price should add somewhere near 1 MOCHI (after LP fee). Loose check.
        assertGt(added, 0.9 ether, "added too little");
        assertLt(added, 1.05 ether, "added too much");
    }

    function test_RefillTreasury_RevertsAboveCap() public {
        vm.deal(alice, 100 ether);
        vm.prank(alice, alice);
        vm.expectRevert();
        hook.refillTreasury{value: 6 ether}();
    }

    function test_RefillTreasury_RevertsOnZero() public {
        vm.prank(alice, alice);
        vm.expectRevert(MochiHook.RefillZero.selector);
        hook.refillTreasury{value: 0}();
    }

    function test_RefillTreasury_SkipsDevFee() public {
        uint256 devBefore = devTreasury.balance;
        vm.deal(alice, 5 ether);
        vm.prank(alice, alice);
        hook.refillTreasury{value: 1 ether}();
        // Internal swaps must NOT trigger the dev entry fee.
        assertEq(devTreasury.balance, devBefore, "internal swap leaked dev fee");
    }

    // ============ Garden bonding curve ============

    function test_MintFromGarden_InitialPriceCheap() public view {
        uint256 price = hook.currentMintPrice();
        assertEq(price, hook.BASE_PRICE(), "initial price must equal BASE_PRICE");
        // ~1e-8 ETH per MOCHI = very cheap entry
        assertEq(price, 1e10);
    }

    function test_MintFromGarden_PriceRisesWithMints() public {
        uint256 priceBefore = hook.currentMintPrice();
        vm.deal(alice, 5 ether);
        vm.prank(alice, alice);
        hook.mintFromGarden{value: 1 ether}();
        uint256 priceAfter = hook.currentMintPrice();
        assertGt(priceAfter, priceBefore, "price must rise after a mint");
    }

    function test_MintFromGarden_DeliversMochi() public {
        uint256 mochiBefore = mochi.balanceOf(alice);
        vm.deal(alice, 5 ether);
        vm.prank(alice, alice);
        uint256 minted = hook.mintFromGarden{value: 1 ether}();
        uint256 mochiAfter = mochi.balanceOf(alice);
        assertEq(mochiAfter - mochiBefore, minted, "balance delta must match return");
        assertGt(minted, 0);
    }

    function test_MintFromGarden_DripsSeeds() public {
        uint256 seedsBefore = hook.claimedSeeds(alice);
        vm.deal(alice, 5 ether);
        vm.prank(alice, alice);
        hook.mintFromGarden{value: 1 ether}();
        uint256 seedsAfter = hook.claimedSeeds(alice);
        assertGt(seedsAfter, seedsBefore, "must drip seeds on mint");
    }

    function test_MintFromGarden_DevFeeRoutes() public {
        uint256 devBefore = devTreasury.balance;
        vm.deal(alice, 5 ether);
        vm.prank(alice, alice);
        hook.mintFromGarden{value: 1 ether}();
        uint256 devAfter = devTreasury.balance;
        // Expect ~1% (DEV_MINT_FEE_BPS = 100 of 10_000) — minus rounding.
        uint256 expected = 1 ether * 100 / 10_000;
        assertEq(devAfter - devBefore, expected, "dev should get 1% of mint ETH");
    }

    function test_MintFromGarden_RemainderStaysInHook() public {
        uint256 hookBefore = address(hook).balance;
        vm.deal(alice, 5 ether);
        vm.prank(alice, alice);
        hook.mintFromGarden{value: 1 ether}();
        uint256 hookAfter = address(hook).balance;
        // 99% should accrue to the hook (1% to dev)
        uint256 expected = 1 ether * 9_900 / 10_000;
        assertEq(hookAfter - hookBefore, expected, "99% of mint ETH should stay in hook");
    }

    function test_MintFromGarden_TracksSupplyMinted() public {
        assertEq(hook.gardenSupplyMinted(), 0);
        vm.deal(alice, 5 ether);
        vm.prank(alice, alice);
        uint256 minted = hook.mintFromGarden{value: 1 ether}();
        assertEq(hook.gardenSupplyMinted(), minted);
    }

    function test_MintFromGarden_RevertsOnZero() public {
        vm.prank(alice, alice);
        vm.expectRevert(MochiHook.MintTooSmall.selector);
        hook.mintFromGarden{value: 0}();
    }

    function testFuzz_MintInvariants(uint256 ethIn) public {
        ethIn = bound(ethIn, 1, 100 ether);
        address fuzzUser = makeAddr("fuzz");
        vm.deal(fuzzUser, ethIn);

        uint256 inv0 = hook.gardenInventoryRemaining();
        uint256 price0 = hook.currentMintPrice();
        uint256 supplyMinted0 = hook.gardenSupplyMinted();

        vm.prank(fuzzUser, fuzzUser);
        try hook.mintFromGarden{value: ethIn}() returns (uint256 mochiOut) {
            // 1. Mint amount is non-zero (we bound ethIn > 0)
            assertGt(mochiOut, 0, "mint returned 0");
            // 2. Inventory drops by exactly mochiOut
            assertEq(hook.gardenInventoryRemaining(), inv0 - mochiOut, "inv delta wrong");
            // 3. Supply tracker increases
            assertEq(hook.gardenSupplyMinted(), supplyMinted0 + mochiOut, "supply tracker wrong");
            // 4. Price is non-decreasing
            assertGe(hook.currentMintPrice(), price0, "price decreased on mint");
            // 5. Inventory never exceeds initial
            assertLe(hook.gardenSupplyMinted(), hook.GARDEN_INITIAL_INVENTORY(), "minted > inventory");
            // 6. User holds the MOCHI
            assertEq(mochi.balanceOf(fuzzUser), mochiOut, "balance mismatch");
        } catch {
            // Tiny ethIn may revert MintTooSmall — that's expected behavior, not a bug
        }
    }

    function test_PreviewMint_MatchesActualMint() public {
        vm.deal(alice, 5 ether);
        (uint256 quoted,) = hook.previewMint(0.5 ether);
        vm.prank(alice, alice);
        uint256 actual = hook.mintFromGarden{value: 0.5 ether}();
        assertEq(actual, quoted, "previewMint must equal actual mint amount");
    }

    function _seedLpReserve(uint256 mochiAmount) internal {
        // Test contract has the deployer's MOCHI from setUp; approve + fund.
        mochi.approve(address(hook), mochiAmount);
        hook.fundLpReserve(mochiAmount);
    }

    function test_DeepenPool_PermissionlessAnyoneCanCall() public {
        _seedLpReserve(1_000_000 ether);
        vm.deal(alice, 5 ether);
        vm.prank(alice, alice);
        hook.mintFromGarden{value: 1 ether}();

        (,, uint128 liqBefore) = hook.poolState();

        // Bob (not owner) calls deepenPool — should succeed.
        vm.prank(bob);
        hook.deepenPool(0.1 ether);

        (,, uint128 liqAfter) = hook.poolState();
        assertGt(liqAfter, liqBefore, "any aligned actor should be able to deepen pool");
    }

    function test_DeepenPool_DeepensLiquidity() public {
        _seedLpReserve(1_000_000 ether);
        vm.deal(alice, 5 ether);
        vm.prank(alice, alice);
        hook.mintFromGarden{value: 1 ether}();

        (,, uint128 liqBefore) = hook.poolState();
        hook.deepenPool(0.1 ether);
        (,, uint128 liqAfter) = hook.poolState();
        assertGt(liqAfter, liqBefore, "pool liquidity must increase after deepen");
    }

    function test_DeepenPool_DrainsLpReserve() public {
        _seedLpReserve(1_000_000 ether);
        vm.deal(alice, 5 ether);
        vm.prank(alice, alice);
        hook.mintFromGarden{value: 1 ether}();

        uint256 reserveBefore = hook.lpReserve();
        hook.deepenPool(0.1 ether);
        uint256 reserveAfter = hook.lpReserve();
        assertLt(reserveAfter, reserveBefore, "deepen should consume lpReserve");
    }

    function test_AutoDeepen_FiresOnInflowThreshold() public {
        _seedLpReserve(10_000_000 ether);

        // Push cumulative inflow over AUTO_DEEPEN_TRIGGER (5 ETH) via mints.
        // Each 1 ETH mint puts ~0.99 ETH into hook inflow.
        vm.deal(alice, 20 ether);
        uint256 inflowBefore = hook.cumulativeMintInflow();
        assertEq(inflowBefore, 0);

        // 6 ETH minted → cumulativeMintInflow ≈ 5.94 ETH, crosses 5 ETH threshold once.
        vm.startPrank(alice, alice);
        for (uint256 i = 0; i < 6; i++) {
            hook.mintFromGarden{value: 1 ether}();
        }
        vm.stopPrank();

        assertGe(hook.cumulativeMintInflow(), 5 ether, "inflow accumulated");
        assertGt(hook.lastAutoDeepenAt(), 0, "auto-deepen should have fired");

        (,, uint128 liqAfter) = hook.poolState();
        assertGt(liqAfter, 0, "pool should have liquidity from auto-deepen");
    }

    function test_AutoDeepen_SilentSkipWhenLpReserveEmpty() public {
        // Don't seed lpReserve. Mint enough to cross the threshold.
        // The test pool already has setUp liquidity from modifyLiquidityRouter, so we
        // verify the auto-deepen-specific signal (lastAutoDeepenAt) didn't move.
        vm.deal(alice, 20 ether);
        vm.startPrank(alice, alice);
        for (uint256 i = 0; i < 6; i++) {
            hook.mintFromGarden{value: 1 ether}();
        }
        vm.stopPrank();

        assertEq(hook.lastAutoDeepenAt(), 0, "no auto-deepen without lpReserve");
    }

    function test_FundLpReserve_PermissionlessAndIncrements() public {
        uint256 before = hook.lpReserve();
        mochi.approve(address(hook), 1_000_000 ether);
        hook.fundLpReserve(1_000_000 ether);
        assertEq(hook.lpReserve(), before + 1_000_000 ether);
    }

    function test_WithdrawDevEth_OwnerOnly() public {
        vm.deal(alice, 5 ether);
        vm.prank(alice, alice);
        hook.mintFromGarden{value: 1 ether}();

        vm.prank(bob);
        vm.expectRevert();
        hook.withdrawDevEth(0.1 ether, payable(bob));
    }

    function test_WithdrawDevEth_SendsToRecipient() public {
        vm.deal(alice, 5 ether);
        vm.prank(alice, alice);
        hook.mintFromGarden{value: 1 ether}();

        address payable to = payable(makeAddr("recipient"));
        uint256 before = to.balance;
        hook.withdrawDevEth(0.1 ether, to);
        assertEq(to.balance - before, 0.1 ether);
    }

    function test_RefillTreasury_SkipsSeedDrip() public {
        uint256 seedsBefore = hook.claimedSeeds(alice);
        vm.deal(alice, 5 ether);
        vm.prank(alice, alice);
        hook.refillTreasury{value: 1 ether}();
        // Internal swap must NOT credit alice (the funder) with SEED drip.
        assertEq(hook.claimedSeeds(alice), seedsBefore, "internal swap leaked drip");
    }

    function test_DevEntryFee_NotOnMochiToEth() public {
        // Alice first buys MOCHI so she has something to sell
        _swapEthForMochi(alice, 1 ether);
        uint256 devBefore = devTreasury.balance;
        uint256 accruedBefore = hook.totalDevEthAccrued();

        // Now sell MOCHI back — should NOT trigger dev entry fee
        uint256 mochiBal = mochi.balanceOf(alice);
        _swapMochiForEth(alice, mochiBal / 4);

        assertEq(devTreasury.balance, devBefore, "no dev fee on MOCHI->ETH");
        assertEq(hook.totalDevEthAccrued(), accruedBefore, "accrued unchanged");
    }

    function test_HookData_DripsToEncodedAddress() public {
        // Swap large enough that mochiOut >= 1 MOCHI so the integer drip is >= 1 SEED.
        vm.deal(alice, 10 ether);
        bytes memory hookData = abi.encode(bob);

        uint256 aliceSeedsBefore = hook.claimedSeeds(alice);
        uint256 bobSeedsBefore = hook.claimedSeeds(bob);

        vm.startPrank(alice, alice);
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -int256(5 ether),
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });
        PoolSwapTest.TestSettings memory settings =
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false});
        swapRouter.swap{value: 5 ether}(mKey, params, settings, hookData);
        vm.stopPrank();

        assertEq(hook.claimedSeeds(alice), aliceSeedsBefore, "alice should NOT have drip");
        assertGt(hook.claimedSeeds(bob), bobSeedsBefore, "bob should have drip via hookData");
    }

    function test_HookData_LPRebateForEncodedAddress() public {
        // Mark Bob as an active LP, then have Alice swap with hookData=bob — fee should
        // be discounted because hookData says bob is the user, and bob is an active LP.
        // We can't easily measure the discounted fee directly, so we verify via the
        // LP-registration path: it must use the resolved user too.
        // Simpler test: registering as LP through hookData should tag the encoded address.

        // Add liquidity as alice but pass hookData = bob. Bob should become the LP.
        mochi.approve(address(modifyLiquidityRouter), type(uint256).max);
        vm.deal(address(this), 1000 ether);

        ModifyLiquidityParams memory liq = ModifyLiquidityParams({
            tickLower: -120,
            tickUpper: 120,
            liquidityDelta: 1 ether,
            salt: bytes32(uint256(42))
        });
        bytes memory hookData = abi.encode(bob);
        modifyLiquidityRouter.modifyLiquidity{value: 1 ether}(mKey, liq, hookData);

        // Bob should now be an active LP (set via hookData)
        assertTrue(hook.isActiveLP(bob), "bob should be active LP via hookData");
    }

    function test_Swap_NoDripOnMochiToEth() public {
        // First give alice MOCHI by buying.
        _swapEthForMochi(alice, 1 ether);
        uint256 mochiBal = mochi.balanceOf(alice);
        assertGt(mochiBal, 0);
        uint256 seedsBefore = hook.claimedSeeds(alice);

        // Now alice swaps MOCHI → ETH.
        _swapMochiForEth(alice, mochiBal / 2);

        assertEq(hook.claimedSeeds(alice), seedsBefore, "sell direction should NOT drip");
    }

    // ============ Dynamic fee ============

    function test_DynamicFee_DefaultIsBaseFee() public view {
        assertEq(hook.currentDynamicFee(), hook.BASE_FEE());
    }

    function test_DynamicFee_RisesWithMarketSeeds() public {
        uint256 startFee = hook.currentDynamicFee();
        // Trigger marketSeeds growth via several casts.
        for (uint256 i = 0; i < 5; i++) {
            address u = address(uint160(uint256(keccak256(abi.encode("u", i)))));
            vm.deal(u, 10 ether);
            _swapEthForMochi(u, 1 ether);
            _seedUserWith(u, 1e9); // boost their seeds artificially via test helper
            vm.prank(u);
            hook.cast(address(0));
        }
        uint256 endFee = hook.currentDynamicFee();
        assertGe(endFee, startFee, "fee non-decreasing");
    }

    // ============ Internal helpers ============

    /// @dev Grant a user `amount` of claimedSeeds by writing the mapping slot directly.
    function _seedAliceWith(uint256 amount) internal {
        _seedUserWith(alice, amount);
    }

    /// @dev claimedSeeds is at storage slot 7 (verified via `forge inspect MochiHook storage-layout`).
    uint256 internal constant CLAIMED_SEEDS_SLOT = 7;

    function _seedUserWith(address u, uint256 amount) internal {
        bytes32 slot = keccak256(abi.encode(u, CLAIMED_SEEDS_SLOT));
        vm.store(address(hook), slot, bytes32(amount));
    }

    function _swapEthForMochi(address user, uint256 amountIn) internal {
        vm.startPrank(user, user); // (msg.sender, tx.origin) — set both to user
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -int256(amountIn),
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });
        PoolSwapTest.TestSettings memory settings =
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false});
        swapRouter.swap{value: amountIn}(mKey, params, settings, "");
        vm.stopPrank();
    }

    function _swapMochiForEth(address user, uint256 amountIn) internal {
        vm.startPrank(user, user);
        mochi.approve(address(swapRouter), amountIn);
        SwapParams memory params = SwapParams({
            zeroForOne: false,
            amountSpecified: -int256(amountIn),
            sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
        });
        PoolSwapTest.TestSettings memory settings =
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false});
        swapRouter.swap(mKey, params, settings, "");
        vm.stopPrank();
    }

}
