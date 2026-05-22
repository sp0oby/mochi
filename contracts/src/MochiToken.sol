// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MochiToken
/// @notice $MOCHI — the tradable ERC20 paired with ETH in the Uniswap v4 pool for Mochi Garden.
/// @dev Mintable by a single `minter` (the MochiHook), set once after deployment and then frozen.
///      Initial supply is minted to the deployer at construction for pool seeding + treasury.
contract MochiToken is ERC20, ERC20Permit, Ownable {
    address public minter;
    bool public minterFrozen;

    event MinterSet(address indexed minter);
    event MinterFrozen();

    error NotMinter();
    error MinterAlreadyFrozen();
    error ZeroAddress();

    constructor(uint256 initialSupply, address recipient)
        ERC20("Mochi Garden", "MOCHI")
        ERC20Permit("Mochi Garden")
        Ownable(msg.sender)
    {
        if (recipient == address(0)) revert ZeroAddress();
        _mint(recipient, initialSupply);
    }

    function setMinter(address _minter) external onlyOwner {
        if (minterFrozen) revert MinterAlreadyFrozen();
        if (_minter == address(0)) revert ZeroAddress();
        minter = _minter;
        emit MinterSet(_minter);
    }

    function freezeMinter() external onlyOwner {
        minterFrozen = true;
        emit MinterFrozen();
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        _mint(to, amount);
    }
}
