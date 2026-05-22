// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

import {HookMiner} from "v4-hooks-public/utils/HookMiner.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MochiToken} from "../src/MochiToken.sol";
import {MochiHook} from "../src/MochiHook.sol";

/// @notice Deploy MOCHI + MochiHook to a chain (Anvil for now, Base Sepolia tomorrow).
/// @dev    On Anvil/local: pass --broadcast and let it deploy a fresh PoolManager too.
///         On a chain with v4 already deployed: pass `POOL_MANAGER` env var.
contract DeployMochi is Script {
    /// @dev CREATE2 Deployer Proxy — works on every EVM chain, used so the hook lands at
    ///      the right vanity address regardless of deployer nonce.
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    /// @dev Initial MOCHI supply: 1 billion.
    uint256 constant INITIAL_SUPPLY = 1_000_000_000 ether;

    /// @dev Allocation of the fixed 1B supply:
    ///        200M (20%) → game treasury (harvest payouts)
    ///        700M (70%) → garden curve inventory (sold via mintFromGarden)
    ///         75M (7.5%) → lpReserve in hook (used by auto-deepen + manual deepenPool)
    ///         25M (2.5%) → deployer wallet (team / airdrops / future ops)
    uint256 constant TREASURY_ALLOC = 200_000_000 ether;
    uint256 constant GARDEN_INVENTORY = 700_000_000 ether;
    uint256 constant LP_RESERVE_ALLOC = 75_000_000 ether;

    /// @dev Initial pool sqrtPriceX96 — matches the curve's BASE_PRICE so there's no
    ///      arbitrage gap at launch.
    ///      BASE_PRICE = 1e10 wei/MOCHI → 1 ETH (1e18 wei) buys 1e8 MOCHI tokens →
    ///      ratio token1/token0 in raw wei = 1e26/1e18 = 1e8 → sqrt(1e8) = 1e4.
    ///      sqrtPriceX96 = 1e4 × 2^96.
    uint160 constant SQRT_PRICE_CURVE_START = uint160(10_000) * uint160(79228162514264337593543950336);

    function run() external returns (MochiToken mochi, MochiHook hook, PoolManager pm, PoolKey memory key) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address devTreasury = vm.envOr("DEV_TREASURY", deployer);

        // 1. Resolve PoolManager — env override OR deploy fresh (local/anvil).
        address pmAddr = vm.envOr("POOL_MANAGER", address(0));

        vm.startBroadcast(pk);

        if (pmAddr == address(0)) {
            pm = new PoolManager(deployer);
            console.log("Deployed fresh PoolManager:", address(pm));
        } else {
            pm = PoolManager(pmAddr);
            console.log("Using existing PoolManager:", address(pm));
        }

        // 2. Deploy MOCHI token, full supply to deployer.
        mochi = new MochiToken(INITIAL_SUPPLY, deployer);
        console.log("Deployed MochiToken:", address(mochi));

        vm.stopBroadcast();

        // 3. Mine a salt so the hook lands at an address with the right permission bits.
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );

        (address predicted, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(MochiHook).creationCode,
            abi.encode(IPoolManager(address(pm)), mochi, devTreasury, deployer)
        );
        console.log("Mined hook address:", predicted);
        console.logBytes32(salt);

        // 4. Deploy hook via CREATE2 deployer.
        vm.startBroadcast(pk);

        hook = new MochiHook{salt: salt}(IPoolManager(address(pm)), mochi, devTreasury, deployer);
        require(address(hook) == predicted, "hook address mismatch");
        console.log("Deployed MochiHook:", address(hook));

        // 5. Authorize hook to mint MOCHI (currently disabled — we use treasury, not minting).
        //    Reserved for future mechanics.

        // 6. Fund hook treasury (harvest payouts) + seed garden curve inventory.
        mochi.approve(address(hook), TREASURY_ALLOC);
        hook.fundTreasury(TREASURY_ALLOC);
        console.log("Funded hook treasury:", TREASURY_ALLOC / 1e18, "MOCHI");

        // Garden inventory: just transfer MOCHI to the hook. The hook tracks
        // GARDEN_INITIAL_INVENTORY as a constant; deploy is responsible for putting that
        // much MOCHI in the hook's balance so mints can deliver tokens.
        require(GARDEN_INVENTORY == hook.GARDEN_INITIAL_INVENTORY(), "garden alloc mismatch");
        mochi.transfer(address(hook), GARDEN_INVENTORY);
        console.log("Seeded garden curve inventory:", GARDEN_INVENTORY / 1e18, "MOCHI");

        // Pre-fund the LP reserve so the auto-deepen flywheel works from day 1 without
        // any manual setup. Deployer keeps the remaining 25M MOCHI for team / airdrops.
        mochi.approve(address(hook), LP_RESERVE_ALLOC);
        hook.fundLpReserve(LP_RESERVE_ALLOC);
        console.log("Pre-funded LP reserve:", LP_RESERVE_ALLOC / 1e18, "MOCHI");

        // 7. Initialize ETH/MOCHI pool with dynamic fee + the hook.
        key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(mochi)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        pm.initialize(key, SQRT_PRICE_CURVE_START);
        console.log("Initialized ETH/MOCHI pool with hook at curve-start price");

        // 8. Deploy protocol-controlled test routers (PoolModifyLiquidityTest + PoolSwapTest).
        //    These are not Anvil-only — they're plain contracts that just call PoolManager.
        //    Deploying them on Sepolia / mainnet gives our frontend a stable, contract-level
        //    routing surface without depending on Uniswap's Universal Router for v1.
        PoolModifyLiquidityTest mlt = new PoolModifyLiquidityTest(IPoolManager(address(pm)));
        address liqRouter = address(mlt);
        console.log("Deployed liquidity router:", liqRouter);

        PoolSwapTest swt = new PoolSwapTest(IPoolManager(address(pm)));
        address swapRouterAddr = address(swt);
        console.log("Deployed swap router:", swapRouterAddr);

        // 9. Initial liquidity. Per deployer preference: NO auto-seed on real chains.
        //    Deployer adds LP manually via the frontend Liquidity panel using the 100M
        //    MOCHI from deployment + accumulated mint-fee ETH. This gives full control
        //    over pool depth and timing.
        //    Anvil keeps a generous auto-seed because local dev wants something playable
        //    right after deploy. Override with `SEED_ETH=...` env var to force a seed on
        //    any chain.
        uint256 seedEth;
        if (block.chainid == 31337) {
            seedEth = vm.envOr("SEED_ETH", uint256(1_000 ether));
        } else {
            seedEth = vm.envOr("SEED_ETH", uint256(0));
        }

        if (seedEth > 0) {
            mochi.approve(liqRouter, type(uint256).max);
            // At our curve-start price (1 ETH = 100M MOCHI), matching MOCHI = seedEth × 1e8.
            uint256 seedMochi = seedEth * 100_000_000;
            _seedInitialLiquidity(mlt, key, seedEth, seedMochi);
            console.log("Seeded liquidity: ETH (wei):", seedEth);
            console.log("                  MOCHI (wei):", seedMochi);
        } else {
            console.log("Skipped liquidity seeding (deployer can add via Liquidity panel after)");
        }

        vm.stopBroadcast();

        _writeDeployment(devTreasury, address(pm), address(mochi), address(hook), liqRouter, swapRouterAddr);
    }

    function _seedInitialLiquidity(
        PoolModifyLiquidityTest mlt,
        PoolKey memory key,
        uint256 seedEth,
        uint256 seedMochi
    ) internal {
        // Pick a tick range around the current pool tick, rounded to tickSpacing 60.
        // At our curve-start price (1 ETH = 100M MOCHI), the current tick is ~184_207.
        int24 currentTick = TickMath.getTickAtSqrtPrice(SQRT_PRICE_CURVE_START);
        // Round to nearest tickSpacing 60.
        int24 spacing = 60;
        int24 alignedTick = (currentTick / spacing) * spacing;
        int24 tickLower = alignedTick - 3_000; // ~26% below
        int24 tickUpper = alignedTick + 3_000; // ~35% above

        uint160 sqrtPriceA = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtPriceB = TickMath.getSqrtPriceAtTick(tickUpper);

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            SQRT_PRICE_CURVE_START,
            sqrtPriceA,
            sqrtPriceB,
            seedEth,
            seedMochi
        );

        ModifyLiquidityParams memory liq = ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: int256(uint256(liquidity)),
            salt: bytes32(0)
        });
        mlt.modifyLiquidity{value: seedEth}(key, liq, "");
    }

    function _writeDeployment(
        address devTreasury,
        address pmAddr,
        address mochiAddr,
        address hookAddr,
        address liqRouter,
        address swapRouterAddr
    ) internal {
        string memory j = "{\n";
        j = string.concat(j, '  "chainId": ', vm.toString(block.chainid), ",\n");
        j = string.concat(j, '  "poolManager": "', vm.toString(pmAddr), '",\n');
        j = string.concat(j, '  "mochi": "', vm.toString(mochiAddr), '",\n');
        j = string.concat(j, '  "hook": "', vm.toString(hookAddr), '",\n');
        j = string.concat(j, '  "devTreasury": "', vm.toString(devTreasury), '",\n');
        j = string.concat(j, '  "liquidityRouter": "', vm.toString(liqRouter), '",\n');
        j = string.concat(j, '  "swapRouter": "', vm.toString(swapRouterAddr), '",\n');
        j = string.concat(j, '  "currency0": "0x0000000000000000000000000000000000000000",\n');
        j = string.concat(j, '  "currency1": "', vm.toString(mochiAddr), '",\n');
        j = string.concat(j, '  "fee": 8388608,\n');
        j = string.concat(j, '  "tickSpacing": 60\n');
        j = string.concat(j, "}\n");
        string memory path = string.concat("./deployments/", vm.toString(block.chainid), ".json");
        vm.writeFile(path, j);
        console.log("Wrote deployment to:", path);
    }
}
