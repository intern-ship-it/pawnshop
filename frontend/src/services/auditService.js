/**
 * Audit Log Service
 * API calls for audit log management
 */

import api from './api';

const auditService = {
    /**
     * Get audit logs with filters
     * @param {Object} params - Filter params
     * @returns {Promise}
     */
    async getLogs(params = {}) {
        try {
            const response = await api.get('/audit/logs', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            throw error;
        }
    },

    /**
     * Get filter options
     * @returns {Promise}
     */
    async getOptions() {
        try {
            const response = await api.get('/audit/options');
            return response.data;
        } catch (error) {
            console.error('Error fetching audit options:', error);
            throw error;
        }
    },

    /**
     * Get activity summary
     * @param {number} days - Number of days to look back
     * @returns {Promise}
     */
    async getActivitySummary(days = 7) {
        try {
            const response = await api.get('/audit/activity-summary', { params: { days } });
            return response.data;
        } catch (error) {
            console.error('Error fetching activity summary:', error);
            throw error;
        }
    },

    /**
     * Get passkey logs
     * @param {Object} params - Filter params
     * @returns {Promise}
     */
    async getPasskeyLogs(params = {}) {
        try {
            const response = await api.get('/audit/passkey-logs', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching passkey logs:', error);
            throw error;
        }
    },

    /**
     * Export logs as CSV
     * @param {Object} params - Filter params
     * @returns {Promise}
     */
    async exportLogs(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${api.defaults.baseURL}/audit/logs/export?${queryString}`;

            // Open in new tab to download
            window.open(url, '_blank');
            return { success: true };
        } catch (error) {
            console.error('Error exporting audit logs:', error);
            throw error;
        }
    },
};

export default auditService;
