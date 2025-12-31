import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  reportType: null,
  dateRange: {
    start: null,
    end: null,
  },
  filters: {},
  reportData: null,
  loading: false,
  error: null,
}

const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    setReportType: (state, action) => {
      state.reportType = action.payload
    },
    setDateRange: (state, action) => {
      state.dateRange = action.payload
    },
    setFilters: (state, action) => {
      state.filters = action.payload
    },
    setReportData: (state, action) => {
      state.reportData = action.payload
    },
    clearReport: (state) => {
      state.reportData = null
      state.filters = {}
    },
    setLoading: (state, action) => {
      state.loading = action.payload
    },
  },
})

export const {
  setReportType,
  setDateRange,
  setFilters,
  setReportData,
  clearReport,
  setLoading,
} = reportsSlice.actions
export default reportsSlice.reducer
