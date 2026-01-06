import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { setPledges, setSelectedPledge } from "@/features/pledges/pledgesSlice";
import { addToast } from "@/features/ui/uiSlice";
import { pledgeService } from "@/services";
import { formatCurrency, formatDate, formatIC } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select, Badge } from "@/components/common";
import {
  Plus,
  Search,
  Filter,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  DollarSign,
  Calendar,
  User,
  FileText,
  Download,
  TrendingUp,
  Scale,
  Loader2,
} from "lucide-react";

// Status badge config
const statusConfig = {
  active: { label: "Active", variant: "success", icon: CheckCircle },
  overdue: { label: "Overdue", variant: "error", icon: AlertTriangle },
  redeemed: { label: "Redeemed", variant: "info", icon: DollarSign },
  forfeited: { label: "Forfeited", variant: "warning", icon: XCircle },
  auctioned: { label: "Auctioned", variant: "default", icon: Package },
};

export default function PledgeList() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { pledges } = useAppSelector((state) => state.pledges);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printingId, setPrintingId] = useState(null);

  // Fetch pledges from API
  const fetchPledges = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await pledgeService.getAll();
      const data = response.data?.data || response.data || [];

      // Transform snake_case to camelCase and add computed fields
      const transformedPledges = data.map((pledge) => ({
        id: pledge.id,
        pledgeNo: pledge.pledge_no,
        receiptNo: pledge.receipt_no,
        customerId: pledge.customer_id,
        customerName: pledge.customer?.name || "Unknown",
        customerIC: pledge.customer?.ic_number || "",
        customerPhone: pledge.customer?.phone || "",
        totalWeight: parseFloat(pledge.total_weight) || 0,
        grossValue: parseFloat(pledge.gross_value) || 0,
        totalDeduction: parseFloat(pledge.total_deduction) || 0,
        netValue: parseFloat(pledge.net_value) || 0,
        loanPercentage: parseFloat(pledge.loan_percentage) || 0,
        loanAmount: parseFloat(pledge.loan_amount) || 0,
        interestRate: parseFloat(pledge.interest_rate) || 0.5,
        pledgeDate: pledge.pledge_date,
        dueDate: pledge.due_date,
        graceEndDate: pledge.grace_end_date,
        status: pledge.status,
        renewalCount: pledge.renewal_count || 0,
        itemsCount: pledge.items?.length || pledge.items_count || 0,
        items: pledge.items || [],
        createdAt: pledge.created_at,
        updatedAt: pledge.updated_at,
      }));

      dispatch(setPledges(transformedPledges));
    } catch (error) {
      console.error("Error fetching pledges:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to load pledges",
        })
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load pledges on mount
  useEffect(() => {
    fetchPledges();
  }, []);

  // Handle print receipt
  const handlePrint = async (pledgeId, e) => {
    if (e) e.stopPropagation();

    const token = localStorage.getItem("pawnsys_token");
    if (!token) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please login again",
        })
      );
      return;
    }

    setPrintingId(pledgeId);

    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      const response = await fetch(
        `${apiUrl}/print/pledge-receipt/${pledgeId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/pdf",
          },
          body: JSON.stringify({ copy_type: "customer" }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate receipt");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");

      dispatch(
        addToast({
          type: "success",
          title: "Success",
          message: "Receipt generated successfully",
        })
      );
    } catch (error) {
      console.error("Print error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to print receipt",
        })
      );
    } finally {
      setPrintingId(null);
    }
  };

  // Handle export to CSV
  const handleExport = () => {
    if (filteredPledges.length === 0) {
      dispatch(
        addToast({
          type: "warning",
          title: "No Data",
          message: "No pledges to export",
        })
      );
      return;
    }

    // CSV headers
    const headers = [
      "Receipt No",
      "Pledge No",
      "Customer Name",
      "IC Number",
      "Phone",
      "Items",
      "Total Weight (g)",
      "Gross Value (RM)",
      "Deductions (RM)",
      "Net Value (RM)",
      "Loan %",
      "Loan Amount (RM)",
      "Interest Rate (%)",
      "Pledge Date",
      "Due Date",
      "Status",
      "Renewals",
    ];

    // CSV rows
    const rows = filteredPledges.map((pledge) => [
      pledge.receiptNo || pledge.pledgeNo,
      pledge.pledgeNo,
      pledge.customerName,
      pledge.customerIC,
      pledge.customerPhone,
      pledge.itemsCount,
      pledge.totalWeight.toFixed(3),
      pledge.grossValue.toFixed(2),
      pledge.totalDeduction.toFixed(2),
      pledge.netValue.toFixed(2),
      pledge.loanPercentage,
      pledge.loanAmount.toFixed(2),
      pledge.interestRate,
      pledge.pledgeDate,
      pledge.dueDate,
      pledge.status,
      pledge.renewalCount,
    ]);

    // Build CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            // Escape cells containing commas or quotes
            const cellStr = String(cell ?? "");
            if (
              cellStr.includes(",") ||
              cellStr.includes('"') ||
              cellStr.includes("\n")
            ) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(",")
      ),
    ].join("\n");

    // Create and download file
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pledges-export-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    dispatch(
      addToast({
        type: "success",
        title: "Exported",
        message: `${filteredPledges.length} pledges exported to CSV`,
      })
    );
  };

  // Calculate stats
  const stats = {
    total: pledges.length,
    active: pledges.filter((p) => p.status === "active").length,
    overdue: pledges.filter((p) => p.status === "overdue").length,
    totalValue: pledges
      .filter((p) => p.status === "active" || p.status === "overdue")
      .reduce((sum, p) => sum + (p.loanAmount || 0), 0),
    redeemed: pledges.filter((p) => p.status === "redeemed").length,
  };

  // Filter and sort pledges
  const filteredPledges = pledges
    .filter((pledge) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchId =
          pledge.pledgeNo?.toLowerCase().includes(query) ||
          pledge.receiptNo?.toLowerCase().includes(query);
        const matchName = pledge.customerName?.toLowerCase().includes(query);
        const matchIC = pledge.customerIC
          ?.replace(/[-\s]/g, "")
          .includes(query.replace(/[-\s]/g, ""));
        if (!matchId && !matchName && !matchIC) return false;
      }

      // Status filter
      if (statusFilter !== "all" && pledge.status !== statusFilter)
        return false;

      // Date filter
      if (dateFilter !== "all") {
        const createdAt = new Date(pledge.createdAt);
        const now = new Date();
        switch (dateFilter) {
          case "today":
            if (createdAt.toDateString() !== now.toDateString()) return false;
            break;
          case "week":
            const weekAgo = new Date(now.setDate(now.getDate() - 7));
            if (createdAt < weekAgo) return false;
            break;
          case "month":
            const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
            if (createdAt < monthAgo) return false;
            break;
        }
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt) - new Date(a.createdAt);
        case "oldest":
          return new Date(a.createdAt) - new Date(b.createdAt);
        case "amount-high":
          return (b.loanAmount || 0) - (a.loanAmount || 0);
        case "amount-low":
          return (a.loanAmount || 0) - (b.loanAmount || 0);
        case "due-soon":
          return new Date(a.dueDate) - new Date(b.dueDate);
        default:
          return 0;
      }
    });

  // Calculate days until due
  const getDaysUntilDue = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <PageWrapper
      title="All Pledges"
      subtitle="View and manage all pledge tickets"
      actions={
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            leftIcon={RefreshCw}
            onClick={() => fetchPledges(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button variant="outline" leftIcon={Download} onClick={handleExport}>
            Export
          </Button>
          <Button
            variant="accent"
            leftIcon={Plus}
            onClick={() => navigate("/pledges/new")}
          >
            New Pledge
          </Button>
        </div>
      }
    >
      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-100">
                <Package className="w-5 h-5 text-zinc-600" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Total Pledges</p>
                <p className="text-xl font-bold text-zinc-800">{stats.total}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Active</p>
                <p className="text-xl font-bold text-emerald-600">
                  {stats.active}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Overdue</p>
                <p className="text-xl font-bold text-red-600">
                  {stats.overdue}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="col-span-2">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Total Outstanding</p>
                <p className="text-xl font-bold text-amber-600">
                  {formatCurrency(stats.totalValue)}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[250px]">
            <Input
              placeholder="Search by ticket #, customer name, or IC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={Search}
            />
          </div>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: "All Status" },
              { value: "active", label: "Active" },
              { value: "overdue", label: "Overdue" },
              { value: "redeemed", label: "Redeemed" },
              { value: "forfeited", label: "Forfeited" },
            ]}
            className="w-40"
          />

          {/* Date Filter */}
          <Select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            options={[
              { value: "all", label: "All Time" },
              { value: "today", label: "Today" },
              { value: "week", label: "This Week" },
              { value: "month", label: "This Month" },
            ]}
            className="w-40"
          />

          {/* Sort */}
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={[
              { value: "newest", label: "Newest First" },
              { value: "oldest", label: "Oldest First" },
              { value: "amount-high", label: "Amount: High to Low" },
              { value: "amount-low", label: "Amount: Low to High" },
              { value: "due-soon", label: "Due Soon" },
            ]}
            className="w-44"
          />
        </div>
      </Card>

      {/* Pledges Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                  TICKET #
                </th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                  CUSTOMER
                </th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                  ITEMS
                </th>
                <th className="text-right p-4 text-sm font-semibold text-zinc-600">
                  LOAN AMOUNT
                </th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                  DUE DATE
                </th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                  STATUS
                </th>
                <th className="text-center p-4 text-sm font-semibold text-zinc-600">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Loading pledges...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPledges.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">
                    <Package className="w-12 h-12 mx-auto mb-2 text-zinc-300" />
                    <p>No pledges found</p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => navigate("/pledges/new")}
                    >
                      Create your first pledge
                    </Button>
                  </td>
                </tr>
              ) : (
                filteredPledges.map((pledge) => {
                  const statusConf =
                    statusConfig[pledge.status] || statusConfig.active;
                  const StatusIcon = statusConf.icon;
                  const daysUntilDue = getDaysUntilDue(pledge.dueDate);

                  return (
                    <tr
                      key={pledge.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/pledges/${pledge.id}`)}
                    >
                      {/* Ticket # */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-800">
                              {pledge.receiptNo}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {formatDate(
                                pledge.pledgeDate || pledge.createdAt
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center">
                            <User className="w-4 h-4 text-zinc-500" />
                          </div>
                          <div>
                            <p className="font-medium text-zinc-800">
                              {pledge.customerName}
                            </p>
                            <p className="text-xs text-zinc-500 font-mono">
                              {formatIC(pledge.customerIC)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Items */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-zinc-400" />
                          <span className="text-zinc-600">
                            {pledge.itemsCount || pledge.items?.length || 0}{" "}
                            items
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          ({pledge.totalWeight?.toFixed(3) || "0.000"}g)
                        </p>
                      </td>

                      {/* Loan Amount */}
                      <td className="p-4 text-right">
                        <span className="font-semibold text-zinc-800">
                          {formatCurrency(pledge.loanAmount)}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="p-4">
                        <span className="text-zinc-600 text-sm">
                          {formatDate(pledge.dueDate)}
                        </span>
                        {pledge.status === "active" && (
                          <p
                            className={cn(
                              "text-xs mt-0.5",
                              daysUntilDue <= 7
                                ? "text-red-500"
                                : daysUntilDue <= 30
                                ? "text-amber-500"
                                : "text-zinc-400"
                            )}
                          >
                            {daysUntilDue > 0
                              ? `${daysUntilDue} days left`
                              : "Due today"}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <Badge variant={statusConf.variant}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConf.label}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/pledges/${pledge.id}`);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={printingId === pledge.id}
                            onClick={(e) => handlePrint(pledge.id, e)}
                            title="Print Receipt"
                          >
                            {printingId === pledge.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Info */}
        {!loading && filteredPledges.length > 0 && (
          <div className="p-4 border-t border-zinc-200 flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Showing {filteredPledges.length} of {pledges.length} pledges
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </PageWrapper>
  );
}
