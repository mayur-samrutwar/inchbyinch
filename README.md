# inchbyinch: Smart Ladder Trading on 1inch LOP

A smart contract system that builds on top of the 1inch Limit Order Protocol (LOP) to enable ladder-style trading automation for retail DeFi users. All strategies execute fully onchain using LOP native structures, without relying on any 1inch APIs or backend.

## 🎯 Project Overview

inchbyinch brings CEX-grade grid/range automation to DEXs by leveraging the power of 1inch LOP's interaction field for custom callbacks. Users can deploy sophisticated ladder trading strategies that automatically manage themselves based on market behavior.

### Key Features

- **Buy/Sell Range Deployment**: Define a ladder of orders in a specified price range
- **Auto-Reposting**: Orders are re-posted at same or next-level price upon fill
- **Strategy Chaining**: E.g., buy low and auto-place sell at +10%
- **Budget Guardrails**: Max spend/capital usage enforced onchain
- **Stop Conditions**: Cancel all if no activity after X hours, price breaks stop-loss, etc
- **Volatility Adaptive**: Orders tighten/loosen based on volatility feed
- **Fully Onchain**: No backend infrastructure or APIs required

## 🏗️ Architecture

### Core Contracts

1. **inchbyinchFactory.sol**: Deploys per-user smart contract bots using minimal proxy pattern
2. **inchbyinchBot.sol**: Handles logic for placing LOP orders, monitoring fills, reposting
3. **OrderManager.sol**: Maintains metadata for order state, strategies
4. **OracleAdapter.sol**: Interfaces with volatility feeds for dynamic spacing

### Strategy Types

- **Buy Ladder**: Place buy orders below current price
- **Sell Ladder**: Place sell orders above current price  
- **Buy+Sell**: Place orders on both sides of current price

### Repost Modes

- **Same Price**: Repost at the same price level
- **Next Price**: Repost at the next price level in the ladder
- **Skip**: Don't repost after fill

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Hardhat
- Foundry (optional, for additional testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/inchbyinch.git
cd inchbyinch

# Install dependencies
npm install

# Install Foundry (optional)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Environment Setup

Create a `.env` file in the root directory:

```env
# Network RPC URLs
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# Private key for deployment
PRIVATE_KEY=your_private_key_here

# Etherscan API keys
ETHERSCAN_API_KEY=your_etherscan_api_key
BASESCAN_API_KEY=your_basescan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# Gas reporting
REPORT_GAS=true
```

### Compilation

```bash
# Compile contracts
npm run compile
```

### Testing

```bash
# Run Hardhat tests
npm test

# Run Foundry tests (if installed)
npm run test:foundry

# Run specific test file
npx hardhat test test/OrderManager.test.js
```

### Local Development

```bash
# Start local node
npm run node

# Deploy to local network
npm run deploy:local
```

### Deployment

```bash
# Deploy to testnet
npm run deploy:testnet

# Deploy to specific network
npx hardhat run scripts/deploy.js --network sepolia
npx hardhat run scripts/deploy.js --network baseSepolia
npx hardhat run scripts/deploy.js --network polygonAmoy
```

## 📋 Contract Addresses

### Mainnet
- **LOP**: `0x3ef51736315f52d568d6d2cf289419b9cfffe782`

### Testnets
- **Sepolia**: Same LOP address
- **Base Sepolia**: Same LOP address  
- **Polygon Amoy**: Same LOP address

## 🔧 Development

### Project Structure

```
inchbyinch/
├── contracts/
│   ├── interfaces/          # Contract interfaces
│   │   ├── I1inchLOP.sol
│   │   ├── IOrderManager.sol
│   │   └── IOracleAdapter.sol
│   ├── OrderManager.sol     # Order tracking and management
│   ├── OracleAdapter.sol    # Price feeds and volatility
│   ├── inchbyinchBot.sol    # Core trading logic
│   └── inchbyinchFactory.sol # Bot deployment factory
├── test/                    # Test files
├── scripts/                 # Deployment scripts
├── deployments/             # Deployment artifacts
└── docs/                   # Documentation
```

### Key Functions

#### Factory
- `deployBot(user)`: Deploy a new bot for a user
- `deployMultipleBots(user, count)`: Deploy multiple bots
- `upgradeBot(user, botIndex)`: Upgrade an existing bot

#### Bot
- `createStrategy(...)`: Create a new ladder strategy
- `placeLadderOrders()`: Place orders based on strategy
- `handleOrderFill(...)`: Handle order fill callbacks
- `cancelAllOrders()`: Cancel all active orders

#### OrderManager
- `registerOrder(...)`: Register a new order
- `updateOrderFill(...)`: Update order fill status
- `cancelOrder(...)`: Cancel an order
- `createStrategy(...)`: Create a new strategy

#### OracleAdapter
- `updatePrice(...)`: Update price data
- `getVolatility(...)`: Get volatility for an asset
- `calculateDynamicSpacing(...)`: Calculate dynamic spacing

### Testing Strategy

The test suite covers:

- ✅ Contract deployment and initialization
- ✅ Bot authorization and management
- ✅ Order registration and lifecycle
- ✅ Strategy creation and execution
- ✅ Oracle price updates and volatility
- ✅ Factory bot deployment
- ✅ Edge cases and error conditions
- ✅ Access control and security
- ✅ Pausable functionality
- ✅ Emergency functions

### Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **Ownable**: Access control for admin functions
- **Pausable**: Emergency pause functionality
- **Input Validation**: Comprehensive parameter validation
- **Error Handling**: Custom errors for better UX
- **Gas Optimization**: Minimal proxy pattern for bot deployment

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test test/OrderManager.test.js

# Run with gas reporting
REPORT_GAS=true npm test

# Run Foundry tests
npm run test:foundry
```

### Test Coverage

The test suite includes comprehensive coverage for:

- **Unit Tests**: Individual contract functions
- **Integration Tests**: Contract interactions
- **Edge Cases**: Boundary conditions and error states
- **Security Tests**: Access control and attack vectors
- **Gas Tests**: Gas optimization verification

## 🚀 Deployment

### Prerequisites

1. Set up environment variables in `.env`
2. Ensure sufficient balance for deployment
3. Verify network configuration

### Deployment Steps

1. **Compile contracts**:
   ```bash
   npm run compile
   ```

2. **Deploy to testnet**:
   ```bash
   npm run deploy:testnet
   ```

3. **Verify contracts** (automatic in deployment script):
   ```bash
   npm run verify
   ```

### Post-Deployment

After deployment, the script will:

1. Deploy all core contracts
2. Configure OracleAdapter with default settings
3. Authorize the Factory contract
4. Deploy a test bot instance
5. Save deployment information to `deployments/`
6. Verify contracts on Etherscan

## 📊 Monitoring

### Events to Monitor

- `BotDeployed`: New bot deployment
- `OrderRegistered`: New order registration
- `OrderFilled`: Order fill events
- `OrderReposted`: Order reposting
- `StrategyCreated`: New strategy creation
- `PriceUpdated`: Oracle price updates

### Key Metrics

- Total bots deployed
- Active strategies
- Order fill rates
- Gas usage optimization
- Strategy performance

## 🔒 Security

### Audit Considerations

- **Access Control**: All admin functions protected
- **Reentrancy**: Guards on all external calls
- **Input Validation**: Comprehensive parameter checks
- **Emergency Functions**: Pause and recovery mechanisms
- **Gas Limits**: Reasonable limits on operations

### Known Limitations

- Oracle dependency for price feeds
- LOP contract dependency
- Gas costs for complex strategies
- Network congestion considerations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Development Guidelines

- Follow Solidity style guide
- Add comprehensive tests
- Update documentation
- Consider gas optimization
- Security-first approach

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- 1inch team for the Limit Order Protocol
- OpenZeppelin for security libraries
- Hardhat team for development tools
- Foundry team for testing framework

## 📞 Support

- **Discord**: [1inch Community](https://discord.com/invite/1inch)
- **GitHub**: [Issues](https://github.com/your-username/inchbyinch/issues)
- **Documentation**: [1inch LOP Docs](https://docs.1inch.io/docs/limit-order-protocol/introduction/)

---

**Built for 1inch, powered by your strategy.**
