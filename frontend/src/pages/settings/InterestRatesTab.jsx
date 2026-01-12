/**
 * InterestRatesTab - Interest Rates Management with API Integration
 * Replaces localStorage version with backend API calls
 */

import { useState, useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { settingsService } from "@/services";
import { cn } from "@/lib/utils";
import { Card, Button, Input, Modal, Badge, Select } from "@/components/common";
import {
  TrendingUp,
  Plus,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  Edit,
  Info,
  Calendar,
} from "lucide-react";

// Rate type options
const RATE_TYPES = [
  { value: "standard", label: "Standard", description: "First 6 months" },
  {
    value: "extended",
    label: "Extended",
    description: "After 6 months (maintained)",
  },
  {
    value: "overdue",
    label: "Overdue",
    description: "Not maintained / Overdue",
  },
];

export default function InterestRatesTab() {
  const dispatch = useAppDispatch();

  // State
  const [rates, setRates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    name: "",
    rate_type: "standard",
    rate_percentage: "",
    from_month: "1",
    to_month: "",
    description: "",
  });
  const [editingRate, setEditingRate] = useState(null);
  const [deletingRate, setDeletingRate] = useState(null);

  // Action states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch rates on mount
  useEffect(() => {
    fetchRates();
  }, []);

  // Fetch all interest rates from API
  const fetchRates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await settingsService.getInterestRates();
      if (response.success) {
        const data = response.data?.data || response.data || [];
        setRates(data);
      } else {
        throw new Error(response.message || "Failed to fetch interest rates");
      }
    } catch (err) {
      console.error("Error fetching interest rates:", err);
      setError(err.message || "Failed to load interest rates");
    } finally {
      setIsLoading(false);
    }
  };

  // Add new rate
  const handleAdd = async () => {
    if (!formData.name || !formData.rate_percentage) {
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Validation Error",
          message: "Name and rate percentage are required",
        })
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        rate_type: formData.rate_type,
        rate_percentage: parseFloat(formData.rate_percentage),
        from_month: formData.from_month ? parseInt(formData.from_month) : null,
        to_month: formData.to_month ? parseInt(formData.to_month) : null,
        description: formData.description || null,
      };

      const response = await settingsService.createInterestRate(payload);

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Interest Rate Added",
            message: `${formData.name} has been added successfully`,
          })
        );
        resetForm();
        setShowAddModal(false);
        fetchRates();
      } else {
        throw new Error(response.message || "Failed to add interest rate");
      }
    } catch (err) {
      console.error("Error adding interest rate:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to add interest rate",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Open edit modal
  const openEditModal = (rate) => {
    setEditingRate(rate);
    setFormData({
      name: rate.name || "",
      rate_type: rate.rate_type || "standard",
      rate_percentage: rate.rate_percentage?.toString() || "",
      from_month: rate.from_month?.toString() || "",
      to_month: rate.to_month?.toString() || "",
      description: rate.description || "",
    });
    setShowEditModal(true);
  };

  // Update rate
  const handleUpdate = async () => {
    if (!editingRate) return;

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        rate_type: formData.rate_type,
        rate_percentage: parseFloat(formData.rate_percentage),
        from_month: formData.from_month ? parseInt(formData.from_month) : null,
        to_month: formData.to_month ? parseInt(formData.to_month) : null,
        description: formData.description || null,
      };

      const response = await settingsService.updateInterestRate(
        editingRate.id,
        payload
      );

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Interest Rate Updated",
            message: `${formData.name} has been updated successfully`,
          })
        );
        setShowEditModal(false);
        setEditingRate(null);
        resetForm();
        fetchRates();
      } else {
        throw new Error(response.message || "Failed to update interest rate");
      }
    } catch (err) {
      console.error("Error updating interest rate:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to update interest rate",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle active status
  const handleToggle = async (rate) => {
    try {
      const response = await settingsService.updateInterestRate(rate.id, {
        is_active: !rate.is_active,
      });

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: rate.is_active ? "Rate Disabled" : "Rate Enabled",
            message: `${rate.name} has been ${
              rate.is_active ? "disabled" : "enabled"
            }`,
          })
        );
        fetchRates();
      } else {
        throw new Error(response.message || "Failed to update rate");
      }
    } catch (err) {
      console.error("Error toggling rate:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to update rate",
        })
      );
    }
  };

  // Delete rate
  const handleDelete = async () => {
    if (!deletingRate) return;

    setIsDeleting(true);
    try {
      const response = await settingsService.deleteInterestRate(
        deletingRate.id
      );

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Interest Rate Deleted",
            message: `${deletingRate.name} has been deleted`,
          })
        );
        setShowDeleteModal(false);
        setDeletingRate(null);
        fetchRates();
      } else {
        throw new Error(response.message || "Failed to delete interest rate");
      }
    } catch (err) {
      console.error("Error deleting interest rate:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to delete interest rate",
        })
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      rate_type: "standard",
      rate_percentage: "",
      from_month: "1",
      to_month: "",
      description: "",
    });
  };

  // Get badge variant based on rate type
  const getRateTypeBadge = (type) => {
    switch (type) {
      case "standard":
        return "success";
      case "extended":
        return "warning";
      case "overdue":
        return "error";
      default:
        return "secondary";
    }
  };

  // Group rates by type
  const groupedRates = RATE_TYPES.map((type) => ({
    ...type,
    rates: rates.filter((r) => r.rate_type === type.value),
  }));

  // Loading state
  if (isLoading) {
    return (
      <Card className="p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        <span className="ml-3 text-zinc-600">Loading interest rates...</span>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center py-8">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-zinc-600 mb-4">{error}</p>
          <Button variant="outline" leftIcon={RefreshCw} onClick={fetchRates}>
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-500" />
          Interest Rate Rules
          <Badge variant="secondary" className="ml-2">
            {rates.length}
          </Badge>
        </h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={RefreshCw}
            onClick={fetchRates}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={Plus}
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
          >
            Add Rate
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">
              Interest Calculation (KPKT Compliant)
            </p>
            <ul className="list-disc list-inside space-y-1 text-blue-600">
              <li>Interest is calculated monthly based on principal amount</li>
              <li>Standard rate applies for first 6 months</li>
              <li>Extended rate applies after 6 months if maintained</li>
              <li>Overdue rate applies if pledge is not maintained</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Rates by Type */}
      {rates.length === 0 ? (
        <div className="text-center py-12">
          <TrendingUp className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-500">No interest rates configured</p>
          <Button
            variant="outline"
            size="sm"
            leftIcon={Plus}
            className="mt-4"
            onClick={() => setShowAddModal(true)}
          >
            Add First Rate
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedRates.map((group) => (
            <div key={group.value}>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant={getRateTypeBadge(group.value)}>
                  {group.label}
                </Badge>
                <span className="text-sm text-zinc-500">
                  {group.description}
                </span>
              </div>

              {group.rates.length === 0 ? (
                <p className="text-sm text-zinc-400 italic ml-4">
                  No rates configured
                </p>
              ) : (
                <div className="space-y-2">
                  {group.rates.map((rate) => (
                    <div
                      key={rate.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all",
                        rate.is_active !== false
                          ? "border-zinc-200 bg-white"
                          : "border-zinc-100 bg-zinc-50 opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        {/* Toggle */}
                        <button
                          onClick={() => handleToggle(rate)}
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                            rate.is_active !== false
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-zinc-300"
                          )}
                        >
                          {rate.is_active !== false && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </button>

                        {/* Info */}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-zinc-800">
                              {rate.name}
                            </p>
                            <Badge variant="accent" size="sm">
                              {Number(rate.rate_percentage || 0).toFixed(2)}%
                            </Badge>
                          </div>
                          <p className="text-sm text-zinc-500">
                            {rate.from_month && rate.to_month
                              ? `Month ${rate.from_month} - ${rate.to_month}`
                              : rate.from_month
                              ? `From month ${rate.from_month}`
                              : "All months"}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(rate)}
                          className="text-zinc-400 hover:text-blue-500"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingRate(rate);
                            setShowDeleteModal(true);
                          }}
                          className="text-zinc-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rate Summary */}
      {rates.length > 0 && (
        <div className="mt-6 p-4 bg-zinc-50 rounded-xl">
          <p className="text-sm font-medium text-zinc-700 mb-2">
            Rate Summary:
          </p>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            {rates
              .filter((r) => r.is_active !== false)
              .map((rate, idx) => (
                <span key={rate.id} className="flex items-center gap-1">
                  <Badge variant={getRateTypeBadge(rate.rate_type)}>
                    {Number(rate.rate_percentage || 0).toFixed(2)}%
                  </Badge>
                  {idx <
                    rates.filter((r) => r.is_active !== false).length - 1 && (
                    <span className="text-zinc-400 mx-1">→</span>
                  )}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Interest Rate"
        size="md"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Rate Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Standard Rate (First 6 Months)"
          />
          <Select
            label="Rate Type"
            value={formData.rate_type}
            onChange={(e) =>
              setFormData({ ...formData, rate_type: e.target.value })
            }
            options={RATE_TYPES.map((t) => ({
              value: t.value,
              label: t.label,
            }))}
          />
          <Input
            label="Rate Percentage"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.rate_percentage}
            onChange={(e) =>
              setFormData({ ...formData, rate_percentage: e.target.value })
            }
            placeholder="e.g. 0.50"
            rightElement={<span className="text-zinc-400">%</span>}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="From Month"
              type="number"
              min="1"
              value={formData.from_month}
              onChange={(e) =>
                setFormData({ ...formData, from_month: e.target.value })
              }
              placeholder="e.g. 1"
            />
            <Input
              label="To Month (Optional)"
              type="number"
              min="1"
              value={formData.to_month}
              onChange={(e) =>
                setFormData({ ...formData, to_month: e.target.value })
              }
              placeholder="e.g. 6"
              helperText="Leave empty for no limit"
            />
          </div>
          <Input
            label="Description (Optional)"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Optional description"
          />
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              fullWidth
              onClick={handleAdd}
              loading={isSaving}
            >
              Add Rate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingRate(null);
        }}
        title="Edit Interest Rate"
        size="md"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Rate Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Standard Rate (First 6 Months)"
          />
          <Select
            label="Rate Type"
            value={formData.rate_type}
            onChange={(e) =>
              setFormData({ ...formData, rate_type: e.target.value })
            }
            options={RATE_TYPES.map((t) => ({
              value: t.value,
              label: t.label,
            }))}
          />
          <Input
            label="Rate Percentage"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.rate_percentage}
            onChange={(e) =>
              setFormData({ ...formData, rate_percentage: e.target.value })
            }
            placeholder="e.g. 0.50"
            rightElement={<span className="text-zinc-400">%</span>}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="From Month"
              type="number"
              min="1"
              value={formData.from_month}
              onChange={(e) =>
                setFormData({ ...formData, from_month: e.target.value })
              }
              placeholder="e.g. 1"
            />
            <Input
              label="To Month (Optional)"
              type="number"
              min="1"
              value={formData.to_month}
              onChange={(e) =>
                setFormData({ ...formData, to_month: e.target.value })
              }
              placeholder="e.g. 6"
            />
          </div>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setShowEditModal(false);
                setEditingRate(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              fullWidth
              onClick={handleUpdate}
              loading={isSaving}
            >
              Update Rate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingRate(null);
        }}
        title="Delete Interest Rate"
        size="sm"
      >
        <div className="p-5">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-medium text-red-800">Are you sure?</p>
              <p className="text-sm text-red-600">
                This will permanently delete "{deletingRate?.name}"
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingRate(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={handleDelete}
              loading={isDeleting}
            >
              Delete Rate
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
