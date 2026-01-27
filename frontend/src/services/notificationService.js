/**
 * Notification Service
 * Handles API calls for notifications
 */

import api from "./api";

const notificationService = {
    /**
     * Get all notifications (stored + live)
     */
    getAll: async (limit = 10) => {
        const response = await api.get("/notifications", { params: { limit } });
        return response.data;
    },

    /**
     * Get stored notifications only
     */
    getStored: async (limit = 10) => {
        const response = await api.get("/notifications/stored", { params: { limit } });
        return response.data;
    },

    /**
     * Get live/real-time notifications only
     */
    getLive: async () => {
        const response = await api.get("/notifications/live");
        return response.data;
    },

    /**
     * Get unread count
     */
    getUnreadCount: async () => {
        const response = await api.get("/notifications/unread-count");
        return response.data;
    },

    /**
     * Mark a notification as read
     */
    markAsRead: async (id) => {
        const response = await api.post(`/notifications/${id}/read`);
        return response.data;
    },

    /**
     * Mark all notifications as read
     */
    markAllAsRead: async () => {
        const response = await api.post("/notifications/mark-all-read");
        return response.data;
    },

    /**
     * Delete a notification
     */
    delete: async (id) => {
        const response = await api.delete(`/notifications/${id}`);
        return response.data;
    },
};

export default notificationService;
