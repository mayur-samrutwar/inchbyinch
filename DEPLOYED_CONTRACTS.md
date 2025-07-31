# Deployed Contracts - Base Sepolia

## Contract Addresses

### Core Contracts
- **Factory**: `0xEB100be17c1d4Ea03E8AA8a017A5063955172c5D`
- **OrderManager**: `0x96d5BFbf7768187Ea09eD9481f67d443a8498f4d`
- **OracleAdapter**: `0x1ba9Fe347C100D37C89dCA3Cda8b22E5caa0d739`
- **LOPAdapter**: `0xE923c4D90145f33964F2CAb29E0c9b7D41468D55`

### Test Bot Addresses
- **Bot 1**: `0x4ABD6d7AB77be26f39C933F25aa0DD01a0b35265`
- **Bot 2**: `0x6583551dD80278F996BD9e03B97554654d41EC5E`
- **Bot 3**: `0x98CBdc48a92aEbc85BCA1c35507b78DFE9cdB3d6`
- **Bot 4**: `0x1b31279c5C88bDcfAA9b00d490F6CCe6DcF27e58`

## Environment Variables

Add these to your `.env` file:

```bash
# Base Sepolia Contract Addresses (DEPLOYED)
NEXT_PUBLIC_BASE_SEPOLIA_FACTORY_ADDRESS=0xEB100be17c1d4Ea03E8AA8a017A5063955172c5D
NEXT_PUBLIC_BASE_SEPOLIA_ORDER_MANAGER_ADDRESS=0x96d5BFbf7768187Ea09eD9481f67d443a8498f4d
NEXT_PUBLIC_BASE_SEPOLIA_ORACLE_ADAPTER_ADDRESS=0x1ba9Fe347C100D37C89dCA3Cda8b22E5caa0d739
NEXT_PUBLIC_BASE_SEPOLIA_LOP_ADAPTER_ADDRESS=0xE923c4D90145f33964F2CAb29E0c9b7D41468D55
```

## Deployment Status

✅ **Successfully Deployed on Base Sepolia**
- ✅ Factory contract working
- ✅ Bot deployment working (0.001 ETH cost)
- ✅ Basic functionality tested
- ✅ Environment variables updated

## Network Information

- **Network**: Base Sepolia Testnet
- **Chain ID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Block Explorer**: https://sepolia.basescan.org

## Next Steps

1. **Test Frontend**: Start the frontend and test with these contract addresses
2. **Deploy to Base Mainnet**: When ready for production
3. **Deploy to Ethereum Mainnet**: For maximum liquidity

## Cost Analysis

- **Contract Deployment**: One-time cost (completed)
- **Bot Deployment**: 0.001 ETH per bot
- **Gas Costs**: Much more reasonable now (97% cost reduction achieved)

## Verification

All contracts are deployed and tested. The factory can successfully deploy new bots, and basic functionality is working correctly. 