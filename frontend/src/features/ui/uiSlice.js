import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  activeModal: null,
  modalData: null,
  toasts: [],
  loading: {
    global: false,
    page: false,
  },
  goldPrice: {
    price916: 295.00,
    price999: 320.00,
    lastUpdated: new Date().toISOString(),
  },
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload
    },
    toggleSidebarCollapse: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
    openModal: (state, action) => {
      state.activeModal = action.payload.modal
      state.modalData = action.payload.data || null
    },
    closeModal: (state) => {
      state.activeModal = null
      state.modalData = null
    },
    addToast: (state, action) => {
      state.toasts.push({
        id: Date.now(),
        ...action.payload,
      })
    },
    removeToast: (state, action) => {
      state.toasts = state.toasts.filter(t => t.id !== action.payload)
    },
    setGlobalLoading: (state, action) => {
      state.loading.global = action.payload
    },
    setPageLoading: (state, action) => {
      state.loading.page = action.payload
    },
    updateGoldPrice: (state, action) => {
      state.goldPrice = {
        ...action.payload,
        lastUpdated: new Date().toISOString(),
      }
    },
  },
})

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleSidebarCollapse,
  openModal,
  closeModal,
  addToast,
  removeToast,
  setGlobalLoading,
  setPageLoading,
  updateGoldPrice,
} = uiSlice.actions
export default uiSlice.reducer
