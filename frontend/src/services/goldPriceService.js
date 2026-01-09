import { apiGet, apiPost } from './api';

// Cache configuration
const CACHE_KEY = 'pawnsys_gold_price_cache';
const CACHE_EXPIRY_HOURS = 6; // Only fetch every 6 hours

// Cache helper functions
const cache = {
  get: () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const expiryMs = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;

      return {
        data,
        timestamp,
        isExpired: now - timestamp >= expiryMs,
        ageMs: now - timestamp,
      };
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  },

  set: (data) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  },

  clear: () => {
    localStorage.removeItem(CACHE_KEY);
  },

  getAgeString: (timestamp) => {
    if (!timestamp) return 'N/A';
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  },
};

const goldPriceService = {
  /**
   * Get current gold prices (with caching)
   * @param {boolean} forceRefresh - Skip cache and fetch fresh data
   */
  getCurrentPrices: async (forceRefresh = false) => {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = cache.get();
      if (cached && !cached.isExpired) {
        console.log('Gold price: Using cached data');
        return {
          success: true,
          data: cached.data,
          fromCache: true,
          cacheTimestamp: cached.timestamp,
          cacheAge: cache.getAgeString(cached.timestamp),
        };
      }
    }

    // Fetch from API
    console.log('Gold price: Fetching from API');
    const response = await apiGet('/gold-prices/current');

    // If successful, save to cache
    if (response.success && response.data) {
      cache.set(response.data);
      return {
        ...response,
        fromCache: false,
        cacheTimestamp: Date.now(),
        cacheAge: 'Just now',
      };
    }

    // API failed - return error (NO fallback to cache)
    // This ensures you know when API limit is reached
    return response;
  },

  /**
   * Get gold prices by carat (with caching)
   */
  getCaratPrices: async (forceRefresh = false) => {
    const CARAT_CACHE_KEY = 'pawnsys_gold_carat_cache';
    
    // Check cache first
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CARAT_CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const expiryMs = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
          
          if (Date.now() - timestamp < expiryMs) {
            return {
              success: true,
              data,
              fromCache: true,
              cacheTimestamp: timestamp,
              cacheAge: cache.getAgeString(timestamp),
            };
          }
        }
      } catch (e) {}
    }

    // Fetch from API
    const response = await apiGet('/gold-prices/carat');

    if (response.success && response.data) {
      try {
        localStorage.setItem(CARAT_CACHE_KEY, JSON.stringify({
          data: response.data,
          timestamp: Date.now(),
        }));
      } catch (e) {}
      
      return {
        ...response,
        fromCache: false,
        cacheTimestamp: Date.now(),
        cacheAge: 'Just now',
      };
    }

    return response;
  },

  /**
   * Get dashboard prices (with caching)
   */
  getDashboardPrices: async (forceRefresh = false) => {
    const DASHBOARD_CACHE_KEY = 'pawnsys_gold_dashboard_cache';
    
    // Check cache first
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const expiryMs = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
          
          if (Date.now() - timestamp < expiryMs) {
            return {
              success: true,
              data,
              fromCache: true,
              cacheTimestamp: timestamp,
              cacheAge: cache.getAgeString(timestamp),
            };
          }
        }
      } catch (e) {}
    }

    // Fetch from API
    const response = await apiGet('/gold-prices/dashboard');

    if (response.success && response.data) {
      try {
        localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({
          data: response.data,
          timestamp: Date.now(),
        }));
      } catch (e) {}
      
      return {
        ...response,
        fromCache: false,
        cacheTimestamp: Date.now(),
        cacheAge: 'Just now',
      };
    }

    return response;
  },

  /**
   * Get historical prices for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   */
  getHistoricalPrices: async (date) => {
    return apiGet(`/gold-prices/historical/${date}`);
  },

  /**
   * Calculate item value based on weight and purity
   * @param {Object} data - { weight_grams, purity_code, custom_price }
   */
  calculateItemValue: async (data) => {
    return apiPost('/gold-prices/calculate', data);
  },

  /**
   * Get price history for charts
   * @param {number} days - Number of days to fetch (default 30)
   */
  getHistory: async (days = 30) => {
    return apiGet('/gold-prices/history', { days });
  },

  /**
   * Force refresh prices (clear cache and fetch new)
   */
  refreshPrices: async () => {
    // Clear all gold price caches
    cache.clear();
    localStorage.removeItem('pawnsys_gold_carat_cache');
    localStorage.removeItem('pawnsys_gold_dashboard_cache');
    
    // Fetch fresh data
    return apiPost('/gold-prices/refresh');
  },

  /**
   * Manually set gold price
   * @param {Object} data - { gold_price_per_gram, silver_price_per_gram }
   */
  setManualPrice: async (data) => {
    // Clear cache when manually setting price
    cache.clear();
    localStorage.removeItem('pawnsys_gold_carat_cache');
    localStorage.removeItem('pawnsys_gold_dashboard_cache');
    
    return apiPost('/gold-prices/manual', data);
  },

  /**
   * Get API usage stats (admin only)
   */
  getUsageStats: async () => {
    return apiGet('/gold-prices/usage');
  },

  /**
   * Format price value
   * @param {number} price
   * @param {string} currency
   */
  formatPrice: (price, currency = 'MYR') => {
    if (price === null || price === undefined) return '-';
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(price);
  },

  /**
   * Get cache status info
   */
  getCacheStatus: () => {
    const cached = cache.get();
    return {
      hasCachedData: !!cached,
      isExpired: cached?.isExpired ?? true,
      timestamp: cached?.timestamp ?? null,
      age: cached ? cache.getAgeString(cached.timestamp) : 'No cache',
      expiryHours: CACHE_EXPIRY_HOURS,
    };
  },

  /**
   * Clear all gold price caches
   */
  clearCache: () => {
    cache.clear();
    localStorage.removeItem('pawnsys_gold_carat_cache');
    localStorage.removeItem('pawnsys_gold_dashboard_cache');
  },
};

export default goldPriceService;