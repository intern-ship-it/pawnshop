/**
 * Auth Service - Authentication API calls
 * Updated to work with Laravel backend
 */

import { apiPost, apiGet, apiPut, setToken, removeToken, getToken } from './api'

const USER_KEY = 'pawnsys_user'

const authService = {
  /**
   * Login with username and password (for Laravel backend)
   */
  async loginWithUsername(username, password) {
    const response = await apiPost('/auth/login', { username, password })
    
    if (response.success && response.data?.token) {
      setToken(response.data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(response.data.user))
    }
    
    return response
  },

  /**
   * Login with email and password (legacy)
   */
  async login(email, password) {
    const response = await apiPost('/auth/login', { email, password })
    
    if (response.success && response.data?.token) {
      setToken(response.data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(response.data.user))
    }
    
    return response
  },

  /**
   * Logout user
   */
  async logout() {
    try {
      await apiPost('/auth/logout')
    } catch (error) {
      console.warn('Logout API error:', error)
    } finally {
      this.clearLocalAuth()
    }
  },

  /**
   * Clear local authentication data
   */
  clearLocalAuth() {
    removeToken()
    localStorage.removeItem(USER_KEY)
  },

  /**
   * Get current user from API
   */
  async getCurrentUser() {
    return apiGet('/auth/me')
  },

  /**
   * Verify token is still valid
   */
  async verifyToken() {
    try {
      const token = getToken()
      if (!token) return false

      const response = await apiGet('/auth/me')
      if (response.success && response.data) {
        localStorage.setItem(USER_KEY, JSON.stringify(response.data))
        return true
      }
      return false
    } catch (error) {
      console.warn('Token verification failed:', error)
      return false
    }
  },

  /**
   * Refresh token
   */
  async refreshToken() {
    const response = await apiPost('/auth/refresh')
    
    if (response.success && response.data?.token) {
      setToken(response.data.token)
    }
    
    return response
  },

  /**
   * Change password
   */
  async changePassword(currentPassword, newPassword, newPasswordConfirmation) {
    return apiPut('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
      new_password_confirmation: newPasswordConfirmation,
    })
  },

  /**
   * Verify passkey for restricted actions
   */
  async verifyPasskey(passkey) {
    return apiPost('/auth/verify-passkey', { passkey })
  },

  /**
   * Check if user has token stored
   */
  isAuthenticated() {
    return !!getToken()
  },

  /**
   * Get stored user from localStorage
   */
  getStoredUser() {
    try {
      const userStr = localStorage.getItem(USER_KEY)
      return userStr ? JSON.parse(userStr) : null
    } catch (error) {
      console.error('Error parsing stored user:', error)
      return null
    }
  },

  /**
   * Get token
   */
  getToken() {
    return getToken()
  },

  /**
   * Check if user has specific permission
   */
  hasPermission(permission) {
    const user = this.getStoredUser()
    if (!user?.permissions) return false
    
    return Object.keys(user.permissions).includes(permission) ||
           Object.values(user.permissions).includes(permission)
  },

  /**
   * Check if user has specific role
   */
  hasRole(roles) {
    const user = this.getStoredUser()
    if (!user?.role) return false
    
    const roleSlug = user.role?.slug || user.role
    const roleArray = Array.isArray(roles) ? roles : [roles]
    
    return roleArray.includes(roleSlug)
  },
}

export default authService