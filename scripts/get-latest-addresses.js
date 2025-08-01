const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Getting latest deployed contract addresses...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Get the latest transaction to find the deployed contracts
  const latestBlock = await ethers.provider.getBlockNumber();
  console.log("Latest block:", latestBlock);

  // Get the last few blocks to find deployment transactions
  for (let i = 0; i < 10; i++) {
    const block = await ethers.provider.getBlock(latestBlock - i);
    console.log(`Block ${latestBlock - i} has ${block.transactions.length} transactions`);
    
    for (const txHash of block.transactions) {
      try {
        const tx = await ethers.provider.getTransaction(txHash);
        const receipt = await ethers.provider.getTransactionReceipt(txHash);
        
        if (receipt && receipt.contractAddress) {
          console.log(`Contract deployed at: ${receipt.contractAddress}`);
        }
      } catch (error) {
        // Ignore errors for transactions we can't read
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 