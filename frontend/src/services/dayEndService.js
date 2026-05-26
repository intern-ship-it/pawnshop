/**
 * Day End Service - Day End Reconciliation API calls
 */

import { apiGet, apiPost, apiPatch } from './api'

const dayEndService = {
  /**
   * Get all day-end reports with pagination
   * @param {Object} params - Query parameters
   * @returns {Promise}
   */
  async getAll(params = {}) {
    return apiGet('/day-end', params)
  },

  /**
   * Get current day's report
   * @returns {Promise}
   */
  async getCurrent() {
    return apiGet('/day-end/current')
  },

  /**
   * Get report by date
   * @param {string} date - YYYY-MM-DD
   * @returns {Promise}
   */
  async getByDate(date) {
    return apiGet(`/day-end/${date}`)
  },

  /**
   * Open/Start day-end process
   * @param {Object} data - opening_balance
   * @returns {Promise}
   */
  async open(data = {}) {
    return apiPost('/day-end/open', data)
  },

  /**
   * Update opening balance on an open day-end report (admin only)
   * @param {number} dayEndId
   * @param {number} openingBalance
   * @returns {Promise}
   */
  async updateOpeningBalance(dayEndId, openingBalance) {
    return apiPatch(`/day-end/${dayEndId}/opening-balance`, {
      opening_balance: openingBalance,
    })
  },

  /**
   * Idempotent auto-open. Backend creates today's report only if:
   *   - caller is Admin / Super Admin, AND
   *   - prior closing balance exists to carry forward.
   * Returns { report, created, skipped? }
   */
  async ensureOpen() {
    return apiPost('/day-end/ensure-open')
  },

  /**
   * Get verification items
   * @param {number} dayEndId 
   * @returns {Promise}
   */
  async getVerifications(dayEndId) {
    return apiGet(`/day-end/${dayEndId}/verifications`)
  },

  /**
   * Verify single item
   * @param {number} dayEndId 
   * @param {number} verificationId 
   * @param {Object} data - is_verified, notes
   * @returns {Promise}
   */
  async verifyItem(dayEndId, verificationId, data) {
    return apiPost(`/day-end/${dayEndId}/verify-item`, {
      verification_id: verificationId,
      ...data,
    })
  },

  /**
   * Verify amount
   * @param {number} dayEndId 
   * @param {Object} data - verification_id, actual_amount, notes
   * @returns {Promise}
   */
  async verifyAmount(dayEndId, data) {
    return apiPost(`/day-end/${dayEndId}/verify-amount`, data)
  },

  /**
   * Close day-end
   * @param {number} dayEndId 
   * @param {Object} data - force_close, notes
   * @returns {Promise}
   */
  async close(dayEndId, data = {}) {
    return apiPost(`/day-end/${dayEndId}/close`, data)
  },

  /**
   * Send WhatsApp summary
   * @param {number} dayEndId 
   * @returns {Promise}
   */
  async sendWhatsApp(dayEndId) {
    return apiPost(`/day-end/${dayEndId}/send-whatsapp`)
  },

  /**
   * Print day-end report
   * @param {number} dayEndId 
   * @returns {Promise}
   */
  async print(dayEndId) {
    return apiPost(`/day-end/${dayEndId}/print`)
  },

  /**
   * List cash adjustments for a day-end report
   * @param {number} dayEndId
   * @returns {Promise}
   */
  async listCashAdjustments(dayEndId) {
    return apiGet(`/day-end/${dayEndId}/cash-adjustments`)
  },

  /**
   * Create a cash adjustment (injection or withdrawal)
   * @param {number} dayEndId
   * @param {Object} data - type (injection|withdrawal), amount, reason
   * @returns {Promise}
   */
  async createCashAdjustment(dayEndId, data) {
    return apiPost(`/day-end/${dayEndId}/cash-adjustments`, data)
  },

  /**
   * Void a cash adjustment
   * @param {number} dayEndId
   * @param {number} adjustmentId
   * @returns {Promise}
   */
  async voidCashAdjustment(dayEndId, adjustmentId) {
    return apiPost(`/day-end/${dayEndId}/cash-adjustments/${adjustmentId}/void`)
  },

  /**
   * Export report
   * @param {string} date - YYYY-MM-DD
   * @returns {Promise}
   */
  async export(date) {
    try {
      const response = await apiGet('/day-end/export', { date }, { responseType: 'blob' })

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `day_end_${date}.csv`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)

      return { success: true }
    } catch (error) {
      console.error('Export error:', error)
      throw error
    }
  },
}

export default dayEndService
