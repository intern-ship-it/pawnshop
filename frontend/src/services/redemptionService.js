/**
 * Redemption Service - Redemption API calls
 */

import { apiGet, apiPost } from './api'

const redemptionService = {
  /**
   * Get all redemptions with pagination
   * @param {Object} params - Query parameters
   * @returns {Promise}
   */
  async getAll(params = {}) {
    return apiGet('/redemptions', params)
  },

  /**
   * Get redemption by ID
   * @param {number} id 
   * @returns {Promise}
   */
  async getById(id) {
    return apiGet(`/redemptions/${id}`)
  },

  /**
   * Calculate redemption before processing (preview)
   * @param {Object} data - pledge_id
   * @returns {Promise} - Calculated principal + interest + fees
   */
  async calculate(data) {
    return apiGet('/redemptions/calculate', data)
  },

  /**
   * Process redemption
   * @param {Object} redemptionData 
   * @returns {Promise}
   */
  async create(redemptionData) {
    return apiPost('/redemptions', redemptionData)
  },

  /**
   * Release items after redemption
   * @param {number} redemptionId 
   * @returns {Promise}
   */
  async releaseItems(redemptionId) {
    return apiPost(`/redemptions/${redemptionId}/release-items`)
  },

  /**
   * Print redemption receipt
   * @param {number} redemptionId 
   * @returns {Promise}
   */
  async printReceipt(redemptionId) {
    return apiPost(`/redemptions/${redemptionId}/print-receipt`)
  },
}

export default redemptionService
