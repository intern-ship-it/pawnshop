/**
 * Day End Service - Day End Reconciliation API calls
 */

import { apiGet, apiPost } from './api'

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
}

export default dayEndService
