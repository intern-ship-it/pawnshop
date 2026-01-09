/**
 * Inventory List - Fully API Integrated
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

// Status config
const getStatusConfig = (status) => {
  switch (status) {
    case "active":
      return { label: "In Storage", variant: "success", icon: CheckCircle };
    case "overdue":
      return { label: "Overdue", variant: "error", icon: AlertTriangle };
    case "expiring":
      return { label: "Expiring", variant: "warning", icon: Clock };
    case "redeemed":
      return { label: "Released", variant: "info", icon: Clock };
    case "defaulted":
      return { label: "Defaulted", variant: "error", icon: AlertTriangle };
    default:
      return { label: status || "Unknown", variant: "default", icon: Package };
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
  const [newLocation, setNewLocation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Load data on mount
  useEffect(() => {
    fetchInventory();
    fetchSummary();
  }, []);

  // Refetch when status filter changes
  useEffect(() => {
    fetchInventory();
  }, [statusFilter]);

  // Fetch inventory items from API
  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const params = { per_page: 500 };
      if (statusFilter !== "all") {
        params.status = statusFilter;
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
          })
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
        })
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
        searchQuery.trim()
      );
      if (response.success && response.data) {
        setInventoryItems([response.data]);
        dispatch(
          addToast({
            type: "success",
            title: "Found",
            message: `Item found: ${response.data.barcode}`,
          })
        );
      } else {
        dispatch(
          addToast({
            type: "warning",
            title: "Not Found",
            message: "No item found with this barcode",
          })
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
      return `${item.vault.name} → ${item.box.name} → Slot ${item.slot.slot_number}`;
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

  // Filter items client-side
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

  // Calculate stats
  const stats = useMemo(
    () => ({
      total: inventorySummary.total_items || inventoryItems.length,
      inStorage:
        inventorySummary.active_count ||
        inventoryItems.filter((i) => i.pledge?.status === "active").length,
      overdue:
        inventorySummary.overdue_count ||
        inventoryItems.filter((i) => i.pledge?.status === "overdue").length,
      totalWeight:
        inventorySummary.total_weight ||
        inventoryItems.reduce((sum, i) => sum + (parseFloat(i.weight) || 0), 0),
      totalValue:
        inventorySummary.total_value ||
        inventoryItems.reduce(
          (sum, i) => sum + (parseFloat(i.estimated_value) || 0),
          0
        ),
      noLocation: inventoryItems.filter(
        (i) =>
          !i.slot_id && !i.storage_location && i.pledge?.status !== "redeemed"
      ).length,
    }),
    [inventorySummary, inventoryItems]
  );

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
    fetchInventory();
  };

  // Toggle item selection
  const toggleItemSelection = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
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
        })
      );
      return;
    }
    setShowPrintModal(true);
  };

  // Get selected items data
  const getSelectedItemsData = () => {
    return filteredItems.filter((item) => selectedItems.includes(item.id));
  };

  // Print barcode labels
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
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: #fff; }
          .labels-container { display: flex; flex-wrap: wrap; gap: 10px; padding: 10px; }
          .label { 
            width: 220px; 
            border: 1px solid #000; 
            padding: 8px; 
            page-break-inside: avoid;
            background: #fff;
          }
          .label-header { font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
          .barcode-container { text-align: center; margin: 5px 0; }
          .barcode-container svg { max-width: 100%; height: 50px; }
          .label-footer { font-size: 9px; display: flex; justify-content: space-between; margin-top: 5px; border-top: 1px solid #eee; padding-top: 5px; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .labels-container { gap: 5px; padding: 5px; }
          }
        </style>
      </head>
      <body>
        <div class="labels-container">
          ${selectedData
            .map((item, index) => {
              const catName =
                item.category?.name_en ||
                item.category?.name ||
                item.category?.code ||
                (typeof item.category === "string" ? item.category : "Gold");
              const purName =
                item.purity?.name_en ||
                item.purity?.name ||
                item.purity?.code ||
                (typeof item.purity === "string" ? item.purity : "916");
              const barcodeValue = (item.barcode || "NOCODE")
                .replace(/[^A-Z0-9]/gi, "")
                .substring(0, 20);
              return `
            <div class="label">
              <div class="label-header">${
                item.pledge?.pledge_no || "N/A"
              } | ${catName}</div>
              <div class="barcode-container">
                <svg id="barcode-${index}"></svg>
              </div>
              <div style="font-size: 10px; text-align: center; font-family: monospace;">${
                item.barcode || "N/A"
              }</div>
              <div class="label-footer">
                <span>${item.weight || 0}g | ${purName}</span>
                <span>${(item.pledge?.customer?.name || "Customer").substring(
                  0,
                  15
                )}</span>
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
                JsBarcode("#barcode-${index}", "${barcodeValue}", {
                  format: "CODE128",
                  width: 1.5,
                  height: 40,
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
          message: `Printing ${selectedData.length} barcode labels`,
        })
      );
    } else {
      setIsPrinting(false);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please allow popups to print",
        })
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
            width: 260px; 
            border: 2px solid #f59e0b; 
            border-radius: 8px;
            padding: 12px; 
            page-break-inside: avoid;
            background: #fff;
          }
          .sticker-header { 
            background: #f59e0b; 
            color: white; 
            padding: 6px 10px; 
            margin: -12px -12px 10px -12px;
            border-radius: 6px 6px 0 0;
            font-weight: bold;
            font-size: 14px;
          }
          .sticker-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }
          .sticker-label { color: #666; }
          .sticker-value { font-weight: bold; }
          .sticker-barcode { 
            text-align: center; 
            margin-top: 10px; 
            padding-top: 10px; 
            border-top: 1px dashed #ddd; 
          }
          .sticker-barcode svg { max-width: 100%; height: 40px; }
          .barcode-text { font-size: 9px; font-family: monospace; margin-top: 3px; }
          @media print { 
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .sticker { border: 1px solid #f59e0b; } 
          }
        </style>
      </head>
      <body>
        <div class="stickers-container">
          ${selectedData
            .map((item, index) => {
              const catName =
                item.category?.name_en ||
                item.category?.name ||
                item.category?.code ||
                (typeof item.category === "string" ? item.category : "Gold");
              const purName =
                item.purity?.name_en ||
                item.purity?.name ||
                item.purity?.code ||
                (typeof item.purity === "string" ? item.purity : "916");
              return `
            <div class="sticker">
              <div class="sticker-header">📦 ${
                item.pledge?.pledge_no || "N/A"
              }</div>
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
                <span class="sticker-value">${item.weight || 0}g</span>
              </div>
              <div class="sticker-row">
                <span class="sticker-label">Value:</span>
                <span class="sticker-value">RM ${parseFloat(
                  item.estimated_value || 0
                ).toLocaleString()}</span>
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
        })
      );
    } else {
      setIsPrinting(false);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please allow popups to print",
        })
      );
    }
  };

  // Print single item label
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
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; background: #fff; }
          .label { 
            width: 220px; 
            border: 1px solid #000; 
            padding: 8px; 
            background: #fff;
          }
          .label-header { font-size: 11px; font-weight: bold; margin-bottom: 5px; }
          .barcode-container { text-align: center; margin: 5px 0; }
          .barcode-container svg { max-width: 100%; height: 50px; }
          .barcode-text { font-size: 10px; text-align: center; font-family: monospace; }
          .label-footer { font-size: 9px; display: flex; justify-content: space-between; margin-top: 5px; border-top: 1px solid #eee; padding-top: 5px; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="label-header">${
            item.pledge?.pledge_no || "N/A"
          } | ${catName}</div>
          <div class="barcode-container">
            <svg id="single-barcode"></svg>
          </div>
          <div class="barcode-text">${item.barcode || "N/A"}</div>
          <div class="label-footer">
            <span>${item.weight || 0}g | ${purName}</span>
            <span>${(item.pledge?.customer?.name || "Customer").substring(
              0,
              15
            )}</span>
          </div>
        </div>
        <script>
          window.onload = function() {
            try {
              JsBarcode("#single-barcode", "${barcodeValue}", {
                format: "CODE128",
                width: 1.5,
                height: 40,
                displayValue: false,
                margin: 0
              });
            } catch(e) { console.log(e); }
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
    }
  };

  // Open location assignment modal
  const openLocationModal = (item) => {
    setEditingItem(item);
    setNewLocation(formatLocation(item) || "");
    setShowLocationModal(true);
  };

  // Save location via API
  const handleSaveLocation = async () => {
    if (!editingItem) return;

    setIsSaving(true);
    try {
      const response = await inventoryService.updateLocation(editingItem.id, {
        storage_location: newLocation,
        reason: "Manual assignment from inventory list",
      });

      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Location Updated",
            message: "Item location has been updated",
          })
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
          })
        );
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to update location",
        })
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
      "Weight (g)": item.weight || 0,
      "Value (RM)": item.estimated_value || 0,
      Location: formatLocation(item) || "Unassigned",
      Status: item.pledge?.status || "",
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
      })
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
      {/* Stats Cards */}
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

        <Card className="p-4">
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

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Overdue</p>
              <p className="text-xl font-bold text-red-600">{stats.overdue}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Scale className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Weight</p>
              <p className="text-xl font-bold text-amber-600">
                {parseFloat(stats.totalWeight || 0).toFixed(1)}g
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Value</p>
              <p className="text-xl font-bold text-purple-600">
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
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "all", label: "All Status" },
                { value: "active", label: "In Storage" },
                { value: "overdue", label: "Overdue" },
                { value: "expiring", label: "Expiring" },
                { value: "redeemed", label: "Released" },
              ]}
              className="w-32"
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
                  viewMode === "table" ? "bg-zinc-100" : "hover:bg-zinc-50"
                )}
                onClick={() => setViewMode("table")}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                className={cn(
                  "p-2 transition-colors",
                  viewMode === "grid" ? "bg-zinc-100" : "hover:bg-zinc-50"
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
                    : "hover:bg-zinc-50"
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
                Showing <strong>{filteredItems.length}</strong> items
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

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="p-4 text-left w-10">
                        <button onClick={toggleSelectAll}>
                          {selectAll ? (
                            <CheckSquare className="w-5 h-5 text-amber-500" />
                          ) : (
                            <Square className="w-5 h-5 text-zinc-400" />
                          )}
                        </button>
                      </th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">
                        Item
                      </th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">
                        Barcode
                      </th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">
                        Pledge
                      </th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">
                        Customer
                      </th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">
                        Weight
                      </th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">
                        Purity
                      </th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">
                        Location
                      </th>
                      <th className="p-4 text-left text-xs font-semibold text-zinc-500 uppercase">
                        Status
                      </th>
                      <th className="p-4 text-center text-xs font-semibold text-zinc-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredItems.length === 0 ? (
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
                      filteredItems.map((item) => {
                        const status = getStatusConfig(item.pledge?.status);
                        const StatusIcon = status.icon;
                        const isSelected = selectedItems.includes(item.id);
                        const location = formatLocation(item);

                        return (
                          <motion.tr
                            key={item.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={cn(
                              "hover:bg-zinc-50",
                              isSelected && "bg-amber-50"
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
                                    }`
                                  )
                                }
                                className="text-amber-600 hover:text-amber-700 font-medium"
                              >
                                {item.pledge?.pledge_no || "-"}
                              </button>
                            </td>
                            <td className="p-4">
                              <p className="text-zinc-800">
                                {item.pledge?.customer?.name || "Unknown"}
                              </p>
                            </td>
                            <td className="p-4">
                              <span className="font-medium">
                                {item.weight}g
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
                              <Badge variant={status.variant}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {status.label}
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
                                      }`
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
                                {item.pledge?.status !== "redeemed" && (
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
                Showing <strong>{filteredItems.length}</strong> items
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
              {filteredItems.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <Package className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                  <p className="text-zinc-500">No items found</p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const status = getStatusConfig(item.pledge?.status);
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
                          isSelected && "ring-2 ring-amber-500 bg-amber-50"
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
                          <Badge variant={status.variant} size="sm">
                            {status.label}
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
                          <p className="text-sm font-medium">{item.weight}g</p>
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
                                `/pledges/${item.pledge?.id || item.pledge_id}`
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

              <Input
                label="Storage Location"
                placeholder="e.g., Vault A → Box 1 → Slot 5"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
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
