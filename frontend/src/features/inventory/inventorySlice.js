import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  items: [],
  selectedItem: null,
  filters: {
    category: 'all',
    status: 'all',
    searchQuery: '',
  },
  loading: false,
  error: null,
}

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setItems: (state, action) => {
      state.items = action.payload
    },
    addItem: (state, action) => {
      state.items.push(action.payload)
    },
    updateItem: (state, action) => {
      const index = state.items.findIndex(i => i.id === action.payload.id)
      if (index !== -1) {
        state.items[index] = action.payload
      }
    },
    removeItem: (state, action) => {
      state.items = state.items.filter(i => i.id !== action.payload)
    },
    setSelectedItem: (state, action) => {
      state.selectedItem = action.payload
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    setLoading: (state, action) => {
      state.loading = action.payload
    },
  },
})

export const {
  setItems,
  addItem,
  updateItem,
  removeItem,
  setSelectedItem,
  setFilters,
  setLoading,
} = inventorySlice.actions
export default inventorySlice.reducer
