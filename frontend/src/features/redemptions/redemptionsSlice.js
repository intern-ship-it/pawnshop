import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  redemptions: [],
  selectedRedemption: null,
  searchQuery: '',
  partialAmount: null,
  signature: null,
  loading: false,
  error: null,
}

const redemptionsSlice = createSlice({
  name: 'redemptions',
  initialState,
  reducers: {
    setRedemptions: (state, action) => {
      state.redemptions = action.payload
    },
    addRedemption: (state, action) => {
      state.redemptions.push(action.payload)
    },
    setSelectedRedemption: (state, action) => {
      state.selectedRedemption = action.payload
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload
    },
    setPartialAmount: (state, action) => {
      state.partialAmount = action.payload
    },
    setSignature: (state, action) => {
      state.signature = action.payload
    },
    setLoading: (state, action) => {
      state.loading = action.payload
    },
  },
})

export const {
  setRedemptions,
  addRedemption,
  setSelectedRedemption,
  setSearchQuery,
  setPartialAmount,
  setSignature,
  setLoading,
} = redemptionsSlice.actions
export default redemptionsSlice.reducer
