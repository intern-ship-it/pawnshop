/**
 * Auction Service - Auction API calls
 */

import { apiGet, apiPost, apiPut, apiDelete } from './api'

const auctionService = {
  /**
   * Get all auctions with pagination
   * @param {Object} params - Query parameters (status, per_page, page)
   * @returns {Promise}
   */
  async getAll(params = {}) {
    return apiGet('/auctions', params)
  },

  /**
   * Get auction by ID
   * @param {number} id
   * @returns {Promise}
   */
  async getById(id) {
    return apiGet(`/auctions/${id}`)
  },

  /**
   * Create a new auction
   * @param {Object} data - { auction_date, auction_time, location }
   * @returns {Promise}
   */
  async create(data) {
    return apiPost('/auctions', data)
  },

  /**
   * Update auction
   * @param {number} id
   * @param {Object} data
   * @returns {Promise}
   */
  async update(id, data) {
    return apiPut(`/auctions/${id}`, data)
  },

  /**
   * Get eligible items for auction (forfeited/overdue beyond grace)
   * @returns {Promise}
   */
  async getEligibleItems() {
    return apiGet('/auctions/eligible-items')
  },

  /**
   * Get overdue pledges (3+ days overdue, eligible for auction process)
   * @param {Object} params - { search, sort_by, min_days_overdue }
   * @returns {Promise}
   */
  async getOverduePledges(params = {}) {
    return apiGet('/auctions/overdue-pledges', params)
  },

  /**
   * Get forfeited pledges
   * @param {Object} params - { search, sort_by }
   * @returns {Promise}
   */
  async getForfeitedPledges(params = {}) {
    return apiGet('/auctions/forfeited-pledges', params)
  },

  /**
   * Get auctioned pledges (completed sales)
   * @param {Object} params - { search, sort_by }
   * @returns {Promise}
   */
  async getAuctionedPledges(params = {}) {
    return apiGet('/auctions/auctioned-pledges', params)
  },

  /**
   * Get auction statistics/summary
   * @returns {Promise}
   */
  async getStats() {
    return apiGet('/auctions/stats')
  },

  /**
   * Forfeit a pledge (mark as forfeited)
   * @param {number} pledgeId
   * @param {Object} data - { notes }
   * @returns {Promise}
   */
  async forfeitPledge(pledgeId, data = {}) {
    return apiPost(`/auctions/forfeit/${pledgeId}`, data)
  },

  /**
   * Sell a forfeited pledge (quick auction sale)
   * @param {number} pledgeId
   * @param {Object} data - { sold_price, buyer_name, buyer_ic, buyer_phone, notes }
   * @returns {Promise}
   */
  async sellForfeitedPledge(pledgeId, data) {
    return apiPost(`/auctions/sell/${pledgeId}`, data)
  },

  /**
   * Get auction items
   * @param {number} auctionId
   * @returns {Promise}
   */
  async getItems(auctionId) {
    return apiGet(`/auctions/${auctionId}/items`)
  },

  /**
   * Add items to auction
   * @param {number} auctionId
   * @param {Object} data - { items: [{ pledge_item_id, reserve_price }] }
   * @returns {Promise}
   */
  async addItems(auctionId, data) {
    return apiPost(`/auctions/${auctionId}/add-items`, data)
  },

  /**
   * Remove item from auction
   * @param {number} auctionId
   * @param {number} auctionItemId
   * @returns {Promise}
   */
  async removeItem(auctionId, auctionItemId) {
    return apiDelete(`/auctions/${auctionId}/items/${auctionItemId}`)
  },

  /**
   * Sell item at auction
   * @param {number} auctionId
   * @param {number} auctionItemId
   * @param {Object} data - { sold_price, buyer_name, buyer_ic, buyer_phone }
   * @returns {Promise}
   */
  async sellItem(auctionId, auctionItemId, data) {
    return apiPost(`/auctions/${auctionId}/items/${auctionItemId}/sell`, data)
  },

  /**
   * Mark item as unsold
   * @param {number} auctionId
   * @param {number} auctionItemId
   * @returns {Promise}
   */
  async markUnsold(auctionId, auctionItemId) {
    return apiPost(`/auctions/${auctionId}/items/${auctionItemId}/unsold`)
  },

  /**
   * Complete auction
   * @param {number} auctionId
   * @returns {Promise}
   */
  async complete(auctionId) {
    return apiPost(`/auctions/${auctionId}/complete`)
  },

  /**
   * Cancel auction
   * @param {number} auctionId
   * @returns {Promise}
   */
  async cancel(auctionId) {
    return apiPost(`/auctions/${auctionId}/cancel`)
  },
}

export default auctionService
