# 1inch Limit Order Protocol (LOP) Integration

This document describes the integration of inchbyinch with the 1inch Limit Order Protocol (LOP).

## Overview

The LOP integration enables inchbyinch to create, manage, and execute limit orders directly on the 1inch Aggregation Router V6 contract (which includes the Limit Order Protocol via OrderMixin). This provides:

- **Onchain Order Management**: All orders are created and managed onchain
- **Real Market Execution**: Orders execute through 1inch's liquidity network
- **Custom Callbacks**: Orders can trigger custom logic when filled
- **Gasless Order Creation**: Orders can be created without immediate gas costs

## Architecture

### Components

1. **LOPAdapter** (`contracts/LOPAdapter.sol`)
   - Handles interaction with the 1inch Aggregation Router V6 (which includes LOP)
   - Manages order creation, cancellation, and validation
   - Provides order tracking and user management

2. **inchbyinchBot** (`contracts/inchbyinchBot.sol`)
   - Uses LOPAdapter to place ladder orders
   - Handles order fill callbacks and reposting logic
   - Manages strategy execution and state

3. **I1inchLOP** (`contracts/interfaces/I1inchLOP.sol`)
   - Interface for the 1inch LOP contract
   - Defines order structures and function signatures

### Flow

```
User → Factory → Bot → LOPAdapter → 1inch Aggregation Router V6 (includes LOP)
                ↓
            OrderManager (tracking)
                ↓
            OracleAdapter (pricing)
```

## LOP Contract Addresses

The 1inch Limit Order Protocol is integrated into the Aggregation Router V6 contract, which is deployed on multiple networks:

| Network | Contract Address |
|---------|------------------|
| Ethereum | `0x111111125421ca6dc452d289314280a0f8842a65` |
| Base | `0x111111125421ca6dc452d289314280a0f8842a65` |
| Polygon | `0x111111125421ca6dc452d289314280a0f8842a65` |
| Arbitrum | `0x111111125421ca6dc452d289314280a0f8842a65` |
| Optimism | `0x111111125421ca6dc452d289314280a0f8842a65` |
| BSC | `0x111111125421ca6dc452d289314280a0f8842a65` |

## Order Structure

LOP orders follow this structure:

```solidity
struct Order {
    uint256 salt;           // Unique identifier
    address makerAsset;     // Asset being sold
    address takerAsset;     // Asset being bought
    address maker;          // Order creator
    address receiver;       // Who receives the filled amount
    address allowedSender;  // Who can fill the order (0 = anyone)
    uint256 makingAmount;   // Amount being sold
    uint256 takingAmount;   // Amount being bought
    uint256 offsets;        // Additional data
    bytes interactions;     // Custom callback data
}
```

## Key Features

### 1. Order Creation

Orders are created through the `LOPAdapter.createOrder()` function:

```solidity
function createOrder(
    address makerAsset,
    address takerAsset,
    uint256 makingAmount,
    uint256 takingAmount,
    address receiver,
    address allowedSender,
    bytes calldata interactions
) external returns (bytes32 orderHash)
```

### 2. Order Filling

Orders can be filled by anyone (unless restricted by `allowedSender`):

```solidity
function fillOrder(
    Order calldata order,
    bytes calldata signature,
    bytes calldata interaction
) external payable returns (uint256 makingAmount, uint256 takingAmount)
```

### 3. Custom Callbacks

Orders can include custom interaction data that executes when filled:

```solidity
// Example: Callback to bot when order is filled
bytes memory interactions = abi.encodeWithSignature(
    "handleOrderFill(bytes32,uint256,uint256)",
    orderHash,
    filledAmount,
    remainingAmount
);
```

### 4. Order Cancellation

Orders can be cancelled by the maker:

```solidity
function cancelOrder(Order calldata order) external
```

## Integration with inchbyinch

### Bot Order Placement

The `inchbyinchBot` places orders through the `LOPAdapter`:

```solidity
function _placeOrder(uint256 price, uint256 size, bool isBuy) private {
    // Calculate amounts
    uint256 makingAmount = size;
    uint256 takingAmount = (size * price) / 1e18;
    
    // Create interaction data for callback
    bytes memory interactions = abi.encodeWithSignature(
        "handleOrderFill(bytes32,uint256,uint256)",
        bytes32(0), // Will be set by LOP adapter
        uint256(0),
        uint256(0)
    );
    
    // Create order through LOP adapter
    bytes32 orderHash = lopAdapter.createOrder(
        isBuy ? strategy.takerAsset : strategy.makerAsset,
        isBuy ? strategy.makerAsset : strategy.takerAsset,
        makingAmount,
        takingAmount,
        address(this),
        address(0),
        interactions
    );
}
```

### Order Fill Handling

When an order is filled, the bot receives a callback:

```solidity
function handleOrderFill(
    bytes32 orderHash,
    uint256 filledAmount,
    uint256 remainingAmount
) external onlyAuthorized {
    // Update order state
    // Handle reposting logic
    // Trigger strategy chaining
}
```

### Strategy Chaining

Orders can trigger additional actions when filled:

1. **Reposting**: Place a new order at the same or next price level
2. **Sell-Flip**: After a buy order fills, automatically place a sell order
3. **Strategy Completion**: When all orders are filled, complete the strategy

## Deployment

### Prerequisites

1. Hardhat environment configured
2. Network RPC endpoints set up
3. Private key with deployment funds

### Deployment Script

Use the provided deployment script:

```bash
npx hardhat run scripts/deploy-lop-integration.js --network <network>
```

The script will:

1. Deploy all contracts
2. Set up proper authorizations
3. Configure price feeds
4. Deploy a test bot
5. Save deployment information

### Manual Deployment

If you prefer manual deployment:

```bash
# 1. Deploy OracleAdapter
npx hardhat run scripts/deploy.js --network <network>

# 2. Deploy OrderManager
npx hardhat run scripts/deploy.js --network <network>

# 3. Deploy LOPAdapter
npx hardhat run scripts/deploy.js --network <network>

# 4. Deploy Bot Implementation
npx hardhat run scripts/deploy.js --network <network>

# 5. Deploy Factory
npx hardhat run scripts/deploy.js --network <network>
```

## Testing

### Running Tests

```bash
# Run all LOP integration tests
npx hardhat test test/LOPIntegration.test.js

# Run specific test suite
npx hardhat test test/LOPIntegration.test.js --grep "LOPAdapter"
```

### Test Coverage

The tests cover:

- ✅ Order creation and validation
- ✅ Order filling and callback handling
- ✅ Order cancellation
- ✅ Strategy creation and execution
- ✅ Sell-flip chaining
- ✅ Error handling and access control
- ✅ Factory integration
- ✅ Order management

## Security Considerations

### Access Control

- Only authorized bots can create orders
- Only order makers can cancel orders
- Factory controls bot deployment limits

### Order Validation

- Orders are validated before creation
- Order hashes are verified before execution
- Timestamps prevent replay attacks

### Error Handling

- Comprehensive error messages
- Graceful failure handling
- Emergency pause functionality

## Gas Optimization

### Efficient Order Creation

- Minimal proxy pattern for bot deployment
- Batch order operations where possible
- Optimized storage patterns

### Cost Estimates

| Operation | Gas Cost |
|-----------|----------|
| Deploy Bot | ~500,000 |
| Create Strategy | ~100,000 |
| Place Order | ~50,000 |
| Cancel Order | ~30,000 |
| Handle Fill | ~40,000 |

## Monitoring

### Events to Track

```solidity
// Order lifecycle events
event OrderCreated(bytes32 indexed orderHash, address indexed maker);
event OrderFilled(bytes32 indexed orderHash, uint256 makingAmount, uint256 takingAmount);
event OrderCanceled(bytes32 indexed orderHash, address indexed maker);

// Strategy events
event StrategyCreated(address indexed makerAsset, address indexed takerAsset);
event StrategyCompleted(uint256 totalFilled, uint256 totalSpent, uint256 profit);
```

### Key Metrics

- Order fill rates
- Strategy completion rates
- Gas costs per operation
- Error rates and types

## Troubleshooting

### Common Issues

1. **Order Not Found**
   - Check if order was created successfully
   - Verify order hash calculation
   - Ensure order hasn't expired

2. **Insufficient Balance**
   - Check token balances in bot contract
   - Verify token approvals
   - Ensure budget limits are respected

3. **Authorization Errors**
   - Verify bot is authorized in LOPAdapter
   - Check factory authorization in OrderManager
   - Ensure correct caller permissions

### Debug Commands

```bash
# Check order status
npx hardhat console --network <network>
> const bot = await ethers.getContractAt("inchbyinchBot", "BOT_ADDRESS")
> await bot.getOrder(1)

# Check LOP adapter
> const adapter = await ethers.getContractAt("LOPAdapter", "ADAPTER_ADDRESS")
> await adapter.getOrderInfo("ORDER_HASH")
```

## Next Steps

1. **Deploy to Testnet**: Test with real LOP orders on Base Sepolia
2. **Integration Testing**: Test with actual token pairs and market conditions
3. **Performance Optimization**: Optimize gas costs and execution speed
4. **Security Audit**: Get contracts audited before mainnet deployment
5. **Production Deployment**: Deploy to mainnet with proper monitoring

## Resources

- [1inch LOP Documentation](https://docs.1inch.io/docs/limit-order-protocol/introduction/)
- [LOP Contract on Etherscan](https://etherscan.io/address/0x111111125421ca6dc452d289314280a0f8842a65)
- [1inch Community Discord](https://discord.com/invite/1inch) 