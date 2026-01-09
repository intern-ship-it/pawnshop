/**
 * Gold Price Cache Utility
 * Caches gold prices to reduce API calls
 */

const CACHE_KEY = 'pawnsys_gold_price_cache';
const CACHE_EXPIRY_HOURS = 6; // Only fetch every 6 hours (4 calls/day = ~120/month)

export const goldPriceCache = {
  /**
   * Get cached gold price if still valid
   */
  get: () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const expiryMs = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;

      // Check if cache is still valid
      if (now - timestamp < expiryMs) {
        return {
          data,
          timestamp,
          isExpired: false,
          age: now - timestamp,
        };
      }

      // Cache expired but return data anyway (can be used as fallback)
      return {
        data,
        timestamp,
        isExpired: true,
        age: now - timestamp,
      };
    } catch (error) {
      console.error('Error reading gold price cache:', error);
      return null;
    }
  },

  /**
   * Save gold price to cache
   */
  set: (data) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      return true;
    } catch (error) {
      console.error('Error saving gold price cache:', error);
      return false;
    }
  },

  /**
   * Clear cache (force refresh on next fetch)
   */
  clear: () => {
    try {
      localStorage.removeItem(CACHE_KEY);
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get cache age in human readable format
   */
  getAgeString: (timestamp) => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  },

  /**
   * Check if should fetch new data
   */
  shouldFetch: () => {
    const cached = goldPriceCache.get();
    return !cached || cached.isExpired;
  },
};

export default goldPriceCache;