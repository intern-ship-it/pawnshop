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
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-zinc-400" />
                    <span className="text-zinc-600">{customer.phone}</span>
                  </div>
                )}
                {customer.whatsapp && customer.whatsapp !== customer.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-emerald-500" />
                    <span className="text-zinc-600">
                      {customer.whatsapp} (WhatsApp)
                    </span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-zinc-400" />
                    <span className="text-zinc-600">{customer.email}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-zinc-400 mt-1" />
                    <span className="text-zinc-600">
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
                    <img
                      src={getStorageUrl(customer.ic_front_photo)}
                      alt="IC Front"
                      className="w-full h-24 object-cover rounded-lg border border-zinc-200 cursor-pointer hover:opacity-90"
                      onClick={() =>
                        window.open(
                          getStorageUrl(customer.ic_front_photo),
                          "_blank"
                        )
                      }
                    />
                  ) : (
                    <div className="w-full h-24 bg-zinc-100 rounded-lg border border-zinc-200 flex items-center justify-center">
                      <span className="text-xs text-zinc-400">
                        Not uploaded
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-zinc-500 mb-2">Back</p>
                  {customer.ic_back_photo ? (
                    <img
                      src={getStorageUrl(customer.ic_back_photo)}
                      alt="IC Back"
                      className="w-full h-24 object-cover rounded-lg border border-zinc-200 cursor-pointer hover:opacity-90"
                      onClick={() =>
                        window.open(
                          getStorageUrl(customer.ic_back_photo),
                          "_blank"
                        )
                      }
                    />
                  ) : (
                    <div className="w-full h-24 bg-zinc-100 rounded-lg border border-zinc-200 flex items-center justify-center">
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
            >
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Total Pledges</p>
                    <p className="text-xl font-semibold text-zinc-800">
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
            >
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Active</p>
                    <p className="text-xl font-semibold text-zinc-800">
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
            >
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Total Value</p>
                    <p className="text-xl font-semibold text-zinc-800">
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
            >
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Overdue</p>
                    <p className="text-xl font-semibold text-zinc-800">
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
                <table className="w-full">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                        Pledge No
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                        Items
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase">
                        Loan Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                        Due Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredPledges.map((pledge) => {
                      const config =
                        statusConfig[pledge.status] || statusConfig.active;
                      return (
                        <tr
                          key={pledge.id}
                          className="hover:bg-zinc-50 transition-colors"
                        >
                          <td className="px-4 py-4">
                            <span className="font-mono text-amber-600 font-medium">
                              {pledge.pledge_number || pledge.id}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-zinc-600">
                            {formatDate(
                              pledge.pledge_date || pledge.created_at
                            )}
                          </td>
                          <td className="px-4 py-4 text-zinc-600">
                            {pledge.items_count || pledge.items?.length || 0}{" "}
                            items
                          </td>
                          <td className="px-4 py-4 text-right text-zinc-800 font-medium">
                            {formatCurrency(
                              pledge.loan_amount || pledge.principal_amount
                            )}
                          </td>
                          <td className="px-4 py-4 text-zinc-600">
                            {formatDate(
                              pledge.due_date || pledge.maturity_date
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant={config.variant}>
                              {config.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewPledge(pledge.id)}
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
