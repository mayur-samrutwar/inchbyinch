// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IOracleAdapter.sol";

/**
 * @title OracleAdapter
 * @notice Provides price feeds and volatility data for inchbyinch
 * @dev Handles multiple price sources and dynamic spacing calculations
 */
contract OracleAdapter is IOracleAdapter, Ownable, ReentrancyGuard, Pausable {
    // Storage
    mapping(address => PriceData) private _latestPrices;
    mapping(address => VolatilityConfig) private _volatilityConfigs;
    mapping(address => uint256[]) private _priceHistory;
    mapping(address => uint256[]) private _priceTimestamps;
    
    // Configuration
    uint256 private constant MAX_PRICE_HISTORY = 100;
    uint256 private constant PRICE_PRECISION = 1e18;
    uint256 private constant MAX_VOLATILITY = 1000; // 1000% max volatility
    uint256 private constant MIN_VOLATILITY = 1; // 1% min volatility
    
    // Access control
    mapping(address => bool) private _authorizedUpdaters;
    
    // Events
    event UpdaterAuthorized(address indexed updater);
    event UpdaterDeauthorized(address indexed updater);
    event PriceHistoryCleared(address indexed asset);
    
    // Errors
    error InvalidPrice();
    error InvalidTimestamp();
    error InvalidVolatility();
    error PriceDataNotFound();
    error VolatilityConfigNotFound();
    error UnauthorizedUpdater();
    error InvalidVolatilityConfig();
    error StalePriceData();
    error InsufficientPriceHistory();
    error ZeroAddress();
    error ZeroAmount();
    
    // Modifiers
    modifier onlyAuthorizedUpdater() {
        if (!_authorizedUpdaters[msg.sender] && msg.sender != owner()) revert UnauthorizedUpdater();
        _;
    }
    
    modifier validAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress();
        _;
    }
    
    modifier validPrice(uint256 price) {
        if (price == 0) revert InvalidPrice();
        _;
    }
    
    modifier validTimestamp(uint256 timestamp) {
        if (timestamp == 0 || timestamp > block.timestamp) revert InvalidTimestamp();
        _;
    }
    
    modifier validVolatility(uint256 volatility) {
        if (volatility < MIN_VOLATILITY || volatility > MAX_VOLATILITY) revert InvalidVolatility();
        _;
    }
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice Authorizes an address to update prices
     * @param updater The address to authorize
     */
    function authorizeUpdater(address updater) external onlyOwner validAddress(updater) {
        _authorizedUpdaters[updater] = true;
        emit UpdaterAuthorized(updater);
    }
    
    /**
     * @notice Deauthorizes an address
     * @param updater The address to deauthorize
     */
    function deauthorizeUpdater(address updater) external onlyOwner validAddress(updater) {
        _authorizedUpdaters[updater] = false;
        emit UpdaterDeauthorized(updater);
    }
    
    /**
     * @notice Gets the latest price for an asset
     * @param asset The asset address
     * @return priceData The price data
     */
    function getLatestPrice(address asset) external view override validAddress(asset) returns (PriceData memory priceData) {
        priceData = _latestPrices[asset];
        if (priceData.price == 0) revert PriceDataNotFound();
    }
    
    /**
     * @notice Gets the price at a specific timestamp
     * @param asset The asset address
     * @param timestamp The timestamp
     * @return price The price at the timestamp
     */
    function getPriceAt(address asset, uint256 timestamp) external view override validAddress(asset) validTimestamp(timestamp) returns (uint256 price) {
        uint256[] storage timestamps = _priceTimestamps[asset];
        uint256[] storage prices = _priceHistory[asset];
        
        if (timestamps.length == 0) revert PriceDataNotFound();
        
        // Find the closest timestamp
        uint256 closestIndex = 0;
        uint256 minDiff = type(uint256).max;
        
        for (uint256 i = 0; i < timestamps.length; i++) {
            uint256 diff = timestamp > timestamps[i] ? timestamp - timestamps[i] : timestamps[i] - timestamp;
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }
        
        return prices[closestIndex];
    }
    
    /**
     * @notice Gets the volatility for an asset
     * @param asset The asset address
     * @param timeframe The timeframe in seconds
     * @return volatility The volatility value
     */
    function getVolatility(address asset, uint256 timeframe) external view override validAddress(asset) returns (uint256 volatility) {
        uint256[] storage prices = _priceHistory[asset];
        uint256[] storage timestamps = _priceTimestamps[asset];
        
        if (prices.length < 2) revert InsufficientPriceHistory();
        
        uint256 cutoffTime = block.timestamp - timeframe;
        uint256 sumSquaredReturns = 0;
        uint256 validReturns = 0;
        
        for (uint256 i = 1; i < prices.length; i++) {
            if (timestamps[i] >= cutoffTime) {
                uint256 priceChange = prices[i] > prices[i-1] ? prices[i] - prices[i-1] : prices[i-1] - prices[i];
                uint256 returnPercent = (priceChange * PRICE_PRECISION) / prices[i-1];
                sumSquaredReturns += returnPercent * returnPercent;
                validReturns++;
            }
        }
        
        if (validReturns == 0) revert InsufficientPriceHistory();
        
        // Calculate volatility as standard deviation
        volatility = sqrt(sumSquaredReturns / validReturns);
        
        // Ensure volatility is within bounds
        if (volatility < MIN_VOLATILITY) volatility = MIN_VOLATILITY;
        if (volatility > MAX_VOLATILITY) volatility = MAX_VOLATILITY;
        
        return volatility;
    }
    
    /**
     * @notice Calculates dynamic spacing based on volatility
     * @param asset The asset address
     * @param baseSpacing The base spacing
     * @return dynamicSpacing The calculated dynamic spacing
     */
    function calculateDynamicSpacing(
        address asset,
        uint256 baseSpacing
    ) external view override validAddress(asset) returns (uint256 dynamicSpacing) {
        VolatilityConfig memory config = _volatilityConfigs[asset];
        if (config.baseSpacing == 0) revert VolatilityConfigNotFound();
        
        uint256 volatility = this.getVolatility(asset, 3600); // 1 hour volatility
        uint256 volatilityMultiplier = config.volatilityMultiplier;
        
        // Calculate dynamic spacing
        dynamicSpacing = baseSpacing + ((volatility * volatilityMultiplier) / 100);
        
        // Ensure spacing is within bounds
        if (dynamicSpacing < config.minSpacing) dynamicSpacing = config.minSpacing;
        if (dynamicSpacing > config.maxSpacing) dynamicSpacing = config.maxSpacing;
        
        return dynamicSpacing;
    }
    
    /**
     * @notice Updates price data for an asset
     * @param asset The asset address
     * @param price The new price
     * @param timestamp The timestamp
     */
    function updatePrice(
        address asset,
        uint256 price,
        uint256 timestamp
    ) external override onlyAuthorizedUpdater validAddress(asset) validPrice(price) validTimestamp(timestamp) {
        // Update latest price
        _latestPrices[asset] = PriceData({
            price: price,
            timestamp: timestamp,
            volatility: 0, // Will be calculated on demand
            isValid: true
        });
        
        // Add to price history
        _priceHistory[asset].push(price);
        _priceTimestamps[asset].push(timestamp);
        
        // Maintain history size
        if (_priceHistory[asset].length > MAX_PRICE_HISTORY) {
            // Remove oldest entry
            for (uint256 i = 0; i < _priceHistory[asset].length - 1; i++) {
                _priceHistory[asset][i] = _priceHistory[asset][i + 1];
                _priceTimestamps[asset][i] = _priceTimestamps[asset][i + 1];
            }
            _priceHistory[asset].pop();
            _priceTimestamps[asset].pop();
        }
        
        // Calculate and update volatility
        try this.getVolatility(asset, 3600) returns (uint256 volatility) {
            _latestPrices[asset].volatility = volatility;
        } catch {
            // If volatility calculation fails, keep it at 0
        }
        
        emit PriceUpdated(asset, price, timestamp, _latestPrices[asset].volatility);
    }
    
    /**
     * @notice Sets volatility configuration for an asset
     * @param asset The asset address
     * @param config The volatility configuration
     */
    function setVolatilityConfig(
        address asset,
        VolatilityConfig calldata config
    ) external override onlyOwner validAddress(asset) {
        // Validate configuration
        if (config.baseSpacing == 0) revert InvalidVolatilityConfig();
        if (config.minSpacing == 0) revert InvalidVolatilityConfig();
        if (config.maxSpacing == 0) revert InvalidVolatilityConfig();
        if (config.minSpacing >= config.maxSpacing) revert InvalidVolatilityConfig();
        if (config.baseSpacing < config.minSpacing || config.baseSpacing > config.maxSpacing) revert InvalidVolatilityConfig();
        
        _volatilityConfigs[asset] = config;
        
        emit VolatilityConfigUpdated(asset, config.baseSpacing, config.volatilityMultiplier);
    }
    
    /**
     * @notice Gets volatility configuration for an asset
     * @param asset The asset address
     * @return config The volatility configuration
     */
    function getVolatilityConfig(address asset) external view override validAddress(asset) returns (VolatilityConfig memory config) {
        config = _volatilityConfigs[asset];
        if (config.baseSpacing == 0) revert VolatilityConfigNotFound();
    }
    
    /**
     * @notice Checks if price data is stale
     * @param asset The asset address
     * @param maxAge The maximum age in seconds
     * @return isStale Whether the price data is stale
     */
    function isPriceStale(address asset, uint256 maxAge) external view override validAddress(asset) returns (bool isStale) {
        PriceData memory priceData = _latestPrices[asset];
        if (priceData.price == 0) return true;
        
        return (block.timestamp - priceData.timestamp) > maxAge;
    }
    
    /**
     * @notice Gets the price change percentage over a timeframe
     * @param asset The asset address
     * @param timeframe The timeframe in seconds
     * @return changePercent The price change percentage
     */
    function getPriceChangePercent(
        address asset,
        uint256 timeframe
    ) external view override validAddress(asset) returns (int256 changePercent) {
        uint256[] storage prices = _priceHistory[asset];
        uint256[] storage timestamps = _priceTimestamps[asset];
        
        if (prices.length < 2) revert InsufficientPriceHistory();
        
        uint256 cutoffTime = block.timestamp - timeframe;
        uint256 currentPrice = prices[prices.length - 1];
        uint256 oldPrice = currentPrice;
        
        // Find the oldest price within timeframe
        for (uint256 i = prices.length - 1; i >= 0; i--) {
            if (timestamps[i] >= cutoffTime) {
                oldPrice = prices[i];
                break;
            }
        }
        
        if (oldPrice == 0) revert InsufficientPriceHistory();
        
        // Calculate percentage change
        if (currentPrice > oldPrice) {
            changePercent = int256(((currentPrice - oldPrice) * 10000) / oldPrice);
        } else {
            changePercent = -int256(((oldPrice - currentPrice) * 10000) / oldPrice);
        }
        
        return changePercent;
    }
    
    /**
     * @notice Clears price history for an asset
     * @param asset The asset address
     */
    function clearPriceHistory(address asset) external onlyOwner validAddress(asset) {
        delete _priceHistory[asset];
        delete _priceTimestamps[asset];
        delete _latestPrices[asset];
        
        emit PriceHistoryCleared(asset);
    }
    
    /**
     * @notice Gets price history for an asset
     * @param asset The asset address
     * @return prices Array of prices
     * @return timestamps Array of timestamps
     */
    function getPriceHistory(address asset) external view validAddress(asset) returns (uint256[] memory prices, uint256[] memory timestamps) {
        return (_priceHistory[asset], _priceTimestamps[asset]);
    }
    
    /**
     * @notice Checks if an updater is authorized
     * @param updater The updater address
     * @return isAuthorized Whether the updater is authorized
     */
    function isUpdaterAuthorized(address updater) external view returns (bool isAuthorized) {
        return _authorizedUpdaters[updater] || updater == owner();
    }
    
    /**
     * @notice Pauses the contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpauses the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Calculates square root
     * @param x The number to calculate square root for
     * @return y The square root
     */
    function sqrt(uint256 x) private pure returns (uint256 y) {
        if (x == 0) return 0;
        if (x == 1) return 1;
        
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
} 