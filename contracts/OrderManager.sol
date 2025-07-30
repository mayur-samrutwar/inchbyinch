// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IOrderManager.sol";

/**
 * @title OrderManager
 * @notice Manages order tracking and strategy information for inchbyinch
 * @dev Handles all order lifecycle events and strategy metadata
 */
contract OrderManager is IOrderManager, Ownable, ReentrancyGuard, Pausable {
    // Storage
    mapping(bytes32 => OrderInfo) private _orders;
    mapping(address => StrategyInfo) private _strategies;
    mapping(address => bytes32[]) private _botOrders;
    mapping(address => bytes32[]) private _botActiveOrders;
    
    // Counters
    mapping(address => uint256) private _botOrderCounters;
    
    // Access control
    mapping(address => bool) private _authorizedBots;
    
    // Events
    event BotAuthorized(address indexed bot, address indexed owner);
    event BotDeauthorized(address indexed bot);
    
    // Errors
    error OrderNotFound();
    error OrderAlreadyExists();
    error StrategyNotFound();
    error UnauthorizedBot();
    error InvalidOrderData();
    error InvalidStrategyType();
    error OrderAlreadyFilled();
    error OrderAlreadyCanceled();
    error ZeroAddress();
    error ZeroAmount();
    
    // Modifiers
    modifier onlyAuthorizedBot() {
        if (!_authorizedBots[msg.sender]) revert UnauthorizedBot();
        _;
    }
    
    modifier orderExists(bytes32 orderHash) {
        if (_orders[orderHash].orderHash == bytes32(0)) revert OrderNotFound();
        _;
    }
    
    modifier orderActive(bytes32 orderHash) {
        if (!_orders[orderHash].isActive) revert OrderAlreadyCanceled();
        _;
    }
    
    modifier validAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress();
        _;
    }
    
    modifier validAmount(uint256 amount) {
        if (amount == 0) revert ZeroAmount();
        _;
    }
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice Authorizes a bot to register orders
     * @param bot The bot address to authorize
     */
    function authorizeBot(address bot) external onlyOwner validAddress(bot) {
        _authorizedBots[bot] = true;
        emit BotAuthorized(bot, msg.sender);
    }
    
    /**
     * @notice Deauthorizes a bot
     * @param bot The bot address to deauthorize
     */
    function deauthorizeBot(address bot) external onlyOwner validAddress(bot) {
        _authorizedBots[bot] = false;
        emit BotDeauthorized(bot);
    }
    
    /**
     * @notice Registers a new order
     * @param orderHash The hash of the order
     * @param bot The bot address
     * @param makerAsset The maker asset address
     * @param takerAsset The taker asset address
     * @param makingAmount The making amount
     * @param takingAmount The taking amount
     * @return orderIndex The index of the registered order
     */
    function registerOrder(
        bytes32 orderHash,
        address bot,
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount
    ) external override onlyAuthorizedBot validAddress(bot) validAddress(makerAsset) validAddress(takerAsset) validAmount(makingAmount) validAmount(takingAmount) returns (uint256 orderIndex) {
        // Check if order already exists
        if (_orders[orderHash].orderHash != bytes32(0)) revert OrderAlreadyExists();
        
        // Validate bot authorization
        if (!_authorizedBots[bot]) revert UnauthorizedBot();
        
        // Get order index for this bot
        orderIndex = _botOrderCounters[bot]++;
        
        // Create order info
        OrderInfo memory orderInfo = OrderInfo({
            orderHash: orderHash,
            bot: bot,
            makerAsset: makerAsset,
            takerAsset: takerAsset,
            makingAmount: makingAmount,
            takingAmount: takingAmount,
            remainingAmount: makingAmount,
            orderIndex: orderIndex,
            isActive: true,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp
        });
        
        // Store order
        _orders[orderHash] = orderInfo;
        _botOrders[bot].push(orderHash);
        _botActiveOrders[bot].push(orderHash);
        
        // Update strategy if exists
        if (_strategies[bot].bot != address(0)) {
            _strategies[bot].totalOrders++;
            _strategies[bot].activeOrders++;
            _strategies[bot].lastUpdated = block.timestamp;
        }
        
        emit OrderRegistered(
            orderHash,
            bot,
            orderIndex,
            makerAsset,
            takerAsset,
            makingAmount,
            takingAmount
        );
    }
    
    /**
     * @notice Updates order fill status
     * @param orderHash The hash of the order
     * @param filledAmount The amount that was filled
     * @param remainingAmount The remaining amount
     */
    function updateOrderFill(
        bytes32 orderHash,
        uint256 filledAmount,
        uint256 remainingAmount
    ) external override onlyAuthorizedBot orderExists(orderHash) orderActive(orderHash) {
        OrderInfo storage order = _orders[orderHash];
        
        // Validate fill amounts
        if (filledAmount > order.makingAmount) revert InvalidOrderData();
        if (remainingAmount > order.remainingAmount) revert InvalidOrderData();
        if (filledAmount + remainingAmount != order.remainingAmount) revert InvalidOrderData();
        
        // Update order
        order.remainingAmount = remainingAmount;
        order.lastUpdated = block.timestamp;
        
        // Update strategy
        if (_strategies[order.bot].bot != address(0)) {
            _strategies[order.bot].totalFilled += filledAmount;
            _strategies[order.bot].lastUpdated = block.timestamp;
        }
        
        // If order is fully filled, mark as inactive
        if (remainingAmount == 0) {
            order.isActive = false;
            _removeFromActiveOrders(order.bot, orderHash);
            
            if (_strategies[order.bot].bot != address(0)) {
                _strategies[order.bot].activeOrders--;
            }
        }
        
        emit OrderFilled(
            orderHash,
            order.bot,
            order.orderIndex,
            filledAmount,
            remainingAmount
        );
    }
    
    /**
     * @notice Cancels an order
     * @param orderHash The hash of the order
     */
    function cancelOrder(bytes32 orderHash) external override onlyAuthorizedBot orderExists(orderHash) orderActive(orderHash) {
        OrderInfo storage order = _orders[orderHash];
        
        // Validate bot authorization for this order
        if (!_authorizedBots[order.bot]) revert UnauthorizedBot();
        
        // Mark order as inactive
        order.isActive = false;
        order.lastUpdated = block.timestamp;
        
        // Remove from active orders
        _removeFromActiveOrders(order.bot, orderHash);
        
        // Update strategy
        if (_strategies[order.bot].bot != address(0)) {
            _strategies[order.bot].activeOrders--;
            _strategies[order.bot].lastUpdated = block.timestamp;
        }
        
        emit OrderCanceled(
            orderHash,
            order.bot,
            order.orderIndex
        );
    }
    
    /**
     * @notice Creates a new strategy
     * @param bot The bot address
     * @param owner The owner address
     * @param strategyType The type of strategy
     */
    function createStrategy(
        address bot,
        address owner,
        uint256 strategyType
    ) external override onlyAuthorizedBot validAddress(bot) validAddress(owner) {
        // Validate strategy type
        if (strategyType > 2) revert InvalidStrategyType();
        
        // Check if strategy already exists
        if (_strategies[bot].bot != address(0)) revert StrategyNotFound();
        
        StrategyInfo memory strategyInfo = StrategyInfo({
            bot: bot,
            owner: owner,
            totalOrders: 0,
            activeOrders: 0,
            totalFilled: 0,
            strategyType: strategyType,
            isActive: true,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp
        });
        
        _strategies[bot] = strategyInfo;
        
        emit StrategyCreated(bot, owner, strategyType);
    }
    
    /**
     * @notice Updates strategy statistics
     * @param bot The bot address
     * @param totalOrders The total number of orders
     * @param activeOrders The number of active orders
     */
    function updateStrategy(
        address bot,
        uint256 totalOrders,
        uint256 activeOrders
    ) external override onlyAuthorizedBot validAddress(bot) {
        if (_strategies[bot].bot == address(0)) revert StrategyNotFound();
        
        _strategies[bot].totalOrders = totalOrders;
        _strategies[bot].activeOrders = activeOrders;
        _strategies[bot].lastUpdated = block.timestamp;
        
        emit StrategyUpdated(bot, totalOrders, activeOrders);
    }
    
    /**
     * @notice Gets order information
     * @param orderHash The hash of the order
     * @return orderInfo The order information
     */
    function getOrderInfo(bytes32 orderHash) external view override returns (OrderInfo memory orderInfo) {
        orderInfo = _orders[orderHash];
        if (orderInfo.orderHash == bytes32(0)) revert OrderNotFound();
    }
    
    /**
     * @notice Gets strategy information
     * @param bot The bot address
     * @return strategyInfo The strategy information
     */
    function getStrategyInfo(address bot) external view override returns (StrategyInfo memory strategyInfo) {
        strategyInfo = _strategies[bot];
        if (strategyInfo.bot == address(0)) revert StrategyNotFound();
    }
    
    /**
     * @notice Gets all orders for a bot
     * @param bot The bot address
     * @return orderHashes Array of order hashes
     */
    function getBotOrders(address bot) external view override returns (bytes32[] memory orderHashes) {
        return _botOrders[bot];
    }
    
    /**
     * @notice Gets active orders for a bot
     * @param bot The bot address
     * @return orderHashes Array of active order hashes
     */
    function getBotActiveOrders(address bot) external view override returns (bytes32[] memory orderHashes) {
        return _botActiveOrders[bot];
    }
    
    /**
     * @notice Checks if a bot is authorized
     * @param bot The bot address
     * @return isAuthorized Whether the bot is authorized
     */
    function isBotAuthorized(address bot) external view returns (bool isAuthorized) {
        return _authorizedBots[bot];
    }
    
    /**
     * @notice Gets the order count for a bot
     * @param bot The bot address
     * @return count The order count
     */
    function getBotOrderCount(address bot) external view returns (uint256 count) {
        return _botOrderCounters[bot];
    }
    
    /**
     * @notice Pauses the contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpauses the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Removes an order from active orders array
     * @param bot The bot address
     * @param orderHash The order hash to remove
     */
    function _removeFromActiveOrders(address bot, bytes32 orderHash) private {
        bytes32[] storage activeOrders = _botActiveOrders[bot];
        for (uint256 i = 0; i < activeOrders.length; i++) {
            if (activeOrders[i] == orderHash) {
                // Replace with last element and pop
                activeOrders[i] = activeOrders[activeOrders.length - 1];
                activeOrders.pop();
                break;
            }
        }
    }
    
    /**
     * @notice Emergency function to recover stuck tokens
     * @param token The token address
     * @param to The recipient address
     * @param amount The amount to recover
     */
    function emergencyRecover(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        
        // Transfer tokens
        (bool success, ) = token.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        require(success, "Transfer failed");
    }
} 