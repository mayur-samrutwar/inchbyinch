# 🚀 inchbyinch Deployment Guide

## 📋 Overview

This guide will help you deploy inchbyinch to different networks. We support multiple networks with different configurations:

### **🌐 Supported Networks**

| Network | Chain ID | LOP Type | Status | Use Case |
|---------|----------|----------|--------|----------|
| **Base Sepolia** | 84532 | MockLOP | ✅ Ready | Testing |
| **Base Mainnet** | 8453 | Real LOP | ✅ Ready | Production |
| **Ethereum Mainnet** | 1 | Real LOP | ✅ Ready | Production |
| **Sepolia** | 11155111 | MockLOP | ✅ Ready | Testing |

## 🎯 Prerequisites

### 1. **Environment Setup**
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 2. **Required Accounts & Keys**
- **Private Key**: For contract deployment
- **Network ETH**: For gas fees (get from faucet)
- **Block Explorer API Key**: For contract verification (optional)

### 3. **Get Testnet ETH**
```bash
# Base Sepolia Faucet
https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

# Sepolia Faucet
https://sepoliafaucet.com/
```

## 🔧 Configuration

### 1. **Environment Variables**
Edit `.env` file:
```bash
# Required
PRIVATE_KEY=your_private_key_here

# Network RPC URLs
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# Optional (for contract verification)
BASESCAN_API_KEY=your_basescan_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### 2. **Network Configuration**
All networks are configured in:
- `hardhat.config.js`
- `utils/contracts.js`
- `utils/wagmi.js`

## 🚀 Deployment Options

### **Option 1: Base Sepolia (Recommended for Testing)**
```bash
# Deploy to Base Sepolia with MockLOP
npx hardhat run scripts/deploy-base-sepolia.js --network baseSepolia
```

### **Option 2: Base Mainnet (Production)**
```bash
# Deploy to Base mainnet with Real LOP
npx hardhat run scripts/deploy-base-mainnet.js --network base
```

### **Option 3: Ethereum Mainnet (Production)**
```bash
# Deploy to Ethereum mainnet with Real LOP
npx hardhat run scripts/deploy-mainnet-test.js --network mainnet
```

### **Option 4: Sepolia (Testing)**
```bash
# Deploy to Sepolia with MockLOP
npx hardhat run scripts/deploy-base-sepolia.js --network sepolia
```

## 📊 Network Comparison

### **Base Sepolia (Testing)**
- ✅ **Fast & Cheap**: Low gas fees
- ✅ **MockLOP**: Safe testing environment
- ✅ **Faucet Available**: Easy to get test ETH
- ✅ **Real Tokens**: WETH, USDC available
- ❌ **Not Production**: Testnet only

### **Base Mainnet (Production)**
- ✅ **Real LOP**: Full 1inch integration
- ✅ **Production Ready**: Real trading
- ✅ **Low Gas**: Cheaper than Ethereum
- ✅ **Real Tokens**: WETH, USDC, DAI
- ❌ **Real Money**: Requires real ETH

### **Ethereum Mainnet (Production)**
- ✅ **Real LOP**: Full 1inch integration
- ✅ **Most Liquid**: Highest trading volume
- ✅ **Established**: Most trusted network
- ❌ **High Gas**: Expensive transactions
- ❌ **Real Money**: Requires real ETH

## 🧪 Testing Strategy

### **1. Local Testing**
```bash
# Run all tests
npx hardhat test

# Run specific test files
npx hardhat test test/Simple.test.js
npx hardhat test test/Factory.test.js
```

### **2. Testnet Testing**
```bash
# Test on Base Sepolia
npx hardhat test test/ForkTests.test.js --network baseSepolia

# Test on Sepolia
npx hardhat test test/ForkTests.test.js --network sepolia
```

### **3. Frontend Testing**
```bash
# Start development server
npm run dev

# Test with MetaMask connected to desired network
```

## 📄 Deployment Output

Each deployment script creates a JSON file:
- `deployment-base-sepolia.json`
- `deployment-base-mainnet.json`
- `deployment-mainnet.json`

Example output:
```json
{
  "network": "base",
  "chainId": 8453,
  "deployer": "0x...",
  "contracts": {
    "factory": "0x...",
    "orderManager": "0x...",
    "oracleAdapter": "0x...",
    "lopAdapter": "0x...",
    "testBot": "0x..."
  },
  "external": {
    "lop": "0x111111125421ca6dc452d289314280a0f8842a65",
    "weth": "0x4200000000000000000000000000000000000006",
    "usdc": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  }
}
```

## 🔍 Verification

### **1. Block Explorers**
- **Base**: https://basescan.org
- **Base Sepolia**: https://sepolia.basescan.org
- **Ethereum**: https://etherscan.io
- **Sepolia**: https://sepolia.etherscan.io

### **2. Contract Interaction**
```bash
# Test factory deployment
npx hardhat console --network base
> const factory = await ethers.getContractAt("inchbyinchFactory", "FACTORY_ADDRESS")
> await factory.getUserBots("YOUR_ADDRESS")
```

### **3. Frontend Verification**
1. Connect MetaMask to desired network
2. Visit your frontend
3. Try deploying a bot
4. Check dashboard for active orders

## 🎯 Recommended Deployment Path

### **Phase 1: Testing (Base Sepolia)**
```bash
# 1. Deploy to Base Sepolia
npx hardhat run scripts/deploy-base-sepolia.js --network baseSepolia

# 2. Update environment variables
# Copy addresses from deployment output to .env

# 3. Test frontend
npm run dev
# Connect MetaMask to Base Sepolia
```

### **Phase 2: Production (Base Mainnet)**
```bash
# 1. Deploy to Base mainnet
npx hardhat run scripts/deploy-base-mainnet.js --network base

# 2. Update environment variables
# Copy addresses from deployment output to .env

# 3. Test with real tokens
# Connect MetaMask to Base mainnet
```

### **Phase 3: Full Production (Ethereum Mainnet)**
```bash
# 1. Deploy to Ethereum mainnet
npx hardhat run scripts/deploy-mainnet-test.js --network mainnet

# 2. Update environment variables
# Copy addresses from deployment output to .env

# 3. Launch production
# Deploy frontend to Vercel/Netlify
```

## 🚨 Troubleshooting

### **Common Issues**

#### 1. **Insufficient Balance**
```bash
Error: Insufficient balance for deployment
```
**Solution**: Get more ETH from faucet or bridge

#### 2. **RPC Issues**
```bash
Error: network error
```
**Solution**: Check RPC URL or use different provider

#### 3. **Gas Issues**
```bash
Error: gas required exceeds allowance
```
**Solution**: Increase gas limit in hardhat config

#### 4. **Contract Verification Fails**
```bash
Error: Already Verified
```
**Solution**: Contract already verified, skip verification

### **Debug Commands**
```bash
# Check network
npx hardhat node

# Check compilation
npx hardhat compile

# Check gas usage
npx hardhat test --gas

# Check specific network
npx hardhat console --network base
```

## 🎉 Success Criteria

### ✅ **Deployment Success**
- [ ] All contracts deployed
- [ ] Factory address recorded
- [ ] Test bot deployed
- [ ] Test strategy created
- [ ] Environment variables updated

### ✅ **Functionality Success**
- [ ] Frontend loads without errors
- [ ] Wallet connects to network
- [ ] Bot deployment works
- [ ] Strategy creation works
- [ ] Dashboard shows data

### ✅ **Integration Success**
- [ ] LOP integration works (MockLOP for testnets, Real LOP for mainnets)
- [ ] Order management works
- [ ] Price feeds work
- [ ] Withdrawal functions work

## 🚀 Next Steps

### **If Testing Success:**
1. **Deploy to Base Mainnet**
   ```bash
   npx hardhat run scripts/deploy-base-mainnet.js --network base
   ```

2. **Deploy to Ethereum Mainnet**
   ```bash
   npx hardhat run scripts/deploy-mainnet-test.js --network mainnet
   ```

3. **Production Launch**
   - Deploy frontend to Vercel/Netlify
   - Add analytics
   - Monitor performance

### **If Issues Found:**
1. **Debug and Fix**
   - Check error logs
   - Test locally
   - Fix issues

2. **Re-deploy**
   - Update contracts if needed
   - Re-run deployment
   - Test again

## 📞 Support

### **Resources**
- **Base**: https://docs.base.org
- **Base Sepolia**: https://docs.base.org/guides/deploy-smart-contracts
- **Hardhat**: https://hardhat.org/docs
- **1inch LOP**: https://docs.1inch.io/docs/limit-order-protocol/introduction/

### **Community**
- **Base Discord**: https://discord.gg/base
- **1inch Discord**: https://discord.com/invite/1inch

---

**🎉 Ready to deploy to your preferred network! Let's go! 🚀** 