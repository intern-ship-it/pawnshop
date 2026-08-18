/**
 * Sidebar - Dynamic permission-based navigation
 * Menu items shown/hidden based on user permissions from backend
 */

import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { toggleSidebarCollapse, setSidebarOpen } from "@/features/ui/uiSlice";
import { logout } from "@/features/auth/authSlice";
import { getStorageItem, STORAGE_KEYS } from "@/utils/localStorage";
import { cn } from "@/lib/utils";
import { settingsService } from "@/services";
import useIsDesktop from "@/hooks/useIsDesktop";
import {
  LayoutDashboard,
  Users,
  FileText,
  RefreshCw,
  Wallet,
  Package,
  Gavel,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  ClipboardCheck,
  ScrollText,
  Grid3X3,
  Calendar,
  Printer,
  Banknote,
} from "lucide-react";

/**
 * Menu configuration - EXACT MATCH to your original
 */
const menuConfig = [
  {
    title: "MAIN",
    items: [
      {
        name: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        exact: true,
        permission: "dashboard.view",
      },
    ],
  },
  {
    title: "TRANSACTIONS",
    items: [
      {
        name: "New Pledge",
        path: "/pledges/new",
        icon: FileText,
        highlight: true,
        exact: true,
        permission: "pledges.create",
      },
      {
        name: "All Pledges",
        path: "/pledges",
        icon: FileText,
        exact: true,
        permission: "pledges.view",
      },
      {
        name: "Renewals",
        path: "/renewals",
        icon: RefreshCw,
        exact: true,
        permission: "renewals.view",
      },
      {
        name: "Interest Payments",
        path: "/interest-payments",
        icon: Banknote,
        exact: true,
        permission: "interest-payments.view",
      },
      {
        name: "Redemptions",
        path: "/redemptions",
        icon: Wallet,
        exact: true,
        permission: "redemptions.view",
      },
    ],
  },
  {
    title: "MANAGEMENT",
    items: [
      {
        name: "Customers",
        path: "/customers",
        icon: Users,
        permission: "customers.view",
      },
      {
        name: "Inventory",
        path: "/inventory",
        icon: Package,
        exact: true,
        permission: "inventory.view",
      },
      {
        name: "Rack Map",
        path: "/inventory/rack-map",
        icon: Grid3X3,
        exact: true,
        permission: "storage.view",
      },
      // Reconciliation menu hidden from sidebar (route/page kept intact)
      // {
      //   name: "Reconciliation",
      //   path: "/inventory/reconciliation",
      //   icon: ClipboardCheck,
      //   exact: true,
      //   permission: "reconciliation.view",
      // },
      {
        name: "Auctions",
        path: "/auctions",
        icon: Gavel,
        exact: true,
        permission: "auctions.view",
      },
    ],
  },
  {
    title: "REPORTS",
    items: [
      {
        name: "Reports",
        path: "/reports",
        icon: BarChart3,
        exact: true,
        permission: "reports.view",
      },
      {
        name: "Day End",
        path: "/reports/day-end",
        icon: Calendar,
        exact: true,
        permission: "dayend.view",
      },
      {
        name: "Month End",
        path: "/reports/month-end",
        icon: ScrollText,
        exact: true,
        permission: "reports.view",
      },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      {
        name: "Settings",
        path: "/settings",
        icon: Settings,
        exact: true,
        permission: "settings.view",
      },
      {
        name: "Users",
        path: "/settings/users",
        icon: Users,
        exact: true,
        permission: "users.view",
      },
      {
        name: "Audit Log",
        path: "/settings/audit-log",
        icon: ScrollText,
        exact: true,
        permission: "audit.view",
      },
    ],
  },
];

export default function Sidebar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, sidebarOpen } = useAppSelector((state) => state.ui);
  const { user, role, permissions } = useAppSelector((state) => state.auth);
  const isDesktop = useIsDesktop();

  // Collapsing is a desktop-only affordance - below `lg` the sidebar is a
  // slide-over drawer that is always full width when open.
  const collapsed = sidebarCollapsed && isDesktop;

  // Logo state
  const [companyLogo, setCompanyLogo] = useState(null);

  const roleSlug = role?.slug || role || "";

  // Company info
  const { settings } = useAppSelector((state) => state.ui);
  const companyName = settings?.company?.name || "PawnSys";
  const companyShort =
    companyName.split(" ").length >= 2
      ? companyName.split(" ")[0][0] + companyName.split(" ")[1][0]
      : companyName.substring(0, 2).toUpperCase();

  // Load logo on mount
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await settingsService.getLogo();

        // Handle both wrapped {success, data} and unwrapped {logo_url} formats
        const logoData = response?.data || response;
        const logoUrl = logoData?.logo_url || logoData?.path;

        if (logoUrl) {
          // Construct full URL if needed
          let fullUrl = logoUrl;
          if (!logoUrl.startsWith("http")) {
            const baseUrl = (import.meta.env.VITE_API_URL || `${window.location.origin}/api`).replace('/api', '');
            fullUrl = baseUrl + (logoUrl.startsWith("/") ? "" : "/") + logoUrl;
          }

          // Fetch as blob to avoid cross-origin issues
          try {
            const imgResponse = await fetch(fullUrl);
            if (imgResponse.ok) {
              const blob = await imgResponse.blob();
              const blobUrl = URL.createObjectURL(blob);
              setCompanyLogo(blobUrl);
            } else {
              setCompanyLogo(fullUrl);
            }
          } catch (fetchErr) {
            // Fallback to direct URL
            setCompanyLogo(fullUrl);
          }
        }
      } catch (err) {
        console.error("Failed to load logo:", err);
      }
    };
    loadLogo();

    // Listen for logo updates from Settings page
    const handleLogoUpdate = (e) => {
      setCompanyLogo(e.detail);
    };
    window.addEventListener("logoUpdated", handleLogoUpdate);

    return () => {
      window.removeEventListener("logoUpdated", handleLogoUpdate);
      // Cleanup blob URL
      if (companyLogo && companyLogo.startsWith("blob:")) {
        URL.revokeObjectURL(companyLogo);
      }
    };
  }, []);

  const closeDrawer = () => dispatch(setSidebarOpen(false));

  // Close the mobile drawer on navigation and whenever we cross into desktop,
  // so it can never be left open behind the desktop layout.
  useEffect(() => {
    dispatch(setSidebarOpen(false));
  }, [location.pathname, isDesktop, dispatch]);

  // Escape closes the drawer; lock body scroll while it covers the page.
  useEffect(() => {
    if (isDesktop || !sidebarOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") dispatch(setSidebarOpen(false));
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDesktop, sidebarOpen, dispatch]);

  /**
   * Check if user has permission
   */
  const hasPermission = (permission) => {
    if (roleSlug === "super-admin") return true;
    if (!permission) return true;
    if (!Array.isArray(permissions)) return false;
    return permissions.includes(permission);
  };

  /**
   * Filter menu based on permissions
   */
  const getFilteredMenu = () => {
    return menuConfig
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => hasPermission(item.permission)),
      }))
      .filter((section) => section.items.length > 0);
  };

  const filteredMenu = getFilteredMenu();

  const isPathActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const handleToggleCollapse = () => {
    dispatch(toggleSidebarCollapse());
  };

  const handleLogout = async () => {
    await dispatch(logout());
    navigate("/login");
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={closeDrawer}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-zinc-900/50 backdrop-blur-sm lg:hidden",
          "transition-opacity duration-300",
          sidebarOpen
            ? "opacity-100"
            : "opacity-0 pointer-events-none",
        )}
      />

      <aside
        className={cn(
          // `inset-y-0` rather than `h-screen` - 100vh disagrees with the real
          // viewport in mobile browsers, which clipped the footer off-screen.
          "fixed inset-y-0 left-0 z-50 bg-zinc-900 text-white",
          "flex flex-col transition-all duration-300 ease-in-out",
          // Below `lg` the sidebar is a full-width drawer that slides in.
          "w-64",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          sidebarCollapsed && "lg:w-20",
        )}
      >
      {/* Logo */}
      <div className="flex flex-shrink-0 items-center h-16 px-4 border-b border-zinc-800">
        <div
          className={cn(
            "flex items-center gap-3 transition-all duration-300",
            collapsed && "justify-center w-full",
          )}
        >
          {/* Logo Image or Fallback */}
          {companyLogo ? (
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white overflow-hidden flex-shrink-0">
              <img
                src={companyLogo}
                alt="Logo"
                className="w-full h-full object-contain p-1"
                onError={() => setCompanyLogo(null)} // Fallback if image fails
              />
            </div>
          ) : (
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500 flex-shrink-0">
              <span className="text-lg font-bold text-zinc-900">
                {collapsed ? companyShort[0] : companyShort}
              </span>
            </div>
          )}

          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-white truncate">
                {companyName.length > 20
                  ? companyName.substring(0, 20) + "..."
                  : companyName}
              </span>
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest">
                Pajak Gadai
              </span>
            </div>
          )}
        </div>

        {/* Close drawer (mobile only) */}
        <button
          onClick={closeDrawer}
          aria-label="Close menu"
          className="lg:hidden ml-auto p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4 px-3 scrollbar-thin">
        {filteredMenu.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-6">
            {!collapsed && (
              <h3 className="px-3 mb-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                {section.title}
              </h3>
            )}

            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = isPathActive(item.path, item.exact);

                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={closeDrawer}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                        "group relative",
                        isActive
                          ? "bg-amber-500/10 text-amber-500"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-700/50",
                        collapsed && "justify-center px-2",
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-amber-500 rounded-r-full" />
                      )}

                      <Icon
                        className={cn(
                          "w-5 h-5 flex-shrink-0 transition-colors",
                          isActive
                            ? "text-amber-500"
                            : "text-zinc-400 group-hover:text-white",
                        )}
                      />

                      {!collapsed && (
                        <span className="text-sm font-medium">{item.name}</span>
                      )}

                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 border border-zinc-700">
                          {item.name}
                        </div>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User & Actions - pinned; pb clears the iOS/Android home indicator */}
      <div className="flex-shrink-0 border-t border-zinc-700/50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div
          className={cn(
            "flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50 mb-3",
            collapsed && "justify-center",
          )}
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-zinc-900 font-semibold text-sm flex-shrink-0">
            {user?.name?.charAt(0) || "U"}
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.name || "Guest User"}
              </p>
              <p className="text-xs text-zinc-400 capitalize">
                {role?.name || roleSlug?.replace("-", " ") || "No Role"}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2 rounded-lg",
            "text-zinc-400 hover:text-red-400 hover:bg-red-500/10",
            "transition-all duration-200",
            collapsed && "justify-center px-2",
          )}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>

        {/* Collapse is desktop-only - on mobile the drawer closes instead */}
        <button
          onClick={handleToggleCollapse}
          className={cn(
            "hidden lg:flex items-center justify-center w-full py-2 mt-2 rounded-lg",
            "text-zinc-400 hover:text-white hover:bg-zinc-700/50",
            "transition-all duration-200",
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5 mr-2" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </button>
      </div>
      </aside>
    </>
  );
}
