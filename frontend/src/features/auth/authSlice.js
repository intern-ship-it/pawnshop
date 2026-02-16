/**
 * Auth Slice - Redux state for authentication
 * Updated for Laravel backend with username login
 * With Remember Me functionality
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import authService from '@/services/authService'

// Async Thunks

export const loginWithUsername = createAsyncThunk(
  'auth/loginWithUsername',
  async ({ username, password, rememberMe = false }, { rejectWithValue }) => {
    try {
      const response = await authService.loginWithUsername(username, password, rememberMe)
      if (!response.success) {
        return rejectWithValue(response.message || 'Login failed')
      }
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Login failed')
    }
  }
)

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password, rememberMe = false }, { rejectWithValue }) => {
    try {
      const response = await authService.login(email, password, rememberMe)
      if (!response.success) {
        return rejectWithValue(response.message || 'Login failed')
      }
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Login failed')
    }
  }
)

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout()
      return null
    } catch (error) {
      authService.clearLocalAuth()
      return rejectWithValue(error.message)
    }
  }
)

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.getCurrentUser()
      if (!response.success) {
        return rejectWithValue(response.message || 'Failed to fetch user')
      }
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch user')
    }
  }
)

export const verifyPasskey = createAsyncThunk(
  'auth/verifyPasskey',
  async (passkey, { rejectWithValue }) => {
    try {
      const response = await authService.verifyPasskey(passkey)
      if (!response.success) {
        return rejectWithValue(response.message || 'Invalid passkey')
      }
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Invalid passkey')
    }
  }
)

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async ({ currentPassword, newPassword, confirmPassword }, { rejectWithValue }) => {
    try {
      const response = await authService.changePassword(
        currentPassword,
        newPassword,
        confirmPassword
      )
      if (!response.success) {
        return rejectWithValue(response.message || 'Failed to change password')
      }
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to change password')
    }
  }
)

// Initial state
const storedUser = authService.getStoredUser()
const hasToken = authService.isAuthenticated()

const initialState = {
  user: storedUser,
  role: storedUser?.role || null,
  permissions: storedUser?.permissions || {},
  branch: storedUser?.branch || null,
  isAuthenticated: hasToken && !!storedUser,
  passkeyVerified: false,
  passkeyExpiry: null,
  loading: false,
  error: null,
}

// Slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearPasskeyVerification: (state) => {
      state.passkeyVerified = false
      state.passkeyExpiry = null
    },
    logoutSuccess: (state) => {
      state.user = null
      state.role = null
      state.permissions = {}
      state.branch = null
      state.isAuthenticated = false
      state.passkeyVerified = false
      state.passkeyExpiry = null
      state.error = null
    },
    setUser: (state, action) => {
      state.user = action.payload
      state.role = action.payload?.role || null
      state.permissions = action.payload?.permissions || {}
      state.branch = action.payload?.branch || null
      state.isAuthenticated = true
    },
  },
  extraReducers: (builder) => {
    builder
      // Login with Username
      .addCase(loginWithUsername.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loginWithUsername.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.role = action.payload.user?.role || null
        state.permissions = action.payload.user?.permissions || {}
        state.branch = action.payload.user?.branch || null
        state.isAuthenticated = true
        state.error = null
      })
      .addCase(loginWithUsername.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.isAuthenticated = false
      })

      // Login (legacy)
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.role = action.payload.user?.role || null
        state.permissions = action.payload.user?.permissions || {}
        state.branch = action.payload.user?.branch || null
        state.isAuthenticated = true
        state.error = null
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.isAuthenticated = false
      })

      // Logout
      .addCase(logout.pending, (state) => {
        state.loading = true
      })
      .addCase(logout.fulfilled, (state) => {
        state.loading = false
        state.user = null
        state.role = null
        state.permissions = {}
        state.branch = null
        state.isAuthenticated = false
        state.passkeyVerified = false
        state.passkeyExpiry = null
        state.error = null
      })
      .addCase(logout.rejected, (state) => {
        state.loading = false
        state.user = null
        state.role = null
        state.permissions = {}
        state.branch = null
        state.isAuthenticated = false
        state.passkeyVerified = false
        state.passkeyExpiry = null
        state.error = null // Clear error to prevent it leaking to login page
      })

      // Fetch Current User
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload
        state.role = action.payload?.role || null
        state.permissions = action.payload?.permissions || {}
        state.branch = action.payload?.branch || null
        state.isAuthenticated = true
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.loading = false
        // Do NOT set state.error here - fetchCurrentUser is used for silent
        // auto-login checks and should not display errors on the login page
      })

      // Verify Passkey
      .addCase(verifyPasskey.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(verifyPasskey.fulfilled, (state) => {
        state.loading = false
        state.passkeyVerified = true
        state.passkeyExpiry = Date.now() + (5 * 60 * 1000)
      })
      .addCase(verifyPasskey.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.passkeyVerified = false
      })

      // Change Password
      .addCase(changePassword.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const {
  clearError,
  clearPasskeyVerification,
  logoutSuccess,
  setUser,
} = authSlice.actions

// Selectors
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated
export const selectUser = (state) => state.auth.user
export const selectRole = (state) => state.auth.role
export const selectPermissions = (state) => state.auth.permissions
export const selectBranch = (state) => state.auth.branch
export const selectPasskeyVerified = (state) => {
  const { passkeyVerified, passkeyExpiry } = state.auth
  if (passkeyVerified && passkeyExpiry) {
    return Date.now() < passkeyExpiry
  }
  return false
}

export default authSlice.reducer