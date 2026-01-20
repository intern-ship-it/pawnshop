/**
 * Gold Price Service - Metals.Dev + BNM Integration
 * 
 * Matches GoldPriceController.php endpoints:
 * - GET  /api/gold-prices/latest          - Get latest prices
 * - POST /api/gold-prices/fetch           - Fetch fresh from APIs
 * - GET  /api/gold-prices/date/{date}     - Get prices for date
 * - GET  /api/gold-prices/history         - Get price history
 * - GET  /api/gold-prices/sources         - Get API source status
 * - GET  /api/gold-prices/compare         - Compare Metals.Dev vs BNM
 * - GET  /api/gold-prices/audit           - Get audit history
 * - GET  /api/gold-prices/compliance-report - KPKT compliance report
 * - POST /api/gold-prices/manual          - Set manual price
 */

import { apiGet, apiPost } from './api';

// Cache configuration
const CACHE_KEY = 'pawnsys_gold_price_cache';
const CACHE_EXPIRY_MINUTES = 5; // Cache for 5 minutes

// Cache helper functions
const cache = {
  get: () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const expiryMs = CACHE_EXPIRY_MINUTES * 60 * 1000;

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
    localStorage.removeItem('pawnsys_gold_dashboard_cache');
    localStorage.removeItem('pawnsys_gold_carat_cache');
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

// Purity mapping
const PURITY_MAP = {
  '999': { label: '24K', percentage: 99.9 },
  '916': { label: '22K', percentage: 91.6 },
  '875': { label: '21K', percentage: 87.5 },
  '750': { label: '18K', percentage: 75.0 },
  '585': { label: '14K', percentage: 58.5 },
  '375': { label: '9K', percentage: 37.5 },
};

const goldPriceService = {
  /**
   * Get latest gold prices (with caching)
   * Uses: GET /api/gold-prices/latest
   */
  getLatestPrices: async (forceRefresh = false) => {
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
    const response = await apiGet('/gold-prices/latest');

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

    return response;
  },

  /**
   * Get current prices - alias for getLatestPrices (backward compatibility)
   */
  getCurrentPrices: async (forceRefresh = false) => {
    return goldPriceService.getLatestPrices(forceRefresh);
  },

  /**
   * Get dashboard prices - formatted for Header/Dashboard components
   * Uses: GET /api/gold-prices/latest
   */
  getDashboardPrices: async (forceRefresh = false) => {
    const response = await goldPriceService.getLatestPrices(forceRefresh);

    if (!response.success || !response.data) {
      return response;
    }

    const data = response.data;

    // Transform to dashboard format expected by Header.jsx
    return {
      success: true,
      fromCache: response.fromCache,
      cacheAge: response.cacheAge,
      cacheTimestamp: response.cacheTimestamp,
      data: {
        price_date: data.price_date,
        // Main 999 price
        price999: data.prices?.['999'] || 0,
        // Purity codes format (999, 916, etc.)
        purity_codes: data.prices || {},
        // Carat format for compatibility
        carat: data.prices || {},
        // Carat labels format (24K, 22K, etc.)
        caratLabels: {
          '24K': data.prices?.['999'] || 0,
          '22K': data.prices?.['916'] || 0,
          '21K': data.prices?.['875'] || 0,
          '18K': data.prices?.['750'] || 0,
          '14K': data.prices?.['585'] || 0,
          '9K': data.prices?.['375'] || 0,
        },
        // BID/ASK from Metals.Dev
        bid_price_999: data.bid_price_999,
        ask_price_999: data.ask_price_999,
        // BNM prices
        bnm_buying_999: data.bnm_buying_999,
        bnm_selling_999: data.bnm_selling_999,
        // Source info
        source: data.source,
        updated_at: data.updated_at,
        // For current price object compatibility
        current: {
          prices: {
            gold: {
              per_gram: data.prices?.['999'] || 0,
            },
          },
          source: data.source,
        },
        // Change info (will be null from latest, need history for this)
        change: null,
      },
    };
  },

  /**
   * Get carat prices - alias for getDashboardPrices (backward compatibility)
   */
  getCaratPrices: async (forceRefresh = false) => {
    const response = await goldPriceService.getDashboardPrices(forceRefresh);

    if (!response.success || !response.data) {
      return response;
    }

    return {
      success: true,
      fromCache: response.fromCache,
      cacheAge: response.cacheAge,
      data: {
        purity_codes: response.data.purity_codes,
        prices: response.data.caratLabels,
      },
    };
  },

  /**
   * Fetch fresh prices from Metals.Dev + BNM APIs
   * Uses: POST /api/gold-prices/fetch
   */
  fetchFreshPrices: async () => {
    cache.clear();
    const response = await apiPost('/gold-prices/fetch');

    if (response.success && response.data) {
      // Cache the new data
      cache.set({
        price_date: response.data.price_date,
        prices: response.data.prices,
        source: response.data.active_source,
        bid_price_999: response.data.metals_dev?.bid,
        ask_price_999: response.data.metals_dev?.ask,
        bnm_buying_999: response.data.bnm?.buying_per_gram,
        bnm_selling_999: response.data.bnm?.selling_per_gram,
        updated_at: new Date().toISOString(),
      });
    }

    return response;
  },

  /**
   * Force refresh prices - alias for fetchFreshPrices
   */
  refreshPrices: async () => {
    return goldPriceService.fetchFreshPrices();
  },

  /**
   * Get prices for a specific date
   * Uses: GET /api/gold-prices/date/{date}
   */
  getPricesForDate: async (date) => {
    return apiGet(`/gold-prices/date/${date}`);
  },

  /**
   * Get historical prices - alias for getPricesForDate (backward compatibility)
   */
  getHistoricalPrices: async (date) => {
    return goldPriceService.getPricesForDate(date);
  },

  /**
   * Get price history for charts
   * Uses: GET /api/gold-prices/history
   */
  getHistory: async (days = 30, purity = '999') => {
    return apiGet('/gold-prices/history', { days, purity });
  },

  /**
   * Get API source status and usage
   * Uses: GET /api/gold-prices/sources
   */
  getSourceStatus: async () => {
    return apiGet('/gold-prices/sources');
  },

  /**
   * Get usage stats - alias for getSourceStatus
   */
  getUsageStats: async () => {
    return goldPriceService.getSourceStatus();
  },

  /**
   * Compare prices from Metals.Dev vs BNM
   * Uses: GET /api/gold-prices/compare
   */
  comparePrices: async () => {
    return apiGet('/gold-prices/compare');
  },

  /**
   * Get audit history for KPKT compliance
   * Uses: GET /api/gold-prices/audit
   */
  getAuditHistory: async (startDate, endDate) => {
    return apiGet('/gold-prices/audit', {
      start_date: startDate,
      end_date: endDate
    });
  },

  /**
   * Get KPKT compliance report
   * Uses: GET /api/gold-prices/compliance-report
   */
  getComplianceReport: async (startDate, endDate) => {
    return apiGet('/gold-prices/compliance-report', {
      start_date: startDate,
      end_date: endDate
    });
  },

  /**
   * Set manual gold price
   * Uses: POST /api/gold-prices/manual
   */
  setManualPrice: async (data) => {
    cache.clear();
    return apiPost('/gold-prices/manual', {
      price_date: data.price_date || new Date().toISOString().split('T')[0],
      price_999: data.price_999 || data.gold_price_per_gram,
      price_916: data.price_916,
      price_875: data.price_875,
      price_750: data.price_750,
      price_585: data.price_585,
      price_375: data.price_375,
      reason: data.reason || 'Manual entry',
    });
  },

  /**
   * Calculate item value based on weight and purity
   */
  calculateItemValue: (weightGrams, purityCode, pricePerGram = null) => {
    const purity = PURITY_MAP[purityCode];
    if (!purity) {
      return { success: false, error: 'Invalid purity code' };
    }

    if (!pricePerGram) {
      return { success: false, error: 'Price not provided' };
    }

    const value = weightGrams * pricePerGram * (purity.percentage / 100);
    return {
      success: true,
      data: {
        weight_grams: weightGrams,
        purity_code: purityCode,
        purity_label: purity.label,
        price_per_gram: pricePerGram,
        calculated_value: Math.round(value * 100) / 100,
      },
    };
  },

  /**
   * Format price value for display
   */
  formatPrice: (price, currency = 'MYR') => {
    if (price === null || price === undefined || isNaN(price)) return '-';
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  },

  /**
   * Format price without currency symbol
   */
  formatPriceNumber: (price) => {
    if (price === null || price === undefined || isNaN(price)) return '-';
    return new Intl.NumberFormat('en-MY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
      expiryMinutes: CACHE_EXPIRY_MINUTES,
    };
  },

  /**
   * Clear all gold price caches
   */
  clearCache: () => {
    cache.clear();
  },

  /**
   * Purity mapping helper
   */
  PURITY_MAP,

  /**
   * Get purity label from code
   */
  getPurityLabel: (code) => {
    return PURITY_MAP[code]?.label || code;
  },

  /**
   * Get purity percentage from code
   */
  getPurityPercentage: (code) => {
    return PURITY_MAP[code]?.percentage || 0;
  },
};

export default goldPriceService;