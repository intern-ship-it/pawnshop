/**
 * WhatsApp Service - API integration for WhatsApp messaging
 * Connects to Laravel backend WhatsApp endpoints
 */

import api from './api'

const whatsappService = {
    /**
     * Get WhatsApp configuration
     * GET /api/whatsapp/config
     */
    getConfig: async () => {
        try {
            const response = await api.get('/whatsapp/config')
            return response
        } catch (error) {
            console.error('Get WhatsApp config failed:', error)
            throw error
        }
    },

    /**
     * Update WhatsApp configuration
     * PUT /api/whatsapp/config
     * @param {Object} config - Configuration data
     * @param {string} config.provider - Provider (ultramsg, twilio, wati)
     * @param {string} config.instance_id - Instance ID
     * @param {string} config.api_token - API Token
     * @param {string} config.phone_number - Phone number / country code
     * @param {boolean} config.is_enabled - Enable/disable WhatsApp
     */
    updateConfig: async (config) => {
        try {
            const response = await api.put('/whatsapp/config', config)
            return response
        } catch (error) {
            console.error('Update WhatsApp config failed:', error)
            throw error
        }
    },

    /**
     * Test WhatsApp connection
     * POST /api/whatsapp/test-connection
     */
    testConnection: async () => {
        try {
            const response = await api.post('/whatsapp/test-connection')
            return response
        } catch (error) {
            console.error('Test WhatsApp connection failed:', error)
            throw error
        }
    },

    /**
     * Get all message templates
     * GET /api/whatsapp/templates
     */
    getTemplates: async () => {
        try {
            const response = await api.get('/whatsapp/templates')
            return response
        } catch (error) {
            console.error('Get WhatsApp templates failed:', error)
            throw error
        }
    },

    /**
     * Update a message template
     * PUT /api/whatsapp/templates/:id
     * @param {number|string} templateId - Template ID
     * @param {Object} data - Template data
     * @param {string} data.name - Template name
     * @param {string} data.content - Template content
     * @param {boolean} data.is_enabled - Enable/disable template
     */
    updateTemplate: async (templateId, data) => {
        try {
            const response = await api.put(`/whatsapp/templates/${templateId}`, data)
            return response
        } catch (error) {
            console.error('Update WhatsApp template failed:', error)
            throw error
        }
    },

    /**
     * Send WhatsApp message
     * POST /api/whatsapp/send
     * @param {Object} data - Message data
     * @param {string} data.template_key - Template key/ID
     * @param {string} data.recipient_phone - Recipient phone number
     * @param {string} data.recipient_name - Recipient name (optional)
     * @param {Object} data.data - Template variables
     * @param {string} data.related_type - Related entity type (optional)
     * @param {number} data.related_id - Related entity ID (optional)
     */
    send: async (data) => {
        try {
            const response = await api.post('/whatsapp/send', data)
            return response
        } catch (error) {
            console.error('Send WhatsApp message failed:', error)
            throw error
        }
    },

    /**
     * Get message logs/history
     * GET /api/whatsapp/logs
     * @param {Object} params - Query parameters
     * @param {string} params.status - Filter by status (sent, failed, pending)
     * @param {string} params.from_date - Filter from date
     * @param {string} params.to_date - Filter to date
     * @param {number} params.per_page - Items per page
     */
    getLogs: async (params = {}) => {
        try {
            const response = await api.get('/whatsapp/logs', { params })
            return response
        } catch (error) {
            console.error('Get WhatsApp logs failed:', error)
            throw error
        }
    },

    /**
     * Resend a failed message
     * POST /api/whatsapp/logs/:id/resend
     * @param {number} logId - Log ID
     */
    resend: async (logId) => {
        try {
            const response = await api.post(`/whatsapp/logs/${logId}/resend`)
            return response
        } catch (error) {
            console.error('Resend WhatsApp message failed:', error)
            throw error
        }
    },
}

export default whatsappService