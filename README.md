# inchbyinch

A smart contract system that builds on top of the 1inch Limit Order Protocol (LOP), introducing ladder-style trading automation for retail DeFi users. All strategies execute fully onchain using LOP native structures, without relying on any 1inch APIs or backend.

## 🎯 Project Overview

inchbyinch is designed for a hackathon track that specifically encourages innovation using 1inch LOP, onchain strategy execution, and smart contract-level order management.

### Key Features

- **Buy/Sell Range Deployment**: Define a ladder of orders in a specified price range
- **Auto-Reposting**: Orders are re-posted at same or next-level price upon fill
- **Strategy Chaining**: E.g., buy low and auto-place sell at +10%
- **Budget Guardrails**: Max spend/capital usage enforced onchain
- **Stop Conditions**: Cancel all if no activity after X hours, price breaks stop-loss, etc
- **Mean Reversion Bots**: Buy down, sell up
- **Grid Strategy**: Ping-pong between buy/sell ladders
- **Volatility Adaptive**: Orders tighten/loosen based on volatility feed

## 🏗️ Architecture

### Core Contracts

- **`inchbyinchFactory.sol`**: Deploys per-user bot contracts
- **`inchbyinchBot.sol`**: Owns the user strategy and trading logic
- **`OrderManager.sol`**: Metadata and indexing of active strategies/orders
- **`OracleAdapter.sol`**: Interfaces with volatility feeds for dynamic spacing
- **`LOPAdapter.sol`**: Interfaces with 1inch LOP for order management

### Design Highlights

- Uses 1inch LOP's interaction field for custom callbacks (no APIs used)
- No central relayer or backend infra
- Laddered limit order deployment (Buy/Sell Ranges)
- Auto-reposting logic
- Strategy chaining (e.g., buy then auto-sell at X%)
- Chain-native execution bots

## 🧪 Testing

All tests are passing! The test suite covers:

- **Core Contract Tests**: Deployment and basic functionality
- **Factory Tests**: Bot deployment and management
- **LOP Integration Tests**: Order creation and management
- **Strategy Tests**: Buy/sell ladders, chaining, stop conditions
- **OrderManager Tests**: Order registration and tracking
- **OracleAdapter Tests**: Price feeds and volatility calculations

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/Strategy.test.js
```

## 🚀 Deployment

### Prerequisites

- Node.js 18+
- Hardhat
- Ethers.js

### Installation

```bash
npm install
```

### Deploy to Testnet

```bash
# Deploy to Base Sepolia
npx hardhat run scripts/deploy.js --network base-sepolia

# Deploy to Polygon Amoy
npx hardhat run scripts/deploy.js --network polygon-amoy
```

### Local Development

```bash
# Start local node
npx hardhat node

# Deploy to local network
npx hardhat run scripts/deploy.js --network localhost
```

## 📊 Current Status

### ✅ Phase 1: Ideation & Core Logic (COMPLETED)
- [x] Finalize use cases and edge cases (buy ladder, sell ladder, flip strategy, reposting)
- [x] Design smart contract structure: `inchbyinchFactory`, `inchbyinchBot`, `OrderManager`
- [x] Write base contract that can place a single LOP order with custom `interaction` data
- [x] Simulate simple buy ladder order in Remix with hardcoded prices
- [x] Write mock interaction logic for reposting after fill (no oracle yet)
- [x] Create test cases for these behaviors in Foundry/Hardhat

### ✅ Phase 2: Deployable MVP (COMPLETED)
- [x] Build working `inchbyinchBot` that can:
  - Place multiple limit orders using 1inch LOP
  - Track fill status
  - Cancel & repost filled orders (reposting to next step in ladder)
- [x] Deploy on testnet (e.g., Base Sepolia or Polygon Amoy)
- [x] Write basic README and deployment script
- [x] Manually test with real token pairs and mocked fills

### 🎯 Phase 3: Frontend MVP (NEXT)
- [ ] Scaffold React + Viem + RainbowKit frontend
- [ ] Create simple UI for:
  - Selecting token pair
  - Entering range config (start price, spacing, # of orders)
  - Deploying strategy
- [ ] Show active orders and statuses (read from contract events or Graph)
- [ ] Add cancel-all button

## 🔧 Technical Details

### 1inch LOP Integration

The system extends LOP by:
- Using native LOP order structs with custom interaction fields (calldata callbacks)
- Implementing strategy logic in contracts, not backend APIs
- Orders not posted via 1inch public API — all onchain
- Smart contracts auto-manage cancel, repost, fill + trigger strategy chaining

### Hackathon Qualification

✅ Onchain execution of strategies only (not API-based)
✅ Custom orders created and posted onchain
✅ No use of official LOP posting APIs
✅ Commit history tracked with deploy/test logs

## 📚 Resources

- [1inch Limit Order Protocol GitHub](https://github.com/1inch/limit-order-protocol)
- [1inch LOP Docs](https://docs.1inch.io/docs/limit-order-protocol/introduction/)
- [LOP Contract](https://etherscan.io/address/0x3ef51736315f52d568d6d2cf289419b9cfffe782#code)
- [1inch Community](https://discord.com/invite/1inch)

## 🤝 Contributing

This project is built for a hackathon. Feel free to fork and extend the functionality!

## 📄 License

MIT License - see LICENSE file for details.
