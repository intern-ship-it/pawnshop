/**
 * Settings Service - Settings API calls
 */

import { apiGet, apiPost, apiPut, apiDelete } from './api'

const settingsService = {
  // ============ GENERAL SETTINGS ============

  /**
   * Get all settings
   * @returns {Promise}
   */
  async getAll() {
    return apiGet('/settings')
  },

  /**
   * Get settings by category
   * @param {string} category 
   * @returns {Promise}
   */
  async getByCategory(category) {
    return apiGet(`/settings/by-category/${category}`)
  },

  /**
   * Update settings
   * @param {Array} settings - Array of { category, key_name, value }
   * @returns {Promise}
   */
  async update(settings) {
    return apiPut('/settings', { settings })
  },

  // ============ GOLD PRICES ============

  /**
   * Get gold price history
   * @param {number} days - Number of days (default 30)
   * @returns {Promise}
   */
  async getGoldPriceHistory(days = 30) {
    return apiGet('/settings/gold-prices/history', { days })
  },

  /**
   * Update gold prices
   * @param {Object} priceData - price_date, price_999, price_916, etc.
   * @returns {Promise}
   */
  async updateGoldPrices(priceData) {
    return apiPost('/settings/gold-prices', priceData)
  },

  // ============ CATEGORIES ============

  async getCategories() {
    return apiGet('/settings/categories')
  },

  async createCategory(data) {
    return apiPost('/settings/categories', data)
  },

  async updateCategory(id, data) {
    return apiPut(`/settings/categories/${id}`, data)
  },

  async deleteCategory(id) {
    return apiDelete(`/settings/categories/${id}`)
  },

  // ============ PURITIES ============

  async getPurities() {
    return apiGet('/settings/purities')
  },

  async createPurity(data) {
    return apiPost('/settings/purities', data)
  },

  async updatePurity(id, data) {
    return apiPut(`/settings/purities/${id}`, data)
  },

  async deletePurity(id) {
    return apiDelete(`/settings/purities/${id}`)
  },

  // ============ BANKS ============

  async getBanks() {
    return apiGet('/settings/banks')
  },

  async createBank(data) {
    return apiPost('/settings/banks', data)
  },

  async updateBank(id, data) {
    return apiPut(`/settings/banks/${id}`, data)
  },

  async deleteBank(id) {
    return apiDelete(`/settings/banks/${id}`)
  },

  // ============ STONE DEDUCTIONS ============

  async getStoneDeductions() {
    return apiGet('/settings/stone-deductions')
  },

  async createStoneDeduction(data) {
    return apiPost('/settings/stone-deductions', data)
  },

  async updateStoneDeduction(id, data) {
    return apiPut(`/settings/stone-deductions/${id}`, data)
  },

  async deleteStoneDeduction(id) {
    return apiDelete(`/settings/stone-deductions/${id}`)
  },

  // ============ INTEREST RATES ============

  async getInterestRates() {
    return apiGet('/settings/interest-rates')
  },

  async createInterestRate(data) {
    return apiPost('/settings/interest-rates', data)
  },

  async updateInterestRate(id, data) {
    return apiPut(`/settings/interest-rates/${id}`, data)
  },

  async deleteInterestRate(id) {
    return apiDelete(`/settings/interest-rates/${id}`)
  },

  // ============ TERMS & CONDITIONS ============

  async getTermsConditions() {
    return apiGet('/settings/terms-conditions')
  },

  async createTermsCondition(data) {
    return apiPost('/settings/terms-conditions', data)
  },

  async updateTermsCondition(id, data) {
    return apiPut(`/settings/terms-conditions/${id}`, data)
  },

  async deleteTermsCondition(id) {
    return apiDelete(`/settings/terms-conditions/${id}`)
  },
}

export default settingsService
