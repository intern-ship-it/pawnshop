/**
 * Customer Service - Customer API calls
 */

import { apiGet, apiPost, apiPut, apiDelete } from './api'

const customerService = {
  /**
   * Get all customers with pagination
   * @param {Object} params - Query parameters
   * @returns {Promise}
   */
  async getAll(params = {}) {
    return apiGet('/customers', params)
  },

  /**
   * Search customers by IC number
   * @param {string} icNumber 
   * @returns {Promise}
   */
  async searchByIC(icNumber) {
    return apiGet('/customers/search', { ic_number: icNumber })
  },

  /**
   * Get customer by ID
   * @param {number} id 
   * @returns {Promise}
   */
  async getById(id) {
    return apiGet(`/customers/${id}`)
  },

  /**
   * Create new customer
   * @param {Object} customerData 
   * @returns {Promise}
   */
  async create(customerData) {
    return apiPost('/customers', customerData)
  },

  /**
   * Update customer
   * @param {number} id 
   * @param {Object} customerData 
   * @returns {Promise}
   */
  async update(id, customerData) {
    return apiPut(`/customers/${id}`, customerData)
  },

  /**
   * Delete customer
   * @param {number} id 
   * @returns {Promise}
   */
  async delete(id) {
    return apiDelete(`/customers/${id}`)
  },

  /**
   * Get customer's pledges
   * @param {number} customerId 
   * @returns {Promise}
   */
  async getPledges(customerId) {
    return apiGet(`/customers/${customerId}/pledges`)
  },

  /**
   * Get customer's active pledges
   * @param {number} customerId 
   * @returns {Promise}
   */
  async getActivePledges(customerId) {
    return apiGet(`/customers/${customerId}/active-pledges`)
  },

  /**
   * Blacklist customer
   * @param {number} customerId 
   * @param {string} reason 
   * @returns {Promise}
   */
  async blacklist(customerId, reason) {
    return apiPost(`/customers/${customerId}/blacklist`, { reason })
  },

  /**
   * Remove from blacklist
   * @param {number} customerId 
   * @returns {Promise}
   */
  async removeFromBlacklist(customerId) {
    return apiPost(`/customers/${customerId}/blacklist`, { is_blacklisted: false })
  },
}

export default customerService
