/**
 * API Service - Axios instance with interceptors
 * Connects React frontend to Laravel Sanctum backend
 */

import axios from 'axios'

// API Base URL - change for production
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

// Create Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // withCredentials: true, // REMOVED - Not needed for token-based auth
})

// Token storage key
const TOKEN_KEY = 'pawnsys_token'

// Get token from storage
export const getToken = () => localStorage.getItem(TOKEN_KEY)

// Set token to storage
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)

// Remove token from storage
export const removeToken = () => localStorage.removeItem(TOKEN_KEY)

// Request interceptor - Add auth token
api.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => {
    // Return data directly if success
    return response.data
  },
  async (error) => {
    const originalRequest = error.config

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      // Try to refresh token
      try {
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${getToken()}`,
            },
          }
        )

        if (refreshResponse.data.success) {
          const newToken = refreshResponse.data.data.token
          setToken(newToken)
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        // Refresh failed - logout user
        removeToken()
        localStorage.removeItem('pawnsys_user')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error('Access denied:', error.response.data?.message)
    }

    // Handle 422 Validation Error
    if (error.response?.status === 422) {
      const validationErrors = error.response.data?.errors || {}
      return Promise.reject({
        message: error.response.data?.message || 'Validation failed',
        errors: validationErrors,
      })
    }

    // Handle 500 Server Error
    if (error.response?.status >= 500) {
      console.error('Server error:', error.response.data?.message)
    }

    // Return error response
    return Promise.reject({
      message: error.response?.data?.message || 'An error occurred',
      status: error.response?.status,
      errors: error.response?.data?.errors || {},
    })
  }
)

// Helper methods
export const apiGet = (url, params = {}) => api.get(url, { params })
export const apiPost = (url, data = {}) => api.post(url, data)
export const apiPut = (url, data = {}) => api.put(url, data)
export const apiPatch = (url, data = {}) => api.patch(url, data)
export const apiDelete = (url) => api.delete(url)

// File upload helper
export const apiUpload = (url, formData, onProgress) => {
  return api.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        )
        onProgress(percentCompleted)
      }
    },
  })
}

export default api