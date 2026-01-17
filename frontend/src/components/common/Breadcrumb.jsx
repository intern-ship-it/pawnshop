/**
 * Breadcrumb - Automatic breadcrumb navigation based on current route
 */

import { Link, useLocation } from "react-router";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

// Route to breadcrumb label mapping
const routeLabels = {
  "": "Dashboard",
  pledges: "Pledges",
  new: "New Pledge",
  renewals: "Renewals",
  redemptions: "Redemptions",
  customers: "Customers",
  inventory: "Inventory",
  "rack-map": "Rack Map",
  reconciliation: "Reconciliation",
  auctions: "Auctions",
  reports: "Reports",
  "day-end": "Day End",
  settings: "Settings",
  users: "Users",
  roles: "Roles",
  branches: "Branches",
  categories: "Categories",
  purities: "Purities",
  "interest-rates": "Interest Rates",
  margins: "Margin Presets",
  whatsapp: "WhatsApp",
  audit: "Audit Logs",
  edit: "Edit",
  view: "View",
  create: "Create",
};

// Get human-readable label for a route segment
const getLabel = (segment) => {
  // Check if it's a known route
  if (routeLabels[segment]) {
    return routeLabels[segment];
  }

  // Check if it's an ID (numeric or UUID-like)
  if (/^[0-9a-f-]+$/i.test(segment) && segment.length > 5) {
    return "Details";
  }

  // Capitalize first letter and replace hyphens with spaces
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Build path for each breadcrumb segment
const buildPath = (segments, index) => {
  return "/" + segments.slice(0, index + 1).join("/");
};

export default function Breadcrumb({ className, customItems }) {
  const location = useLocation();

  // If custom items are provided, use them
  if (customItems && customItems.length > 0) {
    return (
      <nav className={cn("flex items-center text-sm", className)}>
        <ol className="flex items-center gap-1">
          <li>
            <Link
              to="/"
              className="flex items-center gap-1 text-zinc-500 hover:text-zinc-700 transition-colors"
            >
              <Home className="w-4 h-4" />
            </Link>
          </li>
          {customItems.map((item, index) => (
            <li key={index} className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 text-zinc-400" />
              {item.path ? (
                <Link
                  to={item.path}
                  className="text-zinc-500 hover:text-zinc-700 transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-zinc-700 font-medium">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    );
  }

  // Auto-generate breadcrumbs from URL path
  const pathSegments = location.pathname.split("/").filter(Boolean);

  // Don't show breadcrumb on root/dashboard
  if (pathSegments.length === 0) {
    return null;
  }

  return (
    <nav className={cn("flex items-center text-sm mb-4", className)}>
      <ol className="flex items-center gap-1">
        {/* Home link */}
        <li>
          <Link
            to="/"
            className="flex items-center gap-1 text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            <Home className="w-4 h-4" />
          </Link>
        </li>

        {/* Path segments */}
        {pathSegments.map((segment, index) => {
          const isLast = index === pathSegments.length - 1;
          const path = buildPath(pathSegments, index);
          const label = getLabel(segment);

          return (
            <li key={path} className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 text-zinc-400" />
              {isLast ? (
                <span className="text-zinc-700 font-medium">{label}</span>
              ) : (
                <Link
                  to={path}
                  className="text-zinc-500 hover:text-zinc-700 transition-colors"
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
