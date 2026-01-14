/**
 * CustomerDetail.jsx - API Integrated Version
 */
import { getStorageUrl } from "@/utils/helpers";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { customerService } from "@/services";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Badge } from "@/components/common";
import {
  ArrowLeft,
  Edit2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  User,
  AlertCircle,
  Loader2,
  Plus,
  Eye,
  RefreshCw,
  FileText,
  Clock,
  DollarSign,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Package,
  Scale,
  TrendingUp,
  Calendar,
} from "lucide-react";

// Status config
const statusConfig = {
  active: { label: "Active", variant: "success" },
  renewed: { label: "Renewed", variant: "info" },
  redeemed: { label: "Redeemed", variant: "secondary" },
  overdue: { label: "Overdue", variant: "error" },
  forfeited: { label: "Forfeited", variant: "error" },
};

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // State
  const [customer, setCustomer] = useState(null);
  const [pledges, setPledges] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPledgesLoading, setIsPledgesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("active");
  const [expandedPledge, setExpandedPledge] = useState(null);

  // Fetch customer data
  const fetchCustomer = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await customerService.getById(id);
      setCustomer(response.data || response);
    } catch (err) {
      console.error("Error fetching customer:", err);
      setError(err.response?.data?.message || "Failed to load customer");
      dispatch(addToast({ type: "error", message: "Failed to load customer" }));
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch customer pledges
  const fetchPledges = async () => {
    try {
      setIsPledgesLoading(true);
      const response = await customerService.getPledges(id);
      setPledges(response.data || response || []);
    } catch (err) {
      console.error("Error fetching pledges:", err);
      setPledges([]);
    } finally {
      setIsPledgesLoading(false);
    }
  };

  // Fetch customer statistics
  const fetchStatistics = async () => {
    try {
      const response = await customerService.getStatistics(id);
      setStatistics(response.data || response);
    } catch (err) {
      console.error("Error fetching statistics:", err);
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (id) {
      fetchCustomer();
      fetchPledges();
      fetchStatistics();
    }
  }, [id]);

  // Handle refresh
  const handleRefresh = () => {
    fetchCustomer();
    fetchPledges();
    fetchStatistics();
  };

  // Navigation handlers
  const handleEdit = () => navigate(`/customers/${id}/edit`);
  const handleBack = () => navigate("/customers");
  const handleNewPledge = () => navigate(`/pledges/new?customer=${id}`);
  const handleViewPledge = (pledgeId) => navigate(`/pledges/${pledgeId}`);

  // Loading state
  if (isLoading) {
    return (
      <PageWrapper title="Customer Details">
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-zinc-500">Loading customer...</p>
          </div>
        </Card>
      </PageWrapper>
    );
  }

  // Error state
  if (error) {
    return (
      <PageWrapper title="Customer Details">
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <p className="text-zinc-500">{error}</p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleBack}>
                Back to List
              </Button>
              <Button onClick={handleRefresh}>Retry</Button>
            </div>
          </div>
        </Card>
      </PageWrapper>
    );
  }

  // Customer not found
  if (!customer) {
    return (
      <PageWrapper title="Customer Details">
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <User className="w-12 h-12 text-zinc-400" />
            <p className="text-zinc-500">Customer not found</p>
            <Button variant="secondary" onClick={handleBack}>
              Back to List
            </Button>
          </div>
        </Card>
      </PageWrapper>
    );
  }

  // Filter pledges based on active tab
  const filteredPledges = pledges.filter((p) => {
    if (activeTab === "active") {
      return p.status === "active" || p.status === "overdue";
    }
    return true;
  });

  return (
    <PageWrapper
      title={customer.name}
      subtitle={`IC: ${customer.ic_number || "N/A"}`}
      actions={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button variant="secondary" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="secondary" onClick={handleEdit}>
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button onClick={handleNewPledge}>
            <Plus className="w-4 h-4 mr-2" />
            New Pledge
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Customer Info */}
        <div className="space-y-6">
          {/* Profile Card */}
          <Card>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                {/* Avatar - should use selfie_photo */}
                <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden">
                  {customer.selfie_photo ? (
                    <img
                      src={getStorageUrl(customer.selfie_photo)}
                      alt={customer.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-amber-600">
                      {customer.name?.charAt(0)?.toUpperCase() || "C"}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-zinc-800">
                    {customer.name}
                  </h2>
                  <p className="text-zinc-500">{customer.ic_number}</p>
                  <Badge variant={customer.is_active ? "success" : "error"}>
                    {customer.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                {customer.phone && (
                  <div className="flex items-center gap-3 min-w-0">
                    <Phone className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                    <span className="text-zinc-600 truncate">
                      {customer.phone}
                    </span>
                  </div>
                )}
                {customer.whatsapp && customer.whatsapp !== customer.phone && (
                  <div className="flex items-center gap-3 min-w-0">
                    <Phone className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-zinc-600 truncate">
                      {customer.whatsapp} (WhatsApp)
                    </span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                    <span
                      className="text-zinc-600 truncate break-all text-sm"
                      title={customer.email}
                    >
                      {customer.email}
                    </span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-3 min-w-0">
                    <MapPin className="w-4 h-4 text-zinc-400 mt-1 flex-shrink-0" />
                    <span className="text-zinc-600 break-words">
                      {customer.address}
                      {customer.city && `, ${customer.city}`}
                      {customer.state && `, ${customer.state}`}
                      {customer.postcode && ` ${customer.postcode}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Additional Info */}
          <Card>
            <div className="p-5 border-b border-zinc-100">
              <h3 className="font-semibold text-zinc-800">Additional Info</h3>
            </div>
            <div className="p-5 space-y-3">
              {customer.gender && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Gender</span>
                  <span className="text-zinc-800 capitalize">
                    {customer.gender}
                  </span>
                </div>
              )}
              {customer.date_of_birth && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Date of Birth</span>
                  <span className="text-zinc-800">
                    {formatDate(customer.date_of_birth)}
                  </span>
                </div>
              )}
              {customer.occupation && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Occupation</span>
                  <span className="text-zinc-800">{customer.occupation}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500">Member Since</span>
                <span className="text-zinc-800">
                  {formatDate(customer.created_at)}
                </span>
              </div>
            </div>
          </Card>

          {/* IC Documents */}
          {/* IC Documents */}
          <Card>
            <div className="p-5 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-zinc-800">IC Documents</h3>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm text-zinc-500 mb-2">Front</p>
                  {customer.ic_front_photo ? (
                    <div
                      className="bg-zinc-50 rounded-lg border border-zinc-200 p-2 cursor-pointer hover:border-amber-400 transition-colors"
                      onClick={() =>
                        window.open(
                          getStorageUrl(customer.ic_front_photo),
                          "_blank"
                        )
                      }
                    >
                      <img
                        src={getStorageUrl(customer.ic_front_photo)}
                        alt="IC Front"
                        className="w-full h-32 object-contain rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-32 bg-zinc-100 rounded-lg border border-zinc-200 flex items-center justify-center">
                      <span className="text-xs text-zinc-400">
                        Not uploaded
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-zinc-500 mb-2">Back</p>
                  {customer.ic_back_photo ? (
                    <div
                      className="bg-zinc-50 rounded-lg border border-zinc-200 p-2 cursor-pointer hover:border-amber-400 transition-colors"
                      onClick={() =>
                        window.open(
                          getStorageUrl(customer.ic_back_photo),
                          "_blank"
                        )
                      }
                    >
                      <img
                        src={getStorageUrl(customer.ic_back_photo)}
                        alt="IC Back"
                        className="w-full h-32 object-contain rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-32 bg-zinc-100 rounded-lg border border-zinc-200 flex items-center justify-center">
                      <span className="text-xs text-zinc-400">
                        Not uploaded
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {/* Selfie Photo */}
              {customer.selfie_photo && (
                <div className="mt-4">
                  <p className="text-sm text-zinc-500 mb-2">Selfie</p>
                  <img
                    src={getStorageUrl(customer.selfie_photo)}
                    alt="Selfie"
                    className="w-20 h-20 object-cover rounded-lg border border-zinc-200 cursor-pointer hover:opacity-90"
                    onClick={() =>
                      window.open(
                        getStorageUrl(customer.selfie_photo),
                        "_blank"
                      )
                    }
                  />
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column - Pledges & Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-full"
            >
              <Card className="p-4 h-full">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-500">Total Pledges</p>
                    <p className="text-xl font-semibold text-zinc-800 truncate">
                      {statistics?.total_pledges ?? customer.total_pledges ?? 0}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="h-full"
            >
              <Card className="p-4 h-full">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-500">Active</p>
                    <p className="text-xl font-semibold text-zinc-800 truncate">
                      {statistics?.active_pledges ??
                        customer.active_pledges_count ??
                        0}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="h-full"
            >
              <Card className="p-4 h-full">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-500">Total Value</p>
                    <p className="text-xl font-semibold text-zinc-800 truncate">
                      {formatCurrency(statistics?.total_loan_amount ?? 0)}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="h-full"
            >
              <Card className="p-4 h-full">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-500">Overdue</p>
                    <p className="text-xl font-semibold text-zinc-800 truncate">
                      {statistics?.overdue_pledges ?? 0}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Pledges Tab */}
          <Card>
            <div className="border-b border-zinc-100">
              <div className="flex">
                <button
                  onClick={() => setActiveTab("active")}
                  className={cn(
                    "px-6 py-3 text-sm font-medium transition-colors",
                    activeTab === "active"
                      ? "text-amber-600 border-b-2 border-amber-500"
                      : "text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  Active Pledges
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={cn(
                    "px-6 py-3 text-sm font-medium transition-colors",
                    activeTab === "history"
                      ? "text-amber-600 border-b-2 border-amber-500"
                      : "text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  All History
                </button>
              </div>
            </div>

            {/* Pledges Table */}
            <div className="overflow-x-auto">
              {isPledgesLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 text-amber-500 animate-spin mx-auto mb-2" />
                  <p className="text-zinc-500">Loading pledges...</p>
                </div>
              ) : filteredPledges.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                  <p className="text-zinc-500 mb-4">No pledges found</p>
                  <Button onClick={handleNewPledge}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Pledge
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {filteredPledges.map((pledge) => {
                    const config =
                      statusConfig[pledge.status] || statusConfig.active;
                    const isExpanded = expandedPledge === pledge.id;
                    const items = pledge.items || [];

                    // Calculate interest (if available from API)
                    const principal = parseFloat(
                      pledge.loan_amount || pledge.principal_amount || 0
                    );
                    const interestRate = parseFloat(
                      pledge.interest_rate || 0.5
                    );
                    const monthsElapsed = pledge.months_elapsed || 1;
                    const accruedInterest =
                      pledge.accrued_interest ||
                      principal * (interestRate / 100) * monthsElapsed;
                    const totalPayable =
                      pledge.total_payable || principal + accruedInterest;

                    return (
                      <div key={pledge.id} className="bg-white">
                        {/* Main Row - Clickable to expand */}
                        <div
                          className="flex items-center justify-between p-4 hover:bg-zinc-50 cursor-pointer transition-colors"
                          onClick={() =>
                            setExpandedPledge(isExpanded ? null : pledge.id)
                          }
                        >
                          <div className="flex items-center gap-4 flex-1">
                            {/* Expand Icon */}
                            <button className="p-1 text-zinc-400 hover:text-zinc-600">
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </button>

                            {/* Pledge Info */}
                            <div className="min-w-[120px]">
                              <p className="font-mono text-amber-600 font-medium">
                                {pledge.pledge_no ||
                                  pledge.pledge_number ||
                                  pledge.id}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {formatDate(
                                  pledge.pledge_date || pledge.created_at
                                )}
                              </p>
                            </div>

                            {/* Items Count */}
                            <div className="min-w-[80px]">
                              <div className="flex items-center gap-1.5">
                                <Package className="w-4 h-4 text-zinc-400" />
                                <span className="text-zinc-600">
                                  {pledge.items_count || items.length || 0}{" "}
                                  items
                                </span>
                              </div>
                            </div>

                            {/* Loan Amount */}
                            <div className="min-w-[120px]">
                              <p className="text-xs text-zinc-500">Principal</p>
                              <p className="font-semibold text-zinc-800">
                                {formatCurrency(principal)}
                              </p>
                            </div>

                            {/* Interest */}
                            <div className="min-w-[100px]">
                              <p className="text-xs text-zinc-500">
                                Interest ({interestRate}%)
                              </p>
                              <p className="font-medium text-amber-600">
                                {formatCurrency(accruedInterest)}
                              </p>
                            </div>

                            {/* Total Payable */}
                            <div className="min-w-[120px]">
                              <p className="text-xs text-zinc-500">
                                Total Payable
                              </p>
                              <p className="font-bold text-emerald-600">
                                {formatCurrency(totalPayable)}
                              </p>
                            </div>

                            {/* Due Date */}
                            <div className="min-w-[100px]">
                              <p className="text-xs text-zinc-500">Due Date</p>
                              <p
                                className={cn(
                                  "text-sm font-medium",
                                  pledge.status === "overdue"
                                    ? "text-red-600"
                                    : "text-zinc-700"
                                )}
                              >
                                {formatDate(
                                  pledge.due_date || pledge.maturity_date
                                )}
                              </p>
                            </div>

                            {/* Status */}
                            <Badge variant={config.variant}>
                              {config.label}
                            </Badge>
                          </div>

                          {/* View Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewPledge(pledge.id);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Expanded Content - Items List & Interest Breakdown */}
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="px-4 pb-4 bg-zinc-50 border-t border-zinc-100"
                          >
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4">
                              {/* Items List */}
                              <div>
                                <h4 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                                  <Package className="w-4 h-4 text-amber-500" />
                                  Pledged Items
                                </h4>
                                {items.length > 0 ? (
                                  <div className="space-y-2">
                                    {items.map((item, idx) => {
                                      const itemPhoto =
                                        item.photo ||
                                        item.photo_url ||
                                        item.image ||
                                        null;
                                      return (
                                        <div
                                          key={item.id || idx}
                                          className="flex items-center gap-3 p-3 bg-white rounded-lg border border-zinc-200"
                                        >
                                          {/* Item Photo */}
                                          {itemPhoto ? (
                                            <img
                                              src={itemPhoto}
                                              alt={item.description || "Item"}
                                              className="w-10 h-10 rounded-lg object-cover border border-zinc-200"
                                            />
                                          ) : (
                                            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                              <Package className="w-5 h-5 text-amber-600" />
                                            </div>
                                          )}

                                          {/* Item Details */}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-800 truncate">
                                              {item.description ||
                                                item.category?.name ||
                                                item.category_name ||
                                                "Gold Item"}
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                              {item.purity?.code ||
                                                item.purity?.name ||
                                                item.purity_name ||
                                                item.purity}{" "}
                                              •{" "}
                                              {parseFloat(
                                                item.net_weight ||
                                                  item.weight ||
                                                  0
                                              ).toFixed(2)}
                                              g
                                            </p>
                                          </div>

                                          {/* Item Value */}
                                          <div className="text-right">
                                            <p className="text-sm font-semibold text-zinc-800">
                                              {formatCurrency(
                                                item.net_value ||
                                                  item.value ||
                                                  0
                                              )}
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                              Loan:{" "}
                                              {formatCurrency(
                                                item.loan_amount || 0
                                              )}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-sm text-zinc-500 italic">
                                    No items data available
                                  </p>
                                )}
                              </div>

                              {/* Interest Breakdown */}
                              <div>
                                <h4 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4 text-amber-500" />
                                  Interest Calculation
                                </h4>
                                <div className="bg-white rounded-lg border border-zinc-200 p-4 space-y-3">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-zinc-500">
                                      Principal Amount
                                    </span>
                                    <span className="font-medium text-zinc-800">
                                      {formatCurrency(principal)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-zinc-500">
                                      Interest Rate
                                    </span>
                                    <span className="font-medium text-zinc-800">
                                      {interestRate}% / month
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-zinc-500">
                                      Duration
                                    </span>
                                    <span className="font-medium text-zinc-800">
                                      {monthsElapsed} month(s)
                                    </span>
                                  </div>

                                  {/* Monthly Breakdown (if available) */}
                                  {pledge.interest_breakdown &&
                                    pledge.interest_breakdown.length > 0 && (
                                      <div className="pt-2 border-t border-zinc-100">
                                        <p className="text-xs font-medium text-zinc-500 mb-2">
                                          Monthly Breakdown
                                        </p>
                                        {pledge.interest_breakdown.map(
                                          (month, idx) => (
                                            <div
                                              key={idx}
                                              className="flex justify-between text-xs py-1"
                                            >
                                              <span className="text-zinc-500">
                                                Month {month.month} (
                                                {month.rate}%)
                                              </span>
                                              <span className="text-zinc-700">
                                                {formatCurrency(month.interest)}
                                              </span>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    )}

                                  <div className="flex justify-between text-sm pt-2 border-t border-zinc-200">
                                    <span className="text-zinc-500">
                                      Accrued Interest
                                    </span>
                                    <span className="font-medium text-amber-600">
                                      {formatCurrency(accruedInterest)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-zinc-200">
                                    <span className="text-zinc-800">
                                      Total Payable
                                    </span>
                                    <span className="text-emerald-600">
                                      {formatCurrency(totalPayable)}
                                    </span>
                                  </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="flex gap-2 mt-3">
                                  {(pledge.status === "active" ||
                                    pledge.status === "overdue") && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() =>
                                          navigate(
                                            `/renewals?pledge=${pledge.id}`
                                          )
                                        }
                                      >
                                        <RefreshCw className="w-4 h-4 mr-1" />
                                        Renew
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() =>
                                          navigate(
                                            `/redemptions?pledge=${pledge.id}`
                                          )
                                        }
                                      >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Redeem
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* Remarks */}
          {customer.remarks && (
            <Card>
              <div className="p-5 border-b border-zinc-100">
                <h3 className="font-semibold text-zinc-800">Notes</h3>
              </div>
              <div className="p-5">
                <p className="text-zinc-600">{customer.remarks}</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
