/**
 * Dashboard Slice - Async thunks for dashboard API data
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { dashboardService } from '@/services'

// Async Thunks
export const fetchDashboardSummary = createAsyncThunk(
  'dashboard/fetchSummary',
  async (_, { rejectWithValue }) => {
    try {
      const response = await dashboardService.getSummary()
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch dashboard summary')
    }
  }
)

export const fetchTodayStats = createAsyncThunk(
  'dashboard/fetchTodayStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await dashboardService.getTodayStats()
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch today stats')
    }
  }
)

export const fetchPaymentSplit = createAsyncThunk(
  'dashboard/fetchPaymentSplit',
  async (date = null, { rejectWithValue }) => {
    try {
      const response = await dashboardService.getPaymentSplit(date)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch payment split')
    }
  }
)

export const fetchDueReminders = createAsyncThunk(
  'dashboard/fetchDueReminders',
  async (_, { rejectWithValue }) => {
    try {
      const response = await dashboardService.getDueReminders()
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch due reminders')
    }
  }
)

export const fetchOverduePledges = createAsyncThunk(
  'dashboard/fetchOverduePledges',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await dashboardService.getOverduePledges(params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch overdue pledges')
    }
  }
)

export const fetchGoldPrices = createAsyncThunk(
  'dashboard/fetchGoldPrices',
  async (_, { rejectWithValue }) => {
    try {
      const response = await dashboardService.getGoldPrices()
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch gold prices')
    }
  }
)

// Fetch all dashboard data at once
export const fetchAllDashboardData = createAsyncThunk(
  'dashboard/fetchAll',
  async (_, { dispatch }) => {
    await Promise.all([
      dispatch(fetchDashboardSummary()),
      dispatch(fetchTodayStats()),
      dispatch(fetchPaymentSplit()),
      dispatch(fetchDueReminders()),
      dispatch(fetchGoldPrices()),
    ])
  }
)

// Initial state
const initialState = {
  summary: {
    totalPledges: 0,
    totalCustomers: 0,
    totalOutstanding: 0,
    totalOverdue: 0,
    monthlyRevenue: 0,
    monthlyGrowth: 0,
  },
  todayStats: {
    newPledges: { count: 0, amount: 0 },
    renewals: { count: 0, amount: 0 },
    redemptions: { count: 0, amount: 0 },
    totalTransactions: 0,
  },
  paymentSplit: {
    cash: { count: 0, amount: 0, percentage: 0 },
    transfer: { count: 0, amount: 0, percentage: 0 },
  },
  dueReminders: {
    sevenDays: [],
    threeDays: [],
    oneDay: [],
    overdue: [],
  },
  overduePledges: [],
  goldPrices: {
    price_999: 0,
    price_916: 0,
    price_875: 0,
    price_750: 0,
    updated_at: null,
  },
  loading: false,
  error: null,
  lastFetched: null,
}

// Slice
const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setGoldPrices: (state, action) => {
      state.goldPrices = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Summary
      .addCase(fetchDashboardSummary.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchDashboardSummary.fulfilled, (state, action) => {
        state.loading = false
        state.summary = action.payload
        state.lastFetched = new Date().toISOString()
      })
      .addCase(fetchDashboardSummary.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Fetch Today Stats
      .addCase(fetchTodayStats.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchTodayStats.fulfilled, (state, action) => {
        state.loading = false
        state.todayStats = action.payload
      })
      .addCase(fetchTodayStats.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Fetch Payment Split
      .addCase(fetchPaymentSplit.fulfilled, (state, action) => {
        state.paymentSplit = action.payload
      })

      // Fetch Due Reminders
      .addCase(fetchDueReminders.fulfilled, (state, action) => {
        state.dueReminders = action.payload
      })

      // Fetch Overdue Pledges
      .addCase(fetchOverduePledges.fulfilled, (state, action) => {
        state.overduePledges = action.payload
      })

      // Fetch Gold Prices
      .addCase(fetchGoldPrices.fulfilled, (state, action) => {
        state.goldPrices = action.payload
      })

      // Fetch All
      .addCase(fetchAllDashboardData.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchAllDashboardData.fulfilled, (state) => {
        state.loading = false
        state.lastFetched = new Date().toISOString()
      })
      .addCase(fetchAllDashboardData.rejected, (state) => {
        state.loading = false
      })
  },
})

export const { clearError, setGoldPrices } = dashboardSlice.actions

export default dashboardSlice.reducer
