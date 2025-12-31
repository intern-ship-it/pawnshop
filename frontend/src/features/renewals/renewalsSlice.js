import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  renewals: [],
  selectedRenewal: null,
  searchQuery: '',
  calculatedInterest: null,
  loading: false,
  error: null,
}

const renewalsSlice = createSlice({
  name: 'renewals',
  initialState,
  reducers: {
    setRenewals: (state, action) => {
      state.renewals = action.payload
    },
    addRenewal: (state, action) => {
      state.renewals.push(action.payload)
    },
    setSelectedRenewal: (state, action) => {
      state.selectedRenewal = action.payload
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload
    },
    setCalculatedInterest: (state, action) => {
      state.calculatedInterest = action.payload
    },
    setLoading: (state, action) => {
      state.loading = action.payload
    },
  },
})

export const {
  setRenewals,
  addRenewal,
  setSelectedRenewal,
  setSearchQuery,
  setCalculatedInterest,
  setLoading,
} = renewalsSlice.actions
export default renewalsSlice.reducer
