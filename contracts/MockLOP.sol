// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/I1inchLOP.sol";

/**
 * @title MockLOP
 * @notice Mock implementation of 1inch Limit Order Protocol for testing
 */
contract MockLOP is I1inchLOP {
    mapping(bytes32 => bool) public orderExists;
    mapping(bytes32 => uint256) public orderRemaining;
    
    event MockOrderPlaced(bytes32 indexed orderHash, address indexed maker);
    event MockOrderFilled(bytes32 indexed orderHash, uint256 makingAmount, uint256 takingAmount);
    event MockOrderCanceled(bytes32 indexed orderHash);
    
    /**
     * @notice Places a limit order (mock implementation)
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
    ) external payable returns (uint256 makingAmount, uint256 takingAmount) {
        bytes32 orderHash = getOrderHash(order);
        require(orderExists[orderHash], "Order does not exist");
        
        // Mock fill - return half the amount
        makingAmount = order.makingAmount / 2;
        takingAmount = order.takingAmount / 2;
        
        orderRemaining[orderHash] = order.makingAmount - makingAmount;
        
        emit MockOrderFilled(orderHash, makingAmount, takingAmount);
        
        return (makingAmount, takingAmount);
    }
    
    /**
     * @notice Cancels an order (mock implementation)
     * @param order The order to cancel
     */
    function cancelOrder(Order calldata order) external {
        bytes32 orderHash = getOrderHash(order);
        require(orderExists[orderHash], "Order does not exist");
        
        orderExists[orderHash] = false;
        orderRemaining[orderHash] = 0;
        
        emit MockOrderCanceled(orderHash);
    }
    
    /**
     * @notice Checks if an order is valid (mock implementation)
     * @param order The order to check
     * @return isValid Whether the order is valid
     */
    function checkOrder(Order calldata order) external view returns (bool isValid) {
        bytes32 orderHash = getOrderHash(order);
        return orderExists[orderHash];
    }
    
    /**
     * @notice Gets the order hash (mock implementation)
     * @param order The order
     * @return orderHash The hash of the order
     */
    function getOrderHash(Order calldata order) public view returns (bytes32 orderHash) {
        return keccak256(abi.encodePacked(
            order.salt,
            order.makerAsset,
            order.takerAsset,
            order.maker,
            order.receiver,
            order.allowedSender,
            order.makingAmount,
            order.takingAmount,
            order.offsets,
            order.interactions
        ));
    }
    
    /**
     * @notice Gets the remaining amount for an order (mock implementation)
     * @param order The order
     * @return remainingAmount The remaining amount
     */
    function remaining(Order calldata order) external view returns (uint256 remainingAmount) {
        bytes32 orderHash = getOrderHash(order);
        return orderRemaining[orderHash];
    }
    
    /**
     * @notice Mock function to place an order (for testing)
     * @param order The order to place
     */
    function placeOrder(Order calldata order) external {
        bytes32 orderHash = getOrderHash(order);
        orderExists[orderHash] = true;
        orderRemaining[orderHash] = order.makingAmount;
        
        emit MockOrderPlaced(orderHash, order.maker);
    }
} 