/**
 * Dashboard Service - Dashboard API calls
 */

import { apiGet } from './api'

const dashboardService = {
  /**
   * Get dashboard summary
   * @returns {Promise}
   */
  async getSummary() {
    return apiGet('/dashboard/summary')
  },

  /**
   * Get today's statistics
   * @returns {Promise}
   */
  async getTodayStats() {
    return apiGet('/dashboard/today-stats')
  },

  /**
   * Get payment split (cash vs transfer)
   * @param {string} date - Optional date
   * @returns {Promise}
   */
  async getPaymentSplit(date = null) {
    const params = date ? { date } : {}
    return apiGet('/dashboard/payment-split', params)
  },

  /**
   * Get due reminders (7, 3, 1 day alerts)
   * @returns {Promise}
   */
  async getDueReminders() {
    return apiGet('/dashboard/due-reminders')
  },

  /**
   * Get overdue pledges
   * @param {Object} params - Pagination
   * @returns {Promise}
   */
  async getOverduePledges(params = {}) {
    return apiGet('/dashboard/overdue-pledges', params)
  },

  /**
   * Get current gold prices
   * @returns {Promise}
   */
  async getGoldPrices() {
    return apiGet('/dashboard/gold-prices')
  },
}

export default dashboardService
