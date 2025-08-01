const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Checking factory authorization...");

  // Contract addresses
  const FACTORY_ADDRESS = "0x943d0b36bE3c57FAd833c112e948be94B73F2D6c";
  const ORDER_MANAGER_ADDRESS = "0x1DBDE29762eFA12CBcdf31436Ad5E38317069C0b";

  try {
    // Get OrderManager contract
    const OrderManager = await ethers.getContractFactory("OrderManager");
    const orderManager = OrderManager.attach(ORDER_MANAGER_ADDRESS);
    
    // Check if factory is authorized
    const isFactoryAuthorized = await orderManager.isBotAuthorized(FACTORY_ADDRESS);
    console.log("✅ Factory authorized in OrderManager:", isFactoryAuthorized);
    
    // Check OrderManager owner
    const orderManagerOwner = await orderManager.owner();
    console.log("✅ OrderManager owner:", orderManagerOwner);
    
    // Check factory owner
    const Factory = await ethers.getContractFactory("inchbyinchFactory");
    const factory = Factory.attach(FACTORY_ADDRESS);
    const factoryOwner = await factory.owner();
    console.log("✅ Factory owner:", factoryOwner);
    
    // Try to authorize factory if not authorized
    if (!isFactoryAuthorized) {
      console.log("Factory not authorized, attempting to authorize...");
      try {
        const tx = await orderManager.authorizeBot(FACTORY_ADDRESS);
        await tx.wait();
        console.log("✅ Factory authorized successfully!");
      } catch (error) {
        console.log("❌ Failed to authorize factory:", error.message);
      }
    }
    
  } catch (error) {
    console.error("❌ Error checking factory authorization:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 