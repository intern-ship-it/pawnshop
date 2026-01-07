/**
 * Rack / Locker Map - Fully API Integrated
 * No localStorage - All data from backend
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import storageService from "@/services/storageService";
import inventoryService from "@/services/inventoryService";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Badge, Modal } from "@/components/common";
import {
  Grid3X3,
  Package,
  Box,
  Search,
  Plus,
  RefreshCw,
  Scale,
  DollarSign,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Printer,
} from "lucide-react";

export default function RackMap({ embedded = false }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // State
  const [vaults, setVaults] = useState([]);
  const [selectedVault, setSelectedVault] = useState(null);
  const [boxes, setBoxes] = useState([]);
  const [selectedBox, setSelectedBox] = useState(null);
  const [slots, setSlots] = useState([]);
  const [boxSummaries, setBoxSummaries] = useState({});
  const [inventorySummary, setInventorySummary] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBoxes, setIsLoadingBoxes] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Modal State
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotItems, setSlotItems] = useState([]);
  const [showAddVaultModal, setShowAddVaultModal] = useState(false);
  const [showAddBoxModal, setShowAddBoxModal] = useState(false);
  const [newVaultName, setNewVaultName] = useState("");
  const [newVaultCode, setNewVaultCode] = useState("");
  const [newVaultDescription, setNewVaultDescription] = useState("");
  const [newBoxName, setNewBoxName] = useState("");
  const [newBoxCode, setNewBoxCode] = useState("");
  const [newBoxSlots, setNewBoxSlots] = useState(20);
  const [isSaving, setIsSaving] = useState(false);

  // Load initial data
  useEffect(() => {
    fetchVaults();
    fetchInventorySummary();
  }, []);

  // Load boxes when vault changes
  useEffect(() => {
    if (selectedVault) {
      fetchBoxes(selectedVault);
    }
  }, [selectedVault]);

  // Load slots and summary when box changes
  useEffect(() => {
    if (selectedBox) {
      fetchSlots(selectedBox);
      fetchBoxSummary(selectedBox);
    }
  }, [selectedBox]);

  // Fetch all vaults (racks)
  const fetchVaults = async () => {
    setIsLoading(true);
    try {
      const response = await storageService.getVaults();
      if (response.success && response.data) {
        setVaults(response.data);
        if (response.data.length > 0 && !selectedVault) {
          setSelectedVault(response.data[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching vaults:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to load vaults",
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch boxes for a vault
  const fetchBoxes = async (vaultId) => {
    setIsLoadingBoxes(true);
    setBoxes([]);
    setSelectedBox(null);
    setSlots([]);
    try {
      const response = await storageService.getBoxes(vaultId);
      if (response.success && response.data) {
        setBoxes(response.data);
        // Fetch summaries for all boxes
        response.data.forEach((box) => fetchBoxSummary(box.id));
        if (response.data.length > 0) {
          setSelectedBox(response.data[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching boxes:", error);
    } finally {
      setIsLoadingBoxes(false);
    }
  };

  // Fetch slots for a box
  const fetchSlots = async (boxId) => {
    setIsLoadingSlots(true);
    try {
      const response = await storageService.getSlots(boxId);
      if (response.success && response.data) {
        setSlots(response.data);
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // Fetch box summary (totals)
  const fetchBoxSummary = async (boxId) => {
    try {
      const response = await storageService.getBoxSummary(boxId);
      if (response.success && response.data) {
        setBoxSummaries((prev) => ({ ...prev, [boxId]: response.data }));
      }
    } catch (error) {
      console.error("Error fetching box summary:", error);
    }
  };

  // Fetch overall inventory summary
  const fetchInventorySummary = async () => {
    try {
      const response = await inventoryService.getSummary();
      if (response.success && response.data) {
        setInventorySummary(response.data);
      }
    } catch (error) {
      console.error("Error fetching inventory summary:", error);
    }
  };

  // Get current vault/box data
  const currentVault = vaults.find((v) => v.id === selectedVault);
  const currentBox = boxes.find((b) => b.id === selectedBox);
  const currentBoxSummary = boxSummaries[selectedBox] || {};

  // Filter slots by search
  const filteredSlots = useMemo(() => {
    if (!searchQuery) return slots;
    const query = searchQuery.toLowerCase();
    return slots.filter(
      (slot) =>
        slot.slot_number?.toString().includes(query) ||
        slot.pledge_item?.pledge?.pledge_no?.toLowerCase().includes(query) ||
        slot.pledge_item?.pledge?.customer?.name
          ?.toLowerCase()
          .includes(query) ||
        slot.pledge_item?.barcode?.toLowerCase().includes(query)
    );
  }, [slots, searchQuery]);

  // Overall stats
  const overallStats = useMemo(
    () => ({
      totalVaults: vaults.length,
      totalItems: inventorySummary.total_items || 0,
      totalWeight: inventorySummary.total_weight || 0,
      totalValue: inventorySummary.total_value || 0,
      overdueItems: inventorySummary.overdue_count || 0,
    }),
    [vaults, inventorySummary]
  );

  // Handle slot click
  const handleSlotClick = async (slot) => {
    setSelectedSlot(slot);
    setSlotItems([]);
    setShowSlotModal(true);

    if (slot.is_occupied && slot.pledge_item_id) {
      try {
        const response = await inventoryService.getById(slot.pledge_item_id);
        if (response.success && response.data) {
          setSlotItems([response.data]);
        }
      } catch (error) {
        console.error("Error fetching slot item:", error);
      }
    }
  };

  // Navigate to pledge
  const handleViewPledge = (pledgeId) => {
    setShowSlotModal(false);
    navigate(`/pledges/${pledgeId}`);
  };

  // Add new vault
  const handleAddVault = async () => {
    if (!newVaultName.trim()) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please enter a vault name",
        })
      );
      return;
    }
    if (!newVaultCode.trim()) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please enter a vault code",
        })
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await storageService.createVault({
        name: newVaultName,
        code: newVaultCode.toUpperCase().replace(/\s+/g, "-"),
        description: newVaultDescription,
      });

      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Vault Created",
            message: `${newVaultName} has been created`,
          })
        );
        setShowAddVaultModal(false);
        setNewVaultName("");
        setNewVaultCode("");
        setNewVaultDescription("");
        fetchVaults();
      } else {
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: response.message || "Failed to create vault",
          })
        );
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to create vault",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Add new box
  const handleAddBox = async () => {
    if (!newBoxName.trim() || !selectedVault) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please enter a box name",
        })
      );
      return;
    }
    if (!newBoxCode.trim()) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please enter a box number",
        })
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await storageService.createBox({
        vault_id: selectedVault,
        name: newBoxName,
        box_number: newBoxCode,
        total_slots: parseInt(newBoxSlots) || 20,
      });

      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Box Created",
            message: `${newBoxName} has been created`,
          })
        );
        setShowAddBoxModal(false);
        setNewBoxName("");
        setNewBoxCode("");
        setNewBoxSlots(20);
        fetchBoxes(selectedVault);
      } else {
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: response.message || "Failed to create box",
          })
        );
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to create box",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-MY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Print map
  const handlePrintMap = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rack Map - ${currentVault?.name || "All Vaults"}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { color: #666; font-size: 12px; }
          .stats { display: flex; justify-content: space-around; margin-bottom: 20px; padding: 10px; background: #f5f5f5; }
          .stat { text-align: center; }
          .stat-value { font-size: 20px; font-weight: bold; }
          .stat-label { font-size: 10px; color: #666; }
          .vault-section { margin-bottom: 30px; page-break-inside: avoid; }
          .vault-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; padding: 5px; background: #f59e0b; color: white; }
          .box-section { margin-bottom: 20px; border: 1px solid #ddd; padding: 10px; }
          .box-header { display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #eee; }
          .box-name { font-weight: bold; }
          .box-stats { font-size: 12px; color: #666; }
          .slots-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; }
          .slot { width: 100%; aspect-ratio: 1; border: 1px solid #ddd; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; }
          .slot.empty { background: #f9fafb; }
          .slot.occupied { background: #fef3c7; border-color: #f59e0b; }
          .slot.overdue { background: #fee2e2; border-color: #ef4444; }
          .slot-number { font-weight: bold; }
          .slot-pledge { font-size: 8px; color: #666; }
          .legend { display: flex; gap: 20px; margin-top: 20px; justify-content: center; }
          .legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; }
          .legend-box { width: 15px; height: 15px; border: 1px solid #ddd; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🗄️ Rack / Locker Map</h1>
          <p>Printed on: ${new Date().toLocaleString("en-MY")}</p>
        </div>
        
        <div class="stats">
          <div class="stat">
            <div class="stat-value">${overallStats.totalVaults}</div>
            <div class="stat-label">Total Vaults</div>
          </div>
          <div class="stat">
            <div class="stat-value">${overallStats.totalItems}</div>
            <div class="stat-label">Total Items</div>
          </div>
          <div class="stat">
            <div class="stat-value">${overallStats.totalWeight}g</div>
            <div class="stat-label">Total Weight</div>
          </div>
          <div class="stat">
            <div class="stat-value">RM ${overallStats.totalValue.toLocaleString()}</div>
            <div class="stat-label">Total Value</div>
          </div>
          <div class="stat">
            <div class="stat-value" style="color: #ef4444;">${
              overallStats.overdueItems
            }</div>
            <div class="stat-label">Overdue</div>
          </div>
        </div>

        ${
          currentVault
            ? `
          <div class="vault-section">
            <div class="vault-title">${currentVault.name} ${
                currentVault.description ? `- ${currentVault.description}` : ""
              }</div>
            ${boxes
              .map((box) => {
                const summary = boxSummaries[box.id] || {};
                return `
                <div class="box-section">
                  <div class="box-header">
                    <span class="box-name">${box.name}</span>
                    <span class="box-stats">${
                      summary.item_count || 0
                    } items | ${(summary.total_weight || 0).toFixed(
                  1
                )}g | RM ${(summary.total_value || 0).toLocaleString()}</span>
                  </div>
                  <div class="slots-grid">
                    ${(selectedBox === box.id ? slots : [])
                      .map(
                        (slot) => `
                      <div class="slot ${
                        slot.is_occupied
                          ? slot.pledge_item?.pledge?.status === "overdue"
                            ? "overdue"
                            : "occupied"
                          : "empty"
                      }">
                        <span class="slot-number">${String(
                          slot.slot_number
                        ).padStart(2, "0")}</span>
                        ${
                          slot.is_occupied && slot.pledge_item
                            ? `<span class="slot-pledge">${
                                slot.pledge_item.pledge?.pledge_no || ""
                              }</span>`
                            : ""
                        }
                      </div>
                    `
                      )
                      .join("")}
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        `
            : '<p style="text-align: center; color: #999;">No vault selected</p>'
        }

        <div class="legend">
          <div class="legend-item"><div class="legend-box" style="background: #f9fafb;"></div> Empty</div>
          <div class="legend-item"><div class="legend-box" style="background: #fef3c7;"></div> Occupied</div>
          <div class="legend-item"><div class="legend-box" style="background: #fee2e2;"></div> Overdue</div>
        </div>

        <div class="footer">
          <p>PawnSys - Pawn Shop Management System</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } else {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please allow popups to print",
        })
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading rack map...</p>
        </div>
      </div>
    );
  }

  const content = (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Grid3X3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Vaults</p>
              <p className="text-xl font-bold text-zinc-800">
                {overallStats.totalVaults}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Items</p>
              <p className="text-xl font-bold text-amber-600">
                {overallStats.totalItems}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Scale className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Weight</p>
              <p className="text-xl font-bold text-emerald-600">
                {overallStats.totalWeight}g
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
                {formatCurrency(overallStats.totalValue)}
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
              <p className="text-xs text-zinc-500">Overdue Items</p>
              <p className="text-xl font-bold text-red-600">
                {overallStats.overdueItems}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Vaults */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-800">Vaults / Racks</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddVaultModal(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {vaults.length === 0 ? (
              <div className="text-center py-8">
                <Grid3X3 className="w-12 h-12 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No vaults configured</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowAddVaultModal(true)}
                >
                  Add Vault
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {vaults.map((vault) => (
                  <button
                    key={vault.id}
                    onClick={() => setSelectedVault(vault.id)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-all",
                      selectedVault === vault.id
                        ? "bg-amber-100 border-2 border-amber-300"
                        : "bg-zinc-50 hover:bg-zinc-100 border-2 border-transparent"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-zinc-800">
                        {vault.name}
                      </span>
                      <Badge variant="default" size="sm">
                        {vault.total_boxes || 0} boxes
                      </Badge>
                    </div>
                    {vault.description && (
                      <p className="text-xs text-zinc-500 truncate">
                        {vault.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Boxes */}
          {selectedVault && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-zinc-800">Boxes</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddBoxModal(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {isLoadingBoxes ? (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 text-amber-500 animate-spin mx-auto" />
                </div>
              ) : boxes.length === 0 ? (
                <div className="text-center py-4">
                  <Box className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">No boxes</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {boxes.map((box) => {
                    const summary = boxSummaries[box.id] || {};
                    return (
                      <button
                        key={box.id}
                        onClick={() => setSelectedBox(box.id)}
                        className={cn(
                          "w-full p-3 rounded-lg text-left transition-all",
                          selectedBox === box.id
                            ? "bg-amber-100 border-2 border-amber-300"
                            : "bg-zinc-50 hover:bg-zinc-100 border-2 border-transparent"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-zinc-800">
                            {box.name}
                          </span>
                          <Badge
                            variant={
                              summary.overdue_count > 0 ? "error" : "default"
                            }
                            size="sm"
                          >
                            {summary.item_count || 0}
                          </Badge>
                        </div>

                        {/* Box Totals */}
                        <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                          <div className="flex items-center gap-1 text-zinc-500">
                            <Scale className="w-3 h-3" />
                            <span>
                              {(summary.total_weight || 0).toFixed(1)}g
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-zinc-500">
                            <DollarSign className="w-3 h-3" />
                            <span>
                              {formatCurrency(summary.total_value || 0)}
                            </span>
                          </div>
                        </div>

                        {/* Occupancy Bar */}
                        <div className="mt-2 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              summary.overdue_count > 0
                                ? "bg-red-500"
                                : "bg-amber-500"
                            )}
                            style={{
                              width: `${Math.min(
                                ((box.occupied_slots || 0) /
                                  (box.total_slots || 1)) *
                                  100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* Legend */}
          <Card className="p-4">
            <p className="text-xs font-medium text-zinc-500 mb-3">LEGEND</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-zinc-100 border border-zinc-300" />
                <span className="text-zinc-600">Empty Slot</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-amber-500" />
                <span className="text-zinc-600">Occupied</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500" />
                <span className="text-zinc-600">Overdue Item</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Slot Grid */}
        <div className="lg:col-span-3">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-zinc-800">
                  {currentVault?.name || "Select a Vault"}{" "}
                  {currentBox ? `→ ${currentBox.name}` : ""}
                </h3>
                {currentBox && (
                  <p className="text-sm text-zinc-500">
                    {currentBoxSummary.item_count || 0} items •{" "}
                    {(currentBoxSummary.total_weight || 0).toFixed(1)}g •{" "}
                    {formatCurrency(currentBoxSummary.total_value || 0)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search slot or pledge..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={Search}
                  className="w-48"
                />
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={RefreshCw}
                  onClick={() => selectedBox && fetchSlots(selectedBox)}
                >
                  Refresh
                </Button>
              </div>
            </div>

            {isLoadingSlots ? (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-4" />
                <p className="text-zinc-500">Loading slots...</p>
              </div>
            ) : currentBox && filteredSlots.length > 0 ? (
              <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {filteredSlots.map((slot) => {
                  const isOccupied = slot.is_occupied;
                  const hasOverdue =
                    slot.pledge_item?.pledge?.status === "overdue";

                  return (
                    <motion.button
                      key={slot.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSlotClick(slot)}
                      className={cn(
                        "aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-1 transition-all relative",
                        isOccupied
                          ? hasOverdue
                            ? "bg-red-100 border-red-300 text-red-700"
                            : "bg-amber-100 border-amber-300 text-amber-700"
                          : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:border-zinc-300"
                      )}
                    >
                      <span className="text-xs font-mono font-medium">
                        {String(slot.slot_number).padStart(2, "0")}
                      </span>
                      {isOccupied && slot.pledge_item && (
                        <span className="text-[10px] mt-0.5 truncate max-w-full px-1">
                          {slot.pledge_item.pledge?.pledge_no || "Item"}
                        </span>
                      )}
                      {hasOverdue && (
                        <AlertTriangle className="w-3 h-3 absolute top-1 right-1 text-red-500" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            ) : currentBox ? (
              <div className="text-center py-12">
                <Grid3X3 className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                <p className="text-zinc-500">No slots in this box</p>
              </div>
            ) : (
              <div className="text-center py-12">
                <Grid3X3 className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                <p className="text-zinc-500">
                  Select a vault and box to view slots
                </p>
              </div>
            )}

            {currentBox && slots.length > 0 && (
              <div className="mt-6 pt-4 border-t border-zinc-200 flex items-center gap-4 text-sm">
                <span className="text-zinc-500">
                  <strong className="text-zinc-800">
                    {slots.filter((s) => s.is_occupied).length}
                  </strong>{" "}
                  occupied
                </span>
                <span className="text-zinc-500">
                  <strong className="text-zinc-800">
                    {slots.filter((s) => !s.is_occupied).length}
                  </strong>{" "}
                  empty
                </span>
                <span className="text-zinc-500">
                  <strong className="text-red-600">
                    {
                      slots.filter(
                        (s) => s.pledge_item?.pledge?.status === "overdue"
                      ).length
                    }
                  </strong>{" "}
                  overdue
                </span>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Slot Detail Modal */}
      <Modal
        isOpen={showSlotModal}
        onClose={() => setShowSlotModal(false)}
        title={`Slot ${
          selectedSlot?.slot_number
            ? String(selectedSlot.slot_number).padStart(2, "0")
            : ""
        }`}
        size="lg"
      >
        <div className="p-5">
          {selectedSlot?.is_occupied && slotItems.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <Package className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-amber-600">
                    {slotItems.length}
                  </p>
                  <p className="text-xs text-amber-700">Items</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <Scale className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-emerald-600">
                    {slotItems
                      .reduce(
                        (sum, item) => sum + (parseFloat(item.weight) || 0),
                        0
                      )
                      .toFixed(2)}
                    g
                  </p>
                  <p className="text-xs text-emerald-700">Weight</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <DollarSign className="w-6 h-6 text-purple-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-purple-600">
                    {formatCurrency(
                      slotItems.reduce(
                        (sum, item) =>
                          sum + (parseFloat(item.estimated_value) || 0),
                        0
                      )
                    )}
                  </p>
                  <p className="text-xs text-purple-700">Value</p>
                </div>
              </div>

              <h4 className="font-semibold text-zinc-800 mb-3">
                Items in this Slot
              </h4>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {slotItems.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "p-4 rounded-xl border",
                      item.pledge?.status === "overdue"
                        ? "bg-red-50 border-red-200"
                        : "bg-zinc-50 border-zinc-200"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-800">
                            {item.pledge?.pledge_no || "N/A"}
                          </span>
                          <Badge
                            variant={
                              item.pledge?.status === "overdue"
                                ? "error"
                                : "success"
                            }
                          >
                            {item.pledge?.status || "active"}
                          </Badge>
                        </div>
                        <p className="text-sm text-zinc-500">
                          {item.pledge?.customer?.name || "Unknown"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={ExternalLink}
                        onClick={() =>
                          handleViewPledge(item.pledge?.id || item.pledge_id)
                        }
                      >
                        View Pledge
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-zinc-500">Category</p>
                        <p className="font-medium">
                          {item.category?.name || item.category || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Purity</p>
                        <p className="font-medium">
                          {item.purity?.name || item.purity || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Weight</p>
                        <p className="font-medium">{item.weight}g</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Value</p>
                        <p className="font-medium">
                          {formatCurrency(item.estimated_value || 0)}
                        </p>
                      </div>
                    </div>
                    {item.barcode && (
                      <div className="mt-2 pt-2 border-t border-zinc-200">
                        <p className="text-xs text-zinc-500">Barcode</p>
                        <code className="text-sm font-mono">
                          {item.barcode}
                        </code>
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                      <Clock className="w-3 h-3" />
                      Due: {formatDate(item.pledge?.due_date)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Box className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <p className="text-zinc-500">This slot is empty</p>
              <p className="text-sm text-zinc-400 mt-1">
                Assign items during pledge creation
              </p>
            </div>
          )}
          <Button
            variant="outline"
            fullWidth
            className="mt-6"
            onClick={() => setShowSlotModal(false)}
          >
            Close
          </Button>
        </div>
      </Modal>

      {/* Add Vault Modal */}
      <Modal
        isOpen={showAddVaultModal}
        onClose={() => setShowAddVaultModal(false)}
        title="Add New Vault / Rack"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Vault Name"
            placeholder="e.g., Safe Room, Vault A"
            value={newVaultName}
            onChange={(e) => setNewVaultName(e.target.value)}
          />
          <Input
            label="Vault Code"
            placeholder="e.g., SAFE-01, VAULT-A"
            value={newVaultCode}
            onChange={(e) => setNewVaultCode(e.target.value)}
            helperText="Unique identifier code (required)"
          />
          <Input
            label="Description (Optional)"
            placeholder="e.g., High value items"
            value={newVaultDescription}
            onChange={(e) => setNewVaultDescription(e.target.value)}
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowAddVaultModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              fullWidth
              leftIcon={Plus}
              onClick={handleAddVault}
              loading={isSaving}
            >
              Add Vault
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Box Modal */}
      <Modal
        isOpen={showAddBoxModal}
        onClose={() => setShowAddBoxModal(false)}
        title="Add New Box"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Box Name"
            placeholder="e.g., Box 01, Drawer A"
            value={newBoxName}
            onChange={(e) => setNewBoxName(e.target.value)}
          />
          <Input
            label="Box Number"
            placeholder="e.g., 1, 2, 3 or B01"
            value={newBoxCode}
            onChange={(e) => setNewBoxCode(e.target.value)}
            helperText="Unique box number (required)"
          />
          <Input
            label="Number of Slots"
            type="number"
            min={1}
            max={100}
            value={newBoxSlots}
            onChange={(e) => setNewBoxSlots(e.target.value)}
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowAddBoxModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              fullWidth
              leftIcon={Plus}
              onClick={handleAddBox}
              loading={isSaving}
            >
              Add Box
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );

  if (embedded) return content;

  return (
    <PageWrapper
      title="Rack / Locker Map"
      subtitle="Visual storage location management"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={Printer} onClick={handlePrintMap}>
            Print Map
          </Button>
          <Button
            variant="accent"
            leftIcon={Plus}
            onClick={() => setShowAddVaultModal(true)}
          >
            Add Vault
          </Button>
        </div>
      }
    >
      {content}
    </PageWrapper>
  );
}
