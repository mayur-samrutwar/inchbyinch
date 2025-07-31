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
    uint256 public constant MAX_BOTS_PER_USER = 10;
    uint256 public constant MIN_DEPOSIT = 0.001 ether; // Reduced from 0.01 to 0.001 for testing
    uint256 public constant MAX_DEPOSIT = 1000 ether;
    
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
    event DepositLimitsUpdated(uint256 minDeposit, uint256 maxDeposit);
    
    // Errors
    error BotDeploymentFailed();
    error BotAlreadyExists();
    error BotNotFound();
    error UserLimitExceeded();
    error InvalidDeposit();
    error InsufficientDeposit();
    error ExcessiveDeposit();
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
    
    modifier validDeposit(uint256 amount) {
        if (amount < MIN_DEPOSIT) revert InsufficientDeposit();
        if (amount > MAX_DEPOSIT) revert ExcessiveDeposit();
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
     * @notice Deploys a new bot for a user
     * @param user The user address
     * @return bot The deployed bot address
     */
    function deployBot(address user) external payable validAddress(user) validDeposit(msg.value) returns (address bot) {
        // Check user limit
        if (userBots[user].length >= MAX_BOTS_PER_USER) revert UserLimitExceeded();
        
        // Deploy bot using minimal proxy
        bot = Clones.clone(botImplementation);
        
        // Initialize the bot
        inchbyinchBot(bot).initialize(lop, lopAdapter, orderManager, oracleAdapter, user);
        
        // Note: Bot ownership remains with factory for security
        // User can interact through factory functions
        
        // Note: Bot authorization should be done by the owner of OrderManager
        // This is typically done during deployment or by admin
        
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
    ) external payable validAddress(user) returns (address[] memory bots) {
        if (count == 0 || count > 5) revert ZeroAmount();
        if (userBots[user].length + count > MAX_BOTS_PER_USER) revert UserLimitExceeded();
        
        uint256 requiredDeposit = MIN_DEPOSIT * count;
        if (msg.value < requiredDeposit) revert InsufficientDeposit();
        if (msg.value > MAX_DEPOSIT * count) revert ExcessiveDeposit();
        
        bots = new address[](count);
        
        for (uint256 i = 0; i < count; i++) {
            address bot = Clones.clone(botImplementation);
            
            // Initialize the bot
            inchbyinchBot(bot).initialize(lop, lopAdapter, orderManager, oracleAdapter, user);
            
            // Note: Bot ownership remains with factory for security
            
            // Note: Bot authorization should be done by the owner of OrderManager
            
            // Store bot
            userBots[user].push(bot);
            botDeploymentCount[user]++;
            
            bots[i] = bot;
            
            emit BotDeployed(user, bot, userBots[user].length - 1, MIN_DEPOSIT);
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
    ) external payable validAddress(user) validDeposit(msg.value) returns (address newBot) {
        address[] storage bots = userBots[user];
        if (botIndex >= bots.length) revert BotNotFound();
        
        address oldBot = bots[botIndex];
        if (oldBot == address(0)) revert BotNotFound();
        
        // Deploy new bot
        newBot = Clones.clone(botImplementation);
        
        // Initialize the new bot
        inchbyinchBot(newBot).initialize(lop, lopAdapter, orderManager, oracleAdapter, user);
        
        // Note: Bot ownership remains with factory for security
        
        // Note: Bot authorization should be done by the owner of OrderManager
        
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
    function authorizeToken(address token) external onlyOwner validAddress(token) {
        authorizedTokens[token] = true;
        emit TokenAuthorized(token);
    }
    
    /**
     * @notice Deauthorizes a token
     * @param token The token address
     */
    function deauthorizeToken(address token) external onlyOwner validAddress(token) {
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
     * @return _maxBotsPerUser Maximum bots per user
     * @return _minDeposit Minimum deposit
     * @return _maxDeposit Maximum deposit
     */
    function getFactoryConfig() external view returns (
        address _orderManager,
        address _oracleAdapter,
        address _lop,
        uint256 _maxBotsPerUser,
        uint256 _minDeposit,
        uint256 _maxDeposit
    ) {
        return (
            orderManager,
            oracleAdapter,
            lop,
            MAX_BOTS_PER_USER,
            MIN_DEPOSIT,
            MAX_DEPOSIT
        );
    }
    
    /**
     * @notice Withdraws ETH from the factory
     * @param amount The amount to withdraw
     */
    function withdrawETH(uint256 amount) external onlyOwner validAmount(amount) {
        require(amount <= address(this).balance, "Insufficient balance");
        
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @notice Withdraws tokens from the factory
     * @param token The token address
     * @param amount The amount to withdraw
     */
    function withdrawTokens(address token, uint256 amount) external onlyOwner validAddress(token) validAmount(amount) {
        // Use low-level call for token transfer
        (bool success, ) = token.call(abi.encodeWithSignature("transfer(address,uint256)", owner(), amount));
        require(success, "Transfer failed");
    }
    
    /**
     * @notice Pauses the factory
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpauses the factory
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Emergency function to recover stuck tokens
     * @param token The token address
     * @param to The recipient address
     * @param amount The amount to recover
     */
    function emergencyRecover(address token, address to, uint256 amount) external onlyOwner validAddress(token) validAddress(to) validAmount(amount) {
        // Use low-level call for token transfer
        (bool success, ) = token.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        require(success, "Transfer failed");
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
} 