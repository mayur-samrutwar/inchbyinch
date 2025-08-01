// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/I1inchLOP.sol";
import "./interfaces/IOrderManager.sol";
import "./interfaces/IOracleAdapter.sol";
import "./LOPAdapter.sol";

/**
 * @title inchbyinchBot
 * @notice Core trading bot for inchbyinch ladder strategies
 * @dev Handles ladder order placement, reposting, and strategy execution
 */
contract inchbyinchBot is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // Strategy types
    uint256 public constant STRATEGY_BUY_LADDER = 0;
    uint256 public constant STRATEGY_SELL_LADDER = 1;
    uint256 public constant STRATEGY_BUY_SELL = 2;
    
    // Repost modes
    uint256 public constant REPOST_SAME_PRICE = 0;
    uint256 public constant REPOST_NEXT_PRICE = 1;
    uint256 public constant REPOST_SKIP = 2;
    
    // Configuration
    uint256 public constant MAX_ORDERS = 50;
    uint256 public constant MAX_ORDER_SIZE = 1000 ether;
    uint256 public constant MIN_ORDER_SIZE = 0.001 ether;
    uint256 public constant MAX_SPACING = 1000; // 1000% max spacing
    uint256 public constant MIN_SPACING = 1; // 1% min spacing
    
    // State
    struct Strategy {
        address makerAsset;
        address takerAsset;
        uint256 startPrice;
        uint256 spacing;
        uint256 orderSize;
        uint256 numOrders;
        uint256 strategyType;
        uint256 repostMode;
        uint256 budget;
        uint256 stopLoss;
        uint256 takeProfit;
        uint256 expiryTime;
        bool isActive;
        uint256 currentOrderIndex;
        uint256 totalFilled;
        uint256 totalSpent;
        // --- Phase 4: Sell-flip chaining ---
        bool flipToSell;
        uint256 flipPercentage; // e.g. 10 for +10%
        bool flipSellActive;
    }
    
    struct Order {
        bytes32 orderHash;
        uint256 price;
        uint256 orderIndex;
        bool isActive;
        uint256 createdAt;
    }
    
    struct StrategyConfig {
        address tokenIn;
        address tokenOut;
        uint256 startPrice;
        uint256 spacing;
        uint256 orderSize;
        uint256 numOrders;
        uint256 repostMode;
        uint256 budget;
        uint256 stopLoss;
        uint256 takeProfit;
        uint256 expiryTime;
        bool flipToSell;
        uint256 flipPercentage;
    }
    
    // Storage
    Strategy public strategy;
    mapping(uint256 => Order) public orders;
    mapping(bytes32 => uint256) public orderIndexByHash;
    
    // External contracts
    I1inchLOP public lop;
    LOPAdapter public lopAdapter;
    IOrderManager public orderManager;
    IOracleAdapter public oracleAdapter;
    
    // Events
    event StrategyCreated(
        address indexed makerAsset,
        address indexed takerAsset,
        uint256 startPrice,
        uint256 spacing,
        uint256 orderSize,
        uint256 numOrders,
        uint256 strategyType
    );
    
    event ETHWithdrawn(address indexed recipient, uint256 amount);
    
    event OrderPlaced(
        bytes32 indexed orderHash,
        uint256 indexed orderIndex,
        uint256 price,
        uint256 orderSize
    );
    
    event OrderFilled(
        bytes32 indexed orderHash,
        uint256 indexed orderIndex,
        uint256 filledAmount,
        uint256 price
    );
    
    event OrderReposted(
        bytes32 indexed oldOrderHash,
        bytes32 indexed newOrderHash,
        uint256 newPrice,
        uint256 orderIndex
    );
    
    event StrategyCompleted(
        uint256 totalFilled,
        uint256 totalSpent,
        uint256 profit
    );
    
    event StrategyCancelled();
    
    // Debug event for sell-flip
    event SellFlipTriggered(uint256 orderPrice, uint256 sellPrice, uint256 flipPercentage);
    
    // Errors
    error InvalidStrategy();
    error InvalidOrderSize();
    error InvalidSpacing();
    error InvalidPrice();
    error InvalidBudget();
    error InvalidStopLoss();
    error InvalidTakeProfit();
    error InvalidExpiry();
    error StrategyAlreadyActive();
    error StrategyNotActive();
    error OrderNotFound();
    error OrderAlreadyExists();
    error OrderAlreadyFilled();
    error OrderAlreadyCanceled();
    error InsufficientBalance();
    error ExceedsBudget();
    error StopLossTriggered();
    error TakeProfitTriggered();
    error StrategyExpired();
    error UnauthorizedCaller();
    error ZeroAddress();
    error ZeroAmount();
    error TransferFailed();
    
    // Modifiers
    modifier onlyAuthorized() {
        // Allow anyone to call - simplified
        _;
    }
    
    modifier strategyActive() {
        if (!strategy.isActive) revert StrategyNotActive();
        _;
    }
    
    modifier validAddress(address addr) {
        // Allow zero address for native ETH
        if (addr == address(0)) {
            // Special case for native ETH - don't revert
            _;
            return;
        }
        _;
    }
    
    modifier validAmount(uint256 amount) {
        if (amount == 0) revert ZeroAmount();
        _;
    }
    
    modifier validPrice(uint256 price) {
        if (price == 0) revert InvalidPrice();
        _;
    }
    
    modifier validSpacing(uint256 spacing) {
        if (spacing < MIN_SPACING || spacing > MAX_SPACING) revert InvalidSpacing();
        _;
    }
    
    modifier validOrderSize(uint256 size) {
        if (size < MIN_ORDER_SIZE || size > MAX_ORDER_SIZE) revert InvalidOrderSize();
        _;
    }
    
    constructor() {
        // Implementation contract - will be initialized via proxy
    }
    
    /**
     * @notice Initializes the bot with external contracts
     * @param _lop The LOP contract address
     * @param _lopAdapter The LOP adapter address
     * @param _orderManager The order manager address
     * @param _oracleAdapter The oracle adapter address
     */
    function initialize(
        address _lop,
        address _lopAdapter,
        address _orderManager,
        address _oracleAdapter
    ) external validAddress(_lop) validAddress(_lopAdapter) validAddress(_orderManager) validAddress(_oracleAdapter) {
        require(address(lop) == address(0), "Already initialized");
        lop = I1inchLOP(_lop);
        lopAdapter = LOPAdapter(payable(_lopAdapter));
        orderManager = IOrderManager(_orderManager);
        oracleAdapter = IOracleAdapter(_oracleAdapter);
    }
    
    /**
     * @notice Creates a new ladder strategy
     * @param makerAsset The asset being sold
     * @param takerAsset The asset being bought
     * @param startPrice The starting price
     * @param spacing The price spacing between orders
     * @param orderSize The size of each order
     * @param numOrders The number of orders to place
     * @param strategyType The type of strategy
     * @param repostMode The repost mode
     * @param budget The maximum budget
     * @param stopLoss The stop loss price
     * @param takeProfit The take profit price
     * @param expiryTime The expiry time
     * @param flipToSell_ Whether to flip to sell after a buy order is filled
     * @param flipPercentage_ The percentage to increase the price for the sell order
     */
    function createStrategy(
        address makerAsset,
        address takerAsset,
        uint256 startPrice,
        uint256 spacing,
        uint256 orderSize,
        uint256 numOrders,
        uint256 strategyType,
        uint256 repostMode,
        uint256 budget,
        uint256 stopLoss,
        uint256 takeProfit,
        uint256 expiryTime,
        bool flipToSell_,
        uint256 flipPercentage_
    ) external validAddress(makerAsset) validAddress(takerAsset) validPrice(startPrice) validSpacing(spacing) validOrderSize(orderSize) {
        // Validate strategy parameters
        if (strategy.isActive) revert StrategyAlreadyActive();
        if (numOrders == 0 || numOrders > MAX_ORDERS) revert InvalidStrategy();
        if (strategyType > 2) revert InvalidStrategy();
        if (repostMode > 2) revert InvalidStrategy();
        if (budget == 0) revert InvalidBudget();
        if (expiryTime <= block.timestamp) revert InvalidExpiry();
        
        // Validate stop loss and take profit
        if (stopLoss > 0 && stopLoss >= startPrice) revert InvalidStopLoss();
        if (takeProfit > 0 && takeProfit <= startPrice) revert InvalidTakeProfit();
        
        // Check token balances (handle native ETH)
        uint256 makerBalance;
        uint256 takerBalance;
        
        if (makerAsset == address(0)) {
            // Native ETH
            makerBalance = address(this).balance;
        } else {
            makerBalance = IERC20(makerAsset).balanceOf(address(this));
        }
        
        if (takerAsset == address(0)) {
            // Native ETH
            takerBalance = address(this).balance;
        } else {
            takerBalance = IERC20(takerAsset).balanceOf(address(this));
        }
        
        if (strategyType == STRATEGY_BUY_LADDER) {
            if (takerBalance < budget) revert InsufficientBalance();
        } else if (strategyType == STRATEGY_SELL_LADDER) {
            if (makerBalance < (orderSize * numOrders)) revert InsufficientBalance();
        } else if (strategyType == STRATEGY_BUY_SELL) {
            if (takerBalance < budget) revert InsufficientBalance();
        }
        
        // Create strategy
        strategy = Strategy({
            makerAsset: makerAsset,
            takerAsset: takerAsset,
            startPrice: startPrice,
            spacing: spacing,
            orderSize: orderSize,
            numOrders: numOrders,
            strategyType: strategyType,
            repostMode: repostMode,
            budget: budget,
            stopLoss: stopLoss,
            takeProfit: takeProfit,
            expiryTime: expiryTime,
            isActive: true,
            currentOrderIndex: 0,
            totalFilled: 0,
            totalSpent: 0,
            flipToSell: flipToSell_,
            flipPercentage: flipPercentage_,
            flipSellActive: false
        });
        
        // Register strategy with order manager
        orderManager.createStrategy(address(this), msg.sender, strategyType);
        
        emit StrategyCreated(
            makerAsset,
            takerAsset,
            startPrice,
            spacing,
            orderSize,
            numOrders,
            strategyType
        );
    }


    
    /**
     * @notice Places ladder orders
     */
    function placeLadderOrders() external strategyActive {
        uint256 currentPrice = _getCurrentPrice();
        
        // Check stop conditions
        if (strategy.stopLoss > 0 && currentPrice <= strategy.stopLoss) revert StopLossTriggered();
        if (strategy.takeProfit > 0 && currentPrice >= strategy.takeProfit) revert TakeProfitTriggered();
        if (block.timestamp > strategy.expiryTime) revert StrategyExpired();
        
        // Place orders based on strategy type
        if (strategy.strategyType == STRATEGY_BUY_LADDER) {
            _placeBuyLadderOrders();
        } else if (strategy.strategyType == STRATEGY_SELL_LADDER) {
            _placeSellLadderOrders();
        } else if (strategy.strategyType == STRATEGY_BUY_SELL) {
            _placeBuySellOrders();
        }
    }
    
    /**
     * @notice Handles order fill callback from LOP
     * @param orderHash The order hash
     * @param filledAmount The amount filled
     * @param remainingAmount The remaining amount
     */
    function handleOrderFill(
        bytes32 orderHash,
        uint256 filledAmount,
        uint256 remainingAmount
    ) external onlyAuthorized {
        uint256 orderIndex = orderIndexByHash[orderHash];
        if (orderIndex == 0) revert OrderNotFound();
        
        Order storage order = orders[orderIndex];
        if (!order.isActive) revert OrderAlreadyCanceled();
        
        // Update order
        order.isActive = remainingAmount > 0;
        
        // Update strategy
        strategy.totalFilled += filledAmount;
        strategy.totalSpent += (filledAmount * order.price) / 1e18;
        
        // Update order manager
        orderManager.updateOrderFill(orderHash, filledAmount, remainingAmount);
        
        emit OrderFilled(orderHash, orderIndex, filledAmount, order.price);
        
        // --- Sell-flip chaining logic ---
        if (remainingAmount == 0) {
            // If this was a buy order and flipToSell is enabled, place a sell order
            if (
                strategy.flipToSell &&
                !strategy.flipSellActive &&
                strategy.strategyType == STRATEGY_BUY_LADDER
            ) {
                uint256 sellPrice = order.price + (order.price * strategy.flipPercentage) / 100;
                _placeOrder(sellPrice, strategy.orderSize, false); // false = sell
                strategy.flipSellActive = true;
                emit SellFlipTriggered(order.price, sellPrice, strategy.flipPercentage);
            } else {
                // Only handle repost if flipToSell is not enabled
                _handleOrderRepost(orderIndex);
            }
        }
    }
    
    /**
     * @notice Cancels all active orders
     */
    function cancelAllOrders() external strategyActive {
        _cancelAllOrdersInternal();
    }

    /**
     * @notice Internal function to cancel all active orders
     */
    function _cancelAllOrdersInternal() internal {
        for (uint256 i = 1; i <= strategy.currentOrderIndex; i++) {
            Order storage order = orders[i];
            if (order.isActive) {
                _cancelOrder(i);
            }
        }
        
        strategy.isActive = false;
        emit StrategyCancelled();
    }
    
    /**
     * @notice Cancels a specific order
     * @param orderIndex The order index
     */
    function cancelOrder(uint256 orderIndex) external strategyActive {
        if (orderIndex == 0 || orderIndex > strategy.currentOrderIndex) revert OrderNotFound();
        
        Order storage order = orders[orderIndex];
        if (!order.isActive) revert OrderAlreadyCanceled();
        
        _cancelOrder(orderIndex);
    }

    /**
     * @notice Checks for timeouts and cancels expired orders
     */
    function checkTimeouts() external {
        if (!strategy.isActive) return;
        
        if (block.timestamp > strategy.expiryTime) {
            _cancelAllOrdersInternal();
        }
    }

    /**
     * @notice Checks for stop loss conditions and cancels orders if triggered
     */
    function checkStopLoss() external {
        if (!strategy.isActive) return;
        
        uint256 currentPrice = _getCurrentPrice();
        
        if (strategy.stopLoss > 0 && currentPrice <= strategy.stopLoss) {
            _cancelAllOrdersInternal();
        }
        
        if (strategy.takeProfit > 0 && currentPrice >= strategy.takeProfit) {
            _cancelAllOrdersInternal();
        }
    }
    
    /**
     * @notice Withdraws tokens from the bot
     * @param token The token address
     * @param amount The amount to withdraw
     */
    function withdrawTokens(address token, uint256 amount) external {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
    
    /**
     * @notice Gets order information
     * @param orderIndex The order index
     * @return order The order information
     */
    function getOrder(uint256 orderIndex) external view returns (Order memory order) {
        if (orderIndex == 0 || orderIndex > strategy.currentOrderIndex) revert OrderNotFound();
        return orders[orderIndex];
    }
    
    /**
     * @notice Gets all active orders
     * @return activeOrders Array of active order indices
     */
    function getActiveOrders() external view returns (uint256[] memory activeOrders) {
        uint256 count = 0;
        for (uint256 i = 1; i <= strategy.currentOrderIndex; i++) {
            if (orders[i].isActive) count++;
        }
        
        activeOrders = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= strategy.currentOrderIndex; i++) {
            if (orders[i].isActive) {
                activeOrders[index] = i;
                index++;
            }
        }
    }

    /**
     * @notice Gets all active order hashes
     * @return activeOrderHashes Array of active order hashes
     */
    function getActiveOrderHashes() external view returns (bytes32[] memory activeOrderHashes) {
        uint256 count = 0;
        for (uint256 i = 1; i <= strategy.currentOrderIndex; i++) {
            if (orders[i].isActive) count++;
        }
        
        activeOrderHashes = new bytes32[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= strategy.currentOrderIndex; i++) {
            if (orders[i].isActive) {
                activeOrderHashes[index] = orders[i].orderHash;
                index++;
            }
        }
    }
    
    /**
     * @notice Gets strategy performance
     * @return totalFilled Total amount filled
     * @return totalSpent Total amount spent
     * @return profit Profit/loss
     */
    function getStrategyPerformance() external view returns (uint256 totalFilled, uint256 totalSpent, int256 profit) {
        totalFilled = strategy.totalFilled;
        totalSpent = strategy.totalSpent;
        
        if (strategy.strategyType == STRATEGY_BUY_LADDER) {
            uint256 currentValue = (totalFilled * _getCurrentPrice()) / 1e18;
            profit = int256(currentValue) - int256(totalSpent);
        } else if (strategy.strategyType == STRATEGY_SELL_LADDER) {
            uint256 currentValue = (totalFilled * _getCurrentPrice()) / 1e18;
            profit = int256(totalSpent) - int256(currentValue);
        }
    }
    
    /**
     * @notice Pauses the bot
     */
    function pause() external {
        _pause();
    }
    
    /**
     * @notice Unpauses the bot
     */
    function unpause() external {
        _unpause();
    }
    
    /**
     * @notice Places buy ladder orders
     */
    function _placeBuyLadderOrders() private {
        uint256 currentPrice = _getCurrentPrice();
        uint256 dynamicSpacing = _getDynamicSpacing();
        
        for (uint256 i = 0; i < strategy.numOrders; i++) {
            uint256 orderPrice = currentPrice - (i * dynamicSpacing);
            if (orderPrice <= 0) break;
            
            _placeOrder(orderPrice, strategy.orderSize, true);
        }
    }
    
    /**
     * @notice Places sell ladder orders
     */
    function _placeSellLadderOrders() private {
        uint256 currentPrice = _getCurrentPrice();
        uint256 dynamicSpacing = _getDynamicSpacing();
        
        for (uint256 i = 0; i < strategy.numOrders; i++) {
            uint256 orderPrice = currentPrice + (i * dynamicSpacing);
            _placeOrder(orderPrice, strategy.orderSize, false);
        }
    }
    
    /**
     * @notice Places buy and sell orders
     */
    function _placeBuySellOrders() private {
        uint256 currentPrice = _getCurrentPrice();
        uint256 dynamicSpacing = _getDynamicSpacing();
        
        // Place buy orders below current price
        for (uint256 i = 1; i <= strategy.numOrders / 2; i++) {
            uint256 orderPrice = currentPrice - (i * dynamicSpacing);
            if (orderPrice <= 0) break;
            _placeOrder(orderPrice, strategy.orderSize, true);
        }
        
        // Place sell orders above current price
        for (uint256 i = 1; i <= strategy.numOrders / 2; i++) {
            uint256 orderPrice = currentPrice + (i * dynamicSpacing);
            _placeOrder(orderPrice, strategy.orderSize, false);
        }
    }
    
    /**
     * @notice Places a single order
     * @param price The order price
     * @param size The order size
     * @param isBuy Whether this is a buy order
     */
    function _placeOrder(uint256 price, uint256 size, bool isBuy) private {
        strategy.currentOrderIndex++;
        
        // Calculate amounts
        uint256 makingAmount = size;
        uint256 takingAmount = (size * price) / 1e18;
        
        // Create order through LOP adapter
        bytes32 orderHash = lopAdapter.createOrder(
            isBuy ? strategy.takerAsset : strategy.makerAsset, // makerAsset
            isBuy ? strategy.makerAsset : strategy.takerAsset, // takerAsset
            makingAmount,
            takingAmount,
            address(this), // receiver
            address(0), // allowedSender
            "" // interactions
        );
        
        // Store order
        orders[strategy.currentOrderIndex] = Order({
            orderHash: orderHash,
            price: price,
            orderIndex: strategy.currentOrderIndex,
            isActive: true,
            createdAt: block.timestamp
        });
        
        orderIndexByHash[orderHash] = strategy.currentOrderIndex;
        
        // Register with order manager
        orderManager.registerOrder(
            orderHash,
            address(this),
            isBuy ? strategy.takerAsset : strategy.makerAsset,
            isBuy ? strategy.makerAsset : strategy.takerAsset,
            makingAmount,
            takingAmount
        );
        
        emit OrderPlaced(orderHash, strategy.currentOrderIndex, price, size);
    }
    
    /**
     * @notice Handles order reposting
     * @param orderIndex The order index
     */
    function _handleOrderRepost(uint256 orderIndex) private {
        if (strategy.repostMode == REPOST_SKIP) return;
        
        Order storage order = orders[orderIndex];
        uint256 newPrice = order.price;
        
        if (strategy.repostMode == REPOST_NEXT_PRICE) {
            if (strategy.strategyType == STRATEGY_BUY_LADDER) {
                newPrice = order.price - _getDynamicSpacing();
            } else if (strategy.strategyType == STRATEGY_SELL_LADDER) {
                newPrice = order.price + _getDynamicSpacing();
            }
        }
        
        if (newPrice > 0) {
            _placeOrder(newPrice, strategy.orderSize, strategy.strategyType == STRATEGY_BUY_LADDER);
            
            emit OrderReposted(
                order.orderHash,
                orders[strategy.currentOrderIndex].orderHash,
                newPrice,
                strategy.currentOrderIndex
            );
        }
    }
    
    /**
     * @notice Cancels an order
     * @param orderIndex The order index
     */
    function _cancelOrder(uint256 orderIndex) private {
        Order storage order = orders[orderIndex];
        
        // Cancel through LOP adapter using the existing order hash
        lopAdapter.cancelOrderByHash(order.orderHash);
        
        // Update order
        order.isActive = false;
        
        // Update order manager
        orderManager.cancelOrder(order.orderHash);
    }
    
    /**
     * @notice Gets current price from oracle
     * @return price The current price
     */
    function _getCurrentPrice() private view returns (uint256 price) {
        // Handle native ETH
        if (strategy.makerAsset == address(0)) {
            try oracleAdapter.getLatestPrice(address(0)) returns (IOracleAdapter.PriceData memory priceData) {
                return priceData.price;
            } catch {
                // Fallback to strategy start price
                return strategy.startPrice;
            }
        } else {
            try oracleAdapter.getLatestPrice(strategy.makerAsset) returns (IOracleAdapter.PriceData memory priceData) {
                return priceData.price;
            } catch {
                // Fallback to strategy start price
                return strategy.startPrice;
            }
        }
    }
    
    /**
     * @notice Gets dynamic spacing from oracle
     * @return spacing The dynamic spacing
     */
    function _getDynamicSpacing() private view returns (uint256 spacing) {
        // Handle native ETH
        address asset = strategy.makerAsset == address(0) ? address(0) : strategy.makerAsset;
        try oracleAdapter.calculateDynamicSpacing(asset, strategy.spacing) returns (uint256 dynamicSpacing) {
            return dynamicSpacing;
        } catch {
            // Fallback to static spacing
            return strategy.spacing;
        }
    }
    
    /**
     * @notice Allows the contract to receive ETH
     */
    receive() external payable {
        // Accept ETH for gas fees
    }
    
    /**
     * @notice Allows anyone to withdraw ETH from the bot
     * @param amount The amount to withdraw
     */
    function withdrawETH(uint256 amount) external {
        if (amount > address(this).balance) revert InsufficientBalance();
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit ETHWithdrawn(msg.sender, amount);
    }
    
    /**
     * @notice Emergency function to withdraw all ETH
     */
    function emergencyWithdrawETH() external {
        uint256 balance = address(this).balance;
        if (balance == 0) revert ZeroAmount();
        
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        if (!success) revert TransferFailed();
        
        emit ETHWithdrawn(msg.sender, balance);
    }
} 