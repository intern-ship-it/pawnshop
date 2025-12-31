import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  auctions: [],
  eligibleItems: [],
  selectedAuction: null,
  profitLoss: null,
  loading: false,
  error: null,
}

const auctionsSlice = createSlice({
  name: 'auctions',
  initialState,
  reducers: {
    setAuctions: (state, action) => {
      state.auctions = action.payload
    },
    addAuction: (state, action) => {
      state.auctions.push(action.payload)
    },
    setEligibleItems: (state, action) => {
      state.eligibleItems = action.payload
    },
    setSelectedAuction: (state, action) => {
      state.selectedAuction = action.payload
    },
    setProfitLoss: (state, action) => {
      state.profitLoss = action.payload
    },
    setLoading: (state, action) => {
      state.loading = action.payload
    },
  },
})

export const {
  setAuctions,
  addAuction,
  setEligibleItems,
  setSelectedAuction,
  setProfitLoss,
  setLoading,
} = auctionsSlice.actions
export default auctionsSlice.reducer
