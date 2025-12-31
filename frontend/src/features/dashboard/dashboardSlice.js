/**
 * Dashboard Slice - Async thunks for dashboard API data
 * Connected to Laravel backend API
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { dashboardService } from '@/services'

// Helper to normalize API response (handles both {data: ...} and direct response)
// API interceptor already returns response.data, so we get {success, message, data}
const normalizeResponse = (response) => {
  // If response has .data property (our API format), return it
  if (response?.data !== undefined) {
    return response.data
  }
  // Otherwise return as-is
  return response
}

// Async Thunks
export const fetchDashboardSummary = createAsyncThunk(
  'dashboard/fetchSummary',
  async (_, { rejectWithValue }) => {
    try {
      const response = await dashboardService.getSummary()
      const data = normalizeResponse(response)
      
      // Map backend response to frontend expected structure
      return {
        totalPledges: data.active_pledges || 0,
        totalCustomers: data.total_customers || 0,
        totalOutstanding: data.today?.pledges?.total || 0,
        totalOverdue: data.overdue_pledges || 0,
        monthlyRevenue: (data.today?.pledges?.total || 0) + 
                        (data.today?.renewals?.total || 0) + 
                        (data.today?.redemptions?.total || 0),
        monthlyGrowth: 0, // Would need historical data to calculate
        today: data.today || {},
      }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch dashboard summary')
    }
  }
)

export const fetchTodayStats = createAsyncThunk(
  'dashboard/fetchTodayStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await dashboardService.getTodayStats()
      const data = normalizeResponse(response)
      
      // Map backend response to frontend expected structure
      return {
        newPledges: { 
          count: data.pledges?.count || 0, 
          amount: data.pledges?.total || 0 
        },
        renewals: { 
          count: data.renewals?.count || 0, 
          amount: data.renewals?.total || 0 
        },
        redemptions: { 
          count: data.redemptions?.count || 0, 
          amount: data.redemptions?.total || 0 
        },
        totalTransactions: (data.pledges?.count || 0) + 
                          (data.renewals?.count || 0) + 
                          (data.redemptions?.count || 0),
        totals: data.totals || { cash: 0, transfer: 0 },
      }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch today stats')
    }
  }
)

export const fetchPaymentSplit = createAsyncThunk(
  'dashboard/fetchPaymentSplit',
  async (date = null, { rejectWithValue }) => {
    try {
      const response = await dashboardService.getPaymentSplit(date)
      const data = normalizeResponse(response)
      
      // Calculate totals
      const totalCash = (data.pledges?.cash || 0) + 
                        (data.renewals?.cash || 0) + 
                        (data.redemptions?.cash || 0)
      const totalTransfer = (data.pledges?.transfer || 0) + 
                            (data.renewals?.transfer || 0) + 
                            (data.redemptions?.transfer || 0)
      const grandTotal = totalCash + totalTransfer
      
      return {
        cash: { 
          count: 0, // Backend doesn't provide count, would need separate query
          amount: totalCash, 
          percentage: grandTotal > 0 ? Math.round((totalCash / grandTotal) * 100) : 0 
        },
        transfer: { 
          count: 0, 
          amount: totalTransfer, 
          percentage: grandTotal > 0 ? Math.round((totalTransfer / grandTotal) * 100) : 0 
        },
        date: data.date,
        breakdown: data,
      }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch payment split')
    }
  }
)

export const fetchDueReminders = createAsyncThunk(
  'dashboard/fetchDueReminders',
  async (_, { rejectWithValue }) => {
    try {
      const response = await dashboardService.getDueReminders()
      const data = normalizeResponse(response)
      
      // Map backend response - due_in_7_days contains all pledges due in 7 days
      // We separate them into 1, 3, 7 day groups based on due_date
      const today = new Date()
      const pledges = data.due_in_7_days || []
      
      const oneDay = []
      const threeDays = []
      const sevenDays = []
      
      pledges.forEach(pledge => {
        const dueDate = new Date(pledge.due_date)
        const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))
        
        if (daysUntilDue <= 1) {
          oneDay.push(pledge)
        } else if (daysUntilDue <= 3) {
          threeDays.push(pledge)
        } else {
          sevenDays.push(pledge)
        }
      })
      
      return {
        sevenDays,
        threeDays,
        oneDay,
        overdue: [], // Overdue is fetched separately
        counts: data.counts || {},
      }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch due reminders')
    }
  }
)

export const fetchOverduePledges = createAsyncThunk(
  'dashboard/fetchOverduePledges',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await dashboardService.getOverduePledges(params)
      const data = normalizeResponse(response)
      
      // Backend returns paginated data
      return data.data || data || []
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch overdue pledges')
    }
  }
)

export const fetchGoldPrices = createAsyncThunk(
  'dashboard/fetchGoldPrices',
  async (_, { rejectWithValue }) => {
    try {
      const response = await dashboardService.getGoldPrices()
      const data = normalizeResponse(response)
      
      // Map backend response (prices.999, prices.916) to frontend expected format
      const prices = data.prices || {}
      
      return {
        price_999: prices['999'] || 0,
        price_916: prices['916'] || 0,
        price_875: prices['875'] || 0,
        price_750: prices['750'] || 0,
        price_585: prices['585'] || 0,
        price_375: prices['375'] || 0,
        updated_at: data.price_date || null,
        source: data.source || 'manual',
      }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch gold prices')
    }
  }
)

// Fetch all dashboard data at once
export const fetchAllDashboardData = createAsyncThunk(
  'dashboard/fetchAll',
  async (_, { dispatch }) => {
    const results = await Promise.allSettled([
      dispatch(fetchDashboardSummary()),
      dispatch(fetchTodayStats()),
      dispatch(fetchPaymentSplit()),
      dispatch(fetchDueReminders()),
      dispatch(fetchGoldPrices()),
    ])
    
    // Check if any failed
    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length > 0) {
      console.warn('Some dashboard data failed to load:', failed)
    }
    
    return { success: failed.length === 0 }
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
