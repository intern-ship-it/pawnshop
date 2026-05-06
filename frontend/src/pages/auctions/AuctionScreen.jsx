import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { auctionService } from "@/services";
import { formatCurrency, formatDate, formatIC } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select, Badge, Modal } from "@/components/common";
import {
  Gavel,
  Search,
  Package,
  AlertTriangle,
  Clock,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  Scale,
  TrendingUp,
  Users,
  Printer,
  Download,
  MapPin,
  ShieldAlert,
  Archive,
  RefreshCw,
  Loader2,
  ArrowRight,
} from "lucide-react";

// Tab config
const TABS = [
  { id: "eligible", label: "Overdue (3+ Days)", icon: AlertTriangle },
  { id: "forfeited", label: "Forfeited", icon: XCircle },
  { id: "auctioned", label: "Auctioned", icon: Gavel },
];

export default function AuctionScreen() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // State
  const [activeTab, setActiveTab] = useState("eligible");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("overdue-days");
  const [isLoading, setIsLoading] = useState(true);
  const [pledges, setPledges] = useState([]);
  const [stats, setStats] = useState(null);

  // Modal state
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [selectedPledge, setSelectedPledge] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Auction sale form state
  const [auctionPrice, setAuctionPrice] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerIC, setBuyerIC] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [auctionNotes, setAuctionNotes] = useState("");

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await auctionService.getStats();
      const data = response?.data || response;
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch auction stats:", error);
    }
  }, []);

  // Fetch pledges based on active tab
  const fetchPledges = useCallback(async () => {
    setIsLoading(true);
    try {
      let response;
      const params = { search: searchQuery || undefined, sort_by: sortBy };

      switch (activeTab) {
        case "eligible":
          response = await auctionService.getOverduePledges(params);
          break;
        case "forfeited":
          response = await auctionService.getForfeitedPledges(params);
          break;
        case "auctioned":
          response = await auctionService.getAuctionedPledges(params);
          break;
      }

      const data = response?.data || response || [];
      setPledges(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch pledges:", error);
      setPledges([]);
      dispatch(addToast({ type: "error", title: "Error", message: "Failed to load auction data" }));
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, searchQuery, sortBy, dispatch]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchPledges(); }, [fetchPledges]);

  // Days overdue calculation
  const getDaysOverdue = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    return Math.max(0, Math.floor((now - due) / (1000 * 60 * 60 * 24)));
  };

  // Process forfeit
  const handleForfeit = async () => {
    if (!selectedPledge) return;
    setIsProcessing(true);
    try {
      await auctionService.forfeitPledge(selectedPledge.id);
      dispatch(addToast({
        type: "success",
        title: "Forfeited",
        message: `Pledge ${selectedPledge.pledge_no} has been marked as forfeited`,
      }));
      setShowForfeitModal(false);
      setSelectedPledge(null);
      fetchPledges();
      fetchStats();
    } catch (error) {
      dispatch(addToast({
        type: "error",
        title: "Failed",
        message: error?.message || "Failed to forfeit pledge",
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Process auction sale
  const handleAuctionSale = async () => {
    if (!selectedPledge) return;
    const price = parseFloat(auctionPrice);
    if (!price || price <= 0) {
      dispatch(addToast({ type: "error", title: "Invalid", message: "Please enter a valid auction price" }));
      return;
    }
    if (!buyerName.trim()) {
      dispatch(addToast({ type: "error", title: "Required", message: "Please enter buyer name" }));
      return;
    }
    setIsProcessing(true);
    try {
      await auctionService.sellForfeitedPledge(selectedPledge.id, {
        sold_price: price,
        buyer_name: buyerName,
        buyer_ic: buyerIC || null,
        buyer_phone: buyerPhone || null,
        notes: auctionNotes || null,
      });
      dispatch(addToast({
        type: "success",
        title: "Sold",
        message: `Pledge ${selectedPledge.pledge_no} sold for ${formatCurrency(price)}`,
      }));
      setShowAuctionModal(false);
      setSelectedPledge(null);
      setAuctionPrice("");
      setBuyerName("");
      setBuyerIC("");
      setBuyerPhone("");
      setAuctionNotes("");
      fetchPledges();
      fetchStats();
    } catch (error) {
      dispatch(addToast({
        type: "error",
        title: "Failed",
        message: error?.message || "Failed to process auction sale",
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Navigate to renewal
  const handleRenewal = (pledge) => {
    navigate("/renewals", { state: { pledgeNo: pledge.pledge_no } });
  };

  const openForfeitModal = (pledge) => {
    setSelectedPledge(pledge);
    setShowForfeitModal(true);
  };

  const openAuctionModal = (pledge) => {
    setSelectedPledge(pledge);
    setAuctionPrice(pledge.net_value?.toString() || "");
    setShowAuctionModal(true);
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { fetchPledges(); }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <PageWrapper
      title="Auctions"
      subtitle="Manage overdue pledges, forfeitures and auction sales"
      actions={
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={Download}>Export</Button>
          <Button variant="outline" leftIcon={Printer}>Print List</Button>
        </div>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Overdue Card */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <div
            className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
              border: "1px solid #f59e0b33",
            }}
            onClick={() => setActiveTab("eligible")}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: "#92400e" }}>Overdue Pledges</p>
                <p className="text-3xl font-bold mt-1" style={{ color: "#78350f" }}>
                  {stats?.overdue?.count ?? "—"}
                </p>
                <p className="text-sm mt-1" style={{ color: "#92400e" }}>
                  {stats ? formatCurrency(stats.overdue.amount) : "—"} at risk
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#f59e0b33" }}>
                <AlertTriangle className="w-7 h-7" style={{ color: "#b45309" }} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Forfeited Card */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div
            className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
              border: "1px solid #ef444433",
            }}
            onClick={() => setActiveTab("forfeited")}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: "#991b1b" }}>Forfeited Items</p>
                <p className="text-3xl font-bold mt-1" style={{ color: "#7f1d1d" }}>
                  {stats?.forfeited?.count ?? "—"}
                </p>
                <p className="text-sm mt-1" style={{ color: "#991b1b" }}>
                  {stats ? formatCurrency(stats.forfeited.value) : "—"} inventory
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#ef444433" }}>
                <Archive className="w-7 h-7" style={{ color: "#dc2626" }} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Auctioned Card */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div
            className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
              border: "1px solid #10b98133",
            }}
            onClick={() => setActiveTab("auctioned")}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: "#065f46" }}>Auctioned</p>
                <p className="text-3xl font-bold mt-1" style={{ color: "#064e3b" }}>
                  {stats?.auctioned?.count ?? "—"}
                </p>
                <p className="text-sm mt-1" style={{ color: "#065f46" }}>
                  {stats ? formatCurrency(stats.auctioned.revenue) : "—"} revenue
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#10b98133" }}>
                <Gavel className="w-7 h-7" style={{ color: "#059669" }} />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count =
            tab.id === "eligible" ? stats?.overdue?.count :
            tab.id === "forfeited" ? stats?.forfeited?.count :
            stats?.auctioned?.count;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all text-sm",
                activeTab === tab.id
                  ? "text-white shadow-md"
                  : "bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200"
              )}
              style={activeTab === tab.id ? {
                background: tab.id === "eligible"
                  ? "linear-gradient(135deg, #d97706, #b45309)"
                  : tab.id === "forfeited"
                  ? "linear-gradient(135deg, #dc2626, #b91c1c)"
                  : "linear-gradient(135deg, #059669, #047857)"
              } : {}}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-bold",
                  activeTab === tab.id ? "bg-white/25" : "bg-zinc-100"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by Pledge ID, Customer Name or IC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={Search}
            />
          </div>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={[
              { value: "overdue-days", label: "Most Overdue" },
              { value: "amount-high", label: "Amount: High to Low" },
              { value: "amount-low", label: "Amount: Low to High" },
              { value: "newest", label: "Newest First" },
            ]}
            className="w-48"
          />
          <Button variant="outline" leftIcon={RefreshCw} onClick={() => { fetchPledges(); fetchStats(); }}>
            Refresh
          </Button>
        </div>
      </Card>

      {/* Pledges List */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {isLoading ? (
            <Card className="p-12 text-center">
              <Loader2 className="w-10 h-10 text-amber-500 mx-auto mb-3 animate-spin" />
              <p className="text-zinc-500">Loading auction data...</p>
            </Card>
          ) : pledges.length === 0 ? (
            <Card className="p-12 text-center">
              <Gavel className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-700 mb-2">No Pledges Found</h3>
              <p className="text-zinc-500">
                {activeTab === "eligible" && "No overdue pledges (3+ days) found"}
                {activeTab === "forfeited" && "No forfeited pledges yet"}
                {activeTab === "auctioned" && "No auctioned items yet"}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pledges.map((pledge, index) => {
                const daysOverdue = pledge.days_overdue || getDaysOverdue(pledge.due_date);
                return (
                  <motion.div
                    key={pledge.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Card className="p-5 hover:shadow-lg transition-all border-l-4"
                      style={{
                        borderLeftColor:
                          activeTab === "eligible" ? "#d97706" :
                          activeTab === "forfeited" ? "#dc2626" : "#059669"
                      }}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Pledge Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className="font-mono font-semibold text-zinc-700">
                              {pledge.pledge_no}
                            </span>
                            {activeTab === "eligible" && (
                              <Badge variant="warning">
                                <Clock className="w-3 h-3 mr-1" />
                                {daysOverdue} days overdue
                              </Badge>
                            )}
                            {activeTab === "forfeited" && (
                              <Badge variant="error">
                                <XCircle className="w-3 h-3 mr-1" />
                                Forfeited
                              </Badge>
                            )}
                            {activeTab === "auctioned" && (
                              <Badge variant="success">
                                <Gavel className="w-3 h-3 mr-1" />
                                Auctioned
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-zinc-500 flex-wrap">
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-zinc-400" />
                              {pledge.customer?.name || "Unknown"}
                            </div>
                            <div className="flex items-center gap-1">
                              <Package className="w-4 h-4 text-zinc-400" />
                              {pledge.items_count || pledge.items?.length || 0} item(s)
                            </div>
                            <div className="flex items-center gap-1">
                              <Scale className="w-4 h-4 text-zinc-400" />
                              {parseFloat(pledge.total_weight || 0).toFixed(2)}g
                            </div>
                            {pledge.location_string && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4 text-amber-500" />
                                <span className="text-amber-700">{pledge.location_string}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Values */}
                        <div className="flex items-center gap-6 flex-wrap">
                          <div className="text-right">
                            <p className="text-xs text-zinc-400">Loan Amount</p>
                            <p className="font-semibold text-zinc-700">
                              {formatCurrency(pledge.loan_amount)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-zinc-400">Item Value</p>
                            <p className="font-semibold" style={{ color: "#059669" }}>
                              {formatCurrency(pledge.net_value)}
                            </p>
                          </div>
                          {pledge.due_date && activeTab === "eligible" && (
                            <div className="text-right">
                              <p className="text-xs text-zinc-400">Due Date</p>
                              <p className="font-medium text-amber-700">
                                {formatDate(pledge.due_date)}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button variant="outline" size="sm" leftIcon={Eye}
                            onClick={() => navigate(`/pledges/${pledge.id}`)}
                          >
                            View
                          </Button>

                          {activeTab === "eligible" && (
                            <>
                              <Button
                                size="sm"
                                leftIcon={RefreshCw}
                                onClick={() => handleRenewal(pledge)}
                                style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "white" }}
                              >
                                Renew
                              </Button>
                              <Button variant="error" size="sm" leftIcon={XCircle}
                                onClick={() => openForfeitModal(pledge)}
                              >
                                Forfeit
                              </Button>
                            </>
                          )}

                          {activeTab === "forfeited" && (
                            <Button size="sm" leftIcon={Gavel}
                              style={{ background: "linear-gradient(135deg, #d97706, #b45309)", color: "white" }}
                              onClick={() => openAuctionModal(pledge)}
                            >
                              Auction
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Forfeit Confirmation Modal */}
      <Modal
        isOpen={showForfeitModal}
        onClose={() => setShowForfeitModal(false)}
        title="Confirm Forfeit"
        size="md"
      >
        <div className="p-5">
          <div className="flex items-center gap-4 p-4 rounded-xl mb-4"
            style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
          >
            <ShieldAlert className="w-10 h-10" style={{ color: "#dc2626" }} />
            <div>
              <p className="font-semibold" style={{ color: "#991b1b" }}>
                Warning: This action is irreversible
              </p>
              <p className="text-sm" style={{ color: "#b91c1c" }}>
                The pledge will be marked as forfeited and items will be available for auction.
              </p>
            </div>
          </div>

          {selectedPledge && (
            <div className="space-y-3 mb-6">
              <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                <span className="text-zinc-500">Pledge ID</span>
                <span className="font-mono font-semibold">{selectedPledge.pledge_no}</span>
              </div>
              <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                <span className="text-zinc-500">Customer</span>
                <span className="font-medium">{selectedPledge.customer?.name}</span>
              </div>
              <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                <span className="text-zinc-500">Loan Amount</span>
                <span className="font-semibold">{formatCurrency(selectedPledge.loan_amount)}</span>
              </div>
              <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                <span className="text-zinc-500">Items</span>
                <span>{selectedPledge.items_count || selectedPledge.items?.length || 0} item(s) - {parseFloat(selectedPledge.total_weight || 0).toFixed(2)}g</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg" style={{ background: "#fffbeb" }}>
                <span style={{ color: "#92400e" }}>Days Overdue</span>
                <span className="font-bold" style={{ color: "#d97706" }}>
                  {selectedPledge.days_overdue || getDaysOverdue(selectedPledge.due_date)} days
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setShowForfeitModal(false)}>
              Cancel
            </Button>
            <Button variant="error" fullWidth leftIcon={XCircle} onClick={handleForfeit} loading={isProcessing}>
              Confirm Forfeit
            </Button>
          </div>
        </div>
      </Modal>

      {/* Auction Sale Modal */}
      <Modal
        isOpen={showAuctionModal}
        onClose={() => setShowAuctionModal(false)}
        title="Record Auction Sale"
        size="md"
      >
        <div className="p-5">
          {selectedPledge && (
            <>
              {/* Pledge Summary */}
              <div className="p-4 rounded-xl mb-5" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-semibold text-zinc-700">{selectedPledge.pledge_no}</span>
                  <Badge variant="error">Forfeited</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-zinc-500">Customer:</span>
                    <span className="ml-2 font-medium">{selectedPledge.customer?.name}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Items:</span>
                    <span className="ml-2">{selectedPledge.items_count || selectedPledge.items?.length || 0} ({parseFloat(selectedPledge.total_weight || 0).toFixed(2)}g)</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Loan:</span>
                    <span className="ml-2 font-semibold">{formatCurrency(selectedPledge.loan_amount)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Value:</span>
                    <span className="ml-2 font-semibold" style={{ color: "#059669" }}>{formatCurrency(selectedPledge.net_value)}</span>
                  </div>
                </div>
              </div>

              {/* Auction Form */}
              <div className="space-y-4">
                <Input
                  label="Auction Price (RM) *"
                  type="number"
                  step="0.01"
                  placeholder="Enter selling price"
                  value={auctionPrice}
                  onChange={(e) => setAuctionPrice(e.target.value)}
                  leftIcon={DollarSign}
                />
                <Input
                  label="Buyer Name *"
                  placeholder="Enter buyer's name"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  leftIcon={Users}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Buyer IC (Optional)"
                    placeholder="IC number"
                    value={buyerIC}
                    onChange={(e) => setBuyerIC(e.target.value)}
                  />
                  <Input
                    label="Buyer Phone (Optional)"
                    placeholder="Phone number"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                  />
                </div>
                <Input
                  label="Notes (Optional)"
                  placeholder="Any additional notes"
                  value={auctionNotes}
                  onChange={(e) => setAuctionNotes(e.target.value)}
                />

                {/* Profit/Loss Indicator */}
                {auctionPrice && selectedPledge.loan_amount && (
                  <div
                    className="p-3 rounded-lg border"
                    style={{
                      background: parseFloat(auctionPrice) >= parseFloat(selectedPledge.loan_amount) ? "#ecfdf5" : "#fef2f2",
                      borderColor: parseFloat(auctionPrice) >= parseFloat(selectedPledge.loan_amount) ? "#a7f3d0" : "#fecaca",
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span style={{ color: parseFloat(auctionPrice) >= parseFloat(selectedPledge.loan_amount) ? "#065f46" : "#991b1b" }}>
                        {parseFloat(auctionPrice) >= parseFloat(selectedPledge.loan_amount) ? "Profit" : "Loss"}
                      </span>
                      <span className="font-bold" style={{ color: parseFloat(auctionPrice) >= parseFloat(selectedPledge.loan_amount) ? "#059669" : "#dc2626" }}>
                        {formatCurrency(Math.abs(parseFloat(auctionPrice) - parseFloat(selectedPledge.loan_amount)))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" fullWidth onClick={() => setShowAuctionModal(false)}>
                  Cancel
                </Button>
                <Button
                  fullWidth
                  leftIcon={Gavel}
                  onClick={handleAuctionSale}
                  loading={isProcessing}
                  style={{ background: "linear-gradient(135deg, #d97706, #b45309)", color: "white" }}
                >
                  Complete Sale
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </PageWrapper>
  );
}
