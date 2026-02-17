import { createBrowserRouter, Navigate } from "react-router";

import { lazy, Suspense } from "react";

// Layout
import MainLayout from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

// Loading component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-zinc-50">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-zinc-500">Loading...</p>
    </div>
  </div>
);

// Lazy load pages for better performance
const Login = lazy(() => import("@/pages/Login"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Profile = lazy(() => import("@/pages/Profile"));

// Customer pages
const CustomerList = lazy(() => import("@/pages/customers/CustomerList"));
const CustomerDetail = lazy(() => import("@/pages/customers/CustomerDetail"));
const CustomerCreate = lazy(() => import("@/pages/customers/CustomerCreate"));
const CustomerEdit = lazy(() => import("@/pages/customers/CustomerEdit"));

// Pledge pages
const PledgeList = lazy(() => import("@/pages/pledges/PledgeList"));
const NewPledge = lazy(() => import("@/pages/pledges/NewPledge"));
const PledgeDetail = lazy(() => import("@/pages/pledges/PledgeDetail"));

// Transaction pages
const RenewalScreen = lazy(() => import("@/pages/renewals/RenewalScreen"));
const RedemptionScreen = lazy(
  () => import("@/pages/redemptions/RedemptionScreen"),
);

// Inventory pages
const InventoryList = lazy(() => import("@/pages/inventory/InventoryList"));
const StockReconciliation = lazy(
  () => import("@/pages/inventory/StockReconciliation"),
);
const RackMap = lazy(() => import("@/pages/inventory/RackMap"));

// Auction pages
const AuctionScreen = lazy(() => import("@/pages/auctions/AuctionScreen"));

// Report pages
const ReportsScreen = lazy(() => import("@/pages/reports/ReportsScreen"));
const DayEndSummary = lazy(() => import("@/pages/reports/DayEndSummary"));

// Settings pages
const SettingsScreen = lazy(() => import("@/pages/settings/SettingsScreen"));
const UserList = lazy(() => import("@/pages/settings/UserList"));
const UserForm = lazy(() => import("@/pages/settings/UserForm"));
const AuditLogScreen = lazy(() => import("@/pages/settings/AuditLogScreen"));
const WhatsAppSettings = lazy(
  () => import("@/pages/settings/WhatsAppSettings"),
);
const HardwareIntegration = lazy(
  () => import("@/pages/settings/HardwareIntegration"),
);
const PrintTestPage = lazy(() => import("@/pages/settings/PrintTestPage"));

// Wrap component with Suspense
const withSuspense = (Component) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

// Wrap component with Suspense + ProtectedRoute permission check
const withPermission = (Component, permission) => (
  <ProtectedRoute permission={permission}>
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  </ProtectedRoute>
);

import ErrorBoundary from "@/components/common/ErrorBoundary";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: withSuspense(Login),
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/forgot-password",
    element: withSuspense(ForgotPassword),
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/reset-password",
    element: withSuspense(ResetPassword),
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      // Dashboard
      { index: true, element: withPermission(Dashboard, "dashboard.view") },
      {
        path: "profile",
        element: withSuspense(Profile),
      },
      // CUSTOMER ROUTES
      { path: "customers", element: withPermission(CustomerList, "customers.view") },
      { path: "customers/new", element: withPermission(CustomerCreate, "customers.create") },
      { path: "customers/:id", element: withPermission(CustomerDetail, "customers.view") },
      { path: "customers/:id/edit", element: withPermission(CustomerEdit, "customers.edit") },

      // PLEDGE ROUTES
      { path: "pledges", element: withPermission(PledgeList, "pledges.view") },
      { path: "pledges/new", element: withPermission(NewPledge, "pledges.create") },
      { path: "pledges/:id", element: withPermission(PledgeDetail, "pledges.view") },

      // TRANSACTION ROUTES
      { path: "renewals", element: withPermission(RenewalScreen, "renewals.view") },
      { path: "redemptions", element: withPermission(RedemptionScreen, "redemptions.view") },

      // INVENTORY ROUTES
      { path: "inventory", element: withPermission(InventoryList, "inventory.view") },
      { path: "inventory/rack-map", element: withPermission(RackMap, "storage.view") },
      {
        path: "inventory/reconciliation",
        element: withPermission(StockReconciliation, "reconciliation.view"),
      },

      // AUCTION ROUTES
      { path: "auctions", element: withPermission(AuctionScreen, "auctions.view") },

      // REPORT ROUTES
      { path: "reports", element: withPermission(ReportsScreen, "reports.view") },
      { path: "reports/day-end", element: withPermission(DayEndSummary, "dayend.view") },

      // SETTINGS ROUTES
      { path: "settings", element: withPermission(SettingsScreen, "settings.view") },
      { path: "settings/users", element: withPermission(UserList, "users.view") },
      { path: "settings/users/new", element: withPermission(UserForm, "users.create") },
      { path: "settings/users/:id/edit", element: withPermission(UserForm, "users.edit") },
      { path: "settings/audit-log", element: withPermission(AuditLogScreen, "audit.view") },
      { path: "settings/whatsapp", element: withPermission(WhatsAppSettings, "whatsapp.view") },
      { path: "settings/hardware", element: withPermission(HardwareIntegration, "settings.view") },
      { path: "settings/print-test", element: withPermission(PrintTestPage, "settings.view") },
    ],
  },

  // CATCH-ALL REDIRECT
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

// Export route paths for easy reference
export const ROUTES = {
  LOGIN: "/login",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  DASHBOARD: "/",
  CUSTOMERS: "/customers",
  CUSTOMER_NEW: "/customers/new",
  CUSTOMER_DETAIL: (id) => `/customers/${id}`,
  CUSTOMER_EDIT: (id) => `/customers/${id}/edit`,
  PLEDGES: "/pledges",
  PLEDGE_NEW: "/pledges/new",
  PLEDGE_DETAIL: (id) => `/pledges/${id}`,
  RENEWALS: "/renewals",
  REDEMPTIONS: "/redemptions",
  INVENTORY: "/inventory",
  RACK_MAP: "/inventory/rack-map",
  RECONCILIATION: "/inventory/reconciliation",
  AUCTIONS: "/auctions",
  REPORTS: "/reports",
  DAY_END: "/reports/day-end",
  SETTINGS: "/settings",
  USERS: "/settings/users",
  USER_NEW: "/settings/users/new",
  USER_EDIT: (id) => `/settings/users/${id}/edit`,
  AUDIT_LOG: "/settings/audit-log",
  WHATSAPP_SETTINGS: "/settings/whatsapp",
  HARDWARE_SETTINGS: "/settings/hardware",
  PRINT_TEST: "/settings/print-test",
};
