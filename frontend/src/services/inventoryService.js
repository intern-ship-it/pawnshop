/**
 * Inventory Service - Inventory API calls
 */

import { apiGet, apiPost, apiPut } from './api'

const inventoryService = {
  /**
   * Get all inventory items with pagination
   * @param {Object} params - Query parameters
   * @returns {Promise}
   */
  async getAll(params = {}) {
    return apiGet('/inventory', params)
  },

  /**
   * Get item by ID
   * @param {number} id 
   * @returns {Promise}
   */
  async getById(id) {
    return apiGet(`/inventory/${id}`)
  },

  /**
   * Get items by location
   * @param {Object} params - vault_id, box_id, slot_id
   * @returns {Promise}
   */
  async getByLocation(params) {
    return apiGet('/inventory/by-location', params)
  },

  /**
   * Search item by barcode
   * @param {string} barcode 
   * @returns {Promise}
   */
  async searchByBarcode(barcode) {
    return apiGet('/inventory/search', { barcode })
  },

  /**
   * Get inventory summary
   * @returns {Promise}
   */
  async getSummary() {
    return apiGet('/inventory/summary')
  },

  /**
   * Update item location
   * @param {number} itemId 
   * @param {Object} locationData - vault_id, box_id, slot_id, reason
   * @returns {Promise}
   */
  async updateLocation(itemId, locationData) {
    return apiPut(`/inventory/${itemId}/location`, locationData)
  },

  /**
   * Get item location history
   * @param {number} itemId 
   * @returns {Promise}
   */
  async getLocationHistory(itemId) {
    return apiGet(`/inventory/${itemId}/history`)
  },

  /**
   * Bulk update locations (reorganization)
   * @param {Object} data - items array with new locations
   * @returns {Promise}
   */
  async bulkUpdateLocation(data) {
    return apiPost('/inventory/bulk-update-location', data)
  },
}

export default inventoryService
