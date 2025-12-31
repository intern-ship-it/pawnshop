/**
 * Auth Slice - Updated with async thunks for API integration
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import authService from '@/services/authService'

// Async Thunks
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await authService.login(email, password)
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
      // Still logout locally even if API fails
      authService.logout()
      return rejectWithValue(error.message)
    }
  }
)

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.getCurrentUser()
      return response.data
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const verifyPasskey = createAsyncThunk(
  'auth/verifyPasskey',
  async (passkey, { rejectWithValue }) => {
    try {
      const response = await authService.verifyPasskey(passkey)
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
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to change password')
    }
  }
)

// Initial state
const initialState = {
  user: authService.getStoredUser(),
  role: authService.getStoredUser()?.role || null,
  isAuthenticated: authService.isAuthenticated(),
  passkeyVerified: false,
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
    },
    // For mock/local auth (can remove later)
    loginStart: (state) => {
      state.loading = true
      state.error = null
    },
    loginSuccess: (state, action) => {
      state.loading = false
      state.user = action.payload.user
      state.role = action.payload.role
      state.isAuthenticated = true
      state.error = null
    },
    loginFailure: (state, action) => {
      state.loading = false
      state.error = action.payload
      state.isAuthenticated = false
    },
    logoutSuccess: (state) => {
      state.user = null
      state.role = null
      state.isAuthenticated = false
      state.passkeyVerified = false
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.role = action.payload.user?.role || null
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
        state.isAuthenticated = false
        state.passkeyVerified = false
        state.error = null
      })
      .addCase(logout.rejected, (state) => {
        // Still clear state on logout failure
        state.loading = false
        state.user = null
        state.role = null
        state.isAuthenticated = false
        state.passkeyVerified = false
      })

      // Fetch Current User
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload
        state.role = action.payload?.role || null
        state.isAuthenticated = true
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.isAuthenticated = false
      })

      // Verify Passkey
      .addCase(verifyPasskey.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(verifyPasskey.fulfilled, (state) => {
        state.loading = false
        state.passkeyVerified = true
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
  loginStart,
  loginSuccess,
  loginFailure,
  logoutSuccess,
} = authSlice.actions

export default authSlice.reducer
