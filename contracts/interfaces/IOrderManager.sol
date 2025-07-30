// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOrderManager
 * @notice Interface for OrderManager contract
 */
interface IOrderManager {
    struct OrderInfo {
        bytes32 orderHash;
        address bot;
        address makerAsset;
        address takerAsset;
        uint256 makingAmount;
        uint256 takingAmount;
        uint256 remainingAmount;
        uint256 orderIndex;
        bool isActive;
        uint256 createdAt;
        uint256 lastUpdated;
    }

    struct StrategyInfo {
        address bot;
        address owner;
        uint256 totalOrders;
        uint256 activeOrders;
        uint256 totalFilled;
        uint256 strategyType; // 0: Buy Ladder, 1: Sell Ladder, 2: Buy+Sell
        bool isActive;
        uint256 createdAt;
        uint256 lastUpdated;
    }

    event OrderRegistered(
        bytes32 indexed orderHash,
        address indexed bot,
        uint256 indexed orderIndex,
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount
    );

    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed bot,
        uint256 indexed orderIndex,
        uint256 filledAmount,
        uint256 remainingAmount
    );

    event OrderCanceled(
        bytes32 indexed orderHash,
        address indexed bot,
        uint256 indexed orderIndex
    );

    event StrategyCreated(
        address indexed bot,
        address indexed owner,
        uint256 indexed strategyType
    );

    event StrategyUpdated(
        address indexed bot,
        uint256 totalOrders,
        uint256 activeOrders
    );

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
    ) external returns (uint256 orderIndex);

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
    ) external;

    /**
     * @notice Cancels an order
     * @param orderHash The hash of the order
     */
    function cancelOrder(bytes32 orderHash) external;

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
    ) external;

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
    ) external;

    /**
     * @notice Gets order information
     * @param orderHash The hash of the order
     * @return orderInfo The order information
     */
    function getOrderInfo(bytes32 orderHash) external view returns (OrderInfo memory orderInfo);

    /**
     * @notice Gets strategy information
     * @param bot The bot address
     * @return strategyInfo The strategy information
     */
    function getStrategyInfo(address bot) external view returns (StrategyInfo memory strategyInfo);

    /**
     * @notice Gets all orders for a bot
     * @param bot The bot address
     * @return orderHashes Array of order hashes
     */
    function getBotOrders(address bot) external view returns (bytes32[] memory orderHashes);

    /**
     * @notice Gets active orders for a bot
     * @param bot The bot address
     * @return orderHashes Array of active order hashes
     */
    function getBotActiveOrders(address bot) external view returns (bytes32[] memory orderHashes);
    
    /**
     * @notice Checks if a bot is authorized
     * @param bot The bot address
     * @return isAuthorized Whether the bot is authorized
     */
    function isBotAuthorized(address bot) external view returns (bool isAuthorized);
    
    /**
     * @notice Authorizes a bot to register orders
     * @param bot The bot address to authorize
     */
    function authorizeBot(address bot) external;
} 