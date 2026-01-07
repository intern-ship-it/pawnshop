/**
 * Stock Reconciliation - Full Inventory List + Schedule + Barcode Scan + Pledge Details
 * API Integrated Version
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import reconciliationService from "@/services/reconciliationService";
import { apiGet } from "@/services/api";
import { formatCurrency } from "@/utils/formatters";
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from "@/utils/localStorage";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select, Badge, Modal } from "@/components/common";
import {
  QrCode,
  CheckCircle,
  XCircle,
  ClipboardCheck,
  AlertTriangle,
  Package,
  Search,
  Play,
  Pause,
  RotateCcw,
  Printer,
  Download,
  Clock,
  User,
  Calendar,
  Barcode,
  ScanLine,
  MapPin,
  FileText,
  Check,
  X,
  Info,
  Zap,
  Eye,
  ChevronDown,
  ChevronUp,
  Filter,
  ListChecks,
  CalendarClock,
  Loader2,
} from "lucide-react";

export default function StockReconciliation() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  // API State
  const [currentReconciliation, setCurrentReconciliation] = useState(null);
  const [expectedItems, setExpectedItems] = useState([]);
  const [scannedItems, setScannedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // UI State
  const [scanInput, setScanInput] = useState("");
  const [reconciliationType, setReconciliationType] = useState("adhoc");
  const [reconciliationStartTime, setReconciliationStartTime] = useState(null);
  const [lastScannedItem, setLastScannedItem] = useState(null);

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showInventoryList, setShowInventoryList] = useState(true);

  // Modal State
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [showItemDetailModal, setShowItemDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [reconciliationNote, setReconciliationNote] = useState("");

  // Past reconciliations
  const [pastReconciliations, setPastReconciliations] = useState([]);

  // Check for in-progress reconciliation and load data
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      // Fetch past reconciliations
      const reconResponse = await reconciliationService.getReconciliations({
        per_page: 10,
      });
      if (reconResponse.success) {
        setPastReconciliations(reconResponse.data?.data || []);

        // Check for in-progress reconciliation
        const inProgress = reconResponse.data?.data?.find(
          (r) => r.status === "in_progress"
        );
        if (inProgress) {
          setCurrentReconciliation(inProgress);
          setReconciliationStartTime(new Date(inProgress.started_at));
          // Fetch scanned items for this reconciliation
          const detailResponse = await reconciliationService.getReconciliation(
            inProgress.id
          );
          if (detailResponse.success && detailResponse.data?.items) {
            setScannedItems(detailResponse.data.items);
          }
        }
      }

      // Fetch expected items (stored inventory)
      await fetchExpectedItems();
    } catch (error) {
      console.error("Error fetching initial data:", error);
      // Fallback to localStorage if API fails
      loadFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExpectedItems = async () => {
    try {
      // Use pledges API to get active/overdue pledges with items
      const response = await apiGet(
        "/pledges?status=active,overdue&per_page=500"
      );
      if (response.success && response.data?.data) {
        const items = [];

        response.data.data.forEach((pledge) => {
          const dueDate = pledge.due_date ? new Date(pledge.due_date) : null;
          const isOverdue = dueDate && dueDate < new Date();

          (pledge.items || []).forEach((item, idx) => {
            items.push({
              id: item.id || `${pledge.id}-${idx + 1}`,
              barcode: item.barcode || `PLG-${pledge.pledge_no}-${idx + 1}`,
              pledge_id: pledge.id,
              pledge_no: pledge.pledge_no,
              category: item.category?.name || item.category || "Unknown",
              description:
                item.description ||
                `${item.category?.name || ""} - ${item.purity?.name || ""}`,
              weight: item.weight,
              purity: item.purity?.name || item.purity || "",
              storage_location:
                item.storage_location ||
                pledge.storage_location ||
                "Not assigned",
              customer_name: pledge.customer?.name || "Unknown",
              customer_ic: pledge.customer?.ic_number || "",
              due_date: pledge.due_date,
              status: isOverdue ? "overdue" : "active",
              loan_amount: pledge.loan_amount,
            });
          });
        });

        setExpectedItems(items);
        return;
      }
    } catch (error) {
      console.error("Error fetching expected items:", error);
    }

    // Fallback to localStorage
    loadFromLocalStorage();
  };

  const loadFromLocalStorage = () => {
    const pledges = getStorageItem(STORAGE_KEYS.PLEDGES, []);
    const items = [];

    pledges.forEach((pledge) => {
      if (pledge.status === "active" || pledge.status === "overdue") {
        const dueDate = pledge.dueDate ? new Date(pledge.dueDate) : null;
        const isOverdue = dueDate && dueDate < new Date();

        (pledge.items || []).forEach((item, idx) => {
          items.push({
            id: item.id || `${pledge.id}-${idx + 1}`,
            barcode: item.barcode || `${pledge.id}-${idx + 1}`,
            pledge_id: pledge.id,
            pledge_no: pledge.pledgeNo || pledge.id,
            category: item.category,
            description:
              item.description || `${item.category} - ${item.purity}`,
            weight: item.weight,
            purity: item.purity,
            storage_location: pledge.rackLocation || "Not assigned",
            customer_name: pledge.customerName,
            customer_ic: pledge.customerIC,
            due_date: pledge.dueDate,
            status: isOverdue ? "overdue" : "active",
            loan_amount: pledge.loanAmount,
          });
        });
      }
    });

    setExpectedItems(items);
  };

  // Calculate stats
  const stats = useMemo(() => {
    if (currentReconciliation) {
      return {
        expected: currentReconciliation.expected_items || expectedItems.length,
        scanned: currentReconciliation.scanned_items || scannedItems.length,
        matched:
          currentReconciliation.matched_items ||
          scannedItems.filter((s) => s.status === "matched").length,
        missing:
          currentReconciliation.missing_items ||
          expectedItems.length -
            scannedItems.filter((s) => s.status === "matched").length,
        unexpected:
          currentReconciliation.unexpected_items ||
          scannedItems.filter((s) => s.status === "unexpected").length,
        progress:
          expectedItems.length > 0
            ? Math.round(
                (scannedItems.filter((s) => s.status === "matched").length /
                  expectedItems.length) *
                  100
              )
            : 0,
      };
    }

    const scannedBarcodes = new Set(scannedItems.map((s) => s.barcode));
    const expectedBarcodes = new Set(expectedItems.map((e) => e.barcode));

    const matched = scannedItems.filter((s) => expectedBarcodes.has(s.barcode));
    const unexpected = scannedItems.filter(
      (s) => !expectedBarcodes.has(s.barcode)
    );
    const missing = expectedItems.filter(
      (e) => !scannedBarcodes.has(e.barcode)
    );

    return {
      expected: expectedItems.length,
      scanned: scannedItems.length,
      matched: matched.length,
      unexpected: unexpected.length,
      missing: missing.length,
      matchedItems: matched,
      unexpectedItems: unexpected,
      missingItems: missing,
      progress:
        expectedItems.length > 0
          ? Math.round((matched.length / expectedItems.length) * 100)
          : 0,
    };
  }, [scannedItems, expectedItems, currentReconciliation]);

  // Filter expected items for display
  const filteredExpectedItems = useMemo(() => {
    let items = [...expectedItems];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.barcode?.toLowerCase().includes(query) ||
          item.pledge_no?.toLowerCase().includes(query) ||
          item.customer_name?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query) ||
          item.storage_location?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      items = items.filter((item) => item.status === statusFilter);
    }

    return items;
  }, [expectedItems, searchQuery, statusFilter]);

  // Get missing items (not yet scanned)
  const missingItems = useMemo(() => {
    const scannedBarcodes = new Set(scannedItems.map((s) => s.barcode));
    return expectedItems.filter((e) => !scannedBarcodes.has(e.barcode));
  }, [expectedItems, scannedItems]);

  // Check if item is scanned
  const isItemScanned = (barcode) => {
    return scannedItems.some((s) => s.barcode === barcode);
  };

  // Start reconciliation
  const handleStart = async () => {
    setIsStarting(true);
    try {
      const response = await reconciliationService.start(
        reconciliationType,
        ""
      );

      if (response.success && response.data) {
        setCurrentReconciliation(response.data);
        setReconciliationStartTime(new Date());
        setScannedItems([]);
        setTimeout(() => inputRef.current?.focus(), 100);
        dispatch(
          addToast({
            type: "info",
            title: "Reconciliation Started",
            message: `Scanning ${
              response.data.expected_items || expectedItems.length
            } items`,
          })
        );
      } else {
        throw new Error(response.message || "Failed to start reconciliation");
      }
    } catch (error) {
      console.error("Error starting reconciliation:", error);
      // Fallback to local mode
      setCurrentReconciliation({
        id: `LOCAL-${Date.now()}`,
        status: "in_progress",
      });
      setReconciliationStartTime(new Date());
      setScannedItems([]);
      setTimeout(() => inputRef.current?.focus(), 100);
      dispatch(
        addToast({
          type: "warning",
          title: "Offline Mode",
          message: "Reconciliation started in offline mode",
        })
      );
    } finally {
      setIsStarting(false);
    }
  };

  // Handle scan
  const handleScan = async (e) => {
    e?.preventDefault();
    const barcode = scanInput.trim().toUpperCase();

    if (!barcode) return;

    // Check if already scanned
    if (scannedItems.find((s) => s.barcode === barcode)) {
      dispatch(
        addToast({
          type: "warning",
          title: "Duplicate",
          message: "Item already scanned",
        })
      );
      setScanInput("");
      return;
    }

    setIsScanning(true);
    try {
      // Try API scan
      if (
        currentReconciliation?.id &&
        !String(currentReconciliation.id).startsWith("LOCAL")
      ) {
        const response = await reconciliationService.scan(
          currentReconciliation.id,
          barcode
        );

        if (response.success) {
          const scanResult = response.data;
          const newItem = {
            id: Date.now(),
            barcode,
            status: scanResult.status,
            timestamp: new Date().toISOString(),
            pledge_item: scanResult.item,
            message: scanResult.message,
          };

          setScannedItems((prev) => [newItem, ...prev]);
          setLastScannedItem(newItem);
          setScanInput("");

          // Update reconciliation counts
          if (scanResult.status === "matched") {
            setCurrentReconciliation((prev) => ({
              ...prev,
              scanned_items: (prev.scanned_items || 0) + 1,
              matched_items: (prev.matched_items || 0) + 1,
            }));
            dispatch(
              addToast({ type: "success", title: "Matched", message: barcode })
            );
          } else {
            setCurrentReconciliation((prev) => ({
              ...prev,
              scanned_items: (prev.scanned_items || 0) + 1,
              unexpected_items: (prev.unexpected_items || 0) + 1,
            }));
            dispatch(
              addToast({
                type: "error",
                title: "Unexpected Item",
                message: `${barcode} not in expected list`,
              })
            );
          }
          return;
        }
      }

      // Fallback to local matching
      const expectedItem = expectedItems.find((e) => e.barcode === barcode);
      const newItem = {
        id: Date.now(),
        barcode,
        timestamp: new Date().toISOString(),
        status: expectedItem ? "matched" : "unexpected",
        pledge_item: expectedItem || null,
      };

      setScannedItems((prev) => [newItem, ...prev]);
      setLastScannedItem(newItem);
      setScanInput("");

      if (expectedItem) {
        dispatch(
          addToast({ type: "success", title: "Matched", message: barcode })
        );
      } else {
        dispatch(
          addToast({
            type: "error",
            title: "Unexpected Item",
            message: `${barcode} not in expected list`,
          })
        );
      }
    } catch (error) {
      console.error("Error scanning:", error);
      dispatch(
        addToast({ type: "error", title: "Scan Error", message: error.message })
      );
    } finally {
      setIsScanning(false);
      inputRef.current?.focus();
    }
  };

  // Simulate scan (for demo)
  const handleSimulateScan = () => {
    const unscanned = expectedItems.filter(
      (e) => !scannedItems.find((s) => s.barcode === e.barcode)
    );
    if (unscanned.length > 0) {
      const randomItem =
        unscanned[Math.floor(Math.random() * unscanned.length)];
      setScanInput(randomItem.barcode);
      setTimeout(() => handleScan(), 100);
    } else {
      dispatch(
        addToast({
          type: "info",
          title: "Complete",
          message: "All items have been scanned",
        })
      );
    }
  };

  // Reset / Cancel reconciliation
  const handleReset = async () => {
    if (
      currentReconciliation?.id &&
      !String(currentReconciliation.id).startsWith("LOCAL")
    ) {
      try {
        await reconciliationService.cancel(
          currentReconciliation.id,
          "Cancelled by user"
        );
      } catch (error) {
        console.error("Error cancelling:", error);
      }
    }

    setCurrentReconciliation(null);
    setScannedItems([]);
    setReconciliationStartTime(null);
    setScanInput("");
    setLastScannedItem(null);
  };

  // Complete reconciliation
  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      if (
        currentReconciliation?.id &&
        !String(currentReconciliation.id).startsWith("LOCAL")
      ) {
        const response = await reconciliationService.complete(
          currentReconciliation.id,
          reconciliationNote
        );

        if (response.success) {
          dispatch(
            addToast({
              type: "success",
              title: "Reconciliation Complete",
              message:
                stats.missing === 0 && stats.unexpected === 0
                  ? "All items verified successfully"
                  : `Completed with ${
                      stats.missing + stats.unexpected
                    } discrepancies`,
            })
          );

          // Refresh data
          fetchInitialData();
        } else {
          throw new Error(response.message || "Failed to complete");
        }
      } else {
        // Save to localStorage for offline mode
        const reconciliations = getStorageItem("reconciliations", []);
        const newRecon = {
          id: `RECON-${Date.now()}`,
          date: new Date().toISOString(),
          startTime: reconciliationStartTime?.toISOString(),
          endTime: new Date().toISOString(),
          expected: stats.expected,
          scanned: stats.scanned,
          matched: stats.matched,
          missing: stats.missing,
          unexpected: stats.unexpected,
          status:
            stats.missing > 0 || stats.unexpected > 0
              ? "discrepancy"
              : "complete",
          note: reconciliationNote,
          performedBy: "User",
        };
        setStorageItem("reconciliations", [...reconciliations, newRecon]);

        dispatch(
          addToast({
            type: "success",
            title: "Reconciliation Complete",
            message: "Saved locally",
          })
        );
      }

      setShowCompleteModal(false);
      handleReset();
    } catch (error) {
      console.error("Error completing:", error);
      dispatch(
        addToast({ type: "error", title: "Error", message: error.message })
      );
    } finally {
      setIsCompleting(false);
    }
  };

  // View item details
  const handleViewItem = (item) => {
    setSelectedItem(item);
    setShowItemDetailModal(true);
  };

  // Navigate to pledge
  const handleViewPledge = (pledgeId) => {
    navigate(`/pledges/${pledgeId}`);
  };

  // Format elapsed time
  const getElapsedTime = () => {
    if (!reconciliationStartTime) return "00:00";
    const elapsed = Math.floor((new Date() - reconciliationStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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

  const isReconciling = !!currentReconciliation;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading reconciliation data...</p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper
      title="Stock Reconciliation"
      subtitle="Verify physical inventory against system records"
      actions={
        <div className="flex items-center gap-2">
          {!isReconciling ? (
            <>
              <Select
                value={reconciliationType}
                onChange={(e) => setReconciliationType(e.target.value)}
                options={[
                  { value: "adhoc", label: "Ad-hoc" },
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                ]}
                className="w-32"
              />
              <Button
                variant="accent"
                leftIcon={Play}
                onClick={handleStart}
                loading={isStarting}
              >
                Start Reconciliation
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                leftIcon={RotateCcw}
                onClick={handleReset}
              >
                Cancel
              </Button>
              <Button
                variant="accent"
                leftIcon={CheckCircle}
                onClick={() => setShowCompleteModal(true)}
                disabled={stats.scanned === 0}
              >
                Complete
              </Button>
            </>
          )}
        </div>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Expected</p>
              <p className="text-xl font-bold text-zinc-800">
                {stats.expected}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Scanned</p>
              <p className="text-xl font-bold text-amber-600">
                {stats.scanned}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Matched</p>
              <p className="text-xl font-bold text-emerald-600">
                {stats.matched}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Missing</p>
              <p className="text-xl font-bold text-red-600">{stats.missing}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Unexpected</p>
              <p className="text-xl font-bold text-orange-600">
                {stats.unexpected}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner Section */}
        <div className="space-y-6">
          {/* Scanner Card */}
          <Card className="p-4">
            <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-amber-500" />
              Barcode Scanner
            </h3>

            {isReconciling ? (
              <form onSubmit={handleScan}>
                <Input
                  ref={inputRef}
                  placeholder="Scan barcode..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                  leftIcon={Barcode}
                  autoFocus
                  disabled={isScanning}
                />
                <div className="flex gap-2 mt-3">
                  <Button
                    type="submit"
                    variant="accent"
                    fullWidth
                    leftIcon={ScanLine}
                    loading={isScanning}
                  >
                    Verify
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSimulateScan}
                    title="Demo: Scan random item"
                  >
                    <Zap className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            ) : (
              <div className="text-center py-6">
                <QrCode className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">
                  Click "Start Reconciliation" to begin
                </p>
              </div>
            )}

            {/* Timer */}
            {isReconciling && (
              <div className="mt-4 pt-4 border-t border-zinc-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Elapsed
                  </span>
                  <span className="font-mono font-bold text-zinc-800">
                    {getElapsedTime()}
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* Last Scanned Item */}
          {lastScannedItem && (
            <Card
              className={cn(
                "p-4 border-2",
                lastScannedItem.status === "matched"
                  ? "bg-emerald-50 border-emerald-300"
                  : "bg-orange-50 border-orange-300"
              )}
            >
              <h3 className="font-semibold text-zinc-800 mb-3 flex items-center gap-2">
                {lastScannedItem.status === "matched" ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                )}
                Last Scanned
              </h3>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-500">Barcode</span>
                  <code className="font-mono text-sm font-bold">
                    {lastScannedItem.barcode}
                  </code>
                </div>
                {lastScannedItem.pledge_item && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-zinc-500">Pledge No</span>
                      <span className="text-sm font-medium">
                        {lastScannedItem.pledge_item.pledge_no}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-zinc-500">Customer</span>
                      <span className="text-sm">
                        {lastScannedItem.pledge_item.customer_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-zinc-500">Item</span>
                      <span className="text-sm">
                        {lastScannedItem.pledge_item.category}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-zinc-500">Weight</span>
                      <span className="text-sm">
                        {lastScannedItem.pledge_item.weight}g
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-zinc-500">Location</span>
                      <span className="text-sm">
                        {lastScannedItem.pledge_item.storage_location}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-zinc-500">Due Date</span>
                      <Badge
                        variant={
                          lastScannedItem.pledge_item.status === "overdue"
                            ? "error"
                            : "info"
                        }
                      >
                        {formatDate(lastScannedItem.pledge_item.due_date)}
                      </Badge>
                    </div>
                    {lastScannedItem.pledge_item.pledge_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        fullWidth
                        className="mt-2"
                        leftIcon={Eye}
                        onClick={() =>
                          handleViewPledge(
                            lastScannedItem.pledge_item.pledge_id
                          )
                        }
                      >
                        View Pledge Details
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Progress */}
          {isReconciling && (
            <Card className="p-4">
              <h3 className="font-semibold text-zinc-800 mb-4">Progress</h3>
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-500">Verified</span>
                  <span className="font-medium">{stats.progress}%</span>
                </div>
                <div className="w-full h-3 bg-zinc-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                {stats.matched} of {stats.expected} items verified
              </p>
            </Card>
          )}

          {/* Missing Items Alert */}
          {isReconciling && stats.missing > 0 && (
            <Card className="p-4 bg-red-50 border-red-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">
                    {stats.missing} Missing Items
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    Some items haven't been scanned yet.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowDiscrepancyModal(true)}
                  >
                    View Missing Items
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Full Inventory List */}
          <Card>
            <div className="p-4 border-b border-zinc-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-amber-500" />
                  Inventory Items for Reconciliation
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInventoryList(!showInventoryList)}
                >
                  {showInventoryList ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {showInventoryList && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      placeholder="Search barcode, pledge no, customer..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      leftIcon={Search}
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    options={[
                      { value: "all", label: "All Status" },
                      { value: "active", label: "Active" },
                      { value: "overdue", label: "Overdue" },
                    ]}
                    className="w-32"
                  />
                </div>
              )}
            </div>

            {showInventoryList && (
              <div className="max-h-[400px] overflow-y-auto">
                {filteredExpectedItems.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
                    <p className="text-zinc-500">No items found</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-zinc-50 sticky top-0">
                      <tr>
                        <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                          Barcode
                        </th>
                        <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                          Pledge
                        </th>
                        <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                          Customer
                        </th>
                        <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                          Item
                        </th>
                        <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                          Location
                        </th>
                        <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                          Due Date
                        </th>
                        <th className="text-center p-3 text-xs font-semibold text-zinc-500 uppercase">
                          Status
                        </th>
                        <th className="text-center p-3 text-xs font-semibold text-zinc-500 uppercase">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredExpectedItems.map((item) => {
                        const scanned = isItemScanned(item.barcode);
                        return (
                          <tr
                            key={item.id || item.barcode}
                            className={cn(
                              "hover:bg-zinc-50 transition-colors",
                              scanned && "bg-emerald-50"
                            )}
                          >
                            <td className="p-3">
                              <code className="font-mono text-sm">
                                {item.barcode}
                              </code>
                            </td>
                            <td className="p-3 text-sm font-medium">
                              {item.pledge_no}
                            </td>
                            <td className="p-3">
                              <div>
                                <p className="text-sm">{item.customer_name}</p>
                                <p className="text-xs text-zinc-400">
                                  {item.customer_ic}
                                </p>
                              </div>
                            </td>
                            <td className="p-3">
                              <div>
                                <p className="text-sm">{item.category}</p>
                                <p className="text-xs text-zinc-400">
                                  {item.purity} • {item.weight}g
                                </p>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="text-sm">
                                {item.storage_location}
                              </span>
                            </td>
                            <td className="p-3 text-sm">
                              {formatDate(item.due_date)}
                            </td>
                            <td className="p-3 text-center">
                              {scanned ? (
                                <Badge variant="success">Verified</Badge>
                              ) : item.status === "overdue" ? (
                                <Badge variant="error">Overdue</Badge>
                              ) : (
                                <Badge variant="info">Active</Badge>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewItem(item)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </Card>

          {/* Scanned Items List */}
          <Card>
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-amber-500" />
                Scanned Items
              </h3>
              {scannedItems.length > 0 && (
                <Badge variant="info">{scannedItems.length} items</Badge>
              )}
            </div>

            <div className="p-4 max-h-[300px] overflow-y-auto">
              {scannedItems.length === 0 ? (
                <div className="text-center py-8">
                  <ScanLine className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
                  <p className="text-zinc-500">No items scanned yet</p>
                  <p className="text-sm text-zinc-400 mt-1">
                    {isReconciling
                      ? "Scan barcodes to verify items"
                      : "Start reconciliation to begin"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {scannedItems.map((item) => (
                      <motion.div
                        key={item.id || item.barcode}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          item.status === "matched"
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-orange-50 border-orange-200"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {item.status === "matched" ? (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                          )}
                          <div>
                            <code className="font-mono text-sm font-medium">
                              {item.barcode}
                            </code>
                            {item.pledge_item && (
                              <p className="text-xs text-zinc-500">
                                {item.pledge_item.category} •{" "}
                                {item.pledge_item.pledge_no}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              item.status === "matched" ? "success" : "warning"
                            }
                          >
                            {item.status === "matched"
                              ? "Matched"
                              : "Unexpected"}
                          </Badge>
                          <span className="text-xs text-zinc-400">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Complete Reconciliation Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Complete Reconciliation"
        size="md"
      >
        <div className="p-5">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-emerald-50 rounded-xl">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-600">
                {stats.matched}
              </p>
              <p className="text-xs text-emerald-700">Matched</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-xl">
              <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">{stats.missing}</p>
              <p className="text-xs text-red-700">Missing</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-xl">
              <AlertTriangle className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-orange-600">
                {stats.unexpected}
              </p>
              <p className="text-xs text-orange-700">Unexpected</p>
            </div>
          </div>

          {/* Status */}
          <div
            className={cn(
              "p-4 rounded-xl mb-6",
              stats.missing === 0 && stats.unexpected === 0
                ? "bg-emerald-50 border border-emerald-200"
                : "bg-red-50 border border-red-200"
            )}
          >
            <div className="flex items-center gap-3">
              {stats.missing === 0 && stats.unexpected === 0 ? (
                <>
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                  <div>
                    <p className="font-medium text-emerald-800">
                      All Items Verified
                    </p>
                    <p className="text-sm text-emerald-600">
                      No discrepancies found
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  <div>
                    <p className="font-medium text-red-800">
                      Discrepancies Found
                    </p>
                    <p className="text-sm text-red-600">
                      {stats.missing} missing, {stats.unexpected} unexpected
                      items
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              rows={3}
              placeholder="Add any notes about this reconciliation..."
              value={reconciliationNote}
              onChange={(e) => setReconciliationNote(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowCompleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              fullWidth
              leftIcon={Check}
              onClick={handleComplete}
              loading={isCompleting}
            >
              Complete & Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Missing Items Modal */}
      <Modal
        isOpen={showDiscrepancyModal}
        onClose={() => setShowDiscrepancyModal(false)}
        title="Missing Items"
        size="lg"
      >
        <div className="p-5">
          <div className="p-3 bg-red-50 rounded-lg mb-4">
            <p className="text-sm text-red-700">
              <strong>{missingItems.length}</strong> items have not been scanned
              yet
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 sticky top-0">
                <tr>
                  <th className="text-left p-2 text-xs font-semibold text-zinc-500">
                    Barcode
                  </th>
                  <th className="text-left p-2 text-xs font-semibold text-zinc-500">
                    Pledge
                  </th>
                  <th className="text-left p-2 text-xs font-semibold text-zinc-500">
                    Customer
                  </th>
                  <th className="text-left p-2 text-xs font-semibold text-zinc-500">
                    Item
                  </th>
                  <th className="text-left p-2 text-xs font-semibold text-zinc-500">
                    Location
                  </th>
                  <th className="text-center p-2 text-xs font-semibold text-zinc-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {missingItems.map((item) => (
                  <tr
                    key={item.id || item.barcode}
                    className="hover:bg-zinc-50"
                  >
                    <td className="p-2">
                      <code className="font-mono text-sm">{item.barcode}</code>
                    </td>
                    <td className="p-2 text-sm">{item.pledge_no}</td>
                    <td className="p-2 text-sm">{item.customer_name}</td>
                    <td className="p-2 text-sm">{item.category}</td>
                    <td className="p-2 text-sm">{item.storage_location}</td>
                    <td className="p-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowDiscrepancyModal(false);
                          handleViewPledge(item.pledge_id);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            variant="outline"
            fullWidth
            className="mt-4"
            onClick={() => setShowDiscrepancyModal(false)}
          >
            Close
          </Button>
        </div>
      </Modal>

      {/* Item Detail Modal */}
      <Modal
        isOpen={showItemDetailModal}
        onClose={() => setShowItemDetailModal(false)}
        title="Item Details"
        size="md"
      >
        {selectedItem && (
          <div className="p-5">
            <div className="space-y-4">
              <div className="p-4 bg-zinc-50 rounded-xl text-center">
                <code className="text-2xl font-mono font-bold">
                  {selectedItem.barcode}
                </code>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500">Pledge No</p>
                  <p className="font-medium">{selectedItem.pledge_no}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Status</p>
                  <Badge
                    variant={
                      selectedItem.status === "overdue" ? "error" : "success"
                    }
                  >
                    {selectedItem.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Customer</p>
                  <p className="font-medium">{selectedItem.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">IC Number</p>
                  <p className="font-medium">{selectedItem.customer_ic}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Category</p>
                  <p className="font-medium">{selectedItem.category}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Purity</p>
                  <p className="font-medium">{selectedItem.purity}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Weight</p>
                  <p className="font-medium">{selectedItem.weight}g</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Storage Location</p>
                  <p className="font-medium">{selectedItem.storage_location}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Due Date</p>
                  <p className="font-medium">
                    {formatDate(selectedItem.due_date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Loan Amount</p>
                  <p className="font-medium">
                    {formatCurrency(selectedItem.loan_amount)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                fullWidth
                onClick={() => setShowItemDetailModal(false)}
              >
                Close
              </Button>
              <Button
                variant="accent"
                fullWidth
                leftIcon={Eye}
                onClick={() => {
                  setShowItemDetailModal(false);
                  handleViewPledge(selectedItem.pledge_id);
                }}
              >
                View Pledge
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageWrapper>
  );
}
