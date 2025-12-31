/**
 * Sidebar - Role-based navigation menu
 * Shows/hides menu items based on user role and permissions
 */

import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { toggleSidebarCollapse } from "@/features/ui/uiSlice";
import { logout } from "@/features/auth/authSlice";
import { getStorageItem, STORAGE_KEYS } from "@/utils/localStorage";
import { cn } from "@/lib/utils";
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
  ShieldCheck,
  Building2,
  MessageSquare,
} from "lucide-react";

/**
 * Menu configuration with role-based access
 * roles: array of role slugs that can access this item
 * permissions: array of permission keys (optional, for fine-grained control)
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
        roles: ["super-admin", "admin", "manager", "cashier", "auditor"], // Everyone
      },
    ],
  },
  {
    title: "TRANSACTIONS",
    roles: ["super-admin", "admin", "manager", "cashier"], // Not auditor
    items: [
      {
        name: "New Pledge",
        path: "/pledges/new",
        icon: FileText,
        highlight: true,
        exact: true,
        roles: ["super-admin", "admin", "manager", "cashier"],
        permissions: ["pledges.create"],
      },
      {
        name: "All Pledges",
        path: "/pledges",
        icon: FileText,
        exact: true,
        roles: ["super-admin", "admin", "manager", "cashier", "auditor"],
        permissions: ["pledges.view"],
      },
      {
        name: "Renewals",
        path: "/renewals",
        icon: RefreshCw,
        exact: true,
        roles: ["super-admin", "admin", "manager", "cashier"],
        permissions: ["renewals.view"],
      },
      {
        name: "Redemptions",
        path: "/redemptions",
        icon: Wallet,
        exact: true,
        roles: ["super-admin", "admin", "manager", "cashier"],
        permissions: ["redemptions.view"],
      },
    ],
  },
  {
    title: "MANAGEMENT",
    roles: ["super-admin", "admin", "manager", "cashier"],
    items: [
      {
        name: "Customers",
        path: "/customers",
        icon: Users,
        roles: ["super-admin", "admin", "manager", "cashier"],
        permissions: ["customers.view"],
      },
      {
        name: "Inventory",
        path: "/inventory",
        icon: Package,
        exact: true,
        roles: ["super-admin", "admin", "manager", "cashier"],
        permissions: ["inventory.view"],
      },
      {
        name: "Rack Map",
        path: "/inventory/rack-map",
        icon: Grid3X3,
        exact: true,
        roles: ["super-admin", "admin", "manager"],
        permissions: ["storage.view"],
      },
      {
        name: "Reconciliation",
        path: "/inventory/reconciliation",
        icon: ClipboardCheck,
        exact: true,
        roles: ["super-admin", "admin", "manager"],
        permissions: ["reconciliation.view"],
      },
      {
        name: "Auctions",
        path: "/auctions",
        icon: Gavel,
        exact: true,
        roles: ["super-admin", "admin", "manager"],
        permissions: ["auctions.view"],
      },
    ],
  },
  {
    title: "REPORTS",
    roles: ["super-admin", "admin", "manager", "auditor"],
    items: [
      {
        name: "Reports",
        path: "/reports",
        icon: BarChart3,
        exact: true,
        roles: ["super-admin", "admin", "manager", "auditor"],
        permissions: ["reports.view"],
      },
      {
        name: "Day End",
        path: "/reports/day-end",
        icon: Calendar,
        exact: true,
        roles: ["super-admin", "admin", "manager"],
        permissions: ["dayend.view"],
      },
    ],
  },
  {
    title: "SYSTEM",
    roles: ["super-admin", "admin"],
    items: [
      {
        name: "Settings",
        path: "/settings",
        icon: Settings,
        exact: true,
        roles: ["super-admin", "admin", "manager"],
        permissions: ["settings.view"],
      },
      {
        name: "Users",
        path: "/settings/users",
        icon: Users,
        exact: true,
        roles: ["super-admin", "admin"],
        permissions: ["users.view"],
      },
      {
        name: "Roles",
        path: "/settings/roles",
        icon: ShieldCheck,
        exact: true,
        roles: ["super-admin"],
        permissions: ["roles.view"],
      },
      {
        name: "Branches",
        path: "/settings/branches",
        icon: Building2,
        exact: true,
        roles: ["super-admin"],
        permissions: ["branches.view"],
      },
      {
        name: "Audit Log",
        path: "/settings/audit-log",
        icon: ScrollText,
        exact: true,
        roles: ["super-admin", "admin"],
        permissions: ["audit.view"],
      },
      {
        name: "WhatsApp",
        path: "/settings/whatsapp",
        icon: MessageSquare,
        exact: true,
        roles: ["super-admin", "admin", "manager"],
        permissions: ["whatsapp.view"],
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

  // Get role slug - handle both object and string formats
  const roleSlug = role?.slug || role || "cashier";

  // Company name from settings
  const [companyName, setCompanyName] = useState("PawnSys");
  const [companyShort, setCompanyShort] = useState("PS");

  useEffect(() => {
    const settings = getStorageItem(STORAGE_KEYS.SETTINGS, {});
    if (settings.company?.name) {
      setCompanyName(settings.company.name);
      const words = settings.company.name.split(" ");
      if (words.length >= 2) {
        setCompanyShort(words[0][0] + words[1][0]);
      } else {
        setCompanyShort(settings.company.name.substring(0, 2).toUpperCase());
      }
    }
  }, []);

  // Listen for settings updates
  useEffect(() => {
    const handleSettingsUpdate = () => {
      const settings = getStorageItem(STORAGE_KEYS.SETTINGS, {});
      if (settings.company?.name) {
        setCompanyName(settings.company.name);
        const words = settings.company.name.split(" ");
        if (words.length >= 2) {
          setCompanyShort(words[0][0] + words[1][0]);
        } else {
          setCompanyShort(settings.company.name.substring(0, 2).toUpperCase());
        }
      }
    };

    window.addEventListener("settingsUpdated", handleSettingsUpdate);
    return () =>
      window.removeEventListener("settingsUpdated", handleSettingsUpdate);
  }, []);

  /**
   * Check if user has access to a menu item
   */
  const hasAccess = (item) => {
    // Super admin has access to everything
    if (roleSlug === "super-admin") return true;

    // Check role-based access
    if (item.roles && !item.roles.includes(roleSlug)) {
      return false;
    }

    // If permissions are specified, check them (optional fine-grained control)
    // For now, role-based is sufficient
    // if (item.permissions && permissions) {
    //   return item.permissions.some(p => permissions[p])
    // }

    return true;
  };

  /**
   * Filter menu sections and items based on role
   */
  const getFilteredMenu = () => {
    return menuConfig
      .filter((section) => {
        // If section has roles defined, check access
        if (
          section.roles &&
          !section.roles.includes(roleSlug) &&
          roleSlug !== "super-admin"
        ) {
          return false;
        }
        return true;
      })
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => hasAccess(item)),
      }))
      .filter((section) => section.items.length > 0); // Remove empty sections
  };

  const filteredMenu = getFilteredMenu();

  // Check if path is active
  const isPathActive = (path, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  // Toggle sidebar collapse
  const handleToggleCollapse = () => {
    dispatch(toggleSidebarCollapse());
  };

  // Handle logout
  const handleLogout = async () => {
    await dispatch(logout());
    navigate("/login");
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-zinc-900 text-white",
        "flex flex-col transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className="flex items-center h-16 px-4 border-b border-zinc-800">
        <div
          className={cn(
            "flex items-center gap-3 transition-all duration-300",
            sidebarCollapsed && "justify-center w-full"
          )}
        >
          {/* Logo Icon */}
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500 flex-shrink-0">
            <span className="text-lg font-bold text-zinc-900">
              {sidebarCollapsed ? companyShort[0] : companyShort}
            </span>
          </div>

          {/* Company Name */}
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
      <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
        {filteredMenu.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-6">
            {/* Section Title */}
            {!sidebarCollapsed && (
              <h3 className="px-3 mb-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                {section.title}
              </h3>
            )}

            {/* Menu Items */}
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
                        item.highlight &&
                          !isActive &&
                          "border border-amber-500/30 bg-amber-500/5",
                        sidebarCollapsed && "justify-center px-2"
                      )}
                    >
                      {/* Active Indicator */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-amber-500 rounded-r-full" />
                      )}

                      {/* Icon */}
                      <Icon
                        className={cn(
                          "w-5 h-5 flex-shrink-0 transition-colors",
                          isActive
                            ? "text-amber-500"
                            : "text-zinc-400 group-hover:text-white",
                          item.highlight && !isActive && "text-amber-500/70"
                        )}
                      />

                      {/* Label */}
                      {!sidebarCollapsed && (
                        <span
                          className={cn(
                            "text-sm font-medium",
                            item.highlight && !isActive && "text-amber-500/90"
                          )}
                        >
                          {item.name}
                        </span>
                      )}

                      {/* Tooltip for collapsed state */}
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

      {/* Bottom Section - User & Actions */}
      <div className="border-t border-zinc-700/50 p-3">
        {/* User Info */}
        <div
          className={cn(
            "flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50 mb-3",
            sidebarCollapsed && "justify-center"
          )}
        >
          {/* Avatar */}
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

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2 rounded-lg",
            "text-zinc-400 hover:text-red-400 hover:bg-red-500/10",
            "transition-all duration-200",
            sidebarCollapsed && "justify-center px-2"
          )}
        >
          <LogOut className="w-5 h-5" />
          {!sidebarCollapsed && (
            <span className="text-sm font-medium">Logout</span>
          )}
        </button>

        {/* Collapse Toggle */}
        <button
          onClick={handleToggleCollapse}
          className={cn(
            "flex items-center justify-center w-full py-2 mt-2 rounded-lg",
            "text-zinc-400 hover:text-white hover:bg-zinc-700/50",
            "transition-all duration-200"
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
