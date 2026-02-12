/**
 * Inventory List - Fully API Integrated
 * ISSUE 2 FIX: Fixed status filter to use item status (stored/released)
 * NO localStorage - All data from backend API
 * Working Print Labels + Actions
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import inventoryService from "@/services/inventoryService";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select, Badge, Modal } from "@/components/common";
import StorageLocationSelector from "@/components/common/StorageLocationSelector";
import RackMap from "./RackMap";
import {
  Search,
  Filter,
  List,
  Grid3X3,
  Map,
  Package,
  Eye,
  Printer,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  Scale,
  DollarSign,
  Gem,
  RotateCcw,
  CheckSquare,
  Square,
  Loader2,
  Download,
  Barcode,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Archive,
} from "lucide-react";

// Purity labels
const purityLabels = {
  999: "999 (24K)",
  916: "916 (22K)",
  875: "875 (21K)",
  750: "750 (18K)",
  585: "585 (14K)",
  375: "375 (9K)",
};

/**
 * ISSUE 2 FIX: Status config based on ITEM status (not pledge status)
 * Items have their own status: stored, released
 * This is different from pledge status: active, overdue, redeemed
 */
const getItemStatusConfig = (itemStatus) => {
  switch (itemStatus) {
    case "stored":
    case null:
    case undefined:
      return { label: "In Storage", variant: "success", icon: CheckCircle };
    case "released":
      return { label: "Released", variant: "info", icon: Archive };
    default:
      return {
        label: itemStatus || "Unknown",
        variant: "default",
        icon: Package,
      };
  }
};

// Get pledge status for additional context
const getPledgeStatusConfig = (pledgeStatus) => {
  switch (pledgeStatus) {
    case "active":
      return { label: "Active", variant: "success", icon: CheckCircle };
    case "overdue":
      return { label: "Overdue", variant: "error", icon: AlertTriangle };
    case "redeemed":
      return { label: "Redeemed", variant: "secondary", icon: Archive };
    default:
      return {
        label: pledgeStatus || "Unknown",
        variant: "default",
        icon: Package,
      };
  }
};

export default function InventoryList() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // View State
  const [viewMode, setViewMode] = useState("table");
  const [isLoading, setIsLoading] = useState(true);

  // Data State
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventorySummary, setInventorySummary] = useState({});

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  /**
   * ISSUE 2 FIX: Status filter now uses ITEM status values
   * - "all" = show all items
   * - "in_storage" = items with status='stored' or null
   * - "released" = items with status='released'
   */
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [purityFilter, setPurityFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Selection State
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newLocation, setNewLocation] = useState({
    vault_id: "",
    box_id: "",
    slot_id: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Load data on mount
  useEffect(() => {
    fetchInventory();
    fetchSummary();
  }, []);

  // Refetch when status filter changes
  useEffect(() => {
    fetchInventory();
  }, [statusFilter]);

  /**
   * ISSUE 2 FIX: Fetch inventory with correct status parameter
   */
  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const params = { per_page: 500 };

      // ISSUE 2 FIX: Send correct status values to backend
      if (statusFilter !== "all") {
        params.status = statusFilter; // "in_storage" or "released"
      }

      const response = await inventoryService.getAll(params);

      if (response.success && response.data) {
        const items = response.data.data || response.data;
        setInventoryItems(Array.isArray(items) ? items : []);
      } else {
        setInventoryItems([]);
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: "Failed to load inventory",
          }),
        );
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
      setInventoryItems([]);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to load inventory",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch inventory summary from API
  const fetchSummary = async () => {
    try {
      const response = await inventoryService.getSummary();
      if (response.success && response.data) {
        setInventorySummary(response.data);
      }
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

  // Search by barcode via API
  const handleBarcodeSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const response = await inventoryService.searchByBarcode(
        searchQuery.trim(),
      );
      if (response.success && response.data) {
        setInventoryItems([response.data]);
        dispatch(
          addToast({
            type: "success",
            title: "Found",
            message: `Item found: ${response.data.barcode}`,
          }),
        );
      } else {
        dispatch(
          addToast({
            type: "warning",
            title: "Not Found",
            message: "No item found with this barcode",
          }),
        );
      }
    } catch (error) {
      console.log("Barcode search failed, using filter instead");
    } finally {
      setIsLoading(false);
    }
  };

  const formatLocation = (item) => {
    // API returns vault, box, slot as separate objects (not nested)
    if (item.vault && item.box && item.slot) {
      return `${item.vault.name || item.vault.code} → Box ${item.box.box_number || item.box.name} → Slot ${item.slot.slot_number}`;
    }
    // Fallback: check for nested structure (in case some APIs return it nested)
    if (item.slot?.box?.vault) {
      return `${item.slot.box.vault.name} → ${item.slot.box.name} → Slot ${item.slot.slot_number}`;
    }
    if (item.storage_location) {
      return item.storage_location;
    }
    return null;
  };

  // Get category name from object or string
  const getCategoryName = (category) => {
    if (!category) return "Gold";
    if (typeof category === "string") return category;
    return category.name_en || category.name || category.code || "Gold";
  };

  // Get purity name from object or string
  const getPurityName = (purity) => {
    if (!purity) return "916";
    if (typeof purity === "string") return purity;
    return purity.name_en || purity.name || purity.code || "916";
  };

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set();
    inventoryItems.forEach((item) => {
      const cat = getCategoryName(item.category);
      if (cat) cats.add(cat);
    });
    return Array.from(cats);
  }, [inventoryItems]);

  // Get unique locations
  const locations = useMemo(() => {
    const locs = new Set();
    inventoryItems.forEach((item) => {
      const loc = formatLocation(item);
      if (loc) locs.add(loc);
    });
    return Array.from(locs);
  }, [inventoryItems]);

  // Filter items client-side (for additional filters beyond status)
  const filteredItems = useMemo(() => {
    return inventoryItems.filter((item) => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches =
          item.barcode?.toLowerCase().includes(query) ||
          item.pledge?.pledge_no?.toLowerCase().includes(query) ||
          item.pledge?.customer?.name?.toLowerCase().includes(query) ||
          getCategoryName(item.category).toLowerCase().includes(query);
        if (!matches) return false;
      }

      // Category
      const itemCategory = getCategoryName(item.category);
      if (categoryFilter !== "all" && itemCategory !== categoryFilter)
        return false;

      // Purity
      const itemPurity = getPurityName(item.purity);
      if (purityFilter !== "all" && itemPurity !== purityFilter) return false;

      // Location
      const itemLoc = formatLocation(item);
      if (locationFilter === "unassigned" && itemLoc) return false;
      if (
        locationFilter !== "all" &&
        locationFilter !== "unassigned" &&
        itemLoc !== locationFilter
      )
        return false;

      return true;
    });
  }, [
    inventoryItems,
    searchQuery,
    categoryFilter,
    purityFilter,
    locationFilter,
  ]);

  /**
   * ISSUE 2 FIX: Calculate stats using ITEM status (not pledge status)
   */
  const stats = useMemo(
    () => ({
      total: inventorySummary.total_items || inventoryItems.length,
      // ISSUE 2 FIX: Use item status for "In Storage" count
      inStorage:
        inventorySummary.in_storage ??
        inventoryItems.filter(
          (i) =>
            i.status === "stored" ||
            i.status === null ||
            i.status === undefined,
        ).length,
      // ISSUE 2 FIX: Use item status for "Released" count
      released:
        inventorySummary.released ??
        inventoryItems.filter((i) => i.status === "released").length,
      // Overdue count (from pledge status)
      overdue:
        inventorySummary.overdue_count ??
        inventoryItems.filter((i) => i.pledge?.status === "overdue").length,
      totalWeight:
        inventorySummary.total_weight ||
        inventoryItems.reduce(
          (sum, i) => sum + (parseFloat(i.net_weight || i.weight) || 0),
          0,
        ),
      totalValue:
        inventorySummary.total_value ||
        inventoryItems.reduce(
          (sum, i) => sum + (parseFloat(i.net_value || i.estimated_value) || 0),
          0,
        ),
      noLocation:
        inventorySummary.unassigned ??
        inventoryItems.filter(
          (i) => !i.slot_id && !i.storage_location && i.status !== "released",
        ).length,
    }),
    [inventorySummary, inventoryItems],
  );

  // Pagination Logic
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, purityFilter, locationFilter, statusFilter]);

  // Check if filters are active
  const hasActiveFilters =
    categoryFilter !== "all" ||
    purityFilter !== "all" ||
    locationFilter !== "all";

  // Clear filters
  const clearFilters = () => {
    setCategoryFilter("all");
    setPurityFilter("all");
    setLocationFilter("all");
    setSearchQuery("");
    setStatusFilter("all");
    setCurrentPage(1);
    fetchInventory();
  };

  // Toggle item selection
  const toggleItemSelection = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map((i) => i.id));
    }
    setSelectAll(!selectAll);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedItems([]);
    setSelectAll(false);
  };

  // Open print modal
  const openPrintModal = () => {
    if (selectedItems.length === 0) {
      dispatch(
        addToast({
          type: "warning",
          title: "No Items",
          message: "Please select items to print",
        }),
      );
      return;
    }
    setShowPrintModal(true);
  };

  // Get selected items data
  const getSelectedItemsData = () => {
    return filteredItems.filter((item) => selectedItems.includes(item.id));
  };

  // Print barcode labels - 50mm x 50mm thermal labels
  const handlePrintBarcodeLabels = () => {
    setIsPrinting(true);
    const selectedData = getSelectedItemsData();

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode Labels - PawnSys</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          @page { 
            size: 50mm 50mm; 
            margin: 0; 
          }
          @media print {
            html, body {
              width: 50mm !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .controls { display: none !important; }
            .labels-container { 
              width: 50mm !important; 
              margin: 0 !important;
              padding: 0 !important;
              gap: 0 !important;
            }
            .label {
              page-break-after: always;
              page-break-inside: avoid;
              border: none !important;
              box-shadow: none !important;
            }
            .label:last-child {
              page-break-after: avoid;
            }
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: #f5f5f5; }
          .controls { 
            text-align: center; 
            padding: 15px; 
            background: linear-gradient(135deg, #1f2937 0%, #374151 100%); 
            margin-bottom: 15px;
            max-width: 400px;
            margin-left: auto;
            margin-right: auto;
            border-radius: 8px;
          }
          .controls button { 
            background: linear-gradient(135deg, #d97706 0%, #b45309 100%); 
            color: white; 
            border: none; 
            padding: 12px 25px; 
            cursor: pointer; 
            border-radius: 8px; 
            margin: 0 5px; 
            font-weight: bold;
            font-size: 14px;
          }
          .controls button.close { background: #6b7280; }
          .controls .info { color: #9ca3af; font-size: 11px; margin-top: 10px; }
          .controls .info strong { color: #fbbf24; }
          .labels-container { 
            width: 50mm; 
            margin: 0 auto; 
            background: white; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.2); 
          }
          .label { 
            width: 50mm; 
            height: 50mm;
            padding: 2mm 3mm; 
            background: white; 
            display: flex; 
            flex-direction: column; 
            overflow: hidden;
            border-bottom: 1px dashed #ccc;
          }
          .label:last-child { border-bottom: none; }
          .label-header { 
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 0.3mm solid #333;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .pledge-no { font-size: 8pt; font-weight: bold; }
          .category { font-size: 7pt; font-weight: 600; text-transform: uppercase; color: #333; }
          .barcode-container { 
            flex: 1;
            text-align: center; 
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1mm 0;
          }
          .barcode-container svg { 
            width: 44mm; 
            height: 18mm; 
          }
          .barcode-text { 
            font-family: 'Courier New', monospace;
            font-size: 9pt; 
            margin-top: 1mm;
            font-weight: bold;
            letter-spacing: 0.5px;
          }
          .label-footer { 
            border-top: 0.3mm solid #333;
            padding-top: 1mm;
            font-size: 8pt; 
            font-weight: bold;
            text-align: center;
          }
          @media screen { 
            body { padding: 20px; } 
          }
        </style>
      </head>
      <body>
        <div class="controls">
          <button onclick="window.print()">🏷️ Print ${selectedData.length} Label${selectedData.length > 1 ? "s" : ""}</button>
          <button class="close" onclick="window.close()">✕ Close</button>
          <p class="info">Label Size: <strong>50mm × 50mm</strong> | Labels: <strong>${selectedData.length}</strong></p>
          <p class="info" style="margin-top:5px;">⚠️ Set Scale to <strong>100%</strong> (not Fit to Page)</p>
        </div>
        <div class="labels-container">
          ${selectedData
            .map((item, index) => {
              const catName = getCategoryName(item.category);
              const purName = getPurityName(item.purity);
              return `
            <div class="label">
              <div class="label-header">
                <span class="pledge-no">${item.pledge?.pledge_no || "N/A"}</span>
                <span class="category">${catName}</span>
              </div>
              <div class="barcode-container">
                <svg id="barcode-${index}"></svg>
                <div class="barcode-text">${item.barcode || "N/A"}</div>
              </div>
              <div class="label-footer">${purName} • ${parseFloat(item.net_weight || item.weight || 0).toFixed(2)}g</div>
            </div>
          `;
            })
            .join("")}
        </div>
        <script>
          window.onload = function() {
            ${selectedData
              .map((item, index) => {
                const barcodeValue = (item.barcode || "NOCODE")
                  .replace(/[^A-Z0-9]/gi, "")
                  .substring(0, 20);
                return `
              try {
                JsBarcode("#barcode-${index}", "${barcodeValue}", {
                  format: "CODE128",
                  width: 2,
                  height: 50,
                  displayValue: false,
                  margin: 0
                });
              } catch(e) { console.log(e); }
            `;
              })
              .join("")}
            document.querySelector('button').focus();
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setIsPrinting(false);
      setShowPrintModal(false);
      clearSelection();
      dispatch(
        addToast({
          type: "success",
          title: "Print",
          message: `Printing ${selectedData.length} barcode labels`,
        }),
      );
    } else {
      setIsPrinting(false);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please allow popups to print",
        }),
      );
    }
  };

  // Print pack stickers
  const handlePrintPackStickers = () => {
    setIsPrinting(true);
    const selectedData = getSelectedItemsData();

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pack Stickers - PawnSys</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: #fff; }
          .stickers-container { display: flex; flex-wrap: wrap; gap: 15px; padding: 15px; }
          .sticker { 
            width: 280px; 
            border: 2px solid #d97706; 
            border-radius: 8px;
            padding: 0; 
            page-break-inside: avoid;
            background: #fff;
            overflow: hidden;
          }
          .sticker-header { 
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
            color: white; 
            padding: 8px 12px; 
            font-weight: bold;
            font-size: 13px;
            letter-spacing: 0.5px;
          }
          .sticker-body {
            padding: 10px 12px;
          }
          .sticker-row { 
            display: table;
            width: 100%;
            margin-bottom: 5px; 
            font-size: 11px; 
          }
          .sticker-label { 
            display: table-cell;
            width: 70px;
            color: #666; 
            font-weight: 500;
            vertical-align: top;
          }
          .sticker-value { 
            display: table-cell;
            font-weight: 600; 
            color: #1f2937;
          }
          .sticker-barcode { 
            text-align: center; 
            padding: 8px 12px 10px;
            border-top: 1px dashed #e5e7eb; 
            background: #fafafa;
          }
          .sticker-barcode svg { max-width: 100%; height: 38px; }
          .barcode-text { 
            font-size: 9px; 
            font-family: 'Courier New', monospace; 
            margin-top: 4px; 
            color: #374151;
            letter-spacing: 1px;
          }
          @media print { 
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .sticker { border: 1.5px solid #d97706; } 
          }
        </style>
      </head>
      <body>
        <div class="stickers-container">
          ${selectedData
            .map((item, index) => {
              const catName = getCategoryName(item.category);
              const purName = getPurityName(item.purity);
              return `
            <div class="sticker">
              <div class="sticker-header">${
                item.pledge?.pledge_no || "N/A"
              }</div>
              <div class="sticker-body">
                <div class="sticker-row">
                  <span class="sticker-label">Customer:</span>
                  <span class="sticker-value">${
                    item.pledge?.customer?.name || "N/A"
                  }</span>
                </div>
                <div class="sticker-row">
                  <span class="sticker-label">Item:</span>
                  <span class="sticker-value">${catName}</span>
                </div>
                <div class="sticker-row">
                  <span class="sticker-label">Purity:</span>
                  <span class="sticker-value">${purName}</span>
                </div>
                <div class="sticker-row">
                  <span class="sticker-label">Weight:</span>
                  <span class="sticker-value">${item.net_weight || item.weight || 0}g</span>
                </div>
                <div class="sticker-row">
                  <span class="sticker-label">Value:</span>
                  <span class="sticker-value">RM ${parseFloat(
                    item.net_value || item.estimated_value || 0,
                  ).toLocaleString()}</span>
                </div>
              </div>
              <div class="sticker-barcode">
                <svg id="sticker-barcode-${index}"></svg>
                <div class="barcode-text">${item.barcode || "N/A"}</div>
              </div>
            </div>
          `;
            })
            .join("")}
        </div>
        <script>
          window.onload = function() {
            ${selectedData
              .map((item, index) => {
                const barcodeValue = (item.barcode || "NOCODE")
                  .replace(/[^A-Z0-9]/gi, "")
                  .substring(0, 20);
                return `
              try {
                JsBarcode("#sticker-barcode-${index}", "${barcodeValue}", {
                  format: "CODE128",
                  width: 1.5,
                  height: 35,
                  displayValue: false,
                  margin: 0
                });
              } catch(e) { console.log(e); }
            `;
              })
              .join("")}
            setTimeout(function() { window.print(); }, 300);
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setIsPrinting(false);
      setShowPrintModal(false);
      clearSelection();
      dispatch(
        addToast({
          type: "success",
          title: "Print",
          message: `Printing ${selectedData.length} pack stickers`,
        }),
      );
    } else {
      setIsPrinting(false);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please allow popups to print",
        }),
      );
    }
  };

  // Print single item label - 50mm x 50mm thermal label
  const handlePrintSingleLabel = (item) => {
    const catName = getCategoryName(item.category);
    const purName = getPurityName(item.purity);
    const barcodeValue = (item.barcode || "NOCODE")
      .replace(/[^A-Z0-9]/gi, "")
      .substring(0, 20);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Label - ${item.barcode}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          @page { 
            size: 50mm 50mm; 
            margin: 0; 
          }
          @media print {
            html, body {
              width: 50mm !important;
              height: 50mm !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .controls { display: none !important; }
            .labels-wrapper { 
              width: 50mm !important; 
              margin: 0 !important;
              box-shadow: none !important;
            }
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: #f5f5f5; }
          .controls { 
            text-align: center; 
            padding: 15px; 
            background: linear-gradient(135deg, #1f2937 0%, #374151 100%); 
            margin-bottom: 15px;
            max-width: 400px;
            margin-left: auto;
            margin-right: auto;
            border-radius: 8px;
          }
          .controls button { 
            background: linear-gradient(135deg, #d97706 0%, #b45309 100%); 
            color: white; 
            border: none; 
            padding: 12px 25px; 
            cursor: pointer; 
            border-radius: 8px; 
            margin: 0 5px; 
            font-weight: bold;
            font-size: 14px;
          }
          .controls button.close { background: #6b7280; }
          .controls .info { color: #9ca3af; font-size: 11px; margin-top: 10px; }
          .controls .info strong { color: #fbbf24; }
          .labels-wrapper { 
            width: 50mm; 
            margin: 0 auto; 
            background: white; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.2); 
          }
          .label { 
            width: 50mm; 
            height: 50mm;
            padding: 4mm 3mm; 
            background: white; 
            display: flex; 
            flex-direction: column; 
            overflow: hidden;
          }
          .label-header { 
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 0.3mm solid #333;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
          }
          .pledge-no { font-size: 8pt; font-weight: bold; }
          .category { font-size: 7pt; font-weight: 600; text-transform: uppercase; color: #333; }
          .barcode-container { 
            flex: 1;
            text-align: center; 
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1mm 0;
          }
          .barcode-container svg { 
            width: 44mm; 
            height: 18mm; 
          }
          .barcode-text { 
            font-family: 'Courier New', monospace;
            font-size: 9pt; 
            margin-top: 1mm;
            font-weight: bold;
            letter-spacing: 0.5px;
          }
          .label-footer { 
            border-top: 0.3mm solid #333;
            padding-top: 1mm;
            font-size: 8pt; 
            font-weight: bold;
            text-align: center;
          }
          @media screen { 
            body { padding: 20px; } 
          }
        </style>
      </head>
      <body>
        <div class="controls">
          <button onclick="window.print()">🏷️ Print Label</button>
          <button class="close" onclick="window.close()">✕ Close</button>
          <p class="info">Label Size: <strong>50mm × 50mm</strong></p>
          <p class="info" style="margin-top:5px;">⚠️ Set Scale to <strong>100%</strong> (not Fit to Page)</p>
        </div>
        <div class="labels-wrapper">
          <div class="label">
            <div class="label-header">
              <span class="pledge-no">${item.pledge?.pledge_no || "N/A"}</span>
              <span class="category">${catName}</span>
            </div>
            <div class="barcode-container">
              <svg id="single-barcode"></svg>
              <div class="barcode-text">${item.barcode || "N/A"}</div>
            </div>
            <div class="label-footer">${purName} • ${parseFloat(item.net_weight || item.weight || 0).toFixed(2)}g</div>
          </div>
        </div>
        <script>
          window.onload = function() {
            try {
              JsBarcode("#single-barcode", "${barcodeValue}", {
                format: "CODE128",
                width: 2,
                height: 50,
                displayValue: false,
                margin: 0
              });
            } catch(e) { console.log(e); }
            document.querySelector('button').focus();
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  };

  // Open location assignment modal
  const openLocationModal = (item) => {
    setEditingItem(item);
    // Initialize with existing location IDs if available
    setNewLocation({
      vault_id: item.vault?.id || item.vault_id || "",
      box_id: item.box?.id || item.box_id || "",
      slot_id: item.slot?.id || item.slot_id || "",
    });
    setShowLocationModal(true);
  };

  // Save location via API
  const handleSaveLocation = async () => {
    if (!editingItem) return;

    // Validate that all fields are filled
    if (!newLocation.vault_id || !newLocation.box_id || !newLocation.slot_id) {
      dispatch(
        addToast({
          type: "error",
          title: "Incomplete",
          message: "Please select vault, box, and slot",
        }),
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await inventoryService.updateLocation(editingItem.id, {
        vault_id: parseInt(newLocation.vault_id),
        box_id: parseInt(newLocation.box_id),
        slot_id: parseInt(newLocation.slot_id),
        reason: "Manual assignment from inventory list",
      });

      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Location Updated",
            message: "Item location has been updated",
          }),
        );
        setShowLocationModal(false);
        setEditingItem(null);
        fetchInventory(); // Refresh data from API
      } else {
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: response.message || "Failed to update location",
          }),
        );
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to update location",
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Export to CSV
  const handleExport = () => {
    const csvData = filteredItems.map((item) => ({
      Barcode: item.barcode || "",
      "Pledge No": item.pledge?.pledge_no || "",
      Customer: item.pledge?.customer?.name || "",
      Category: getCategoryName(item.category),
      Purity: getPurityName(item.purity),
      "Weight (g)": item.net_weight || item.weight || 0,
      "Value (RM)": item.net_value || item.estimated_value || 0,
      Location: formatLocation(item) || "Unassigned",
      "Item Status": item.status || "stored",
      "Pledge Status": item.pledge?.status || "",
      "Due Date": item.pledge?.due_date || "",
    }));

    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(","),
      ...csvData.map((row) => headers.map((h) => `"${row[h]}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    dispatch(
      addToast({
        type: "success",
        title: "Export",
        message: `Exported ${csvData.length} items to CSV`,
      }),
    );
  };

  // Loading state
  if (isLoading && inventoryItems.length === 0) {
    return (
      <PageWrapper
        title="Inventory Management"
        subtitle="Track and manage all pledged items"
      >
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
            <p className="text-zinc-500">Loading inventory from server...</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Inventory Management"
      subtitle="Track and manage all pledged items"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={RefreshCw}
            onClick={() => {
              fetchInventory();
              fetchSummary();
            }}
          >
            Refresh
          </Button>
          <Button variant="outline" leftIcon={Printer} onClick={openPrintModal}>
            Print Labels
          </Button>
          <Button variant="outline" leftIcon={Download} onClick={handleExport}>
            Export
          </Button>
        </div>
      }
    >
      {/* ISSUE 2 FIX: Stats Cards now show correct counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Items</p>
              <p className="text-xl font-bold text-zinc-800">{stats.total}</p>
            </div>
          </div>
        </Card>

        {/* ISSUE 2 FIX: In Storage count - uses item status */}
        <Card
          className={cn(
            "p-4 cursor-pointer transition-all hover:shadow-md",
            statusFilter === "in_storage" && "ring-2 ring-emerald-500",
          )}
          onClick={() =>
            setStatusFilter(
              statusFilter === "in_storage" ? "all" : "in_storage",
            )
          }
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">In Storage</p>
              <p className="text-xl font-bold text-emerald-600">
                {stats.inStorage}
              </p>
            </div>
          </div>
        </Card>

        {/* ISSUE 2 FIX: Released count - uses item status */}
        <Card
          className={cn(
            "p-4 cursor-pointer transition-all hover:shadow-md",
            statusFilter === "released" && "ring-2 ring-blue-500",
          )}
          onClick={() =>
            setStatusFilter(statusFilter === "released" ? "all" : "released")
          }
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Archive className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Released</p>
              <p className="text-xl font-bold text-blue-600">
                {stats.released}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Scale className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-500">Total Weight</p>
              <p
                className="text-base sm:text-lg md:text-xl font-bold text-amber-600 truncate"
                title={`${parseFloat(stats.totalWeight || 0).toFixed(1)}g`}
              >
                {parseFloat(stats.totalWeight || 0).toFixed(1)}g
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-500">Total Value</p>
              <p
                className="text-base sm:text-lg md:text-xl font-bold text-purple-600 truncate"
                title={formatCurrency(stats.totalValue || 0)}
              >
                {formatCurrency(stats.totalValue || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-zinc-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">No Location</p>
              <p className="text-xl font-bold text-zinc-600">
                {stats.noLocation}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search & Filters Bar */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search barcode, pledge no, customer, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBarcodeSearch()}
              leftIcon={Search}
            />
          </div>

          <div className="flex items-center gap-2">
            {/* ISSUE 2 FIX: Status filter now uses correct item status values */}
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "all", label: "All Status" },
                { value: "in_storage", label: "In Storage" },
                { value: "released", label: "Released" },
              ]}
              className="w-36"
            />

            <Button
              variant="outline"
              leftIcon={Filter}
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && "bg-zinc-100")}
            >
              Filters
              {hasActiveFilters && (
                <span className="ml-1 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </Button>

            {/* View Mode Toggle */}
            <div className="flex border border-zinc-200 rounded-lg overflow-hidden">
              <button
                className={cn(
                  "p-2 transition-colors",
                  viewMode === "table" ? "bg-zinc-100" : "hover:bg-zinc-50",
                )}
                onClick={() => setViewMode("table")}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                className={cn(
                  "p-2 transition-colors",
                  viewMode === "grid" ? "bg-zinc-100" : "hover:bg-zinc-50",
                )}
                onClick={() => setViewMode("grid")}
                title="Grid View"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                className={cn(
                  "p-2 transition-colors",
                  viewMode === "map"
                    ? "bg-amber-100 text-amber-700"
                    : "hover:bg-zinc-50",
                )}
                onClick={() => setViewMode("map")}
                title="Rack Map View"
              >
                <Map className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-zinc-200">
                <Select
                  label="Category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  options={[
                    { value: "all", label: "All Categories" },
                    ...categories.map((c) => ({ value: c, label: c })),
                  ]}
                />
                <Select
                  label="Purity"
                  value={purityFilter}
                  onChange={(e) => setPurityFilter(e.target.value)}
                  options={[
                    { value: "all", label: "All Purities" },
                    ...Object.entries(purityLabels).map(([k, v]) => ({
                      value: k,
                      label: v,
                    })),
                  ]}
                />
                <Select
                  label="Location"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  options={[
                    { value: "all", label: "All Locations" },
                    { value: "unassigned", label: "⚠️ Unassigned" },
                    ...locations.map((l) => ({ value: l, label: l })),
                  ]}
                />
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    leftIcon={RotateCcw}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Selection Actions Bar */}
      {selectedItems.length > 0 && viewMode !== "map" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <Card className="p-3 bg-amber-50 border-amber-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-amber-800">
                  {selectedItems.length} item(s) selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="accent"
                  leftIcon={Printer}
                  onClick={openPrintModal}
                >
                  Print Selected
                </Button>
                <Button size="sm" variant="outline" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* View Mode Content */}
      <AnimatePresence mode="wait">
        {/* MAP VIEW */}
        {viewMode === "map" && (
          <motion.div
            key="map"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <RackMap embedded />
          </motion.div>
        )}

        {/* TABLE VIEW */}
        {viewMode === "table" && (
          <motion.div
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-zinc-500">
                Showing <strong>{paginatedItems.length}</strong> of{" "}
                <strong>{filteredItems.length}</strong> items
                {totalPages > 1 && (
                  <span className="ml-1">
                    (Page {currentPage} of {totalPages})
                  </span>
                )}
              </p>
              <button
                className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
                onClick={toggleSelectAll}
              >
                {selectAll ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {selectAll ? "Deselect All" : "Select All"}
              </button>
            </div>

            <Card className="overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full" style={{ minWidth: "1000px" }}>
                  <thead className="bg-gradient-to-r from-zinc-100 to-zinc-50 border-b-2 border-amber-200">
                    <tr>
                      <th className="p-4 text-left w-12">
                        <button onClick={toggleSelectAll}>
                          {selectAll ? (
                            <CheckSquare className="w-5 h-5 text-amber-500" />
                          ) : (
                            <Square className="w-5 h-5 text-zinc-400" />
                          )}
                        </button>
                      </th>
                      <th
                        className="p-4 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider"
                        style={{ minWidth: "140px" }}
                      >
                        Item
                      </th>
                      <th
                        className="p-4 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider"
                        style={{ minWidth: "140px" }}
                      >
                        Barcode
                      </th>
                      <th
                        className="p-4 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider"
                        style={{ minWidth: "120px" }}
                      >
                        Pledge
                      </th>
                      <th
                        className="p-4 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider"
                        style={{ minWidth: "120px" }}
                      >
                        Customer
                      </th>
                      <th
                        className="p-4 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider"
                        style={{ minWidth: "70px" }}
                      >
                        Weight
                      </th>
                      <th
                        className="p-4 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider"
                        style={{ minWidth: "80px" }}
                      >
                        Purity
                      </th>
                      <th
                        className="p-4 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider"
                        style={{ minWidth: "160px" }}
                      >
                        Location
                      </th>
                      <th
                        className="p-4 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider"
                        style={{ minWidth: "100px" }}
                      >
                        Status
                      </th>
                      <th
                        className="p-4 text-center text-xs font-bold text-zinc-700 uppercase tracking-wider"
                        style={{ minWidth: "100px" }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {paginatedItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="p-8 text-center text-zinc-500"
                        >
                          <Package className="w-12 h-12 text-zinc-300 mx-auto mb-2" />
                          No items found
                        </td>
                      </tr>
                    ) : (
                      paginatedItems.map((item) => {
                        // ISSUE 2 FIX: Use ITEM status for display
                        const itemStatus = getItemStatusConfig(item.status);
                        const ItemStatusIcon = itemStatus.icon;
                        const isSelected = selectedItems.includes(item.id);
                        const location = formatLocation(item);

                        return (
                          <motion.tr
                            key={item.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={cn(
                              "hover:bg-zinc-50",
                              isSelected && "bg-amber-50",
                            )}
                          >
                            <td className="p-4">
                              <button
                                onClick={() => toggleItemSelection(item.id)}
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-5 h-5 text-amber-500" />
                                ) : (
                                  <Square className="w-5 h-5 text-zinc-400" />
                                )}
                              </button>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                  <Gem className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-zinc-800">
                                    {getCategoryName(item.category)}
                                  </p>
                                  <p className="text-xs text-zinc-500">
                                    {purityLabels[getPurityName(item.purity)] ||
                                      getPurityName(item.purity)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <code className="text-sm bg-zinc-100 px-2 py-1 rounded font-mono">
                                {item.barcode || "-"}
                              </code>
                            </td>
                            <td className="p-4">
                              <button
                                onClick={() =>
                                  navigate(
                                    `/pledges/${
                                      item.pledge?.id || item.pledge_id
                                    }`,
                                  )
                                }
                                className="text-amber-600 hover:text-amber-700 font-medium"
                              >
                                {item.pledge?.pledge_no || "-"}
                              </button>
                            </td>
                            <td className="p-4">
                              <p className="font-semibold text-zinc-800 capitalize">
                                {(
                                  item.pledge?.customer?.name || "Unknown"
                                ).toLowerCase()}
                              </p>
                            </td>
                            <td className="p-4">
                              <span className="font-medium">
                                {item.net_weight || item.weight}g
                              </span>
                            </td>
                            <td className="p-4">
                              <Badge variant="default">
                                {getPurityName(item.purity)}
                              </Badge>
                            </td>
                            <td className="p-4">
                              {location ? (
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="w-4 h-4 text-blue-500" />
                                  <span className="font-medium text-blue-600 text-sm">
                                    {location}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-red-500 text-sm flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Unassigned
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              {/* ISSUE 2 FIX: Show ITEM status badge */}
                              <Badge variant={itemStatus.variant}>
                                <ItemStatusIcon className="w-3 h-3 mr-1" />
                                {itemStatus.label}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="View Pledge"
                                  onClick={() =>
                                    navigate(
                                      `/pledges/${
                                        item.pledge?.id || item.pledge_id
                                      }`,
                                    )
                                  }
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="Print Label"
                                  onClick={() => handlePrintSingleLabel(item)}
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                                {/* Only show location button for stored items */}
                                {item.status !== "released" && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    title="Set Location"
                                    onClick={() => openLocationModal(item)}
                                  >
                                    <MapPin className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 p-4 bg-white rounded-lg border border-zinc-200">
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <span>Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-zinc-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>per page</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>

                  <div className="flex items-center gap-1">
                    {/* First page */}
                    {currentPage > 3 && (
                      <>
                        <button
                          onClick={() => setCurrentPage(1)}
                          className="w-8 h-8 rounded-md text-sm hover:bg-zinc-100"
                        >
                          1
                        </button>
                        {currentPage > 4 && <span className="px-1">...</span>}
                      </>
                    )}

                    {/* Page numbers around current */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (page) =>
                          page >= currentPage - 2 &&
                          page <= currentPage + 2 &&
                          page >= 1 &&
                          page <= totalPages,
                      )
                      .map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={cn(
                            "w-8 h-8 rounded-md text-sm font-medium transition-colors",
                            page === currentPage
                              ? "bg-amber-500 text-white"
                              : "hover:bg-zinc-100",
                          )}
                        >
                          {page}
                        </button>
                      ))}

                    {/* Last page */}
                    {currentPage < totalPages - 2 && (
                      <>
                        {currentPage < totalPages - 3 && (
                          <span className="px-1">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          className="w-8 h-8 rounded-md text-sm hover:bg-zinc-100"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                <p className="text-sm text-zinc-500">
                  {(currentPage - 1) * itemsPerPage + 1} -{" "}
                  {Math.min(currentPage * itemsPerPage, filteredItems.length)}{" "}
                  of {filteredItems.length}
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* GRID VIEW */}
        {viewMode === "grid" && (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-zinc-500">
                Showing <strong>{paginatedItems.length}</strong> of{" "}
                <strong>{filteredItems.length}</strong> items
                {totalPages > 1 && (
                  <span className="ml-1">
                    (Page {currentPage} of {totalPages})
                  </span>
                )}
              </p>
              <button
                className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
                onClick={toggleSelectAll}
              >
                {selectAll ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {selectAll ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {paginatedItems.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <Package className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                  <p className="text-zinc-500">No items found</p>
                </div>
              ) : (
                paginatedItems.map((item) => {
                  // ISSUE 2 FIX: Use ITEM status for display
                  const itemStatus = getItemStatusConfig(item.status);
                  const isSelected = selectedItems.includes(item.id);
                  const location = formatLocation(item);

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <Card
                        className={cn(
                          "p-4 cursor-pointer transition-all hover:shadow-md",
                          isSelected && "ring-2 ring-amber-500 bg-amber-50",
                        )}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <button onClick={() => toggleItemSelection(item.id)}>
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-amber-500" />
                            ) : (
                              <Square className="w-5 h-5 text-zinc-400" />
                            )}
                          </button>
                          {/* ISSUE 2 FIX: Show ITEM status badge */}
                          <Badge variant={itemStatus.variant} size="sm">
                            {itemStatus.label}
                          </Badge>
                        </div>

                        <div className="w-full h-24 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
                          <Gem className="w-10 h-10 text-amber-600" />
                        </div>

                        <div className="space-y-1">
                          <p className="font-semibold text-zinc-800">
                            {getCategoryName(item.category)}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {purityLabels[getPurityName(item.purity)] ||
                              getPurityName(item.purity)}
                          </p>
                          <p className="text-sm font-medium">
                            {item.net_weight || item.weight}g
                          </p>
                        </div>

                        <div className="mt-3 pt-3 border-t border-zinc-200">
                          <code className="text-xs bg-zinc-100 px-2 py-1 rounded font-mono block truncate">
                            {item.barcode || "-"}
                          </code>
                          <p className="text-xs text-zinc-500 mt-1">
                            {item.pledge?.pledge_no || "-"}
                          </p>
                        </div>

                        {location ? (
                          <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{location}</span>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-center gap-1 text-xs text-red-500">
                            <AlertTriangle className="w-3 h-3" />
                            Unassigned
                          </div>
                        )}

                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            fullWidth
                            onClick={() =>
                              navigate(
                                `/pledges/${item.pledge?.id || item.pledge_id}`,
                              )
                            }
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls for Grid View */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 p-4 bg-white rounded-lg border border-zinc-200">
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <span>Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-zinc-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>per page</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let page;
                      if (totalPages <= 5) {
                        page = i + 1;
                      } else if (currentPage <= 3) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i;
                      } else {
                        page = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={cn(
                            "w-8 h-8 rounded-md text-sm font-medium transition-colors",
                            page === currentPage
                              ? "bg-amber-500 text-white"
                              : "hover:bg-zinc-100",
                          )}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                <p className="text-sm text-zinc-500">
                  {(currentPage - 1) * itemsPerPage + 1} -{" "}
                  {Math.min(currentPage * itemsPerPage, filteredItems.length)}{" "}
                  of {filteredItems.length}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print Modal */}
      <Modal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Print Labels"
        size="md"
      >
        <div className="p-5">
          <p className="text-zinc-600 mb-4">
            Print labels for <strong>{selectedItems.length}</strong> selected
            item(s)
          </p>

          <div className="space-y-3">
            <Button
              variant="outline"
              fullWidth
              leftIcon={Barcode}
              onClick={handlePrintBarcodeLabels}
              loading={isPrinting}
            >
              Item Barcode Labels
            </Button>
            <Button
              variant="outline"
              fullWidth
              leftIcon={Package}
              onClick={handlePrintPackStickers}
              loading={isPrinting}
            >
              Pack Stickers
            </Button>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowPrintModal(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Location Assignment Modal */}
      <Modal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        title="Assign Storage Location"
        size="sm"
      >
        <div className="p-5">
          {editingItem && (
            <>
              <div className="bg-zinc-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-zinc-500">Item</p>
                <p className="font-semibold">
                  {getCategoryName(editingItem.category)} -{" "}
                  {editingItem.barcode}
                </p>
                <p className="text-sm text-zinc-600">
                  Pledge: {editingItem.pledge?.pledge_no}
                </p>
              </div>

              <StorageLocationSelector
                value={newLocation}
                onChange={setNewLocation}
                showAvailability={true}
              />

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => setShowLocationModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  fullWidth
                  leftIcon={MapPin}
                  onClick={handleSaveLocation}
                  loading={isSaving}
                >
                  Save Location
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </PageWrapper>
  );
}
