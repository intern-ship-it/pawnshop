/**
 * CategoriesTab - Item Categories Management with API Integration
 * Replaces localStorage version with backend API calls
 */

import { useState, useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { settingsService } from "@/services";
import { cn } from "@/lib/utils";
import { Card, Button, Input, Modal, Badge } from "@/components/common";
import {
  Package,
  Plus,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  Edit,
  X,
} from "lucide-react";

export default function CategoriesTab() {
  const dispatch = useAppDispatch();

  // State
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    code: "",
    name_en: "",
    name_ms: "",
  });
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);

  // Action states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch all categories from API
  const fetchCategories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await settingsService.getCategories();
      if (response.success) {
        // Handle nested data structure
        const data = response.data?.data || response.data || [];
        setCategories(data);
      } else {
        throw new Error(response.message || "Failed to fetch categories");
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
      setError(err.message || "Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  };

  // Add new category
  const handleAdd = async () => {
    if (!formData.code || !formData.name_en) {
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Validation Error",
          message: "Code and English name are required",
        })
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await settingsService.createCategory({
        code: formData.code.toUpperCase(),
        name_en: formData.name_en,
        name_ms: formData.name_ms || formData.name_en,
        sort_order: categories.length + 1,
      });

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Category Added",
            message: `${formData.name_en} has been added successfully`,
          })
        );
        setFormData({ code: "", name_en: "", name_ms: "" });
        setShowAddModal(false);
        fetchCategories(); // Refresh list
      } else {
        throw new Error(response.message || "Failed to add category");
      }
    } catch (err) {
      console.error("Error adding category:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to add category",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Open edit modal
  const openEditModal = (category) => {
    setEditingCategory(category);
    setFormData({
      code: category.code || "",
      name_en: category.name_en || "",
      name_ms: category.name_ms || "",
    });
    setShowEditModal(true);
  };

  // Update category
  const handleUpdate = async () => {
    if (!editingCategory) return;

    setIsSaving(true);
    try {
      const response = await settingsService.updateCategory(
        editingCategory.id,
        {
          name_en: formData.name_en,
          name_ms: formData.name_ms || formData.name_en,
        }
      );

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Category Updated",
            message: `${formData.name_en} has been updated successfully`,
          })
        );
        setShowEditModal(false);
        setEditingCategory(null);
        setFormData({ code: "", name_en: "", name_ms: "" });
        fetchCategories(); // Refresh list
      } else {
        throw new Error(response.message || "Failed to update category");
      }
    } catch (err) {
      console.error("Error updating category:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to update category",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle active status
  const handleToggle = async (category) => {
    try {
      const response = await settingsService.updateCategory(category.id, {
        is_active: !category.is_active,
      });

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: category.is_active
              ? "Category Disabled"
              : "Category Enabled",
            message: `${category.name_en} has been ${
              category.is_active ? "disabled" : "enabled"
            }`,
          })
        );
        fetchCategories(); // Refresh list
      } else {
        throw new Error(response.message || "Failed to update category");
      }
    } catch (err) {
      console.error("Error toggling category:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to update category",
        })
      );
    }
  };

  // Open delete confirmation
  const openDeleteModal = (category) => {
    setDeletingCategory(category);
    setShowDeleteModal(true);
  };

  // Delete category
  const handleDelete = async () => {
    if (!deletingCategory) return;

    setIsDeleting(true);
    try {
      const response = await settingsService.deleteCategory(
        deletingCategory.id
      );

      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Category Deleted",
            message: `${deletingCategory.name_en} has been deleted`,
          })
        );
        setShowDeleteModal(false);
        setDeletingCategory(null);
        fetchCategories(); // Refresh list
      } else {
        throw new Error(response.message || "Failed to delete category");
      }
    } catch (err) {
      console.error("Error deleting category:", err);
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message:
            err.message ||
            "Failed to delete category. It may have existing items.",
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
        <span className="ml-3 text-zinc-600">Loading categories...</span>
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
            onClick={fetchCategories}
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
          <Package className="w-5 h-5 text-amber-500" />
          Item Categories
          <Badge variant="secondary" className="ml-2">
            {categories.length}
          </Badge>
        </h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={RefreshCw}
            onClick={fetchCategories}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={Plus}
            onClick={() => {
              setFormData({ code: "", name_en: "", name_ms: "" });
              setShowAddModal(true);
            }}
          >
            Add Category
          </Button>
        </div>
      </div>

      {/* Categories List */}
      {categories.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-500">No categories found</p>
          <Button
            variant="outline"
            size="sm"
            leftIcon={Plus}
            className="mt-4"
            onClick={() => setShowAddModal(true)}
          >
            Add First Category
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => (
            <div
              key={category.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border transition-all",
                category.is_active !== false
                  ? "border-zinc-200 bg-white"
                  : "border-zinc-100 bg-zinc-50 opacity-60"
              )}
            >
              <div className="flex items-center gap-4">
                {/* Toggle Active */}
                <button
                  onClick={() => handleToggle(category)}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    category.is_active !== false
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-zinc-300"
                  )}
                >
                  {category.is_active !== false && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </button>

                {/* Category Info */}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-zinc-800">
                      {category.name_en}
                    </p>
                    <Badge variant="secondary" size="sm">
                      {category.code}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-500">{category.name_ms}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditModal(category)}
                  className="text-zinc-400 hover:text-blue-500"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openDeleteModal(category)}
                  className="text-zinc-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Category"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Category Code"
            value={formData.code}
            onChange={(e) =>
              setFormData({ ...formData, code: e.target.value.toUpperCase() })
            }
            placeholder="e.g. RING"
            helperText="Unique code (uppercase)"
          />
          <Input
            label="Category Name (English)"
            value={formData.name_en}
            onChange={(e) =>
              setFormData({ ...formData, name_en: e.target.value })
            }
            placeholder="e.g. Ring"
          />
          <Input
            label="Category Name (Malay)"
            value={formData.name_ms}
            onChange={(e) =>
              setFormData({ ...formData, name_ms: e.target.value })
            }
            placeholder="e.g. Cincin"
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
              Add Category
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingCategory(null);
        }}
        title="Edit Category"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Category Code"
            value={formData.code}
            disabled
            helperText="Code cannot be changed"
          />
          <Input
            label="Category Name (English)"
            value={formData.name_en}
            onChange={(e) =>
              setFormData({ ...formData, name_en: e.target.value })
            }
            placeholder="e.g. Ring"
          />
          <Input
            label="Category Name (Malay)"
            value={formData.name_ms}
            onChange={(e) =>
              setFormData({ ...formData, name_ms: e.target.value })
            }
            placeholder="e.g. Cincin"
          />
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setShowEditModal(false);
                setEditingCategory(null);
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
              Update Category
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingCategory(null);
        }}
        title="Delete Category"
        size="sm"
      >
        <div className="p-5">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-medium text-red-800">Are you sure?</p>
              <p className="text-sm text-red-600">
                This will permanently delete "{deletingCategory?.name_en}"
              </p>
            </div>
          </div>
          <p className="text-sm text-zinc-500 mb-6">
            Categories with existing pledge items cannot be deleted.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingCategory(null);
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
              Delete Category
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
