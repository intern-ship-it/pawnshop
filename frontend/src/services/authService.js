/**
 * Auth Service - Authentication API calls
 * Updated to work with Laravel backend
 * With Remember Me functionality
 */

import { apiPost, apiGet, apiPut, setLoggingOut } from './api'

const USER_KEY = 'pawnsys_user'
const TOKEN_KEY = 'pawnsys_token'
const REMEMBER_KEY = 'pawnsys_remember'

/**
 * Get the correct storage based on remember me choice
 */
const getStorage = () => {
  const remembered = localStorage.getItem(REMEMBER_KEY)
  if (remembered === 'true') {
    return localStorage
  } else if (remembered === 'false') {
    return sessionStorage
  }
  // Fallback: check which storage has the token
  if (localStorage.getItem(TOKEN_KEY)) {
    return localStorage
  }
  return sessionStorage
}

/**
 * Get token from correct storage
 */
export const getToken = () => {
  // Check localStorage first (for remember me)
  const remembered = localStorage.getItem(REMEMBER_KEY)

  if (remembered === 'true') {
    return localStorage.getItem(TOKEN_KEY)
  } else if (remembered === 'false') {
    return sessionStorage.getItem(TOKEN_KEY)
  }

  // Fallback: check both (for backward compatibility)
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
}

/**
 * Set token in correct storage
 */
export const setToken = (token, rememberMe = true) => {
  const storage = rememberMe ? localStorage : sessionStorage
  storage.setItem(TOKEN_KEY, token)
  localStorage.setItem(REMEMBER_KEY, rememberMe ? 'true' : 'false')
}

/**
 * Remove token from both storages
 */
export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

const authService = {
  /**
   * Login with username and password (for Laravel backend)
   * Supports Remember Me functionality
   */
  async loginWithUsername(username, password, rememberMe = false) {
    const response = await apiPost('/auth/login', { username, password })

    if (response.success && response.data?.token) {
      // Choose storage based on rememberMe
      const storage = rememberMe ? localStorage : sessionStorage

      // Clear any existing tokens from both storages first
      localStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(TOKEN_KEY)

      // Store in correct storage
      storage.setItem(TOKEN_KEY, response.data.token)
      storage.setItem(USER_KEY, JSON.stringify(response.data.user))

      // Remember the choice for token retrieval
      localStorage.setItem(REMEMBER_KEY, rememberMe ? 'true' : 'false')
    }

    return response
  },

  /**
   * Login with email and password (legacy)
   */
  async login(email, password, rememberMe = false) {
    const response = await apiPost('/auth/login', { email, password })

    if (response.success && response.data?.token) {
      const storage = rememberMe ? localStorage : sessionStorage

      localStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(TOKEN_KEY)

      storage.setItem(TOKEN_KEY, response.data.token)
      storage.setItem(USER_KEY, JSON.stringify(response.data.user))
      localStorage.setItem(REMEMBER_KEY, rememberMe ? 'true' : 'false')
    }

    return response
  },

  /**
   * Logout user
   */
  async logout() {
    try {
      // Set flag to prevent token refresh attempts during logout
      setLoggingOut(true)
      await apiPost('/auth/logout')
    } catch (error) {
      console.warn('Logout API error:', error)
    } finally {
      this.clearLocalAuth()
      // Reset flag after logout is complete
      setLoggingOut(false)
    }
  },

  /**
   * Clear ALL local data on logout (localStorage + sessionStorage)
   */
  clearLocalAuth() {
    // Clear ALL localStorage data
    localStorage.clear()

    // Clear ALL sessionStorage data
    sessionStorage.clear()
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
        // Store user in correct storage
        const storage = getStorage()
        storage.setItem(USER_KEY, JSON.stringify(response.data))
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
      const storage = getStorage()
      storage.setItem(TOKEN_KEY, response.data.token)
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
   * Get stored user from correct storage
   */
  getStoredUser() {
    try {
      const storage = getStorage()
      const userStr = storage.getItem(USER_KEY)

      // Fallback to other storage if not found
      if (!userStr) {
        const fallbackStorage = storage === localStorage ? sessionStorage : localStorage
        const fallbackUser = fallbackStorage.getItem(USER_KEY)
        return fallbackUser ? JSON.parse(fallbackUser) : null
      }

      return JSON.parse(userStr)
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

  /**
   * Request password reset (forgot password)
   */
  async forgotPassword(email) {
    return apiPost('/auth/forgot-password', { email })
  },

  /**
   * Verify password reset token
   */
  async verifyResetToken(token) {
    return apiPost('/auth/verify-reset-token', { token })
  },

  /**
   * Reset password with token
   */
  async resetPassword(token, password, passwordConfirmation) {
    return apiPost('/auth/reset-password', {
      token,
      password,
      password_confirmation: passwordConfirmation,
    })
  },

  // Update user profile
  async updateProfile(formData) {
    // Laravel requires POST with _method override for file uploads
    if (formData instanceof FormData) {
      formData.append('_method', 'PUT')
      return apiPost('/auth/profile', formData)
    }
    return apiPost('/auth/profile', { ...formData, _method: 'PUT' })
  },
}

export default authService