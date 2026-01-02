/**
 * Gold Price Service - MetalPriceAPI Integration
 * 
 * Provides live gold prices from MetalPriceAPI.com
 * Supports: Current prices, carat prices, historical data, calculations
 */

import { apiGet, apiPost } from './api'

const goldPriceService = {
  /**
   * Get current gold prices (per gram & per troy oz)
   * @returns {Promise}
   */
  async getCurrentPrices() {
    return apiGet('/gold-prices/current')
  },

  /**
   * Get gold prices by carat/purity (24K, 22K, 18K, etc.)
   * @returns {Promise}
   */
  async getCaratPrices() {
    return apiGet('/gold-prices/carat')
  },

  /**
   * Get comprehensive dashboard data (current + carat + change)
   * @returns {Promise}
   */
  async getDashboardPrices() {
    return apiGet('/gold-prices/dashboard')
  },

  /**
   * Get historical prices for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise}
   */
  async getHistoricalPrices(date) {
    return apiGet(`/gold-prices/historical/${date}`)
  },

  /**
   * Get price history for charts
   * @param {number} days - Number of days (default: 30, max: 365)
   * @returns {Promise}
   */
  async getPriceHistory(days = 30) {
    return apiGet('/gold-prices/history', { days })
  },

  /**
   * Calculate item value based on weight and purity
   * @param {number} weightGrams - Weight in grams
   * @param {string} purityCode - Purity code (999, 916, 875, 750, 585, 375)
   * @param {number|null} customPrice - Optional custom price per gram
   * @returns {Promise}
   */
  async calculateValue(weightGrams, purityCode, customPrice = null) {
    return apiPost('/gold-prices/calculate', {
      weight_grams: weightGrams,
      purity_code: purityCode,
      custom_price: customPrice,
    })
  },

  /**
   * Force refresh prices from API (clear cache)
   * @returns {Promise}
   */
  async refreshPrices() {
    return apiPost('/gold-prices/refresh')
  },

  /**
   * Manually set gold price (when API is down)
   * @param {number} goldPrice - Gold price per gram
   * @param {number|null} silverPrice - Silver price per gram (optional)
   * @returns {Promise}
   */
  async setManualPrice(goldPrice, silverPrice = null) {
    return apiPost('/gold-prices/manual', {
      gold_price_per_gram: goldPrice,
      silver_price_per_gram: silverPrice,
    })
  },

  /**
   * Get API usage stats (for admin)
   * @returns {Promise}
   */
  async getUsageStats() {
    return apiGet('/gold-prices/usage')
  },

  // ============================================================
  // UTILITY FUNCTIONS (Frontend-only, no API calls)
  // ============================================================

  /**
   * Convert purity code to karat
   * @param {string} purityCode - e.g., '916'
   * @returns {string} - e.g., '22K'
   */
  purityToKarat(purityCode) {
    const mapping = {
      '999': '24K',
      '916': '22K',
      '875': '21K',
      '750': '18K',
      '585': '14K',
      '375': '9K',
    }
    return mapping[purityCode] || purityCode
  },

  /**
   * Convert karat to purity code
   * @param {string} karat - e.g., '22K'
   * @returns {string} - e.g., '916'
   */
  karatToPurity(karat) {
    const mapping = {
      '24K': '999',
      '22K': '916',
      '21K': '875',
      '18K': '750',
      '14K': '585',
      '9K': '375',
    }
    return mapping[karat.toUpperCase()] || karat
  },

  /**
   * Get purity percentage
   * @param {string} purityCode - e.g., '916'
   * @returns {number} - e.g., 91.6
   */
  getPurityPercentage(purityCode) {
    const mapping = {
      '999': 99.9,
      '916': 91.6,
      '875': 87.5,
      '750': 75.0,
      '585': 58.5,
      '375': 37.5,
    }
    return mapping[purityCode] || 100
  },

  /**
   * Calculate gold price for a specific purity from 999 price
   * @param {number} price999 - Price per gram for 999 gold
   * @param {string} purityCode - Target purity code
   * @returns {number} - Price per gram for target purity
   */
  calculatePurityPrice(price999, purityCode) {
    const percentage = this.getPurityPercentage(purityCode)
    return Math.round(price999 * (percentage / 100) * 100) / 100
  },

  /**
   * Format price for display
   * @param {number} price - Price value
   * @param {string} currency - Currency code (default: MYR)
   * @returns {string} - Formatted price
   */
  formatPrice(price, currency = 'MYR') {
    if (price === null || price === undefined) return '-'
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  },

  /**
   * Get all purity options for dropdowns
   * @returns {Array}
   */
  getPurityOptions() {
    return [
      { code: '999', karat: '24K', percentage: 99.9 },
      { code: '916', karat: '22K', percentage: 91.6 },
      { code: '875', karat: '21K', percentage: 87.5 },
      { code: '750', karat: '18K', percentage: 75.0 },
      { code: '585', karat: '14K', percentage: 58.5 },
      { code: '375', karat: '9K', percentage: 37.5 },
    ]
  },
}

export default goldPriceService
