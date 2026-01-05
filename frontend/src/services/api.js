/**
 * API Service - Axios instance with interceptors
 * Connects React frontend to Laravel Sanctum backend
 */

import axios from 'axios'

// Auto-detect API URL based on environment
const getApiUrl = () => {
  const hostname = window.location.hostname
  
  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8000/api'
  }
  
  // Production - same domain, just add /api
  return `${window.location.origin}/api`
}

const API_BASE_URL = getApiUrl()

// Create Axios instance - DON'T set Content-Type here
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
  },
})

// Token storage key
const TOKEN_KEY = 'pawnsys_token'

// Get token from storage
export const getToken = () => localStorage.getItem(TOKEN_KEY)

// Set token to storage
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)

// Remove token from storage
export const removeToken = () => localStorage.removeItem(TOKEN_KEY)

// Request interceptor - Add auth token and handle Content-Type
api.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // Only set Content-Type to JSON if NOT FormData
    // For FormData, browser will set it automatically with boundary
    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json'
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

    const isAuthEndpoint = originalRequest.url?.includes('auth/login') || 
                           originalRequest.url?.includes('auth/refresh') ||
                           originalRequest.url?.includes('auth/logout')

    // Handle 401 Unauthorized (but not for auth endpoints)
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true

      // Only try refresh if we have a token
      const currentToken = getToken()
      if (currentToken) {
        try {
          const refreshResponse = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            {},
            {
              headers: {
                Authorization: `Bearer ${currentToken}`,
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
        response: error.response,
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
      response: error.response,
    })
  }
)

// Helper methods
export const apiGet = (url, params = {}) => api.get(url, { params })
export const apiPost = (url, data = {}) => api.post(url, data)
export const apiPut = (url, data = {}) => api.put(url, data)
export const apiPatch = (url, data = {}) => api.patch(url, data)
export const apiDelete = (url) => api.delete(url)

// File upload helper with progress
export const apiUpload = (url, formData, onProgress) => {
  return api.post(url, formData, {
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