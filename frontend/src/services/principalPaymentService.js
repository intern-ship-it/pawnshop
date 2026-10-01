/**
 * Principal Payment Service - payments made against the loan itself.
 *
 * Distinct from interestPaymentService: that settles the cost of borrowing and leaves
 * the debt where it is. This reduces the debt, and the goods stay in the locker.
 */

import { apiGet, apiPost } from './api'

const principalPaymentService = {
  /**
   * What the pledge owes, and what a given payment would leave behind.
   * @param {Object} data - { pledge_id, amount (optional) }
   */
  async calculate(data) {
    return apiGet('/principal-payments/calculate', data)
  },

  /**
   * Take the payment.
   * @param {Object} paymentData - { pledge_id, amount, payment_method, ... }
   */
  async create(paymentData) {
    return apiPost('/principal-payments', paymentData)
  },

  /** Today's principal payments, with a summary for the counter's tally. */
  async getToday() {
    return apiGet('/principal-payments/today')
  },
}

export default principalPaymentService
