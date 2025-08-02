// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOracleAdapter
 * @notice Interface for OracleAdapter contract
 */
interface IOracleAdapter {
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint256 volatility;
        bool isValid;
    }

    struct VolatilityConfig {
        uint256 baseSpacing;
        uint256 volatilityMultiplier;
        uint256 minSpacing;
        uint256 maxSpacing;
    }

    event PriceUpdated(
        address indexed asset,
        uint256 indexed price,
        uint256 indexed timestamp,
        uint256 volatility
    );

    event VolatilityConfigUpdated(
        address indexed asset,
        uint256 baseSpacing,
        uint256 volatilityMultiplier
    );

    /**
     * @notice Gets the latest price for an asset
     * @param asset The asset address
     * @return priceData The price data
     */
    function getLatestPrice(address asset) external view returns (PriceData memory priceData);

    /**
     * @notice Gets the price at a specific timestamp
     * @param asset The asset address
     * @param timestamp The timestamp
     * @return price The price at the timestamp
     */
    function getPriceAt(address asset, uint256 timestamp) external view returns (uint256 price);

    /**
     * @notice Gets the volatility for an asset
     * @param asset The asset address
     * @param timeframe The timeframe in seconds
     * @return volatility The volatility value
     */
    function getVolatility(address asset, uint256 timeframe) external view returns (uint256 volatility);

    /**
     * @notice Calculates dynamic spacing based on volatility
     * @param asset The asset address
     * @param baseSpacing The base spacing
     * @return dynamicSpacing The calculated dynamic spacing
     */
    function calculateDynamicSpacing(
        address asset,
        uint256 baseSpacing
    ) external view returns (uint256 dynamicSpacing);

    /**
     * @notice Updates price data for an asset
     * @param asset The asset address
     * @param price The new price
     * @param timestamp The timestamp
     */
    function updatePrice(address asset, uint256 price, uint256 timestamp) external;

    /**
     * @notice Sets volatility configuration for an asset
     * @param asset The asset address
     * @param config The volatility configuration
     */
    function setVolatilityConfig(address asset, VolatilityConfig calldata config) external;

    /**
     * @notice Gets volatility configuration for an asset
     * @param asset The asset address
     * @return config The volatility configuration
     */
    function getVolatilityConfig(address asset) external view returns (VolatilityConfig memory config);

    /**
     * @notice Checks if price data is stale
     * @param asset The asset address
     * @param maxAge The maximum age in seconds
     * @return isStale Whether the price data is stale
     */
    function isPriceStale(address asset, uint256 maxAge) external view returns (bool isStale);

    /**
     * @notice Gets the price change percentage over a timeframe
     * @param asset The asset address
     * @param timeframe The timeframe in seconds
     * @return changePercent The price change percentage
     */
    function getPriceChangePercent(address asset, uint256 timeframe) external view returns (int256 changePercent);
    
    /**
     * @notice Sets a fallback price for an asset (when Chainlink is not available)
     * @param asset The asset address
     * @param price The price in USD (18 decimals)
     */
    function setFallbackPrice(address asset, uint256 price) external;
    
    /**
     * @notice Sets a Chainlink price feed for an asset
     * @param asset The asset address
     * @param feed The Chainlink feed address
     */
    function setChainlinkFeed(address asset, address feed) external;
    
    /**
     * @notice Gets the Chainlink feed address for an asset
     * @param asset The asset address
     * @return feed The Chainlink feed address
     */
    function getChainlinkFeed(address asset) external view returns (address feed);
    
    /**
     * @notice Authorizes an address to update prices
     * @param updater The address to authorize
     */
    function authorizeUpdater(address updater) external;
    
    /**
     * @notice Deauthorizes an address
     * @param updater The address to deauthorize
     */
    function deauthorizeUpdater(address updater) external;
} 