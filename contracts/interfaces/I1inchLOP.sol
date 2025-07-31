// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title I1inchLOP
 * @notice Interface for 1inch Limit Order Protocol
 * @dev Based on the official 1inch LOP contract interface
 */
interface I1inchLOP {
    struct Order {
        uint256 salt;
        address makerAsset;
        address takerAsset;
        address maker;
        address receiver;
        address allowedSender;
        uint256 makingAmount;
        uint256 takingAmount;
        uint256 offsets;
        bytes interactions;
    }

    struct OrderRFQ {
        uint256 info;
        address makerAsset;
        address takerAsset;
        address maker;
        address allowedSender;
        uint256 makingAmount;
        uint256 takingAmount;
    }

    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed maker,
        address indexed taker,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 remainingAmount
    );

    event OrderCanceled(
        bytes32 indexed orderHash,
        address indexed maker
    );

    /**
     * @notice Places a limit order
     * @param order The order structure
     * @param signature The signature for the order
     * @param interaction The interaction data for custom callbacks
     * @return makingAmount The amount of maker asset that was filled
     * @return takingAmount The amount of taker asset that was filled
     */
    function fillOrder(
        Order calldata order,
        bytes calldata signature,
        bytes calldata interaction
    ) external payable returns (uint256 makingAmount, uint256 takingAmount);

    /**
     * @notice Cancels an order
     * @param order The order to cancel
     */
    function cancelOrder(Order calldata order) external;

    /**
     * @notice Checks if an order is valid
     * @param order The order to check
     * @return isValid Whether the order is valid
     */
    function checkOrder(Order calldata order) external view returns (bool isValid);

    /**
     * @notice Gets the order hash
     * @param order The order
     * @return orderHash The hash of the order
     */
    function getOrderHash(Order calldata order) external view returns (bytes32 orderHash);

    /**
     * @notice Gets the remaining amount for an order
     * @param order The order
     * @return remainingAmount The remaining amount
     */
    function remaining(Order calldata order) external view returns (uint256 remainingAmount);

    /**
     * @notice Fills an order with RFQ
     * @param order The order structure
     * @param signature The signature for the order
     * @param interaction The interaction data for custom callbacks
     * @return makingAmount The amount of maker asset that was filled
     * @return takingAmount The amount of taker asset that was filled
     */
    function fillOrderRFQ(
        OrderRFQ calldata order,
        bytes calldata signature,
        bytes calldata interaction
    ) external payable returns (uint256 makingAmount, uint256 takingAmount);

    /**
     * @notice Gets the order hash for RFQ orders
     * @param order The order
     * @return orderHash The hash of the order
     */
    function getOrderRFQHash(OrderRFQ calldata order) external view returns (bytes32 orderHash);

    /**
     * @notice Checks if an RFQ order is valid
     * @param order The order to check
     * @return isValid Whether the order is valid
     */
    function checkOrderRFQ(OrderRFQ calldata order) external view returns (bool isValid);
} 