import { apiGet, apiPost } from './api';

const goldPriceService = {
  /**
   * Get current gold prices (with caching)
   */
  getCurrentPrices: async () => {
    return apiGet('/gold-prices/current');
  },

  /**
   * Get gold prices by carat (24K, 22K, 18K, etc.)
   */
  getCaratPrices: async () => {
    return apiGet('/gold-prices/carat');
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
   * Force refresh prices (clear cache)
   */
  refreshPrices: async () => {
    return apiPost('/gold-prices/refresh');
  },

  /**
   * Manually set gold price
   * @param {Object} data - { gold_price_per_gram, silver_price_per_gram }
   */
  setManualPrice: async (data) => {
    return apiPost('/gold-prices/manual', data);
  },

  /**
   * Get API usage stats (admin only)
   */
  getUsageStats: async () => {
    return apiGet('/gold-prices/usage');
  },

  /**
   * Get all prices combined (for dashboard widget)
   */
  getDashboardPrices: async () => {
    return apiGet('/gold-prices/dashboard');
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
  }
};

export default goldPriceService;