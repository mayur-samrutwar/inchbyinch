// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./inchbyinchBot.sol";
import "./interfaces/IOrderManager.sol";
import "./interfaces/IOracleAdapter.sol";

/**
 * @title inchbyinchFactory
 * @notice Factory contract for deploying inchbyinch bot instances
 * @dev Uses minimal proxy pattern for gas efficiency
 */
contract inchbyinchFactory is Ownable, ReentrancyGuard, Pausable {
    using Clones for address;
    
    // Configuration
    uint256 public constant BOT_GAS_FUNDING = 0.0005 ether; // Required ETH for bot gas
    
    // State
    address public immutable botImplementation;
    address public immutable orderManager;
    address public immutable oracleAdapter;
    address public immutable lop;
    address public immutable lopAdapter;
    
    mapping(address => address[]) public userBots;
    mapping(address => bool) public authorizedTokens;
    mapping(address => uint256) public botDeploymentCount;
    
    // Events
    event BotDeployed(
        address indexed user,
        address indexed bot,
        uint256 indexed botIndex,
        uint256 deploymentCost
    );
    
    event BotUpgraded(
        address indexed user,
        address indexed oldBot,
        address indexed newBot
    );
    
    event TokenAuthorized(address indexed token);
    event TokenDeauthorized(address indexed token);
    
    event UserLimitUpdated(uint256 newLimit);
    event BotFunded(address indexed bot, address indexed funder, uint256 amount);
    
    // Errors
    error BotDeploymentFailed();
    error BotAlreadyExists();
    error BotNotFound();


    error UnauthorizedToken();
    error InvalidBotAddress();
    error BotUpgradeFailed();
    error ZeroAddress();
    error ZeroAmount();
    
    // Modifiers
    modifier validAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress();
        _;
    }
    
    modifier validAmount(uint256 amount) {
        if (amount == 0) revert ZeroAmount();
        _;
    }
    

    
    modifier tokenAuthorized(address token) {
        if (!authorizedTokens[token]) revert UnauthorizedToken();
        _;
    }
    
    constructor(
        address _botImplementation,
        address _orderManager,
        address _oracleAdapter,
        address _lop,
        address _lopAdapter
    ) Ownable(msg.sender) validAddress(_botImplementation) validAddress(_orderManager) validAddress(_oracleAdapter) validAddress(_lop) validAddress(_lopAdapter) {
        botImplementation = _botImplementation;
        orderManager = _orderManager;
        oracleAdapter = _oracleAdapter;
        lop = _lop;
        lopAdapter = _lopAdapter;
    }
    
    /**
     * @notice Deploys a new bot for a user with optional funding
     * @param user The user address
     * @return bot The deployed bot address
     */
    function deployBot(address user) external payable whenNotPaused validAddress(user) returns (address bot) {
        // Require funding for bot gas
        require(msg.value == BOT_GAS_FUNDING, "Must send exactly 0.0005 ETH for bot gas");
        
        // Deploy bot using minimal proxy
        bot = Clones.clone(botImplementation);
        
        // Initialize the bot
        inchbyinchBot(payable(bot)).initialize(lop, lopAdapter, orderManager, oracleAdapter);
        
        // Fund the bot with the ETH
        (bool success, ) = payable(bot).call{value: msg.value}("");
        require(success, "Failed to fund bot");
        
        // Store bot
        userBots[user].push(bot);
        botDeploymentCount[user]++;
        
        emit BotDeployed(user, bot, userBots[user].length - 1, msg.value);
        
        return bot;
    }
    
    /**
     * @notice Deploys multiple bots for a user
     * @param user The user address
     * @param count The number of bots to deploy
     * @return bots Array of deployed bot addresses
     */
    function deployMultipleBots(
        address user,
        uint256 count
    ) external payable whenNotPaused validAddress(user) returns (address[] memory bots) {
        if (count == 0 || count > 5) revert ZeroAmount();
        
        // Require funding for bot gas
        uint256 requiredFunding = BOT_GAS_FUNDING * count;
        require(msg.value == requiredFunding, "Must send exactly 0.0005 ETH per bot for gas");
        
        bots = new address[](count);
        
        for (uint256 i = 0; i < count; i++) {
            address bot = Clones.clone(botImplementation);
            
            // Initialize the bot
            inchbyinchBot(payable(bot)).initialize(lop, lopAdapter, orderManager, oracleAdapter);
            
            // Fund the bot with required ETH
            (bool success, ) = payable(bot).call{value: BOT_GAS_FUNDING}("");
            require(success, "Failed to fund bot");
            
            // Store bot
            userBots[user].push(bot);
            botDeploymentCount[user]++;
            
            bots[i] = bot;
            
            emit BotDeployed(user, bot, userBots[user].length - 1, BOT_GAS_FUNDING);
        }
        
        return bots;
    }
    
    /**
     * @notice Upgrades a user's bot
     * @param user The user address
     * @param botIndex The index of the bot to upgrade
     * @return newBot The new bot address
     */
    function upgradeBot(
        address user,
        uint256 botIndex
    ) external whenNotPaused validAddress(user) returns (address newBot) {
        address[] storage bots = userBots[user];
        if (botIndex >= bots.length) revert BotNotFound();
        
        address oldBot = bots[botIndex];
        if (oldBot == address(0)) revert BotNotFound();
        
        // Deploy new bot
        newBot = Clones.clone(botImplementation);
        
        // Initialize the new bot
        inchbyinchBot(payable(newBot)).initialize(lop, lopAdapter, orderManager, oracleAdapter);
        
        // Replace old bot
        bots[botIndex] = newBot;
        
        emit BotUpgraded(user, oldBot, newBot);
        
        return newBot;
    }
    
    /**
     * @notice Gets all bots for a user
     * @param user The user address
     * @return bots Array of bot addresses
     */
    function getUserBots(address user) external view validAddress(user) returns (address[] memory bots) {
        return userBots[user];
    }
    
    /**
     * @notice Gets a specific bot for a user
     * @param user The user address
     * @param botIndex The bot index
     * @return bot The bot address
     */
    function getUserBot(address user, uint256 botIndex) external view validAddress(user) returns (address bot) {
        address[] storage bots = userBots[user];
        if (botIndex >= bots.length) revert BotNotFound();
        return bots[botIndex];
    }
    
    /**
     * @notice Gets the number of bots for a user
     * @param user The user address
     * @return count The number of bots
     */
    function getUserBotCount(address user) external view validAddress(user) returns (uint256 count) {
        return userBots[user].length;
    }
    
    /**
     * @notice Gets the deployment count for a user
     * @param user The user address
     * @return count The deployment count
     */
    function getUserDeploymentCount(address user) external view validAddress(user) returns (uint256 count) {
        return botDeploymentCount[user];
    }
    
    /**
     * @notice Authorizes a token for bot deployment
     * @param token The token address
     */
    function authorizeToken(address token) external validAddress(token) {
        authorizedTokens[token] = true;
        emit TokenAuthorized(token);
    }
    
    /**
     * @notice Deauthorizes a token
     * @param token The token address
     */
    function deauthorizeToken(address token) external validAddress(token) {
        authorizedTokens[token] = false;
        emit TokenDeauthorized(token);
    }
    
    /**
     * @notice Checks if a token is authorized
     * @param token The token address
     * @return isAuthorized Whether the token is authorized
     */
    function isTokenAuthorized(address token) external view validAddress(token) returns (bool isAuthorized) {
        return authorizedTokens[token];
    }
    
    /**
     * @notice Gets bot implementation address
     * @return implementation The implementation address
     */
    function getBotImplementation() external view returns (address implementation) {
        return botImplementation;
    }
    
    /**
     * @notice Gets factory configuration
     * @return _orderManager Order manager address
     * @return _oracleAdapter Oracle adapter address
     * @return _lop LOP address
     */
    function getFactoryConfig() external view returns (
        address _orderManager,
        address _oracleAdapter,
        address _lop
    ) {
        return (
            orderManager,
            oracleAdapter,
            lop
        );
    }
    
    /**
     * @notice Withdraws ETH from the factory
     * @param amount The amount to withdraw
     */
    function withdrawETH(uint256 amount) external validAmount(amount) {
        require(amount <= address(this).balance, "Insufficient balance");
        
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @notice Withdraws tokens from the factory
     * @param token The token address
     * @param amount The amount to withdraw
     */
    function withdrawTokens(address token, uint256 amount) external validAddress(token) validAmount(amount) {
        // Use low-level call for token transfer
        (bool success, ) = token.call(abi.encodeWithSignature("transfer(address,uint256)", owner(), amount));
        require(success, "Transfer failed");
    }
    
    /**
     * @notice Pauses the factory
     */
    function pause() external {
        _pause();
    }
    
    /**
     * @notice Unpauses the factory
     */
    function unpause() external {
        _unpause();
    }
    
    /**
     * @notice Emergency function to recover stuck tokens
     * @param token The token address
     * @param to The recipient address
     * @param amount The amount to recover
     */
    function emergencyRecover(address token, address to, uint256 amount) external validAddress(token) validAddress(to) validAmount(amount) {
        // Use low-level call for token transfer
        (bool success, ) = token.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        require(success, "Transfer failed");
    }
    
    /**
     * @notice Allows users to fund their bots with ETH for gas
     * @param botAddress The bot address to fund
     */
    function fundBot(address botAddress) external payable {
        require(msg.value > 0, "Must send ETH");
        
        // Transfer ETH to the bot
        (bool success, ) = payable(botAddress).call{value: msg.value}("");
        require(success, "Transfer failed");
        
        emit BotFunded(botAddress, msg.sender, msg.value);
    }
    
    /**
     * @notice Receives ETH
     */
    receive() external payable {
        // Accept ETH deposits
    }
    
    /**
     * @notice Fallback function
     */
    fallback() external payable {
        // Accept ETH deposits
    }

    /**
     * @notice Sets fallback price in OracleAdapter
     * @param asset The asset address
     * @param price The price in USD (18 decimals)
     */
    function setOracleFallbackPrice(address asset, uint256 price) external {
        IOracleAdapter(oracleAdapter).setFallbackPrice(asset, price);
    }
    
    /**
     * @notice Sets Chainlink feed in OracleAdapter
     * @param asset The asset address
     * @param feed The Chainlink feed address
     */
    function setOracleChainlinkFeed(address asset, address feed) external {
        IOracleAdapter(oracleAdapter).setChainlinkFeed(asset, feed);
    }
    
    /**
     * @notice Sets volatility config in OracleAdapter
     * @param asset The asset address
     * @param config The volatility configuration
     */
    function setOracleVolatilityConfig(address asset, IOracleAdapter.VolatilityConfig calldata config) external {
        IOracleAdapter(oracleAdapter).setVolatilityConfig(asset, config);
    }
    
    /**
     * @notice Authorizes an updater in OracleAdapter
     * @param updater The updater address
     */
    function authorizeOracleUpdater(address updater) external {
        IOracleAdapter(oracleAdapter).authorizeUpdater(updater);
    }
    
    /**
     * @notice Deauthorizes an updater in OracleAdapter
     * @param updater The updater address
     */
    function deauthorizeOracleUpdater(address updater) external {
        IOracleAdapter(oracleAdapter).deauthorizeUpdater(updater);
    }
} 