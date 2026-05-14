/**
 * Interest Payment Service - Interest Payment API calls
 */

import { apiGet, apiPost } from './api'

const interestPaymentService = {
  /**
   * Get all interest payments with pagination
   * @param {Object} params - Query parameters (search, from_date, to_date, per_page)
   * @returns {Promise}
   */
  async getAll(params = {}) {
    return apiGet('/interest-payments', params)
  },

  /**
   * Get interest payment by ID
   * @param {number} id 
   * @returns {Promise}
   */
  async getById(id) {
    return apiGet(`/interest-payments/${id}`)
  },

  /**
   * Get today's interest payments with summary
   * @returns {Promise}
   */
  async getToday() {
    return apiGet('/interest-payments/today')
  },

  /**
   * Get pledges eligible for interest payment
   * @param {Object} params - search, date_from, date_to
   * @returns {Promise}
   */
  async getEligibleList(params = {}) {
    return apiGet('/interest-payments/eligible-list', params)
  },

  /**
   * Calculate interest payment preview
   * @param {Object} data - { pledge_id, interest_rate (optional) }
   * @returns {Promise} - Calculated interest, breakdown, period
   */
  async calculate(data) {
    return apiGet('/interest-payments/calculate', data)
  },

  /**
   * Process interest payment
   * @param {Object} paymentData 
   * @returns {Promise}
   */
  async create(paymentData) {
    return apiPost('/interest-payments', paymentData)
  },

  /**
   * Print interest payment receipt
   * @param {number} paymentId 
   * @returns {Promise}
   */
  async printReceipt(paymentId) {
    return apiPost(`/interest-payments/${paymentId}/print-receipt`)
  },
}

export default interestPaymentService
