/**
 * Auth Service - Authentication API calls
 */

import { apiPost, apiGet, setToken, removeToken, getToken } from './api'

const authService = {
  /**
   * Login user (supports both email and username)
   * @param {string} username - Username or email
   * @param {string} password 
   * @returns {Promise} User data with token
   */
  async login(username, password) {
    // Backend accepts both 'email' and 'username' field
    // Determine if input is email or username
    const isEmail = username.includes('@')
    const loginData = isEmail 
      ? { email: username, password }
      : { username, password }
    
    const response = await apiPost('/auth/login', loginData)
    
    if (response.success && response.data?.token) {
      setToken(response.data.token)
      localStorage.setItem('pawnsys_user', JSON.stringify(response.data.user))
    }
    
    return response
  },

  /**
   * Logout user
   * @returns {Promise}
   */
  async logout() {
    try {
      await apiPost('/auth/logout')
    } finally {
      removeToken()
      localStorage.removeItem('pawnsys_user')
    }
  },

  /**
   * Get current user
   * @returns {Promise} Current user data
   */
  async getCurrentUser() {
    return apiGet('/auth/me')
  },

  /**
   * Refresh token
   * @returns {Promise} New token
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
   * @param {string} currentPassword 
   * @param {string} newPassword 
   * @param {string} newPasswordConfirmation 
   * @returns {Promise}
   */
  async changePassword(currentPassword, newPassword, newPasswordConfirmation) {
    return apiPost('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
      new_password_confirmation: newPasswordConfirmation,
    })
  },

  /**
   * Verify passkey for restricted actions
   * @param {string} passkey 
   * @returns {Promise}
   */
  async verifyPasskey(passkey) {
    return apiPost('/auth/verify-passkey', { passkey })
  },

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!getToken()
  },

  /**
   * Get stored user from localStorage
   * @returns {Object|null}
   */
  getStoredUser() {
    const userStr = localStorage.getItem('pawnsys_user')
    return userStr ? JSON.parse(userStr) : null
  },
}

export default authService