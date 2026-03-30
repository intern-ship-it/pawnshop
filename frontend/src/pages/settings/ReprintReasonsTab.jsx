import { useState, useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { Card, Button, Input, Badge } from "@/components/common";
import {
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  RotateCcw,
  Loader2,
  GripVertical,
  MessageSquare,
} from "lucide-react";

const STORAGE_KEY = "pawnshop_reprint_reasons";

// Default reasons
const DEFAULT_REASONS = [
  { id: "1", reason: "Barcode Damaged", active: true },
  { id: "2", reason: "Barcode Faded / Not Readable", active: true },
  { id: "3", reason: "Sticker Fell Off", active: true },
  { id: "4", reason: "Wrong Barcode Printed", active: true },
  { id: "5", reason: "Customer Request", active: true },
  { id: "6", reason: "Renewal – New Sticker Needed", active: true },
  { id: "7", reason: "Gold Check / Verification", active: true },
  { id: "8", reason: "Storage Relocation", active: true },
];

export function getReprintReasons() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored).filter((r) => r.active);
    }
  } catch (e) {
    console.error("Failed to load reprint reasons:", e);
  }
  return DEFAULT_REASONS.filter((r) => r.active);
}

export default function ReprintReasonsTab() {
  const dispatch = useAppDispatch();
  const [reasons, setReasons] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [newReason, setNewReason] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadReasons();
  }, []);

  const loadReasons = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setReasons(JSON.parse(stored));
      } else {
        setReasons(DEFAULT_REASONS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_REASONS));
      }
    } catch (e) {
      setReasons(DEFAULT_REASONS);
    }
  };

  const saveReasons = (updated) => {
    setReasons(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleAdd = () => {
    if (!newReason.trim()) {
      dispatch(
        addToast({ type: "error", title: "Error", message: "Please enter a reason" })
      );
      return;
    }

    const exists = reasons.some(
      (r) => r.reason.toLowerCase() === newReason.trim().toLowerCase()
    );
    if (exists) {
      dispatch(
        addToast({ type: "warning", title: "Duplicate", message: "This reason already exists" })
      );
      return;
    }

    const updated = [
      ...reasons,
      {
        id: Date.now().toString(),
        reason: newReason.trim(),
        active: true,
      },
    ];
    saveReasons(updated);
    setNewReason("");
    setIsAdding(false);
    dispatch(
      addToast({ type: "success", title: "Added", message: "Reprint reason added" })
    );
  };

  const handleEdit = (id) => {
    const reason = reasons.find((r) => r.id === id);
    if (reason) {
      setEditingId(id);
      setEditValue(reason.reason);
    }
  };

  const handleSaveEdit = () => {
    if (!editValue.trim()) return;

    const updated = reasons.map((r) =>
      r.id === editingId ? { ...r, reason: editValue.trim() } : r
    );
    saveReasons(updated);
    setEditingId(null);
    setEditValue("");
    dispatch(
      addToast({ type: "success", title: "Updated", message: "Reason updated" })
    );
  };

  const handleToggle = (id) => {
    const updated = reasons.map((r) =>
      r.id === id ? { ...r, active: !r.active } : r
    );
    saveReasons(updated);
  };

  const handleDelete = (id) => {
    const updated = reasons.filter((r) => r.id !== id);
    saveReasons(updated);
    dispatch(
      addToast({ type: "success", title: "Deleted", message: "Reason removed" })
    );
  };

  const handleResetDefaults = () => {
    saveReasons(DEFAULT_REASONS);
    dispatch(
      addToast({
        type: "success",
        title: "Reset",
        message: "Reprint reasons reset to defaults",
      })
    );
  };

  const activeCount = reasons.filter((r) => r.active).length;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-red-500" />
            Reprint Reasons
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Manage predefined reasons for barcode reprinting. These appear as
            dropdown options when reprinting a barcode sticker.
          </p>
        </div>
        <Badge variant="warning">{activeCount} active</Badge>
      </div>

      {/* Add New Reason */}
      <div className="mb-6">
        {isAdding ? (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <MessageSquare className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <Input
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Enter new reprint reason..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              autoFocus
            />
            <Button
              variant="primary"
              size="sm"
              leftIcon={Check}
              onClick={handleAdd}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Add
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={X}
              onClick={() => {
                setIsAdding(false);
                setNewReason("");
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={Plus}
              onClick={() => setIsAdding(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Add New Reason
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={RotateCcw}
              onClick={handleResetDefaults}
            >
              Reset to Defaults
            </Button>
          </div>
        )}
      </div>

      {/* Reasons List */}
      <div className="space-y-2">
        {reasons.length === 0 ? (
          <div className="text-center py-8 text-zinc-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No reprint reasons configured.</p>
            <p className="text-sm">Click "Add New Reason" to get started.</p>
          </div>
        ) : (
          reasons.map((reason, index) => (
            <div
              key={reason.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                reason.active
                  ? "bg-white border-zinc-200 hover:border-zinc-300"
                  : "bg-zinc-50 border-zinc-100 opacity-60"
              }`}
            >
              {/* Index */}
              <span className="text-xs font-medium text-zinc-400 w-6 text-center">
                {index + 1}
              </span>

              {/* Toggle */}
              <button
                onClick={() => handleToggle(reason.id)}
                className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ${
                  reason.active ? "bg-emerald-500" : "bg-zinc-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    reason.active ? "left-5" : "left-0.5"
                  }`}
                />
              </button>

              {/* Reason Text */}
              {editingId === reason.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                    autoFocus
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={Check}
                    onClick={handleSaveEdit}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={X}
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <span
                    className={`flex-1 text-sm font-medium ${
                      reason.active ? "text-zinc-800" : "text-zinc-400 line-through"
                    }`}
                  >
                    {reason.reason}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(reason.id)}
                      className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(reason.id)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Info Note */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-3">
          <RotateCcw className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              How Reprint Reasons Work
            </p>
            <ul className="text-xs text-amber-700 mt-1 space-y-1 list-disc list-inside">
              <li>
                When reprinting a barcode, a modal will ask for a reason before printing.
              </li>
              <li>
                The selected reason is printed on the barcode sticker at the bottom.
              </li>
              <li>
                Active reasons appear in the dropdown. Inactive ones are hidden.
              </li>
              <li>
                Staff can also type a custom reason if none of the presets apply.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
