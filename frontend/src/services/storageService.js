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
   * @param {Object} params - optional; pass { with_search_terms: 1 } to include the
   *   renewal/redemption/receipt numbers and IC the rack map's search needs. Omitted
   *   by default so callers that never search keep the smaller payload.
   * @returns {Promise}
   */
  async getSlots(boxId, params = {}) {
    return apiGet(`/storage/boxes/${boxId}/slots`, params)
  },

  /**
   * Add one subslot to a specific slot group in a box
   * @param {number} boxId
   * @param {number} slotGroup
   * @returns {Promise}
   */
  async addSubslot(boxId, slotGroup) {
    return apiPost('/storage/slots/add-subslot', { box_id: boxId, slot_group: slotGroup })
  },

  /**
   * Add a new slot (group) to a box
   * @param {number} boxId
   * @returns {Promise}
   */
  async addSlot(boxId) {
    return apiPost('/storage/boxes/add-slot', { box_id: boxId })
  },

  /**
   * Remove one empty subslot by its slot id
   * @param {number} slotId
   * @returns {Promise}
   */
  async removeSubslot(slotId) {
    return apiDelete(`/storage/slots/${slotId}`)
  },

  /**
   * Remove an entire slot (group) and its subslots from a box
   * @param {number} boxId
   * @param {number} slotGroup
   * @returns {Promise}
   */
  async removeSlot(boxId, slotGroup) {
    return apiDelete(`/storage/boxes/${boxId}/slot-group/${slotGroup}`)
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
   * Find which drawer holds an item, anywhere in the branch.
   *
   * The rack map only ever loads the slots of the drawer on screen, so its own
   * search cannot see an item stored elsewhere. This asks the server instead.
   *
   * @param {string} search - pledge/renewal/redemption/receipt no, customer, IC or barcode
   * @returns {Promise}
   */
  async locate(search) {
    return apiGet('/storage/locate', { search })
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

  /**
   * Get storage capacity summary
   * @returns {Promise}
   */
  async getCapacity() {
    return apiGet('/storage/capacity')
  },

  // ============ SLOT HOLDS (concurrency guard) ============

  /**
   * Get live holds for all slots in a box (for grey rendering + polling)
   * @param {number} boxId
   * @returns {Promise}
   */
  async getHolds(boxId) {
    return apiGet(`/storage/boxes/${boxId}/holds`)
  },

  /**
   * Claim (or renew, if already mine) a hold on a slot. 409 if held by another user.
   * @param {number} slotId
   * @returns {Promise}
   */
  async claimHold(slotId) {
    return apiPost(`/storage/holds/${slotId}/claim`)
  },

  /**
   * Renew my hold on a slot (called every ~30s while the form is open)
   * @param {number} slotId
   * @returns {Promise}
   */
  async renewHold(slotId) {
    return apiPost(`/storage/holds/${slotId}/renew`)
  },

  /**
   * Release my hold on a slot (on slot change / cancel / leaving the page)
   * @param {number} slotId
   * @returns {Promise}
   */
  async releaseHold(slotId) {
    return apiDelete(`/storage/holds/${slotId}/release`)
  },
}

export default storageService
