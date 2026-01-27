/**
 * Terms & Conditions Tab for Settings Page
 * With DRAG & DROP reordering (User-friendly)
 * KPKT Compliant
 */

import { useState, useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import settingsService from "@/services/settingsService";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Card, Button, Input, Modal, Badge } from "@/components/common";
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Printer,
  MessageCircle,
  Eye,
  FileCheck,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Globe,
  GripVertical,
  RotateCcw,
} from "lucide-react";

const ACTIVITY_TYPES = [
  { value: "pledge", label: "New Pledge", labelMs: "Gadaian Baru" },
  { value: "renewal", label: "Renewal", labelMs: "Pembaharuan" },
  { value: "redemption", label: "Redemption", labelMs: "Penebusan" },
  { value: "auction", label: "Auction", labelMs: "Lelongan" },
  { value: "forfeit", label: "Forfeit", labelMs: "Lupus" },
];

export default function TermsConditionsTab() {
  const dispatch = useAppDispatch();

  // State
  const [terms, setTerms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedTerms, setExpandedTerms] = useState({});
  const [hasOrderChanges, setHasOrderChanges] = useState(false);
  const [originalOrder, setOriginalOrder] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTerm, setDeletingTerm] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    activity_type: "pledge",
    title: "",
    content_ms: "",
    content_en: "",
    print_with_receipt: true,
    require_consent: true,
    show_on_screen: true,
    attach_to_whatsapp: false,
    is_active: true,
    sort_order: 0,
  });

  // Fetch terms on mount
  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    setIsLoading(true);
    try {
      const response = await settingsService.getTermsConditions();
      const data = response.data || response;
      // Sort by sort_order
      const sorted = (Array.isArray(data) ? data : []).sort(
        (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
      );
      setTerms(sorted);
      setOriginalOrder(sorted.map((t) => t.id));
      setHasOrderChanges(false);
    } catch (error) {
      console.error("Error fetching terms:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to load terms and conditions",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Filter terms by activity type
  const filteredTerms =
    activeFilter === "all"
      ? terms
      : terms.filter((t) => t.activity_type === activeFilter);

  // Pagination calculations
  const totalPages = Math.ceil(filteredTerms.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTerms = filteredTerms.slice(startIndex, endIndex);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  // Ensure current page is valid when items change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Handle drag reorder
  const handleReorder = (newOrder) => {
    // Update the filtered list order
    if (activeFilter === "all") {
      setTerms(newOrder);
    } else {
      // For filtered view, we need to update the main terms array
      const otherTerms = terms.filter((t) => t.activity_type !== activeFilter);
      // Assign new sort_order to reordered items
      const reorderedWithOrder = newOrder.map((term, index) => ({
        ...term,
        sort_order: index + 1,
      }));
      setTerms(
        [...otherTerms, ...reorderedWithOrder].sort(
          (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
        ),
      );
    }

    // Check if order changed
    const currentOrder = newOrder.map((t) => t.id);
    const originalFiltered = originalOrder.filter(
      (id) =>
        activeFilter === "all" ||
        terms.find((t) => t.id === id)?.activity_type === activeFilter,
    );
    setHasOrderChanges(
      JSON.stringify(currentOrder) !== JSON.stringify(originalFiltered),
    );
  };

  // Save order changes
  const saveOrderChanges = async () => {
    setIsSaving(true);
    try {
      // Prepare updates with new sort_order based on current position
      const updates = terms.map((term, index) => ({
        id: term.id,
        sort_order: index + 1,
      }));

      // Try bulk update first
      try {
        const response = await settingsService.updateTermsOrder(updates);
        if (response.success !== false) {
          dispatch(
            addToast({
              type: "success",
              title: "Order Saved",
              message: "Terms order updated successfully",
            }),
          );
          setOriginalOrder(terms.map((t) => t.id));
          setHasOrderChanges(false);
          return;
        }
      } catch (bulkError) {
        console.log(
          "Bulk update not available, falling back to individual updates",
        );
      }

      // Fallback: update each term individually
      for (let i = 0; i < terms.length; i++) {
        await settingsService.updateTermsCondition(terms[i].id, {
          ...terms[i],
          sort_order: i + 1,
        });
      }

      dispatch(
        addToast({
          type: "success",
          title: "Order Saved",
          message: "Terms order updated successfully",
        }),
      );
      setOriginalOrder(terms.map((t) => t.id));
      setHasOrderChanges(false);
    } catch (error) {
      console.error("Error saving order:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to save order",
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Reset order changes
  const resetOrderChanges = () => {
    fetchTerms();
  };

  // Open modal for new term
  const handleAddNew = () => {
    setEditingTerm(null);
    const maxOrder = terms.reduce(
      (max, t) => Math.max(max, t.sort_order || 0),
      0,
    );
    setFormData({
      activity_type: activeFilter !== "all" ? activeFilter : "pledge",
      title: "",
      content_ms: "",
      content_en: "",
      print_with_receipt: true,
      require_consent: true,
      show_on_screen: true,
      attach_to_whatsapp: false,
      is_active: true,
      sort_order: maxOrder + 1,
    });
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = (term, e) => {
    e?.stopPropagation();
    setEditingTerm(term);
    setFormData({
      activity_type: term.activity_type || "pledge",
      title: term.title || "",
      content_ms: term.content_ms || "",
      content_en: term.content_en || "",
      print_with_receipt: term.print_with_receipt ?? true,
      require_consent: term.require_consent ?? true,
      show_on_screen: term.show_on_screen ?? true,
      attach_to_whatsapp: term.attach_to_whatsapp ?? false,
      is_active: term.is_active ?? true,
      sort_order: term.sort_order || 0,
    });
    setShowModal(true);
  };

  // Save term
  const handleSave = async () => {
    if (!formData.title.trim()) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Title is required",
        }),
      );
      return;
    }
    if (!formData.content_ms.trim()) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Malay content is required",
        }),
      );
      return;
    }

    setIsSaving(true);
    try {
      let response;
      if (editingTerm) {
        response = await settingsService.updateTermsCondition(
          editingTerm.id,
          formData,
        );
      } else {
        response = await settingsService.createTermsCondition(formData);
      }

      if (response.success !== false) {
        dispatch(
          addToast({
            type: "success",
            title: "Success",
            message: editingTerm
              ? "Term updated successfully"
              : "Term created successfully",
          }),
        );
        setShowModal(false);
        fetchTerms();
      } else {
        throw new Error(response.message || "Failed to save");
      }
    } catch (error) {
      console.error("Error saving term:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to save term",
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Delete term
  const handleDelete = async () => {
    if (!deletingTerm) return;

    setIsSaving(true);
    try {
      const response = await settingsService.deleteTermsCondition(
        deletingTerm.id,
      );

      if (response.success !== false) {
        dispatch(
          addToast({
            type: "success",
            title: "Deleted",
            message: "Term deleted successfully",
          }),
        );
        setShowDeleteModal(false);
        setDeletingTerm(null);
        fetchTerms();
      } else {
        throw new Error(response.message || "Failed to delete");
      }
    } catch (error) {
      console.error("Error deleting term:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to delete term",
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle expand
  const toggleExpand = (id) => {
    setExpandedTerms((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Get activity label
  const getActivityLabel = (type) => {
    const activity = ACTIVITY_TYPES.find((a) => a.value === type);
    return activity ? activity.label : type;
  };

  // Get activity badge color
  const getActivityColor = (type) => {
    switch (type) {
      case "pledge":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "renewal":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "redemption":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "auction":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "forfeit":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-zinc-100 text-zinc-700 border-zinc-200";
    }
  };

  if (isLoading) {
    return (
      <Card className="p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        <span className="ml-3 text-zinc-600">
          Loading terms & conditions...
        </span>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-800">
                Terms & Conditions
              </h3>
              <p className="text-sm text-zinc-500">
                Drag and drop to reorder • Changes auto-save
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {hasOrderChanges && (
              <>
                <Button
                  variant="outline"
                  leftIcon={RotateCcw}
                  onClick={resetOrderChanges}
                  size="sm"
                >
                  Reset
                </Button>
                <Button
                  variant="success"
                  leftIcon={Save}
                  onClick={saveOrderChanges}
                  loading={isSaving}
                  size="sm"
                >
                  Save Order
                </Button>
              </>
            )}
            <Button variant="accent" leftIcon={Plus} onClick={handleAddNew}>
              Add New Term
            </Button>
          </div>
        </div>

        {/* Order change notice */}
        {hasOrderChanges && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-amber-700">
              Order changed! Click "Save Order" to apply changes.
            </span>
          </motion.div>
        )}

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveFilter("all")}
            className={cn(
              "px-3 py-1.5 text-sm rounded-full transition-colors",
              activeFilter === "all"
                ? "bg-amber-500 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
            )}
          >
            All ({terms.length})
          </button>
          {ACTIVITY_TYPES.map((type) => {
            const count = terms.filter(
              (t) => t.activity_type === type.value,
            ).length;
            return (
              <button
                key={type.value}
                onClick={() => setActiveFilter(type.value)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-full transition-colors",
                  activeFilter === type.value
                    ? "bg-amber-500 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                )}
              >
                {type.label} ({count})
              </button>
            );
          })}
        </div>
      </Card>

      {/* Terms List with Drag & Drop */}
      {filteredTerms.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500">No terms & conditions found</p>
          <p className="text-sm text-zinc-400 mt-1">
            Click "Add New Term" to create your first T&C
          </p>
        </Card>
      ) : (
        <Reorder.Group
          axis="y"
          values={paginatedTerms}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {paginatedTerms.map((term, index) => (
            <Reorder.Item key={term.id} value={term} className="list-none">
              <Card
                className={cn(
                  "overflow-hidden cursor-grab active:cursor-grabbing transition-shadow",
                  "hover:shadow-md active:shadow-lg",
                  expandedTerms[term.id] && "ring-2 ring-amber-200",
                )}
              >
                {/* Term Header - Draggable */}
                <div className="p-4 flex items-center gap-3">
                  {/* Drag Handle */}
                  <div className="flex items-center gap-2 pr-3 border-r border-zinc-200">
                    <GripVertical className="w-5 h-5 text-zinc-400 cursor-grab active:cursor-grabbing" />
                    <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-sm font-bold flex items-center justify-center">
                      {startIndex + index + 1}
                    </span>
                  </div>

                  {/* Term info */}
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => toggleExpand(term.id)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-xs font-medium rounded border",
                          getActivityColor(term.activity_type),
                        )}
                      >
                        {getActivityLabel(term.activity_type)}
                      </span>
                      <span className="font-medium text-zinc-800">
                        {term.title}
                      </span>
                      {!term.is_active && (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Status icons */}
                  <div className="flex items-center gap-1.5">
                    {term.print_with_receipt && (
                      <span
                        className="p-1.5 bg-blue-50 rounded-full"
                        title="Print with receipt"
                      >
                        <Printer className="w-3.5 h-3.5 text-blue-500" />
                      </span>
                    )}
                    {term.require_consent && (
                      <span
                        className="p-1.5 bg-amber-50 rounded-full"
                        title="Requires consent"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-amber-500" />
                      </span>
                    )}
                    {term.show_on_screen && (
                      <span
                        className="p-1.5 bg-emerald-50 rounded-full"
                        title="Show on screen"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-500" />
                      </span>
                    )}
                    {term.attach_to_whatsapp && (
                      <span
                        className="p-1.5 bg-green-50 rounded-full"
                        title="Attach to WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-green-500" />
                      </span>
                    )}
                    <button
                      onClick={() => toggleExpand(term.id)}
                      className="p-1.5 hover:bg-zinc-100 rounded-full transition-colors ml-1"
                    >
                      {expandedTerms[term.id] ? (
                        <ChevronUp className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Term Content (Expanded) */}
                <AnimatePresence>
                  {expandedTerms[term.id] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-zinc-100 pt-4">
                        {/* Content */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-xs font-medium text-zinc-500 mb-1 flex items-center gap-1">
                              <Globe className="w-3.5 h-3.5" /> Bahasa Melayu
                            </p>
                            <div className="p-3 bg-zinc-50 rounded-lg text-sm text-zinc-700 whitespace-pre-line max-h-32 overflow-y-auto">
                              {term.content_ms || "-"}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-zinc-500 mb-1 flex items-center gap-1">
                              <Globe className="w-3.5 h-3.5" /> English
                            </p>
                            <div className="p-3 bg-zinc-50 rounded-lg text-sm text-zinc-700 whitespace-pre-line max-h-32 overflow-y-auto">
                              {term.content_en || "-"}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={Edit}
                            onClick={(e) => handleEdit(term, e)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={Trash2}
                            className="text-red-600 hover:bg-red-50 hover:border-red-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingTerm(term);
                              setShowDeleteModal(true);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      {/* Pagination Controls */}
      {filteredTerms.length > itemsPerPage && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Items per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="text-sm text-zinc-500">per page</span>
            </div>

            {/* Page info */}
            <div className="text-sm text-zinc-600">
              Showing <span className="font-medium">{startIndex + 1}</span> -{" "}
              <span className="font-medium">
                {Math.min(endIndex, filteredTerms.length)}
              </span>{" "}
              of <span className="font-medium">{filteredTerms.length}</span>{" "}
              terms
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-1">
              {/* First page */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className={cn(
                  "px-2 py-1 text-sm rounded transition-colors",
                  currentPage === 1
                    ? "text-zinc-300 cursor-not-allowed"
                    : "text-zinc-600 hover:bg-zinc-100",
                )}
              >
                First
              </button>

              {/* Previous */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={cn(
                  "p-1 rounded transition-colors",
                  currentPage === 1
                    ? "text-zinc-300 cursor-not-allowed"
                    : "text-zinc-600 hover:bg-zinc-100",
                )}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-1 px-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    // Show first, last, current, and adjacent pages
                    return (
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) <= 1
                    );
                  })
                  .map((page, idx, arr) => (
                    <div key={page} className="flex items-center">
                      {/* Add ellipsis if there's a gap */}
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span className="px-1 text-zinc-400">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          "w-8 h-8 text-sm font-medium rounded transition-colors",
                          currentPage === page
                            ? "bg-amber-500 text-white"
                            : "text-zinc-600 hover:bg-zinc-100",
                        )}
                      >
                        {page}
                      </button>
                    </div>
                  ))}
              </div>

              {/* Next */}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className={cn(
                  "p-1 rounded transition-colors",
                  currentPage === totalPages
                    ? "text-zinc-300 cursor-not-allowed"
                    : "text-zinc-600 hover:bg-zinc-100",
                )}
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Last page */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className={cn(
                  "px-2 py-1 text-sm rounded transition-colors",
                  currentPage === totalPages
                    ? "text-zinc-300 cursor-not-allowed"
                    : "text-zinc-600 hover:bg-zinc-100",
                )}
              >
                Last
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Help Text */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <GripVertical className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-blue-800">Drag to Reorder</p>
            <p className="text-sm text-blue-600 mt-1">
              Grab the <strong>⋮⋮</strong> handle and drag items to change their
              order. The order here determines how terms appear on printed
              receipts (1, 2, 3...).
            </p>
          </div>
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTerm ? "Edit Term" : "Add New Term"}
        size="lg"
      >
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Activity Type */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Activity Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.activity_type}
              onChange={(e) =>
                setFormData({ ...formData, activity_type: e.target.value })
              }
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {ACTIVITY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label} / {type.labelMs}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g., Tempoh Gadaian / Pledge Duration"
            />
          </div>

          {/* Content Malay */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Content (Bahasa Melayu) <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.content_ms}
              onChange={(e) =>
                setFormData({ ...formData, content_ms: e.target.value })
              }
              rows={4}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="Masukkan terma dalam Bahasa Melayu..."
            />
          </div>

          {/* Content English */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Content (English)
            </label>
            <textarea
              value={formData.content_en}
              onChange={(e) =>
                setFormData({ ...formData, content_en: e.target.value })
              }
              rows={4}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="Enter terms in English (optional)..."
            />
          </div>

          {/* Toggle Options */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-3 p-3 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50 transition-colors">
              <input
                type="checkbox"
                checked={formData.print_with_receipt}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    print_with_receipt: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
              />
              <div>
                <p className="text-sm font-medium text-zinc-800">
                  Print with Receipt
                </p>
                <p className="text-xs text-zinc-500">
                  Include in printed receipt
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50 transition-colors">
              <input
                type="checkbox"
                checked={formData.require_consent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    require_consent: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
              />
              <div>
                <p className="text-sm font-medium text-zinc-800">
                  Require Consent
                </p>
                <p className="text-xs text-zinc-500">Customer must agree</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50 transition-colors">
              <input
                type="checkbox"
                checked={formData.show_on_screen}
                onChange={(e) =>
                  setFormData({ ...formData, show_on_screen: e.target.checked })
                }
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
              />
              <div>
                <p className="text-sm font-medium text-zinc-800">
                  Show on Screen
                </p>
                <p className="text-xs text-zinc-500">
                  Display during transaction
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50 transition-colors">
              <input
                type="checkbox"
                checked={formData.attach_to_whatsapp}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    attach_to_whatsapp: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
              />
              <div>
                <p className="text-sm font-medium text-zinc-800">
                  WhatsApp Attach
                </p>
                <p className="text-xs text-zinc-500">
                  Include in WhatsApp messages
                </p>
              </div>
            </label>
          </div>

          {/* Active Status */}
          <label className="flex items-center gap-3 p-3 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50 transition-colors">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
            />
            <div>
              <p className="text-sm font-medium text-zinc-800">Active</p>
              <p className="text-xs text-zinc-500">Enable this term</p>
            </div>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-zinc-200 sticky bottom-0 bg-white">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              fullWidth
              leftIcon={Save}
              onClick={handleSave}
              loading={isSaving}
            >
              {editingTerm ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Term"
        size="sm"
      >
        <div className="p-5">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">Are you sure?</p>
              <p className="text-sm text-red-600">
                This will permanently delete "{deletingTerm?.title}"
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="error"
              fullWidth
              leftIcon={Trash2}
              onClick={handleDelete}
              loading={isSaving}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
