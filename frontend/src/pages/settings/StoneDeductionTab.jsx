/**
 * StoneDeductionTab - Stone Deduction Management with API Integration
 * Replaces localStorage version with backend API calls
 */

import { useState, useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { settingsService } from "@/services";
import { cn } from "@/lib/utils";
import { Card, Button, Input, Modal, Badge, Select } from "@/components/common";
import {
  Scale,
  Plus,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  Edit,
  Info,
  Star,
  Percent,
  DollarSign,
  Weight,
} from "lucide-react";

// Deduction type options
const DEDUCTION_TYPES = [
  { value: "percentage", label: "Percentage (%)", icon: Percent },
  { value: "amount", label: "Amount (RM)", icon: DollarSign },
  { value: "grams", label: "Weight (grams)", icon: Weight },
];

export default function StoneDeductionTab() {
  const dispatch = useAppDispatch();

  // State
  const [deductions, setDeductions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    name: "",
    deduction_type: "percentage",
    value: "",
    is_default: false,
  });
  const [editingDeduction, setEditingDeduction] = useState(null);
  const [deletingDeduction, setDeletingDeduction] = useState(null);

  // Action states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch deductions on mount
  useEffect(() => {
    fetchDeductions();
  }, []);

  // Fetch all deductions from API
  const fetchDeductions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await settingsService.getStoneDeductions();
      if (response.success) {
        const data = response.data?.data || response.data || [];
        setDeductions(data);
      } else {
        throw new Error(response.message || "Failed to fetch stone deductions");
      }
    } catch (err) {
      console.error("Error fetching stone deductions:", err);
      setError(err.message || "Failed to load stone deductions");
    } finally {
      setIsLoading(false);
    }
  };

  // Add new deduction
  const handleAdd = async () => {
    if (!formData.name || formData.value === "") {
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Validation Error",
          message: "Name and value are required",
        })
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        deduction_type: formData.deduction_type,
        value: parseFloat(formData.value),
        is_default: formData.is_default,
        sort_order: deductions.length + 1,
      };

      const response = await settingsService.createStoneDeduction(payload);

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Deduction Added",
            message: `${formData.name} has been added successfully`,
          })
        );
        resetForm();
        setShowAddModal(false);
        fetchDeductions();
      } else {
        throw new Error(response.message || "Failed to add stone deduction");
      }
    } catch (err) {
      console.error("Error adding stone deduction:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to add stone deduction",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Open edit modal
  const openEditModal = (deduction) => {
    setEditingDeduction(deduction);
    setFormData({
      name: deduction.name || "",
      deduction_type: deduction.deduction_type || "percentage",
      value: deduction.value?.toString() || "",
      is_default: deduction.is_default || false,
    });
    setShowEditModal(true);
  };

  // Update deduction
  const handleUpdate = async () => {
    if (!editingDeduction) return;

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        deduction_type: formData.deduction_type,
        value: parseFloat(formData.value),
        is_default: formData.is_default,
      };

      const response = await settingsService.updateStoneDeduction(
        editingDeduction.id,
        payload
      );

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Deduction Updated",
            message: `${formData.name} has been updated successfully`,
          })
        );
        setShowEditModal(false);
        setEditingDeduction(null);
        resetForm();
        fetchDeductions();
      } else {
        throw new Error(response.message || "Failed to update stone deduction");
      }
    } catch (err) {
      console.error("Error updating stone deduction:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to update stone deduction",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle active status
  const handleToggle = async (deduction) => {
    try {
      const response = await settingsService.updateStoneDeduction(
        deduction.id,
        {
          is_active: !deduction.is_active,
        }
      );

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: deduction.is_active
              ? "Deduction Disabled"
              : "Deduction Enabled",
            message: `${deduction.name} has been ${
              deduction.is_active ? "disabled" : "enabled"
            }`,
          })
        );
        fetchDeductions();
      } else {
        throw new Error(response.message || "Failed to update deduction");
      }
    } catch (err) {
      console.error("Error toggling deduction:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to update deduction",
        })
      );
    }
  };

  // Set as default
  const handleSetDefault = async (deduction) => {
    try {
      // First, unset all other defaults of same type
      const sameTypeDeductions = deductions.filter(
        (d) => d.deduction_type === deduction.deduction_type && d.is_default
      );

      for (const d of sameTypeDeductions) {
        if (d.id !== deduction.id) {
          await settingsService.updateStoneDeduction(d.id, {
            is_default: false,
          });
        }
      }

      // Set this one as default
      const response = await settingsService.updateStoneDeduction(
        deduction.id,
        {
          is_default: true,
        }
      );

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Default Set",
            message: `${deduction.name} is now the default`,
          })
        );
        fetchDeductions();
      }
    } catch (err) {
      console.error("Error setting default:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to set default",
        })
      );
    }
  };

  // Delete deduction
  const handleDelete = async () => {
    if (!deletingDeduction) return;

    setIsDeleting(true);
    try {
      const response = await settingsService.deleteStoneDeduction(
        deletingDeduction.id
      );

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Deduction Deleted",
            message: `${deletingDeduction.name} has been deleted`,
          })
        );
        setShowDeleteModal(false);
        setDeletingDeduction(null);
        fetchDeductions();
      } else {
        throw new Error(response.message || "Failed to delete stone deduction");
      }
    } catch (err) {
      console.error("Error deleting stone deduction:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to delete stone deduction",
        })
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      deduction_type: "percentage",
      value: "",
      is_default: false,
    });
  };

  // Format value based on type
  const formatValue = (deduction) => {
    const value = Number(deduction.value || 0);
    switch (deduction.deduction_type) {
      case "percentage":
        return `${value.toFixed(1)}%`;
      case "amount":
        return `RM ${value.toFixed(2)}`;
      case "grams":
        return `${value.toFixed(2)}g`;
      default:
        return value.toString();
    }
  };

  // Get icon for deduction type
  const getTypeIcon = (type) => {
    const found = DEDUCTION_TYPES.find((t) => t.value === type);
    return found ? found.icon : Percent;
  };

  // Group deductions by type
  const groupedDeductions = DEDUCTION_TYPES.map((type) => ({
    ...type,
    deductions: deductions.filter((d) => d.deduction_type === type.value),
  }));

  // Loading state
  if (isLoading) {
    return (
      <Card className="p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        <span className="ml-3 text-zinc-600">Loading stone deductions...</span>
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
          <Button
            variant="outline"
            leftIcon={RefreshCw}
            onClick={fetchDeductions}
          >
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
          <Scale className="w-5 h-5 text-amber-500" />
          Stone Deduction Presets
          <Badge variant="secondary" className="ml-2">
            {deductions.length}
          </Badge>
        </h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={RefreshCw}
            onClick={fetchDeductions}
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
            Add Deduction
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Stone deduction is applied to gross weight to calculate net gold
            weight for valuation. You can create presets for percentage, fixed
            amount (RM), or weight (grams) deductions.
          </p>
        </div>
      </div>

      {/* Deductions by Type */}
      {deductions.length === 0 ? (
        <div className="text-center py-12">
          <Scale className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-500">No stone deductions configured</p>
          <Button
            variant="outline"
            size="sm"
            leftIcon={Plus}
            className="mt-4"
            onClick={() => setShowAddModal(true)}
          >
            Add First Deduction
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedDeductions.map((group) => {
            const TypeIcon = group.icon;
            return (
              <div key={group.value}>
                <div className="flex items-center gap-2 mb-3">
                  <TypeIcon className="w-4 h-4 text-zinc-500" />
                  <span className="font-medium text-zinc-700">
                    {group.label}
                  </span>
                  <Badge variant="secondary" size="sm">
                    {group.deductions.length}
                  </Badge>
                </div>

                {group.deductions.length === 0 ? (
                  <p className="text-sm text-zinc-400 italic ml-6">
                    No deductions
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.deductions.map((deduction) => (
                      <div
                        key={deduction.id}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all relative",
                          deduction.is_active !== false
                            ? deduction.is_default
                              ? "border-amber-300 bg-amber-50"
                              : "border-zinc-200 bg-white"
                            : "border-zinc-100 bg-zinc-50 opacity-60"
                        )}
                      >
                        {/* Default Badge */}
                        {deduction.is_default && (
                          <div className="absolute -top-2 -right-2">
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">
                              <Star className="w-3 h-3" /> Default
                            </span>
                          </div>
                        )}

                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium text-zinc-800">
                              {deduction.name}
                            </p>
                            <p className="text-2xl font-bold text-zinc-700 mt-1">
                              {formatValue(deduction)}
                            </p>
                          </div>

                          {/* Toggle */}
                          <button
                            onClick={() => handleToggle(deduction)}
                            className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                              deduction.is_active !== false
                                ? "bg-emerald-500 border-emerald-500"
                                : "border-zinc-300"
                            )}
                          >
                            {deduction.is_active !== false && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                          {!deduction.is_default &&
                            deduction.is_active !== false && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSetDefault(deduction)}
                                className="text-amber-600 hover:text-amber-700 text-xs"
                              >
                                <Star className="w-3 h-3 mr-1" />
                                Set Default
                              </Button>
                            )}
                          {deduction.is_default && (
                            <span className="text-xs text-amber-600">
                              Active Default
                            </span>
                          )}
                          <div className="flex items-center gap-1 ml-auto">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(deduction)}
                              className="text-zinc-400 hover:text-blue-500"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingDeduction(deduction);
                                setShowDeleteModal(true);
                              }}
                              className="text-zinc-400 hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Stone Deduction"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Deduction Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. 5% Stone"
          />
          <Select
            label="Deduction Type"
            value={formData.deduction_type}
            onChange={(e) =>
              setFormData({ ...formData, deduction_type: e.target.value })
            }
            options={DEDUCTION_TYPES.map((t) => ({
              value: t.value,
              label: t.label,
            }))}
          />
          <Input
            label="Value"
            type="number"
            step="0.01"
            min="0"
            value={formData.value}
            onChange={(e) =>
              setFormData({ ...formData, value: e.target.value })
            }
            placeholder={
              formData.deduction_type === "percentage"
                ? "e.g. 5"
                : formData.deduction_type === "amount"
                ? "e.g. 10.00"
                : "e.g. 0.5"
            }
            rightElement={
              <span className="text-zinc-400">
                {formData.deduction_type === "percentage"
                  ? "%"
                  : formData.deduction_type === "amount"
                  ? "RM"
                  : "g"}
              </span>
            }
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_default}
              onChange={(e) =>
                setFormData({ ...formData, is_default: e.target.checked })
              }
              className="w-4 h-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-zinc-700">
              Set as default for this type
            </span>
          </label>
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
              Add Deduction
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingDeduction(null);
        }}
        title="Edit Stone Deduction"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Deduction Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. 5% Stone"
          />
          <Select
            label="Deduction Type"
            value={formData.deduction_type}
            onChange={(e) =>
              setFormData({ ...formData, deduction_type: e.target.value })
            }
            options={DEDUCTION_TYPES.map((t) => ({
              value: t.value,
              label: t.label,
            }))}
          />
          <Input
            label="Value"
            type="number"
            step="0.01"
            min="0"
            value={formData.value}
            onChange={(e) =>
              setFormData({ ...formData, value: e.target.value })
            }
            rightElement={
              <span className="text-zinc-400">
                {formData.deduction_type === "percentage"
                  ? "%"
                  : formData.deduction_type === "amount"
                  ? "RM"
                  : "g"}
              </span>
            }
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_default}
              onChange={(e) =>
                setFormData({ ...formData, is_default: e.target.checked })
              }
              className="w-4 h-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-zinc-700">
              Set as default for this type
            </span>
          </label>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setShowEditModal(false);
                setEditingDeduction(null);
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
              Update Deduction
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingDeduction(null);
        }}
        title="Delete Stone Deduction"
        size="sm"
      >
        <div className="p-5">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-medium text-red-800">Are you sure?</p>
              <p className="text-sm text-red-600">
                This will permanently delete "{deletingDeduction?.name}"
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingDeduction(null);
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
              Delete Deduction
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
