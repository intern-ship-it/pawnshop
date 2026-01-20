/**
 * Sidebar - Dynamic permission-based navigation
 * Menu items shown/hidden based on user permissions from backend
 */

import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { toggleSidebarCollapse } from "@/features/ui/uiSlice";
import { logout } from "@/features/auth/authSlice";
import { getStorageItem, STORAGE_KEYS } from "@/utils/localStorage";
import { cn } from "@/lib/utils";
import { settingsService } from "@/services";
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
  ClipboardCheck,
  ScrollText,
  Grid3X3,
  Calendar,
  Printer,
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
        path: "/",
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
      {
        name: "Reconciliation",
        path: "/inventory/reconciliation",
        icon: ClipboardCheck,
        exact: true,
        permission: "reconciliation.view",
      },
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
  const { sidebarCollapsed } = useAppSelector((state) => state.ui);
  const { user, role, permissions } = useAppSelector((state) => state.auth);

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
        // Note: The API interceptor already unwraps response.data
        if (response?.logo_url) {
          // Fetch as blob to avoid cross-origin issues
          try {
            const imgResponse = await fetch(response.logo_url);
            if (imgResponse.ok) {
              const blob = await imgResponse.blob();
              const blobUrl = URL.createObjectURL(blob);
              setCompanyLogo(blobUrl);
            }
          } catch (fetchErr) {
            // Fallback to direct URL
            setCompanyLogo(response.logo_url);
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
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-zinc-900 text-white",
        "flex flex-col transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "w-20" : "w-64",
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-zinc-800">
        <div
          className={cn(
            "flex items-center gap-3 transition-all duration-300",
            sidebarCollapsed && "justify-center w-full",
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
                {sidebarCollapsed ? companyShort[0] : companyShort}
              </span>
            </div>
          )}

          {!sidebarCollapsed && (
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
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 scrollbar-thin">
        {filteredMenu.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-6">
            {!sidebarCollapsed && (
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
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                        "group relative",
                        isActive
                          ? "bg-amber-500/10 text-amber-500"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-700/50",
                        sidebarCollapsed && "justify-center px-2",
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

                      {!sidebarCollapsed && (
                        <span className="text-sm font-medium">{item.name}</span>
                      )}

                      {sidebarCollapsed && (
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

      {/* User & Actions */}
      <div className="border-t border-zinc-700/50 p-3">
        <div
          className={cn(
            "flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50 mb-3",
            sidebarCollapsed && "justify-center",
          )}
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-zinc-900 font-semibold text-sm flex-shrink-0">
            {user?.name?.charAt(0) || "U"}
          </div>

          {!sidebarCollapsed && (
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
            sidebarCollapsed && "justify-center px-2",
          )}
        >
          <LogOut className="w-5 h-5" />
          {!sidebarCollapsed && (
            <span className="text-sm font-medium">Logout</span>
          )}
        </button>

        <button
          onClick={handleToggleCollapse}
          className={cn(
            "flex items-center justify-center w-full py-2 mt-2 rounded-lg",
            "text-zinc-400 hover:text-white hover:bg-zinc-700/50",
            "transition-all duration-200",
          )}
        >
          {sidebarCollapsed ? (
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
  );
}
