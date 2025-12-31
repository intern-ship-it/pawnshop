/**
 * Customers Slice - Updated with async thunks for API integration
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { customerService } from '@/services'

// Async Thunks
export const fetchCustomers = createAsyncThunk(
  'customers/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await customerService.getAll(params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch customers')
    }
  }
)

export const fetchCustomerById = createAsyncThunk(
  'customers/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await customerService.getById(id)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Customer not found')
    }
  }
)

export const searchCustomerByIC = createAsyncThunk(
  'customers/searchByIC',
  async (icNumber, { rejectWithValue }) => {
    try {
      const response = await customerService.searchByIC(icNumber)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Customer not found')
    }
  }
)

export const createCustomer = createAsyncThunk(
  'customers/create',
  async (customerData, { rejectWithValue }) => {
    try {
      const response = await customerService.create(customerData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.errors || error.message || 'Failed to create customer')
    }
  }
)

export const updateCustomer = createAsyncThunk(
  'customers/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await customerService.update(id, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.errors || error.message || 'Failed to update customer')
    }
  }
)

export const deleteCustomer = createAsyncThunk(
  'customers/delete',
  async (id, { rejectWithValue }) => {
    try {
      await customerService.delete(id)
      return id
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete customer')
    }
  }
)

export const fetchCustomerPledges = createAsyncThunk(
  'customers/fetchPledges',
  async (customerId, { rejectWithValue }) => {
    try {
      const response = await customerService.getPledges(customerId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch pledges')
    }
  }
)

export const fetchCustomerActivePledges = createAsyncThunk(
  'customers/fetchActivePledges',
  async (customerId, { rejectWithValue }) => {
    try {
      const response = await customerService.getActivePledges(customerId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch active pledges')
    }
  }
)

export const blacklistCustomer = createAsyncThunk(
  'customers/blacklist',
  async ({ customerId, reason }, { rejectWithValue }) => {
    try {
      const response = await customerService.blacklist(customerId, reason)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to blacklist customer')
    }
  }
)

// Initial state
const initialState = {
  customers: [],
  selectedCustomer: null,
  customerPledges: [],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    perPage: 10,
  },
  searchQuery: '',
  filters: {
    status: 'all',
    blacklisted: false,
  },
  loading: false,
  error: null,
}

// Slice
const customersSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    setSelectedCustomer: (state, action) => {
      state.selectedCustomer = action.payload
    },
    clearSelectedCustomer: (state) => {
      state.selectedCustomer = null
      state.customerPledges = []
    },
    clearError: (state) => {
      state.error = null
    },
    // For local/mock operations (can keep for fallback)
    setCustomers: (state, action) => {
      state.customers = action.payload
    },
    addCustomer: (state, action) => {
      state.customers.unshift(action.payload)
    },
    updateCustomerLocal: (state, action) => {
      const index = state.customers.findIndex(c => c.id === action.payload.id)
      if (index !== -1) {
        state.customers[index] = action.payload
      }
    },
    removeCustomer: (state, action) => {
      state.customers = state.customers.filter(c => c.id !== action.payload)
    },
    setLoading: (state, action) => {
      state.loading = action.payload
    },
    setError: (state, action) => {
      state.error = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch All Customers
      .addCase(fetchCustomers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        state.loading = false
        state.customers = action.payload.customers || action.payload
        if (action.payload.pagination) {
          state.pagination = action.payload.pagination
        }
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Fetch Customer By ID
      .addCase(fetchCustomerById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCustomerById.fulfilled, (state, action) => {
        state.loading = false
        state.selectedCustomer = action.payload
      })
      .addCase(fetchCustomerById.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Search By IC
      .addCase(searchCustomerByIC.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(searchCustomerByIC.fulfilled, (state, action) => {
        state.loading = false
        state.selectedCustomer = action.payload
      })
      .addCase(searchCustomerByIC.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.selectedCustomer = null
      })

      // Create Customer
      .addCase(createCustomer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createCustomer.fulfilled, (state, action) => {
        state.loading = false
        state.customers.unshift(action.payload)
        state.selectedCustomer = action.payload
      })
      .addCase(createCustomer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Update Customer
      .addCase(updateCustomer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateCustomer.fulfilled, (state, action) => {
        state.loading = false
        const index = state.customers.findIndex(c => c.id === action.payload.id)
        if (index !== -1) {
          state.customers[index] = action.payload
        }
        state.selectedCustomer = action.payload
      })
      .addCase(updateCustomer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Delete Customer
      .addCase(deleteCustomer.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteCustomer.fulfilled, (state, action) => {
        state.loading = false
        state.customers = state.customers.filter(c => c.id !== action.payload)
        if (state.selectedCustomer?.id === action.payload) {
          state.selectedCustomer = null
        }
      })
      .addCase(deleteCustomer.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Fetch Customer Pledges
      .addCase(fetchCustomerPledges.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchCustomerPledges.fulfilled, (state, action) => {
        state.loading = false
        state.customerPledges = action.payload
      })
      .addCase(fetchCustomerPledges.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Fetch Active Pledges
      .addCase(fetchCustomerActivePledges.fulfilled, (state, action) => {
        state.customerPledges = action.payload
      })

      // Blacklist Customer
      .addCase(blacklistCustomer.fulfilled, (state, action) => {
        const index = state.customers.findIndex(c => c.id === action.payload.id)
        if (index !== -1) {
          state.customers[index] = action.payload
        }
        if (state.selectedCustomer?.id === action.payload.id) {
          state.selectedCustomer = action.payload
        }
      })
  },
})

export const {
  setSearchQuery,
  setFilters,
  setSelectedCustomer,
  clearSelectedCustomer,
  clearError,
  setCustomers,
  addCustomer,
  updateCustomerLocal,
  removeCustomer,
  setLoading,
  setError,
} = customersSlice.actions

export default customersSlice.reducer
