/**
 * Report Service - Report API calls
 */

import api, { apiGet, apiPost, getToken } from './api'
import axios from 'axios'

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
   * @param {Object} params - from_date, to_date (or date for backward compatibility)
   * @returns {Promise}
   */
  async getTransactionsReport(params = {}) {
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
   * Export report as CSV download
   * Uses raw axios to bypass response interceptor (which breaks blob handling)
   * @param {string} reportType - pledges, renewals, redemptions, etc.
   * @param {string} format - csv, pdf
   * @param {Object} params - Report filters
   * @returns {Promise}
   */
  async exportReport(reportType, format = 'csv', params = {}) {
    try {
      const token = getToken()
      const baseURL = api.defaults.baseURL

      // Use raw axios to bypass the response interceptor that strips response.data
      // (which breaks blob responses since it tries to parse them as JSON)
      const response = await axios.post(`${baseURL}/reports/export`, {
        report_type: reportType,
        format,
        ...params,
      }, {
        responseType: 'blob',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })

      // Check if the response is actually an error (JSON error wrapped in blob)
      const contentType = response.headers?.['content-type'] || ''
      if (contentType.includes('application/json')) {
        // Server returned JSON error instead of CSV - read the blob as text
        const text = await response.data.text()
        const errorData = JSON.parse(text)
        throw new Error(errorData.message || 'Export failed')
      }

      // Create download link from blob
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      // Generate filename
      const dateStr = new Date().toISOString().slice(0, 10)
      const filename = `${reportType}_report_${dateStr}.${format}`

      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)

      return { success: true }
    } catch (error) {
      console.error('Export error:', error)

      // Try to extract error message from blob response
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text()
          const errorData = JSON.parse(text)
          throw new Error(errorData.message || 'Failed to export report')
        } catch (parseError) {
          if (parseError.message && parseError.message !== 'Failed to export report') {
            // parseError is from JSON.parse, throw original
            throw new Error(error.response?.statusText || 'Failed to export report')
          }
          throw parseError
        }
      }

      throw new Error(error?.message || 'Failed to export report')
    }
  },
}

export default reportService
