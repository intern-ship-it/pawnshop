/**
 * Pledges Slice - Updated with async thunks for API integration
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { pledgeService } from '@/services'

// Async Thunks
export const fetchPledges = createAsyncThunk(
  'pledges/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await pledgeService.getAll(params)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch pledges')
    }
  }
)

export const fetchPledgeById = createAsyncThunk(
  'pledges/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await pledgeService.getById(id)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Pledge not found')
    }
  }
)

export const fetchPledgeByReceipt = createAsyncThunk(
  'pledges/fetchByReceipt',
  async (receiptNo, { rejectWithValue }) => {
    try {
      const response = await pledgeService.getByReceipt(receiptNo)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Pledge not found')
    }
  }
)

export const calculatePledge = createAsyncThunk(
  'pledges/calculate',
  async (pledgeData, { rejectWithValue }) => {
    try {
      const response = await pledgeService.calculate(pledgeData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Calculation failed')
    }
  }
)

export const createPledge = createAsyncThunk(
  'pledges/create',
  async (pledgeData, { rejectWithValue }) => {
    try {
      const response = await pledgeService.create(pledgeData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.errors || error.message || 'Failed to create pledge')
    }
  }
)

export const updatePledge = createAsyncThunk(
  'pledges/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await pledgeService.update(id, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.errors || error.message || 'Failed to update pledge')
    }
  }
)

export const deletePledge = createAsyncThunk(
  'pledges/delete',
  async (id, { rejectWithValue }) => {
    try {
      await pledgeService.delete(id)
      return id
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete pledge')
    }
  }
)

export const fetchPledgeItems = createAsyncThunk(
  'pledges/fetchItems',
  async (pledgeId, { rejectWithValue }) => {
    try {
      const response = await pledgeService.getItems(pledgeId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch items')
    }
  }
)

export const fetchInterestBreakdown = createAsyncThunk(
  'pledges/fetchInterestBreakdown',
  async (pledgeId, { rejectWithValue }) => {
    try {
      const response = await pledgeService.getInterestBreakdown(pledgeId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch interest breakdown')
    }
  }
)

export const assignStorage = createAsyncThunk(
  'pledges/assignStorage',
  async ({ pledgeId, storageData }, { rejectWithValue }) => {
    try {
      const response = await pledgeService.assignStorage(pledgeId, storageData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to assign storage')
    }
  }
)

export const printPledgeReceipt = createAsyncThunk(
  'pledges/printReceipt',
  async ({ pledgeId, copyType }, { rejectWithValue }) => {
    try {
      const response = await pledgeService.printReceipt(pledgeId, copyType)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to print receipt')
    }
  }
)

export const sendPledgeWhatsApp = createAsyncThunk(
  'pledges/sendWhatsApp',
  async (pledgeId, { rejectWithValue }) => {
    try {
      const response = await pledgeService.sendWhatsApp(pledgeId)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to send WhatsApp')
    }
  }
)

// Initial state
const initialState = {
  pledges: [],
  selectedPledge: null,
  pledgeItems: [],
  interestBreakdown: null,
  calculationResult: null,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    perPage: 10,
  },
  filters: {
    status: 'all',
    dateRange: null,
    searchQuery: '',
  },
  // Wizard state for new pledge
  wizard: {
    currentStep: 1,
    customer: null,
    items: [],
    valuation: null,
    payout: null,
    signature: null,
  },
  loading: false,
  error: null,
}

// Slice
const pledgesSlice = createSlice({
  name: 'pledges',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    setSelectedPledge: (state, action) => {
      state.selectedPledge = action.payload
    },
    clearSelectedPledge: (state) => {
      state.selectedPledge = null
      state.pledgeItems = []
      state.interestBreakdown = null
    },
    clearError: (state) => {
      state.error = null
    },
    clearCalculation: (state) => {
      state.calculationResult = null
    },
    
    // Wizard reducers
    setWizardStep: (state, action) => {
      state.wizard.currentStep = action.payload
    },
    setWizardCustomer: (state, action) => {
      state.wizard.customer = action.payload
    },
    addWizardItem: (state, action) => {
      state.wizard.items.push(action.payload)
    },
    updateWizardItem: (state, action) => {
      const index = state.wizard.items.findIndex(i => i.id === action.payload.id)
      if (index !== -1) {
        state.wizard.items[index] = action.payload
      }
    },
    removeWizardItem: (state, action) => {
      state.wizard.items = state.wizard.items.filter(i => i.id !== action.payload)
    },
    setWizardItems: (state, action) => {
      state.wizard.items = action.payload
    },
    setWizardValuation: (state, action) => {
      state.wizard.valuation = action.payload
    },
    setWizardPayout: (state, action) => {
      state.wizard.payout = action.payload
    },
    setWizardSignature: (state, action) => {
      state.wizard.signature = action.payload
    },
    resetWizard: (state) => {
      state.wizard = {
        currentStep: 1,
        customer: null,
        items: [],
        valuation: null,
        payout: null,
        signature: null,
      }
    },
    
    // Local operations (fallback)
    setPledges: (state, action) => {
      state.pledges = action.payload
    },
    addPledge: (state, action) => {
      state.pledges.unshift(action.payload)
    },
    updatePledgeLocal: (state, action) => {
      const index = state.pledges.findIndex(p => p.id === action.payload.id)
      if (index !== -1) {
        state.pledges[index] = action.payload
      }
    },
    removePledge: (state, action) => {
      state.pledges = state.pledges.filter(p => p.id !== action.payload)
    },
    setLoading: (state, action) => {
      state.loading = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch All Pledges
      .addCase(fetchPledges.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchPledges.fulfilled, (state, action) => {
        state.loading = false
        state.pledges = action.payload.pledges || action.payload
        if (action.payload.pagination) {
          state.pagination = action.payload.pagination
        }
      })
      .addCase(fetchPledges.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Fetch Pledge By ID
      .addCase(fetchPledgeById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchPledgeById.fulfilled, (state, action) => {
        state.loading = false
        state.selectedPledge = action.payload
      })
      .addCase(fetchPledgeById.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Fetch By Receipt
      .addCase(fetchPledgeByReceipt.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchPledgeByReceipt.fulfilled, (state, action) => {
        state.loading = false
        state.selectedPledge = action.payload
      })
      .addCase(fetchPledgeByReceipt.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Calculate Pledge
      .addCase(calculatePledge.pending, (state) => {
        state.loading = true
      })
      .addCase(calculatePledge.fulfilled, (state, action) => {
        state.loading = false
        state.calculationResult = action.payload
      })
      .addCase(calculatePledge.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Create Pledge
      .addCase(createPledge.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createPledge.fulfilled, (state, action) => {
        state.loading = false
        state.pledges.unshift(action.payload)
        state.selectedPledge = action.payload
      })
      .addCase(createPledge.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Update Pledge
      .addCase(updatePledge.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updatePledge.fulfilled, (state, action) => {
        state.loading = false
        const index = state.pledges.findIndex(p => p.id === action.payload.id)
        if (index !== -1) {
          state.pledges[index] = action.payload
        }
        state.selectedPledge = action.payload
      })
      .addCase(updatePledge.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Delete Pledge
      .addCase(deletePledge.fulfilled, (state, action) => {
        state.pledges = state.pledges.filter(p => p.id !== action.payload)
        if (state.selectedPledge?.id === action.payload) {
          state.selectedPledge = null
        }
      })

      // Fetch Items
      .addCase(fetchPledgeItems.fulfilled, (state, action) => {
        state.pledgeItems = action.payload
      })

      // Fetch Interest Breakdown
      .addCase(fetchInterestBreakdown.fulfilled, (state, action) => {
        state.interestBreakdown = action.payload
      })

      // Assign Storage
      .addCase(assignStorage.fulfilled, (state, action) => {
        if (state.selectedPledge) {
          state.selectedPledge = action.payload
        }
      })
  },
})

export const {
  setFilters,
  setSelectedPledge,
  clearSelectedPledge,
  clearError,
  clearCalculation,
  setWizardStep,
  setWizardCustomer,
  addWizardItem,
  updateWizardItem,
  removeWizardItem,
  setWizardItems,
  setWizardValuation,
  setWizardPayout,
  setWizardSignature,
  resetWizard,
  setPledges,
  addPledge,
  updatePledgeLocal,
  removePledge,
  setLoading,
} = pledgesSlice.actions

export default pledgesSlice.reducer
