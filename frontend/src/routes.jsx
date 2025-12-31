import { createBrowserRouter, Navigate } from 'react-router'
import { lazy, Suspense } from 'react'

// Layout
import MainLayout from '@/components/layout/MainLayout'

// Loading component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-zinc-50">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-zinc-500">Loading...</p>
    </div>
  </div>
)

// Lazy load pages for better performance
const Login = lazy(() => import('@/pages/Login'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))

// Customer pages
const CustomerList = lazy(() => import('@/pages/customers/CustomerList'))
const CustomerDetail = lazy(() => import('@/pages/customers/CustomerDetail'))
const CustomerCreate = lazy(() => import('@/pages/customers/CustomerCreate'))
const CustomerEdit = lazy(() => import('@/pages/customers/CustomerEdit'))

// Pledge pages
const PledgeList = lazy(() => import('@/pages/pledges/PledgeList'))
const NewPledge = lazy(() => import('@/pages/pledges/NewPledge'))
const PledgeDetail = lazy(() => import('@/pages/pledges/PledgeDetail'))

// Transaction pages
const RenewalScreen = lazy(() => import('@/pages/renewals/RenewalScreen'))
const RedemptionScreen = lazy(() => import('@/pages/redemptions/RedemptionScreen'))

// Inventory pages
const InventoryList = lazy(() => import('@/pages/inventory/InventoryList'))
const StockReconciliation = lazy(() => import('@/pages/inventory/StockReconciliation'))
const RackMap = lazy(() => import('@/pages/inventory/RackMap'))

// Auction pages
const AuctionScreen = lazy(() => import('@/pages/auctions/AuctionScreen'))

// Report pages
const ReportsScreen = lazy(() => import('@/pages/reports/ReportsScreen'))
const DayEndSummary = lazy(() => import('@/pages/reports/DayEndSummary'))

// Settings pages
const SettingsScreen = lazy(() => import('@/pages/settings/SettingsScreen'))
const UserList = lazy(() => import('@/pages/settings/UserList'))
const UserForm = lazy(() => import('@/pages/settings/UserForm'))
const AuditLogScreen = lazy(() => import('@/pages/settings/AuditLogScreen'))
const WhatsAppSettings = lazy(() => import('@/pages/settings/WhatsAppSettings'))

// Wrap component with Suspense
const withSuspense = (Component) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
)

export const router = createBrowserRouter([
  {
    path: '/login',
    element: withSuspense(Login),
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      // Dashboard
      { index: true, element: withSuspense(Dashboard) },

      // CUSTOMER ROUTES
      { path: 'customers', element: withSuspense(CustomerList) },
      { path: 'customers/new', element: withSuspense(CustomerCreate) },
      { path: 'customers/:id', element: withSuspense(CustomerDetail) },
      { path: 'customers/:id/edit', element: withSuspense(CustomerEdit) },

      // PLEDGE ROUTES
      { path: 'pledges', element: withSuspense(PledgeList) },
      { path: 'pledges/new', element: withSuspense(NewPledge) },
      { path: 'pledges/:id', element: withSuspense(PledgeDetail) },

      // TRANSACTION ROUTES
      { path: 'renewals', element: withSuspense(RenewalScreen) },
      { path: 'redemptions', element: withSuspense(RedemptionScreen) },

      // INVENTORY ROUTES
      { path: 'inventory', element: withSuspense(InventoryList) },
      { path: 'inventory/rack-map', element: withSuspense(RackMap) },
      { path: 'inventory/reconciliation', element: withSuspense(StockReconciliation) },

      // AUCTION ROUTES
      { path: 'auctions', element: withSuspense(AuctionScreen) },

      // REPORT ROUTES
      { path: 'reports', element: withSuspense(ReportsScreen) },
      { path: 'reports/day-end', element: withSuspense(DayEndSummary) },

      // SETTINGS ROUTES
      { path: 'settings', element: withSuspense(SettingsScreen) },
      { path: 'settings/users', element: withSuspense(UserList) },
      { path: 'settings/users/new', element: withSuspense(UserForm) },
      { path: 'settings/users/:id/edit', element: withSuspense(UserForm) },
      { path: 'settings/audit-log', element: withSuspense(AuditLogScreen) },
      { path: 'settings/whatsapp', element: withSuspense(WhatsAppSettings) },
    ],
  },

  // CATCH-ALL REDIRECT
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])

// Export route paths for easy reference
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  CUSTOMERS: '/customers',
  CUSTOMER_NEW: '/customers/new',
  CUSTOMER_DETAIL: (id) => `/customers/${id}`,
  CUSTOMER_EDIT: (id) => `/customers/${id}/edit`,
  PLEDGES: '/pledges',
  PLEDGE_NEW: '/pledges/new',
  PLEDGE_DETAIL: (id) => `/pledges/${id}`,
  RENEWALS: '/renewals',
  REDEMPTIONS: '/redemptions',
  INVENTORY: '/inventory',
  RACK_MAP: '/inventory/rack-map',
  RECONCILIATION: '/inventory/reconciliation',
  AUCTIONS: '/auctions',
  REPORTS: '/reports',
  DAY_END: '/reports/day-end',
  SETTINGS: '/settings',
  USERS: '/settings/users',
  USER_NEW: '/settings/users/new',
  USER_EDIT: (id) => `/settings/users/${id}/edit`,
  AUDIT_LOG: '/settings/audit-log',
  WHATSAPP_SETTINGS: '/settings/whatsapp',
}