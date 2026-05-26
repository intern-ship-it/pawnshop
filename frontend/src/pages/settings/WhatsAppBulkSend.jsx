import { useState, useEffect, useMemo } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Card, Button, Badge, Modal } from "@/components/common";
import pledgeService from "@/services/pledgeService";
import {
  MessageCircle,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  ArrowLeft,
  Clock,
  Users,
  Filter,
  CheckSquare,
  Square,
  Loader2,
  ChevronDown,
  ChevronUp,
  Shield,
  Zap,
  SkipForward,
} from "lucide-react";
import { Link } from "react-router";

export default function WhatsAppBulkSend() {
  const dispatch = useAppDispatch();

  // Data state
  const [pledges, setPledges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Selection state
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Filter state
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [firstPledgeOnly, setFirstPledgeOnly] = useState(false);

  // Sending state
  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState(null);
  const [showResultsModal, setShowResultsModal] = useState(false);

  // Confirm modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    loadPendingPledges();
  }, [statusFilter]);

  const loadPendingPledges = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;

      const response = await pledgeService.getPendingWhatsApp(params);
      if (response.success) {
        setPledges(response.data.pledges || []);
        setTotalCount(response.data.total_count || 0);
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to load pending pledges",
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered pledges based on search (supports multiple pledge numbers separated by comma/space/newline)
  const filteredPledges = useMemo(() => {
    let result = pledges;

    // Apply "first pledge only" filter — keep only the earliest pledge per customer
    if (firstPledgeOnly) {
      const seen = new Map(); // customer_name -> earliest pledge
      for (const p of result) {
        const key = (p.customer_name || '').toLowerCase();
        if (!seen.has(key) || new Date(p.created_at) < new Date(seen.get(key).created_at)) {
          seen.set(key, p);
        }
      }
      result = Array.from(seen.values());
    }

    // Apply search filter
    if (!searchQuery.trim()) return result;

    // Check if multi-search (contains comma, newline, or multiple spaces suggesting multiple entries)
    const hasMultiple = /[,\n]/.test(searchQuery) || searchQuery.trim().split(/\s+/).length > 1 && searchQuery.includes('PLG');

    if (hasMultiple) {
      // Split by comma, newline, or whitespace and clean up
      const terms = searchQuery
        .split(/[,\n]+/)
        .flatMap(t => t.trim().split(/\s+/))
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      return result.filter((p) =>
        terms.some(
          (term) =>
            p.pledge_no?.toLowerCase().includes(term) ||
            p.customer_name?.toLowerCase().includes(term) ||
            p.customer_phone?.toString().includes(term)
        )
      );
    }

    // Single search term
    const q = searchQuery.toLowerCase().trim();
    return result.filter(
      (p) =>
        p.pledge_no?.toLowerCase().includes(q) ||
        p.customer_name?.toLowerCase().includes(q) ||
        p.customer_phone?.toString().includes(q)
    );
  }, [pledges, searchQuery, firstPledgeOnly]);

  // Auto-select all filtered results
  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredPledges.map((p) => p.id)));
  };

  // Selection handlers
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPledges.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPledges.map((p) => p.id)));
    }
  };

  const isAllSelected =
    filteredPledges.length > 0 && selectedIds.size === filteredPledges.length;

  // Send handler
  const handleBulkSend = async () => {
    setShowConfirmModal(false);
    setIsSending(true);
    setSendResults(null);

    try {
      const response = await pledgeService.bulkSendWhatsApp({
        pledge_ids: Array.from(selectedIds),
        force: false,
      });

      if (response.success) {
        setSendResults(response.data);
        setShowResultsModal(true);

        const sentCount = response.data?.sent?.length || 0;
        const failedCount = response.data?.failed?.length || 0;

        dispatch(
          addToast({
            type: sentCount > 0 ? "success" : "warning",
            title: "Bulk Send Complete",
            message: response.message,
          })
        );

        // Refresh the list
        await loadPendingPledges();
        setSelectedIds(new Set());
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Bulk Send Failed",
          message: error.message || "Failed to send WhatsApp messages",
        })
      );
    } finally {
      setIsSending(false);
    }
  };

  // Send single pledge
  const handleSendSingle = async (pledgeId) => {
    try {
      const response = await pledgeService.sendWhatsApp(pledgeId, false);
      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Sent",
            message: response.data?.message || "WhatsApp sent successfully",
          })
        );
        await loadPendingPledges();
      }
    } catch (error) {
      // Check if it's a duplicate (409)
      if (error.status === 409) {
        dispatch(
          addToast({
            type: "warning",
            title: "Already Sent",
            message: error.message,
          })
        );
      } else {
        dispatch(
          addToast({
            type: "error",
            title: "Failed",
            message: error.message || "Failed to send",
          })
        );
      }
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-MY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatAmount = (amount) => {
    return Number(amount || 0).toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </Link>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-800">
              WhatsApp Bulk Send
            </h1>
            <p className="text-sm text-zinc-500">
              Send WhatsApp for pledges created before WhatsApp was configured
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={RefreshCw}
            onClick={loadPendingPledges}
            loading={isLoading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-800">{totalCount}</p>
              <p className="text-xs text-zinc-500">Pending WhatsApp</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-800">
                {selectedIds.size}
              </p>
              <p className="text-xs text-zinc-500">Selected</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-green-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">Protected</p>
              <p className="text-xs text-zinc-500">Duplicate tracker active</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters + Action Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Search - supports multi-line for pasting multiple pledges */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
              <textarea
                rows={searchQuery.includes(',') || searchQuery.includes('\n') ? 3 : 1}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white resize-none"
                style={{ minHeight: '42px' }}
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="renewed">Renewed</option>
                <option value="redeemed">Redeemed</option>
              </select>
            </div>

            {/* First Pledge Only Toggle */}
            <button
              onClick={() => setFirstPledgeOnly(!firstPledgeOnly)}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap",
                firstPledgeOnly
                  ? "bg-amber-50 text-amber-700 border-amber-300"
                  : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50"
              )}
              title="Show only the first (earliest) pledge per customer"
            >
              {firstPledgeOnly ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              1st Pledge Only
            </button>

            {/* Bulk Send Button */}
            <Button
              variant="accent"
              leftIcon={Send}
              onClick={() => setShowConfirmModal(true)}
              disabled={selectedIds.size === 0 || isSending}
              loading={isSending}
              className="whitespace-nowrap"
            >
              Send ({selectedIds.size})
            </Button>
          </div>

          {/* Search helper + quick actions */}
          {searchQuery.trim() && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-zinc-500">
                Found <span className="font-semibold text-zinc-700">{filteredPledges.length}</span> of {pledges.length} pledges
              </span>
              {filteredPledges.length > 0 && (
                <button
                  onClick={selectAllFiltered}
                  className="inline-flex items-center gap-1 px-2 py-1 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 font-medium transition-colors"
                >
                  <CheckSquare className="w-3 h-3" />
                  Select all {filteredPledges.length} matched
                </button>
              )}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="inline-flex items-center gap-1 px-2 py-1 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded border border-zinc-200 font-medium transition-colors"
                >
                  <XCircle className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Pledge Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <span className="ml-3 text-zinc-500">Loading pledges...</span>
          </div>
        ) : filteredPledges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <CheckCircle className="w-16 h-16 mb-4 text-green-300" />
            <p className="text-lg font-medium text-zinc-600">All caught up!</p>
            <p className="text-sm">
              No pending WhatsApp messages to send
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-2 hover:text-amber-600 transition-colors"
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-400" />
                      )}
                      <span className="text-xs font-semibold text-zinc-500 uppercase">
                        All
                      </span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">
                    Pledge No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase">
                    Loan (RM)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">
                    Created
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredPledges.map((pledge, idx) => (
                  <motion.tr
                    key={pledge.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={cn(
                      "hover:bg-amber-50/50 transition-colors cursor-pointer",
                      selectedIds.has(pledge.id) && "bg-amber-50"
                    )}
                    onClick={() => toggleSelect(pledge.id)}
                  >
                    <td className="px-4 py-3">
                      {selectedIds.has(pledge.id) ? (
                        <CheckSquare className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-300" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-zinc-700">
                        {pledge.pledge_no}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-800">
                        {pledge.customer_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {pledge.customer_phone}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-800">
                      {formatAmount(pledge.loan_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          pledge.status === "active"
                            ? "success"
                            : pledge.status === "renewed"
                              ? "info"
                              : "secondary"
                        }
                        size="sm"
                      >
                        {pledge.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {formatDate(pledge.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendSingle(pledge.id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors border border-green-200"
                        title="Send WhatsApp for this pledge"
                      >
                        <Send className="w-3 h-3" />
                        Send
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Confirm Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Bulk Send"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                You are about to send WhatsApp messages to{" "}
                <span className="text-amber-900">{selectedIds.size}</span>{" "}
                pledge(s)
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Each customer will receive the pledge creation WhatsApp message.
                Duplicates will be automatically skipped.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
            <Shield className="w-4 h-4 text-green-600" />
            <p className="text-xs text-green-700">
              Duplicate protection is active — already-sent pledges will be
              skipped
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              className="flex-1"
              leftIcon={Send}
              onClick={handleBulkSend}
              loading={isSending}
            >
              Send Now
            </Button>
          </div>
        </div>
      </Modal>

      {/* Results Modal */}
      <Modal
        isOpen={showResultsModal}
        onClose={() => setShowResultsModal(false)}
        title="Bulk Send Results"
        size="lg"
      >
        {sendResults && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
                <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-green-700">
                  {sendResults.sent?.length || 0}
                </p>
                <p className="text-xs text-green-600">Sent</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                <SkipForward className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-amber-700">
                  {sendResults.skipped_duplicate?.length || 0}
                </p>
                <p className="text-xs text-amber-600">Skipped</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
                <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-red-700">
                  {sendResults.failed?.length || 0}
                </p>
                <p className="text-xs text-red-600">Failed</p>
              </div>
            </div>

            {/* Sent List */}
            {sendResults.sent?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Successfully Sent
                </h4>
                <div className="space-y-1">
                  {sendResults.sent.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 bg-green-50/50 rounded text-xs"
                    >
                      <span className="font-mono font-semibold">
                        {item.pledge_no}
                      </span>
                      <span className="text-zinc-600">{item.customer}</span>
                      <span className="text-zinc-500">{item.phone}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skipped List */}
            {sendResults.skipped_duplicate?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2">
                  <SkipForward className="w-4 h-4" />
                  Skipped (Already Sent)
                </h4>
                <div className="space-y-1">
                  {sendResults.skipped_duplicate.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 bg-amber-50/50 rounded text-xs"
                    >
                      <span className="font-mono font-semibold">
                        {item.pledge_no}
                      </span>
                      <span className="text-zinc-600">{item.customer}</span>
                      <span className="text-zinc-500">
                        Sent: {item.already_sent_at}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed List */}
            {sendResults.failed?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Failed
                </h4>
                <div className="space-y-1">
                  {sendResults.failed.map((item, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 bg-red-50/50 rounded text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold">
                          {item.pledge_no}
                        </span>
                        {item.customer && (
                          <span className="text-zinc-600">{item.customer}</span>
                        )}
                        {item.phone && (
                          <span className="text-zinc-500 font-mono">{item.phone}</span>
                        )}
                      </div>
                      <p className="text-red-600 mt-0.5">{item.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button
                variant="accent"
                className="w-full"
                onClick={() => setShowResultsModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
