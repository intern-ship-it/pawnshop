import { configureStore } from '@reduxjs/toolkit'
import authReducer from '@/features/auth/authSlice'
import dashboardReducer from '@/features/dashboard/dashboardSlice'
import customersReducer from '@/features/customers/customersSlice'
import pledgesReducer from '@/features/pledges/pledgesSlice'
import inventoryReducer from '@/features/inventory/inventorySlice'
import renewalsReducer from '@/features/renewals/renewalsSlice'
import redemptionsReducer from '@/features/redemptions/redemptionsSlice'
import auctionsReducer from '@/features/auctions/auctionsSlice'
import reportsReducer from '@/features/reports/reportsSlice'
import uiReducer from '@/features/ui/uiSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer,
    customers: customersReducer,
    pledges: pledgesReducer,
    inventory: inventoryReducer,
    renewals: renewalsReducer,
    redemptions: redemptionsReducer,
    auctions: auctionsReducer,
    reports: reportsReducer,
    ui: uiReducer,
  },
  devTools: import.meta.env.DEV,
})
