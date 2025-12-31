/**
 * Report Service - Report API calls
 */

import { apiGet, apiPost } from './api'

const reportService = {
  /**
   * Get pledges report
   * @param {Object} params - from_date, to_date, status
   * @returns {Promise}
   */
  async getPledgesReport(params = {}) {
    return apiGet('/reports/pledges', params)
  },

  /**
   * Get renewals report
   * @param {Object} params - from_date, to_date
   * @returns {Promise}
   */
  async getRenewalsReport(params = {}) {
    return apiGet('/reports/renewals', params)
  },

  /**
   * Get redemptions report
   * @param {Object} params - from_date, to_date
   * @returns {Promise}
   */
  async getRedemptionsReport(params = {}) {
    return apiGet('/reports/redemptions', params)
  },

  /**
   * Get outstanding pledges report
   * @returns {Promise}
   */
  async getOutstandingReport() {
    return apiGet('/reports/outstanding')
  },

  /**
   * Get overdue pledges report
   * @returns {Promise}
   */
  async getOverdueReport() {
    return apiGet('/reports/overdue')
  },

  /**
   * Get payment split report
   * @param {Object} params - from_date, to_date
   * @returns {Promise}
   */
  async getPaymentSplitReport(params = {}) {
    return apiGet('/reports/payment-split', params)
  },

  /**
   * Get inventory report
   * @returns {Promise}
   */
  async getInventoryReport() {
    return apiGet('/reports/inventory')
  },

  /**
   * Get customers report
   * @param {Object} params - blacklisted, has_active_pledges
   * @returns {Promise}
   */
  async getCustomersReport(params = {}) {
    return apiGet('/reports/customers', params)
  },

  /**
   * Get daily transactions report
   * @param {string} date - Report date (default today)
   * @returns {Promise}
   */
  async getTransactionsReport(date = null) {
    const params = date ? { date } : {}
    return apiGet('/reports/transactions', params)
  },

  /**
   * Get reprints report
   * @param {Object} params - from_date, to_date
   * @returns {Promise}
   */
  async getReprintsReport(params = {}) {
    return apiGet('/reports/reprints', params)
  },

  /**
   * Export report
   * @param {string} reportType - pledges, renewals, redemptions, etc.
   * @param {string} format - csv, pdf
   * @param {Object} params - Report filters
   * @returns {Promise}
   */
  async exportReport(reportType, format = 'csv', params = {}) {
    return apiPost('/reports/export', {
      report_type: reportType,
      format,
      ...params,
    })
  },
}

export default reportService
