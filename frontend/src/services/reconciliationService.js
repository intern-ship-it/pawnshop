/**
 * Reconciliation Service - API calls for stock reconciliation
 */

import { apiGet, apiPost } from './api'

const reconciliationService = {
  /**
   * Get all reconciliations (paginated)
   */
  async getReconciliations(params = {}) {
    const query = new URLSearchParams(params).toString()
    return apiGet(`/reconciliations${query ? '?' + query : ''}`)
  },

  /**
   * Get single reconciliation details
   */
  async getReconciliation(id) {
    return apiGet(`/reconciliations/${id}`)
  },

  /**
   * Start new reconciliation
   * @param {string} type - 'daily' | 'weekly' | 'monthly' | 'adhoc'
   * @param {string} notes - Optional notes
   */
  async start(type = 'adhoc', notes = '') {
    return apiPost('/reconciliations/start', {
      reconciliation_type: type,
      notes,
    })
  },

  /**
   * Scan item barcode
   * @param {number} reconciliationId - Reconciliation ID
   * @param {string} barcode - Scanned barcode
   * @param {string} notes - Optional notes
   */
  async scan(reconciliationId, barcode, notes = '') {
    return apiPost(`/reconciliations/${reconciliationId}/scan`, {
      barcode,
      notes,
    })
  },

  /**
   * Complete reconciliation
   * @param {number} reconciliationId - Reconciliation ID
   * @param {string} notes - Optional notes
   */
  async complete(reconciliationId, notes = '') {
    return apiPost(`/reconciliations/${reconciliationId}/complete`, {
      notes,
    })
  },

  /**
   * Cancel reconciliation
   * @param {number} reconciliationId - Reconciliation ID
   * @param {string} reason - Cancellation reason
   */
  async cancel(reconciliationId, reason = '') {
    return apiPost(`/reconciliations/${reconciliationId}/cancel`, {
      reason,
    })
  },

  /**
   * Get reconciliation report
   * @param {number} reconciliationId - Reconciliation ID
   */
  async getReport(reconciliationId) {
    return apiGet(`/reconciliations/${reconciliationId}/report`)
  },

  /**
   * Get expected items for reconciliation (from inventory)
   * This fetches all stored pledge items that should be verified
   */
  async getExpectedItems() {
    return apiGet('/inventory/stored-items')
  },
}

export default reconciliationService