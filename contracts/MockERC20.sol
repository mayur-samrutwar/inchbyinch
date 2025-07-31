// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _setupDecimals(decimals_);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    // For OpenZeppelin >=4.5, decimals is immutable, so override if needed
    uint8 private _customDecimals;
    function _setupDecimals(uint8 decimals_) internal {
        _customDecimals = decimals_;
    }
    function decimals() public view override returns (uint8) {
        return _customDecimals == 0 ? 18 : _customDecimals;
    }
}