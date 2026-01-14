/**
 * MarginPresetsTab - Margin Percentage Presets with API Integration
 * Replaces localStorage version with backend API calls
 */

import { useState, useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { settingsService } from "@/services";
import { cn } from "@/lib/utils";
import { Card, Button, Input, Modal, Badge } from "@/components/common";
import {
  Percent,
  Plus,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  Edit,
  Star,
  Info,
} from "lucide-react";

export default function MarginPresetsTab() {
  const dispatch = useAppDispatch();

  // State
  const [presets, setPresets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    value: "",
    label: "",
    is_default: false,
  });
  const [editingPreset, setEditingPreset] = useState(null);
  const [deletingPreset, setDeletingPreset] = useState(null);

  // Action states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch presets on mount
  useEffect(() => {
    fetchPresets();
  }, []);

  // Fetch all margin presets from API
  const fetchPresets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await settingsService.getMarginPresets();
      if (response.success) {
        const data = response.data?.data || response.data || [];
        // Normalize data - map backend fields to frontend fields
        const normalizedData = data.map((item) => ({
          ...item,
          value: item.margin_percentage || item.value,
          label:
            item.name ||
            item.label ||
            `${item.margin_percentage || item.value}%`,
        }));
        setPresets(normalizedData);
      } else {
        throw new Error(response.message || "Failed to fetch margin presets");
      }
    } catch (err) {
      console.error("Error fetching margin presets:", err);
      setError(err.message || "Failed to load margin presets");
    } finally {
      setIsLoading(false);
    }
  };

  // Add new preset
  const handleAdd = async () => {
    const value = parseInt(formData.value);
    if (!value || value < 1 || value > 100) {
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Validation Error",
          message: "Please enter a valid percentage (1-100)",
        })
      );
      return;
    }

    // Check if value already exists
    if (presets.some((p) => (p.margin_percentage || p.value) === value)) {
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Duplicate Value",
          message: `${value}% preset already exists`,
        })
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        value: value,
        label: formData.label || `${value}%`,
        is_default: formData.is_default,
        sort_order: presets.length + 1,
      };
      const response = await settingsService.createMarginPreset(payload);

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Preset Added",
            message: `${value}% preset has been added`,
          })
        );
        resetForm();
        setShowAddModal(false);
        fetchPresets();
      } else {
        throw new Error(response.message || "Failed to add preset");
      }
    } catch (err) {
      console.error("Error adding preset:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to add preset",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Open edit modal
  const openEditModal = (preset) => {
    setEditingPreset(preset);
    setFormData({
      value: preset.value?.toString() || "",
      label: preset.label || "",
      is_default: preset.is_default || false,
    });
    setShowEditModal(true);
  };

  // Update preset
  const handleUpdate = async () => {
    if (!editingPreset) return;

    const value = parseInt(formData.value);
    if (!value || value < 1 || value > 100) {
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Validation Error",
          message: "Please enter a valid percentage (1-100)",
        })
      );
      return;
    }

    // Check if value already exists (excluding current)
    if (
      presets.some(
        (p) =>
          (p.margin_percentage || p.value) === value &&
          p.id !== editingPreset.id
      )
    ) {
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Duplicate Value",
          message: `${value}% preset already exists`,
        })
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        value: value,
        label: formData.label || `${value}%`,
        is_default: formData.is_default,
      };

      const response = await settingsService.updateMarginPreset(
        editingPreset.id,
        payload
      );

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Preset Updated",
            message: `${value}% preset has been updated`,
          })
        );
        setShowEditModal(false);
        setEditingPreset(null);
        resetForm();
        fetchPresets();
      } else {
        throw new Error(response.message || "Failed to update preset");
      }
    } catch (err) {
      console.error("Error updating preset:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to update preset",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle active status
  const handleToggle = async (preset) => {
    try {
      const response = await settingsService.updateMarginPreset(preset.id, {
        is_active: !preset.is_active,
      });

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: preset.is_active ? "Preset Disabled" : "Preset Enabled",
            message: `${preset.label} has been ${
              preset.is_active ? "disabled" : "enabled"
            }`,
          })
        );
        fetchPresets();
      } else {
        throw new Error(response.message || "Failed to update preset");
      }
    } catch (err) {
      console.error("Error toggling preset:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to update preset",
        })
      );
    }
  };

  // Set as default
  const handleSetDefault = async (preset) => {
    try {
      const response = await settingsService.updateMarginPreset(preset.id, {
        is_default: true,
      });

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Default Set",
            message: `${preset.label} is now the default`,
          })
        );
        fetchPresets();
      } else {
        throw new Error(response.message || "Failed to set default");
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

  // Delete preset
  const handleDelete = async () => {
    if (!deletingPreset) return;

    setIsDeleting(true);
    try {
      const response = await settingsService.deleteMarginPreset(
        deletingPreset.id
      );

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Preset Deleted",
            message: `${deletingPreset.label} has been deleted`,
          })
        );
        setShowDeleteModal(false);
        setDeletingPreset(null);
        fetchPresets();
      } else {
        throw new Error(response.message || "Failed to delete preset");
      }
    } catch (err) {
      console.error("Error deleting preset:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to delete preset",
        })
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      value: "",
      label: "",
      is_default: false,
    });
  };

  // Sort presets by value descending
  const sortedPresets = [...presets].sort((a, b) => b.value - a.value);

  // Loading state
  if (isLoading) {
    return (
      <Card className="p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        <span className="ml-3 text-zinc-600">Loading margin presets...</span>
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
          <Button variant="outline" leftIcon={RefreshCw} onClick={fetchPresets}>
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
          <Percent className="w-5 h-5 text-amber-500" />
          Margin Percentage Presets
          <Badge variant="secondary" className="ml-2">
            {presets.length}
          </Badge>
        </h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={RefreshCw}
            onClick={fetchPresets}
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
            Add Preset
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            These presets appear as quick-select buttons when creating a new
            pledge. The default preset will be pre-selected automatically.
            Margin percentage determines the loan amount as a percentage of item
            value.
          </p>
        </div>
      </div>

      {/* Presets Grid */}
      {presets.length === 0 ? (
        <div className="text-center py-12">
          <Percent className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-500">No margin presets configured</p>
          <Button
            variant="outline"
            size="sm"
            leftIcon={Plus}
            className="mt-4"
            onClick={() => setShowAddModal(true)}
          >
            Add First Preset
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedPresets.map((preset) => (
            <div
              key={preset.id}
              className={cn(
                "p-4 rounded-xl border-2 transition-all relative",
                preset.is_active !== false
                  ? preset.is_default
                    ? "border-amber-300 bg-amber-50"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                  : "border-zinc-100 bg-zinc-50 opacity-60"
              )}
            >
              {/* Default Badge */}
              {preset.is_default && (
                <div className="absolute -top-2 -right-2">
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">
                    <Star className="w-3 h-3" /> Default
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-3xl font-bold text-zinc-800">
                    {preset.value}
                    <span className="text-xl text-zinc-500">%</span>
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">{preset.label}</p>
                </div>

                {/* Toggle Active */}
                <button
                  onClick={() => handleToggle(preset)}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    preset.is_active !== false
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-zinc-300"
                  )}
                >
                  {preset.is_active !== false && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </button>
              </div>

              {/* Example Calculation */}
              <div className="text-xs text-zinc-400 mb-3">
                Example: RM 1,000 value → RM{" "}
                {((1000 * preset.value) / 100).toFixed(0)} loan
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                {!preset.is_default && preset.is_active !== false && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(preset)}
                    className="text-amber-600 hover:text-amber-700 text-xs"
                  >
                    <Star className="w-3 h-3 mr-1" />
                    Set Default
                  </Button>
                )}
                {preset.is_default && (
                  <span className="text-xs text-amber-600">Active Default</span>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(preset)}
                    className="text-zinc-400 hover:text-blue-500"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeletingPreset(preset);
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

      {/* Quick Reference */}
      {presets.length > 0 && (
        <div className="mt-6 p-4 bg-zinc-50 rounded-xl">
          <p className="text-sm font-medium text-zinc-700 mb-2">
            Active Presets:
          </p>
          <div className="flex flex-wrap gap-2">
            {sortedPresets
              .filter((p) => p.is_active !== false)
              .map((preset) => (
                <Badge
                  key={preset.id}
                  variant={preset.is_default ? "accent" : "secondary"}
                  className="text-sm"
                >
                  {preset.value}%{preset.is_default && " ★"}
                </Badge>
              ))}
          </div>
        </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Margin Preset"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Percentage Value"
            type="number"
            min="1"
            max="100"
            value={formData.value}
            onChange={(e) =>
              setFormData({ ...formData, value: e.target.value })
            }
            placeholder="e.g. 75"
            rightElement={<span className="text-zinc-400">%</span>}
            helperText="Enter value between 1-100"
          />
          <Input
            label="Display Label (Optional)"
            value={formData.label}
            onChange={(e) =>
              setFormData({ ...formData, label: e.target.value })
            }
            placeholder="e.g. 75% (Standard)"
            helperText="Leave empty to auto-generate"
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
            <span className="text-sm text-zinc-700">Set as default preset</span>
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
              Add Preset
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingPreset(null);
        }}
        title="Edit Margin Preset"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Percentage Value"
            type="number"
            min="1"
            max="100"
            value={formData.value}
            onChange={(e) =>
              setFormData({ ...formData, value: e.target.value })
            }
            placeholder="e.g. 75"
            rightElement={<span className="text-zinc-400">%</span>}
          />
          <Input
            label="Display Label"
            value={formData.label}
            onChange={(e) =>
              setFormData({ ...formData, label: e.target.value })
            }
            placeholder="e.g. 75% (Standard)"
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
            <span className="text-sm text-zinc-700">Set as default preset</span>
          </label>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setShowEditModal(false);
                setEditingPreset(null);
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
              Update Preset
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingPreset(null);
        }}
        title="Delete Margin Preset"
        size="sm"
      >
        <div className="p-5">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-medium text-red-800">Are you sure?</p>
              <p className="text-sm text-red-600">
                This will permanently delete the {deletingPreset?.label} preset
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingPreset(null);
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
              Delete Preset
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
