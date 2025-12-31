/**
 * Renewal Service - Renewal API calls
 */

import { apiGet, apiPost } from './api'

const renewalService = {
  /**
   * Get all renewals with pagination
   * @param {Object} params - Query parameters
   * @returns {Promise}
   */
  async getAll(params = {}) {
    return apiGet('/renewals', params)
  },

  /**
   * Get renewal by ID
   * @param {number} id 
   * @returns {Promise}
   */
  async getById(id) {
    return apiGet(`/renewals/${id}`)
  },

  /**
   * Get today's renewals
   * @returns {Promise}
   */
  async getToday() {
    return apiGet('/renewals/today')
  },

  /**
   * Get pledges due for renewal
   * @param {Object} params - days_ahead, etc.
   * @returns {Promise}
   */
  async getDueList(params = {}) {
    return apiGet('/renewals/due-list', params)
  },

  /**
   * Calculate renewal before processing (preview)
   * @param {Object} data - pledge_id, renewal_months
   * @returns {Promise} - Calculated interest, breakdown
   */
  async calculate(data) {
    return apiGet('/renewals/calculate', data)
  },

  /**
   * Process renewal
   * @param {Object} renewalData 
   * @returns {Promise}
   */
  async create(renewalData) {
    return apiPost('/renewals', renewalData)
  },

  /**
   * Print renewal receipt
   * @param {number} renewalId 
   * @returns {Promise}
   */
  async printReceipt(renewalId) {
    return apiPost(`/renewals/${renewalId}/print-receipt`)
  },
}

export default renewalService
