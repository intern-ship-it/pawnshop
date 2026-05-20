import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  setCustomers,
  deleteCustomer,
} from "@/features/customers/customersSlice";
import { addToast } from "@/features/ui/uiSlice";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
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
  Printer,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

const PER_PAGE_OPTIONS = [15, 25, 50, 100];
const SEARCH_DEBOUNCE_MS = 400;

// Build a compact page list with ellipses: 1 … 4 5 [6] 7 8 … 20
function buildPageList(current, last) {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages = new Set([1, last, current, current - 1, current + 1]);
  if (current <= 4) [2, 3, 4, 5].forEach((p) => pages.add(p));
  if (current >= last - 3)
    [last - 4, last - 3, last - 2, last - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
}

export default function CustomerList() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { customers } = useAppSelector((state) => state.customers);

  // Permission checks
  const canCreate = usePermission("customers.create");
  const canEdit = usePermission("customers.edit");
  const canDelete = usePermission("customers.delete");

  // URL is the source of truth for page/search/status/per_page
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = PER_PAGE_OPTIONS.includes(parseInt(searchParams.get("per_page"), 10))
    ? parseInt(searchParams.get("per_page"), 10)
    : 15;
  const status = searchParams.get("status") || "all";
  const urlSearch = searchParams.get("search") || "";

  // Local input (debounced into URL)
  const [searchInput, setSearchInput] = useState(urlSearch);

  // Pagination meta from server
  const [meta, setMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: perPage,
    total: 0,
  });

  // Stats (full dataset, branch-scoped)
  const [stats, setStats] = useState({ total: 0, active: 0, with_pledges: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeleteInProgress = useRef(false);

  // Track in-flight list request so we can abort stale ones
  const listAbortRef = useRef(null);

  // Helper to update URL params (preserves others, resets page when needed)
  const updateParams = useCallback(
    (updates, { resetPage = false } = {}) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(updates).forEach(([k, v]) => {
            if (v === null || v === undefined || v === "" || v === "all") {
              next.delete(k);
            } else {
              next.set(k, String(v));
            }
          });
          if (resetPage) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Debounce search input -> URL
  useEffect(() => {
    if (searchInput === urlSearch) return;
    const t = setTimeout(() => {
      updateParams({ search: searchInput }, { resetPage: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Fetch list whenever URL params change
  const fetchCustomers = useCallback(
    async ({ silent = false } = {}) => {
      // Abort any in-flight request
      if (listAbortRef.current) listAbortRef.current.abort();
      const controller = new AbortController();
      listAbortRef.current = controller;

      if (silent) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const response = await customerService.getAll(
          {
            page: currentPage,
            per_page: perPage,
            search: urlSearch || undefined,
            status: status !== "all" ? status : undefined,
          },
          { signal: controller.signal },
        );
        const list = response.data || [];
        const m = response.meta || {
          current_page: currentPage,
          last_page: 1,
          per_page: perPage,
          total: list.length,
        };
        dispatch(setCustomers(list));
        setMeta(m);

        // If we asked for a page beyond last_page (e.g. after a delete), snap back
        if (m.last_page > 0 && currentPage > m.last_page) {
          updateParams({ page: m.last_page });
        }
      } catch (error) {
        if (error?.message === "canceled" || controller.signal.aborted) return;
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: "Failed to load customers",
          }),
        );
      } finally {
        if (listAbortRef.current === controller) listAbortRef.current = null;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentPage, perPage, urlSearch, status, dispatch, updateParams],
  );

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await customerService.getStats();
      setStats(response.data || { total: 0, active: 0, with_pledges: 0 });
    } catch (error) {
      // Stats are non-critical; fail silently
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Keep searchInput synced if URL search is changed externally (back button etc.)
  useEffect(() => {
    setSearchInput(urlSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch]);

  // Delete handling
  const handleDeleteClick = (e, customer) => {
    e.stopPropagation();
    isDeleteInProgress.current = false;
    setCustomerToDelete(customer);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (isDeleteInProgress.current) return;
    if (!customerToDelete) return;
    isDeleteInProgress.current = true;

    const customerId = customerToDelete.id;
    const customerName = customerToDelete.name;

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
      fetchCustomers({ silent: true });
      fetchStats();
    } catch (error) {
      const httpStatus = error.response?.status;
      const message = error.response?.data?.message;

      if (httpStatus === 404) {
        dispatch(
          addToast({
            type: "warning",
            title: "Not Found",
            message: "Customer already deleted. Refreshing list...",
          }),
        );
        fetchCustomers({ silent: true });
        fetchStats();
      } else if (httpStatus === 422) {
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
      isDeleteInProgress.current = false;
    }
  };

  // Pagination derived values
  const from = meta.total === 0 ? 0 : (meta.current_page - 1) * meta.per_page + 1;
  const to = Math.min(meta.current_page * meta.per_page, meta.total);
  const pageList = useMemo(
    () => buildPageList(meta.current_page, meta.last_page),
    [meta.current_page, meta.last_page],
  );

  const goToPage = (p) => {
    if (p < 1 || p > meta.last_page || p === meta.current_page) return;
    updateParams({ page: p === 1 ? null : p });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const hasActiveFilters = urlSearch !== "" || status !== "all";
  const showEmpty = !isLoading && customers.length === 0;

  return (
    <PageWrapper
      title="Customers"
      subtitle="Manage customer records and profiles"
      fullWidth={true}
      actions={
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            leftIcon={RefreshCw}
            onClick={() => {
              fetchCustomers({ silent: true });
              fetchStats();
            }}
            disabled={isRefreshing || isLoading}
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
              <p className="text-2xl font-bold text-zinc-800">
                {statsLoading ? "…" : stats.total}
              </p>
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
              <p className="text-2xl font-bold text-zinc-800">
                {statsLoading ? "…" : stats.active}
              </p>
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
                {statsLoading ? "…" : stats.with_pledges}
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
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search by name, IC, phone, or customer no..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600"
                    title="Clear"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {[
                  { key: "all", label: "All" },
                  { key: "active", label: "Active" },
                  { key: "with-pledges", label: "With Pledges" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() =>
                      updateParams({ status: filter.key }, { resetPage: true })
                    }
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                      status === filter.key
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

          {/* List */}
          <div className="divide-y divide-zinc-100">
            {isLoading ? (
              // Skeleton rows
              Array.from({ length: Math.min(perPage, 8) }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-4 p-4 items-center animate-pulse"
                >
                  <div className="col-span-12 md:col-span-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-zinc-200 rounded w-2/3" />
                      <div className="h-2 bg-zinc-100 rounded w-1/3" />
                    </div>
                  </div>
                  <div className="hidden md:block col-span-2 h-3 bg-zinc-200 rounded" />
                  <div className="hidden md:block col-span-3 h-3 bg-zinc-200 rounded" />
                  <div className="hidden md:block col-span-1 h-5 bg-zinc-200 rounded-full" />
                  <div className="hidden md:block col-span-2 h-3 bg-zinc-200 rounded" />
                  <div className="hidden md:block col-span-1 h-6 bg-zinc-200 rounded" />
                </div>
              ))
            ) : showEmpty ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                {hasActiveFilters ? (
                  <>
                    <p className="text-zinc-500 mb-4">
                      No customers match your filters
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSearchParams({}, { replace: true })
                      }
                    >
                      Clear filters
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-zinc-500 mb-4">No customers yet</p>
                    {canCreate && (
                      <Button
                        variant="accent"
                        size="sm"
                        leftIcon={Plus}
                        onClick={() => navigate("/customers/new")}
                        className="bg-amber-500 hover:bg-amber-600"
                      >
                        Add First Customer
                      </Button>
                    )}
                  </>
                )}
              </div>
            ) : (
              customers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className="grid grid-cols-12 gap-4 p-4 hover:bg-zinc-50 cursor-pointer transition-colors items-center"
                >
                  {/* Customer Info with Avatar */}
                  <div className="col-span-12 md:col-span-3">
                    <div className="flex items-center gap-3">
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

                  {/* IC */}
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
                        <span>
                          {customer.country_code
                            ? `${customer.country_code.startsWith("+") ? "" : "+"}${customer.country_code} `
                            : ""}
                          {customer.phone}
                        </span>
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

                  {/* Registered */}
                  <div className="col-span-4 md:col-span-2">
                    <p className="text-sm text-zinc-600">
                      {formatDate(customer.created_at)}
                    </p>
                  </div>

                  {/* Actions */}
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/customers/${customer.id}?print=1`);
                        }}
                        className="p-2 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Print Profile"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
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

          {/* Footer: pagination */}
          {!isLoading && meta.total > 0 && (
            <div className="px-4 py-3 border-t border-zinc-100 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-zinc-600">
              <div className="flex items-center gap-4">
                <span>
                  Showing <span className="font-medium">{from}</span>–
                  <span className="font-medium">{to}</span> of{" "}
                  <span className="font-medium">{meta.total}</span> customers
                </span>
                <div className="flex items-center gap-2">
                  <label htmlFor="per-page" className="text-zinc-500">
                    Rows:
                  </label>
                  <select
                    id="per-page"
                    value={perPage}
                    onChange={(e) =>
                      updateParams(
                        { per_page: parseInt(e.target.value, 10) },
                        { resetPage: true },
                      )
                    }
                    className="bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    {PER_PAGE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(meta.current_page - 1)}
                  disabled={meta.current_page <= 1 || isRefreshing}
                  className="p-2 rounded-lg text-zinc-500 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-500 transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {pageList.map((p, idx) =>
                  p === "…" ? (
                    <span
                      key={`e-${idx}`}
                      className="px-2 text-zinc-400 select-none"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p)}
                      disabled={isRefreshing}
                      className={cn(
                        "min-w-[2rem] h-8 px-2 rounded-lg text-sm font-medium transition-colors",
                        p === meta.current_page
                          ? "bg-amber-500 text-white shadow-sm"
                          : "text-zinc-600 hover:bg-amber-50 hover:text-amber-600",
                      )}
                    >
                      {p}
                    </button>
                  ),
                )}

                <button
                  onClick={() => goToPage(meta.current_page + 1)}
                  disabled={meta.current_page >= meta.last_page || isRefreshing}
                  className="p-2 rounded-lg text-zinc-500 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-500 transition-colors"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
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
