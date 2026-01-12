/**
 * PuritiesTab - Gold Purities Management with API Integration
 * Replaces localStorage version with backend API calls
 */

import { useState, useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { settingsService } from "@/services";
import { cn } from "@/lib/utils";
import { Card, Button, Input, Modal, Badge } from "@/components/common";
import {
  Gem,
  Plus,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  Edit,
} from "lucide-react";

export default function PuritiesTab() {
  const dispatch = useAppDispatch();

  // State
  const [purities, setPurities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    karat: "",
    percentage: "",
  });
  const [editingPurity, setEditingPurity] = useState(null);
  const [deletingPurity, setDeletingPurity] = useState(null);

  // Action states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch purities on mount
  useEffect(() => {
    fetchPurities();
  }, []);

  // Fetch all purities from API
  const fetchPurities = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await settingsService.getPurities();
      if (response.success) {
        // Handle nested data structure
        const data = response.data?.data || response.data || [];
        setPurities(data);
      } else {
        throw new Error(response.message || "Failed to fetch purities");
      }
    } catch (err) {
      console.error("Error fetching purities:", err);
      setError(err.message || "Failed to load purities");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-generate name from code
  const generateName = (code, karat) => {
    if (karat) {
      return `${code} (${karat})`;
    }
    return code;
  };

  // Add new purity
  const handleAdd = async () => {
    if (!formData.code || !formData.percentage) {
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Validation Error",
          message: "Code and percentage are required",
        })
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await settingsService.createPurity({
        code: formData.code,
        name: formData.name || generateName(formData.code, formData.karat),
        percentage: parseFloat(formData.percentage),
        sort_order: purities.length + 1,
      });

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Purity Added",
            message: `${formData.code} has been added successfully`,
          })
        );
        setFormData({ code: "", name: "", karat: "", percentage: "" });
        setShowAddModal(false);
        fetchPurities(); // Refresh list
      } else {
        throw new Error(response.message || "Failed to add purity");
      }
    } catch (err) {
      console.error("Error adding purity:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to add purity",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Open edit modal
  const openEditModal = (purity) => {
    setEditingPurity(purity);
    setFormData({
      code: purity.code || "",
      name: purity.name || "",
      karat: purity.karat || "",
      percentage: purity.percentage?.toString() || "",
    });
    setShowEditModal(true);
  };

  // Update purity
  const handleUpdate = async () => {
    if (!editingPurity) return;

    setIsSaving(true);
    try {
      const response = await settingsService.updatePurity(editingPurity.id, {
        name: formData.name || generateName(formData.code, formData.karat),
        percentage: parseFloat(formData.percentage),
      });

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Purity Updated",
            message: `${formData.code} has been updated successfully`,
          })
        );
        setShowEditModal(false);
        setEditingPurity(null);
        setFormData({ code: "", name: "", karat: "", percentage: "" });
        fetchPurities(); // Refresh list
      } else {
        throw new Error(response.message || "Failed to update purity");
      }
    } catch (err) {
      console.error("Error updating purity:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to update purity",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle active status
  const handleToggle = async (purity) => {
    try {
      const response = await settingsService.updatePurity(purity.id, {
        is_active: !purity.is_active,
      });

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: purity.is_active ? "Purity Disabled" : "Purity Enabled",
            message: `${purity.code} has been ${
              purity.is_active ? "disabled" : "enabled"
            }`,
          })
        );
        fetchPurities(); // Refresh list
      } else {
        throw new Error(response.message || "Failed to update purity");
      }
    } catch (err) {
      console.error("Error toggling purity:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to update purity",
        })
      );
    }
  };

  // Open delete confirmation
  const openDeleteModal = (purity) => {
    setDeletingPurity(purity);
    setShowDeleteModal(true);
  };

  // Delete purity
  const handleDelete = async () => {
    if (!deletingPurity) return;

    setIsDeleting(true);
    try {
      const response = await settingsService.deletePurity(deletingPurity.id);

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Purity Deleted",
            message: `${deletingPurity.code} has been deleted`,
          })
        );
        setShowDeleteModal(false);
        setDeletingPurity(null);
        fetchPurities(); // Refresh list
      } else {
        throw new Error(response.message || "Failed to delete purity");
      }
    } catch (err) {
      console.error("Error deleting purity:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message:
            err.message ||
            "Failed to delete purity. It may have existing items.",
        })
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        <span className="ml-3 text-zinc-600">Loading purities...</span>
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
            onClick={fetchPurities}
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
          <Gem className="w-5 h-5 text-amber-500" />
          Gold Purities
          <Badge variant="secondary" className="ml-2">
            {purities.length}
          </Badge>
        </h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={RefreshCw}
            onClick={fetchPurities}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={Plus}
            onClick={() => {
              setFormData({ code: "", name: "", karat: "", percentage: "" });
              setShowAddModal(true);
            }}
          >
            Add Purity
          </Button>
        </div>
      </div>

      {/* Purities Grid */}
      {purities.length === 0 ? (
        <div className="text-center py-12">
          <Gem className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-500">No purities found</p>
          <Button
            variant="outline"
            size="sm"
            leftIcon={Plus}
            className="mt-4"
            onClick={() => setShowAddModal(true)}
          >
            Add First Purity
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {purities.map((purity) => (
            <div
              key={purity.id}
              className={cn(
                "p-4 rounded-xl border-2 transition-all",
                purity.is_active !== false
                  ? "border-amber-200 bg-amber-50/50"
                  : "border-zinc-100 bg-zinc-50 opacity-60"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-zinc-800">
                      {purity.code}
                    </span>
                    {purity.karat && (
                      <Badge variant="secondary">{purity.karat}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500 mt-1">{purity.name}</p>
                </div>
                {/* Toggle Active */}
                <button
                  onClick={() => handleToggle(purity)}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    purity.is_active !== false
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-zinc-300"
                  )}
                >
                  {purity.is_active !== false && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </button>
              </div>

              {/* Percentage */}
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-zinc-500">Purity: </span>
                  <span className="font-semibold text-zinc-700">
                    {Number(purity.percentage || 0).toFixed(2)}%
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(purity)}
                    className="text-zinc-400 hover:text-blue-500"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteModal(purity)}
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

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Purity"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Purity Code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="e.g. 916"
            helperText="Unique code for this purity"
          />
          <Input
            label="Display Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. 916 (22K)"
            helperText="Leave empty to auto-generate"
          />
          <Input
            label="Karat (Optional)"
            value={formData.karat}
            onChange={(e) =>
              setFormData({ ...formData, karat: e.target.value })
            }
            placeholder="e.g. 22K"
          />
          <Input
            label="Percentage"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.percentage}
            onChange={(e) =>
              setFormData({ ...formData, percentage: e.target.value })
            }
            placeholder="e.g. 91.60"
            helperText="Gold content percentage (0-100)"
            rightElement={<span className="text-zinc-400">%</span>}
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
              Add Purity
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingPurity(null);
        }}
        title="Edit Purity"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Purity Code"
            value={formData.code}
            disabled
            helperText="Code cannot be changed"
          />
          <Input
            label="Display Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. 916 (22K)"
          />
          <Input
            label="Percentage"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.percentage}
            onChange={(e) =>
              setFormData({ ...formData, percentage: e.target.value })
            }
            placeholder="e.g. 91.60"
            rightElement={<span className="text-zinc-400">%</span>}
          />
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setShowEditModal(false);
                setEditingPurity(null);
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
              Update Purity
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingPurity(null);
        }}
        title="Delete Purity"
        size="sm"
      >
        <div className="p-5">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-medium text-red-800">Are you sure?</p>
              <p className="text-sm text-red-600">
                This will permanently delete "{deletingPurity?.code} -{" "}
                {deletingPurity?.name}"
              </p>
            </div>
          </div>
          <p className="text-sm text-zinc-500 mb-6">
            Purities with existing pledge items cannot be deleted.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingPurity(null);
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
              Delete Purity
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
