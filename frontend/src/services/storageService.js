/**
 * Storage Service - Vault, Box, Slot API calls
 */

import { apiGet, apiPost, apiPut, apiDelete } from './api'

const storageService = {
  // ============ VAULTS ============

  /**
   * Get all vaults
   * @returns {Promise}
   */
  async getVaults() {
    return apiGet('/storage/vaults')
  },

  /**
   * Create vault
   * @param {Object} vaultData 
   * @returns {Promise}
   */
  async createVault(vaultData) {
    return apiPost('/storage/vaults', vaultData)
  },

  /**
   * Update vault
   * @param {number} vaultId 
   * @param {Object} vaultData 
   * @returns {Promise}
   */
  async updateVault(vaultId, vaultData) {
    return apiPut(`/storage/vaults/${vaultId}`, vaultData)
  },

  /**
   * Delete vault
   * @param {number} vaultId 
   * @returns {Promise}
   */
  async deleteVault(vaultId) {
    return apiDelete(`/storage/vaults/${vaultId}`)
  },

  // ============ BOXES ============

  /**
   * Get boxes by vault
   * @param {number} vaultId 
   * @returns {Promise}
   */
  async getBoxes(vaultId) {
    return apiGet(`/storage/vaults/${vaultId}/boxes`)
  },

  /**
   * Create box
   * @param {Object} boxData 
   * @returns {Promise}
   */
  async createBox(boxData) {
    return apiPost('/storage/boxes', boxData)
  },

  /**
   * Update box
   * @param {number} boxId 
   * @param {Object} boxData 
   * @returns {Promise}
   */
  async updateBox(boxId, boxData) {
    return apiPut(`/storage/boxes/${boxId}`, boxData)
  },

  /**
   * Delete box
   * @param {number} boxId 
   * @returns {Promise}
   */
  async deleteBox(boxId) {
    return apiDelete(`/storage/boxes/${boxId}`)
  },

  /**
   * Get box summary (items, weight, value)
   * @param {number} boxId 
   * @returns {Promise}
   */
  async getBoxSummary(boxId) {
    return apiGet(`/storage/box-summary/${boxId}`)
  },

  // ============ SLOTS ============

  /**
   * Get slots by box
   * @param {number} boxId 
   * @returns {Promise}
   */
  async getSlots(boxId) {
    return apiGet(`/storage/boxes/${boxId}/slots`)
  },

  /**
   * Get available slots
   * @param {Object} params - vault_id, box_id
   * @returns {Promise}
   */
  async getAvailableSlots(params = {}) {
    return apiGet('/storage/available-slots', params)
  },

  /**
   * Get next available slot
   * @param {number} vaultId 
   * @returns {Promise}
   */
  async getNextAvailableSlot(vaultId = null) {
    const params = vaultId ? { vault_id: vaultId } : {}
    return apiGet('/storage/next-available-slot', params)
  },
}

export default storageService
