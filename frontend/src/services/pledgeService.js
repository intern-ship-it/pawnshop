/**
 * Pledge Service - Pledge API calls
 */

import { apiGet, apiPost, apiPut, apiDelete } from './api'

const pledgeService = {
  /**
   * Get all pledges with pagination
   * @param {Object} params - Query parameters
   * @returns {Promise}
   */
  async getAll(params = {}) {
    return apiGet('/pledges', params)
  },

  /**
   * Get pledge by ID
   * @param {number} id 
   * @returns {Promise}
   */
  async getById(id) {
    return apiGet(`/pledges/${id}`)
  },

  /**
   * Get pledge by receipt number
   * @param {string} receiptNo 
   * @returns {Promise}
   */
  async getByReceipt(receiptNo) {
    return apiGet(`/pledges/by-receipt/${receiptNo}`)
  },

  /**
   * Calculate pledge before creating (preview)
   * @param {Object} pledgeData - Items, customer, etc.
   * @returns {Promise} - Calculated values
   */
  async calculate(pledgeData) {
    return apiGet('/pledges/calculate', pledgeData)
  },

  /**
   * Create new pledge
   * @param {Object} pledgeData 
   * @returns {Promise}
   */
  async create(pledgeData) {
    return apiPost('/pledges', pledgeData)
  },

  /**
   * Update pledge
   * @param {number} id 
   * @param {Object} pledgeData 
   * @returns {Promise}
   */
  async update(id, pledgeData) {
    return apiPut(`/pledges/${id}`, pledgeData)
  },

  /**
   * Delete pledge
   * @param {number} id 
   * @returns {Promise}
   */
  async delete(id) {
    return apiDelete(`/pledges/${id}`)
  },

  /**
   * Get pledge items
   * @param {number} pledgeId 
   * @returns {Promise}
   */
  async getItems(pledgeId) {
    return apiGet(`/pledges/${pledgeId}/items`)
  },

  /**
   * Get interest breakdown
   * @param {number} pledgeId 
   * @returns {Promise}
   */
  async getInterestBreakdown(pledgeId) {
    return apiGet(`/pledges/${pledgeId}/interest-breakdown`)
  },

  /**
   * Assign storage location to pledge items
   * @param {number} pledgeId 
   * @param {Object} storageData - vault_id, box_id, slot assignments
   * @returns {Promise}
   */
  async assignStorage(pledgeId, storageData) {
    return apiPost(`/pledges/${pledgeId}/assign-storage`, storageData)
  },

  /**
   * Print pledge receipt
   * @param {number} pledgeId 
   * @param {string} copyType - 'office' or 'customer'
   * @returns {Promise}
   */
  async printReceipt(pledgeId, copyType = 'customer') {
    return apiPost(`/pledges/${pledgeId}/print-receipt`, { copy_type: copyType })
  },

  /**
   * Print item barcode
   * @param {number} pledgeId 
   * @param {number} itemId 
   * @returns {Promise}
   */
  async printBarcode(pledgeId, itemId) {
    return apiPost(`/pledges/${pledgeId}/print-barcode`, { item_id: itemId })
  },

  /**
   * Send pledge details via WhatsApp
   * @param {number} pledgeId 
   * @returns {Promise}
   */
  async sendWhatsApp(pledgeId) {
    return apiPost(`/pledges/${pledgeId}/send-whatsapp`)
  },
}

export default pledgeService
