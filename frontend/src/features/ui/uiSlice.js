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
  settings: {
    company: { name: 'PawnSys', license: '' },
    loaded: false,
  },
  camera: {
    isOpen: false,
    contextId: null,
    capturedImage: null,
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
    setSettings: (state, action) => {
      state.settings = { ...state.settings, ...action.payload, loaded: true };
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
    openCamera: (state, action) => {
      state.camera = {
        isOpen: true,
        contextId: action.payload.contextId, // e.g. item ID
        capturedImage: null
      }
    },
    closeCamera: (state) => {
      state.camera = { ...state.camera, isOpen: false }
    },
    setCapturedImage: (state, action) => {
      state.camera.capturedImage = action.payload
      state.camera.isOpen = false
    },
    clearCapturedImage: (state) => {
      state.camera.capturedImage = null
      state.camera.contextId = null
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
  setSettings,
  openCamera,
  closeCamera,
  setCapturedImage,
  clearCapturedImage,
} = uiSlice.actions
export default uiSlice.reducer
