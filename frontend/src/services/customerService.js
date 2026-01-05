/**
 * Customer Service - Customer API calls
 * Extended with additional methods for API integration
 */

import { apiGet, apiPost, apiPut, apiDelete } from './api'

// Field mapping: frontend name → backend name
const fieldMapping = {
  ic_front_image: 'ic_front_photo',
  ic_back_image: 'ic_back_photo',
  profile_photo: 'selfie_photo',
  address: 'address_line1',
}

// Helper to map field names
const mapFieldNames = (data) => {
  const mapped = {}
  Object.keys(data).forEach(key => {
    if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
      const backendKey = fieldMapping[key] || key
      mapped[backendKey] = data[key]
    }
  })
  return mapped
}

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
    // Check if we have file uploads
    const hasFiles = customerData.ic_front_image instanceof File || 
                     customerData.ic_back_image instanceof File ||
                     customerData.profile_photo instanceof File

    if (hasFiles) {
      const formData = new FormData()
      Object.keys(customerData).forEach(key => {
        if (customerData[key] !== null && customerData[key] !== undefined && customerData[key] !== '') {
          // Map frontend field name to backend field name
          const backendKey = fieldMapping[key] || key
          formData.append(backendKey, customerData[key])
        }
      })
      return apiPost('/customers', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    }
    
    // Map field names for non-file data
    return apiPost('/customers', mapFieldNames(customerData))
  },

  /**
   * Update customer
   * @param {number} id 
   * @param {Object} customerData 
   * @returns {Promise}
   */
  async update(id, customerData) {
    // Check if we have file uploads
    const hasFiles = customerData.ic_front_image instanceof File || 
                     customerData.ic_back_image instanceof File ||
                     customerData.profile_photo instanceof File

    if (hasFiles) {
      const formData = new FormData()
      formData.append('_method', 'PUT')
      Object.keys(customerData).forEach(key => {
        if (customerData[key] !== null && customerData[key] !== undefined && customerData[key] !== '') {
          // Map frontend field name to backend field name
          const backendKey = fieldMapping[key] || key
          formData.append(backendKey, customerData[key])
        }
      })
      return apiPost(`/customers/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    }
    
    // Map field names for non-file data
    return apiPut(`/customers/${id}`, mapFieldNames(customerData))
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
   * Get customer statistics
   * @param {number} customerId 
   * @returns {Promise}
   */
  async getStatistics(customerId) {
    return apiGet(`/customers/${customerId}/statistics`)
  },

  /**
   * Check if IC exists (for validation)
   * @param {string} icNumber 
   * @param {number} excludeId - Exclude this customer ID (for edit)
   * @returns {Promise}
   */
  async checkICExists(icNumber, excludeId = null) {
    const params = { ic_number: icNumber }
    if (excludeId) params.exclude_id = excludeId
    return apiGet('/customers/check-ic', params)
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