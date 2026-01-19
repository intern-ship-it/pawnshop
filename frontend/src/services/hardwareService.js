/**
 * Hardware Service
 * API calls for hardware device management
 */

import api from './api';

const hardwareService = {
    /**
     * Get all hardware devices
     * @param {Object} params - Filter params (type, active, connection)
     * @returns {Promise}
     */
    async getAll(params = {}) {
        try {
            const response = await api.get('/hardware', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching hardware devices:', error);
            throw error;
        }
    },

    /**
     * Get single device
     * @param {number} id - Device ID
     * @returns {Promise}
     */
    async getById(id) {
        try {
            const response = await api.get(`/hardware/${id}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching device:', error);
            throw error;
        }
    },

    /**
     * Create new device
     * @param {Object} data - Device data
     * @returns {Promise}
     */
    async create(data) {
        try {
            const response = await api.post('/hardware', data);
            return response.data;
        } catch (error) {
            console.error('Error creating device:', error);
            throw error;
        }
    },

    /**
     * Update device
     * @param {number} id - Device ID
     * @param {Object} data - Device data
     * @returns {Promise}
     */
    async update(id, data) {
        try {
            const response = await api.put(`/hardware/${id}`, data);
            return response.data;
        } catch (error) {
            console.error('Error updating device:', error);
            throw error;
        }
    },

    /**
     * Delete device
     * @param {number} id - Device ID
     * @returns {Promise}
     */
    async delete(id) {
        try {
            const response = await api.delete(`/hardware/${id}`);
            return response.data;
        } catch (error) {
            console.error('Error deleting device:', error);
            throw error;
        }
    },

    /**
     * Toggle device active status
     * @param {number} id - Device ID
     * @returns {Promise}
     */
    async toggleActive(id) {
        try {
            const response = await api.post(`/hardware/${id}/toggle-active`);
            return response.data;
        } catch (error) {
            console.error('Error toggling device status:', error);
            throw error;
        }
    },

    /**
     * Set device as default
     * @param {number} id - Device ID
     * @returns {Promise}
     */
    async setDefault(id) {
        try {
            const response = await api.post(`/hardware/${id}/set-default`);
            return response.data;
        } catch (error) {
            console.error('Error setting default device:', error);
            throw error;
        }
    },

    /**
     * Update device connection status
     * @param {number} id - Device ID
     * @param {string} status - Status (connected, disconnected, error, unknown)
     * @returns {Promise}
     */
    async updateStatus(id, status) {
        try {
            const response = await api.post(`/hardware/${id}/update-status`, { status });
            return response.data;
        } catch (error) {
            console.error('Error updating device status:', error);
            throw error;
        }
    },

    /**
     * Test device connection
     * @param {number} id - Device ID
     * @returns {Promise}
     */
    async testConnection(id) {
        try {
            const response = await api.post(`/hardware/${id}/test`);
            return response.data;
        } catch (error) {
            console.error('Error testing device:', error);
            throw error;
        }
    },

    /**
     * Get default devices for each type
     * @returns {Promise}
     */
    async getDefaults() {
        try {
            const response = await api.get('/hardware/defaults');
            return response.data;
        } catch (error) {
            console.error('Error fetching default devices:', error);
            throw error;
        }
    },

    /**
     * Get device options (types, connections, etc.)
     * @returns {Promise}
     */
    async getOptions() {
        try {
            const response = await api.get('/hardware/options');
            return response.data;
        } catch (error) {
            console.error('Error fetching hardware options:', error);
            throw error;
        }
    },

    /**
     * Get default device for a specific type
     * @param {string} type - Device type
     * @returns {Promise}
     */
    async getDefaultForType(type) {
        try {
            const response = await this.getDefaults();
            if (response.success && response.data) {
                return response.data[type] || null;
            }
            return null;
        } catch (error) {
            console.error('Error fetching default device for type:', error);
            return null;
        }
    },

    /**
     * Get all printers (dot matrix + thermal)
     * @returns {Promise}
     */
    async getPrinters() {
        try {
            const response = await this.getAll();
            if (response.success && response.data?.devices) {
                return response.data.devices.filter(d =>
                    d.type === 'dot_matrix_printer' || d.type === 'thermal_printer'
                );
            }
            return [];
        } catch (error) {
            console.error('Error fetching printers:', error);
            return [];
        }
    },

    /**
     * Get all barcode scanners
     * @returns {Promise}
     */
    async getScanners() {
        try {
            const response = await this.getAll({ type: 'barcode_scanner' });
            if (response.success && response.data?.devices) {
                return response.data.devices;
            }
            return [];
        } catch (error) {
            console.error('Error fetching scanners:', error);
            return [];
        }
    },
};

export default hardwareService;