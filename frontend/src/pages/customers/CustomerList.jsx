import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  setCustomers,
  deleteCustomer,
} from "@/features/customers/customersSlice";
import { addToast } from "@/features/ui/uiSlice";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Modal } from "@/components/common";
import {
  PermissionGate,
  usePermission,
} from "@/components/auth/PermissionGate";
import { customerService } from "@/services";
import { getStorageUrl } from "@/utils/helpers";
import {
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  Search,
  Plus,
  Download,
  Eye,
  Edit,
  Trash2,
  Phone,
  Mail,
  RefreshCw,
  CreditCard,
} from "lucide-react";

export default function CustomerList() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { customers, loading } = useAppSelector((state) => state.customers);

  // Permission checks
  const canCreate = usePermission("customers.create");
  const canEdit = usePermission("customers.edit");
  const canDelete = usePermission("customers.delete");

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Ref for synchronous guard against double calls
  const isDeleteInProgress = useRef(false);

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setIsRefreshing(true);
    try {
      const response = await customerService.getAll();
      const customerData = response.data?.data || response.data || [];
      dispatch(setCustomers(customerData));
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to load customers",
        }),
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle delete
  const handleDeleteClick = (e, customer) => {
    e.stopPropagation();
    // Reset ref when opening modal for new delete
    isDeleteInProgress.current = false;
    setCustomerToDelete(customer);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    // SYNCHRONOUS guard using ref - prevents double calls
    if (isDeleteInProgress.current) return;
    if (!customerToDelete) return;

    // Set ref IMMEDIATELY (synchronous)
    isDeleteInProgress.current = true;

    // Store values BEFORE clearing state
    const customerId = customerToDelete.id;
    const customerName = customerToDelete.name;

    // Close modal and update UI state
    setIsDeleting(true);
    setShowDeleteModal(false);
    setCustomerToDelete(null);

    try {
      await customerService.delete(customerId);
      dispatch(deleteCustomer(customerId));
      dispatch(
        addToast({
          type: "success",
          title: "Deleted",
          message: `${customerName} has been deleted`,
        }),
      );
      // Refresh list after successful delete
      fetchCustomers();
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message;

      if (status === 404) {
        dispatch(
          addToast({
            type: "warning",
            title: "Not Found",
            message: "Customer already deleted. Refreshing list...",
          }),
        );
        fetchCustomers();
      } else if (status === 422) {
        dispatch(
          addToast({
            type: "error",
            title: "Cannot Delete",
            message: message || "Customer has active pledges",
          }),
        );
      } else {
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: message || "Failed to delete customer",
          }),
        );
      }
    } finally {
      setIsDeleting(false);
      // Reset ref after operation complete
      isDeleteInProgress.current = false;
    }
  };

  // Filter customers
  const filteredCustomers = customers.filter((customer) => {
    // Search filter
    const matchesSearch =
      searchQuery === "" ||
      customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.ic_number?.includes(searchQuery) ||
      customer.phone?.includes(searchQuery) ||
      customer.customer_no?.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && customer.active_pledges > 0) ||
      (filterStatus === "with-pledges" && customer.total_pledges > 0);

    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: customers.length,
    active: customers.filter((c) => c.active_pledges > 0).length,
    withPledges: customers.filter((c) => c.total_pledges > 0).length,
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <PageWrapper
      title="Customers"
      subtitle="Manage customer records and profiles"
      actions={
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            leftIcon={RefreshCw}
            onClick={fetchCustomers}
            disabled={isRefreshing}
          >
            Refresh
          </Button>
          {canCreate && (
            <Button
              variant="accent"
              leftIcon={Plus}
              onClick={() => navigate("/customers/new")}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              Add Customer
            </Button>
          )}
        </div>
      }
    >
      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <Users className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Total Customers</p>
              <p className="text-2xl font-bold text-zinc-800">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Active Customers</p>
              <p className="text-2xl font-bold text-zinc-800">{stats.active}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">With Active Pledges</p>
              <p className="text-2xl font-bold text-zinc-800">
                {stats.withPledges}
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Customer List Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          {/* Search and Filters */}
          <div className="p-4 border-b border-zinc-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search by name, IC, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
              </div>

              {/* Filter Buttons - Amber Style */}
              <div className="flex items-center gap-2">
                {[
                  { key: "all", label: "All" },
                  { key: "active", label: "Active" },
                  { key: "with-pledges", label: "With Pledges" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setFilterStatus(filter.key)}
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                      filterStatus === filter.key
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-zinc-100 text-zinc-600 hover:bg-amber-50 hover:text-amber-600",
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-gradient-to-r from-zinc-100 to-zinc-50 border-b-2 border-amber-200 text-xs font-bold text-zinc-700 uppercase tracking-wider">
            <div className="col-span-3">Customer</div>
            <div className="col-span-2">IC Number</div>
            <div className="col-span-3">Contact</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Registered</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {/* Customer List */}
          <div className="divide-y divide-zinc-100">
            {loading || isRefreshing ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 text-amber-500 mx-auto mb-3 animate-spin" />
                <p className="text-zinc-500">Loading customers...</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                <p className="text-zinc-500 mb-4">No customers found</p>
                <Button
                  variant="accent"
                  size="sm"
                  leftIcon={Plus}
                  onClick={() => navigate("/customers/new")}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  Add First Customer
                </Button>
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className="grid grid-cols-12 gap-4 p-4 hover:bg-zinc-50 cursor-pointer transition-colors items-center"
                >
                  {/* Customer Info with Avatar */}
                  <div className="col-span-12 md:col-span-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar - Shows image if available, otherwise initial */}
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {customer.selfie_photo ? (
                          <img
                            src={getStorageUrl(customer.selfie_photo)}
                            alt={customer.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextSibling.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <span
                          className={cn(
                            "text-lg font-semibold text-amber-600",
                            customer.selfie_photo && "hidden",
                          )}
                        >
                          {customer.name?.charAt(0)?.toUpperCase() || "C"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-800 truncate text-[15px]">
                          {customer.name}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {customer.customer_no}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* IC Number */}
                  <div className="col-span-6 md:col-span-2">
                    <p className="text-sm text-zinc-600 font-mono">
                      {customer.ic_number}
                    </p>
                  </div>

                  {/* Contact */}
                  <div className="col-span-6 md:col-span-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <Phone className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{customer.phone}</span>
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                          <Mail className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-4 md:col-span-1">
                    <span
                      className={cn(
                        "inline-flex px-2.5 py-1 text-xs font-medium rounded-full",
                        customer.active_pledges > 0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600",
                      )}
                    >
                      {customer.active_pledges > 0 ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Registered Date */}
                  <div className="col-span-4 md:col-span-2">
                    <p className="text-sm text-zinc-600">
                      {formatDate(customer.created_at)}
                    </p>
                  </div>

                  {/* Actions - View, Edit, Delete */}
                  <div className="col-span-4 md:col-span-1">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/customers/${customer.id}`);
                        }}
                        className="p-2 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/customers/${customer.id}/edit`);
                          }}
                          className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={(e) => handleDeleteClick(e, customer)}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {filteredCustomers.length > 0 && (
            <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between text-sm text-zinc-500">
              <span>
                Showing 1 to {filteredCustomers.length} of{" "}
                {filteredCustomers.length} customers
              </span>
              <div className="flex items-center gap-2">
                <span>Page 1 of 1</span>
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setCustomerToDelete(null);
        }}
        title="Delete Customer"
        size="sm"
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="font-medium text-zinc-800">
                Delete "{customerToDelete?.name}"?
              </p>
              <p className="text-sm text-zinc-500">
                This action cannot be undone.
              </p>
            </div>
          </div>

          {customerToDelete?.active_pledges > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <p className="text-sm text-amber-800">
                ⚠️ This customer has {customerToDelete.active_pledges} active
                pledge(s). You cannot delete customers with active pledges.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setCustomerToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              disabled={isDeleting || customerToDelete?.active_pledges > 0}
              leftIcon={isDeleting ? RefreshCw : Trash2}
              className={isDeleting ? "animate-pulse" : ""}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
