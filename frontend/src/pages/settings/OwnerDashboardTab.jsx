import { useState, useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { settingsService } from "@/services";
import { Card, Button, Input, Badge } from "@/components/common";
import {
  FileText,
  Save,
  Loader2,
  Phone,
  Clock,
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const MAX_RECIPIENTS = 5;

/**
 * Owner Dashboard settings.
 *
 * Stores the owner WhatsApp recipients that receive the daily PDF dashboard.
 * Numbers are persisted as a comma-separated string under category=`owner_dashboard`,
 * key_name=`whatsapp_number`. Visible to superadmin only.
 */
export default function OwnerDashboardTab() {
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [sendTime, setSendTime] = useState("20:00");
  const [draftNumber, setDraftNumber] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const normalizePhone = (raw) => {
    const trimmed = (raw || "").trim();
    if (!trimmed) return "";
    // Strip spaces, dashes, parentheses
    const cleaned = trimmed.replace(/[\s\-()]/g, "");
    // Already in international format
    if (cleaned.startsWith("+")) return cleaned;
    // International without +, e.g. 60123456789
    if (cleaned.startsWith("60")) return "+" + cleaned;
    // Local Malaysian with leading 0, e.g. 0123456789 → +60123456789
    if (cleaned.startsWith("0")) return "+60" + cleaned.slice(1);
    // Bare local digits (e.g. 123456789) → assume Malaysian
    return "+60" + cleaned;
  };

  const isValidPhone = (raw) => /^\+\d{8,15}$/.test(normalizePhone(raw));

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await settingsService.getByCategory("owner_dashboard");
      if (response.success && Array.isArray(response.data)) {
        const map = {};
        response.data.forEach((s) => {
          map[s.key_name] = s.value;
        });

        const raw = map.whatsapp_number || "";
        const parsed = raw
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);

        setEnabled(map.enabled === "1" || map.enabled === "true");
        setRecipients(parsed);
        setSendTime(map.send_time || "20:00");
      }
    } catch (err) {
      console.error("Error loading owner dashboard settings:", err);
      dispatch(
        addToast({
          type: "error",
          title: "Load failed",
          message: "Could not load owner dashboard settings",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNumber = () => {
    const phone = normalizePhone(draftNumber);
    if (!phone) return;

    if (!isValidPhone(phone)) {
      dispatch(
        addToast({
          type: "error",
          title: "Invalid number",
          message: "Use country code, e.g. +60123456789",
        }),
      );
      return;
    }
    if (recipients.includes(phone)) {
      dispatch(
        addToast({
          type: "warning",
          title: "Already added",
          message: phone + " is already in the list",
        }),
      );
      return;
    }
    if (recipients.length >= MAX_RECIPIENTS) {
      dispatch(
        addToast({
          type: "warning",
          title: "Limit reached",
          message: `Maximum ${MAX_RECIPIENTS} recipients allowed`,
        }),
      );
      return;
    }

    setRecipients([...recipients, phone]);
    setDraftNumber("");
  };

  const handleRemoveNumber = (phone) => {
    setRecipients(recipients.filter((p) => p !== phone));
  };

  const handleDraftKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddNumber();
    }
  };

  const handleSave = async () => {
    if (enabled && recipients.length === 0) {
      dispatch(
        addToast({
          type: "error",
          title: "No recipients",
          message: "Add at least one WhatsApp number before enabling",
        }),
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = [
        {
          category: "owner_dashboard",
          key_name: "enabled",
          value: enabled ? "1" : "0",
        },
        {
          category: "owner_dashboard",
          key_name: "whatsapp_number",
          value: recipients.join(","),
        },
        {
          category: "owner_dashboard",
          key_name: "send_time",
          value: sendTime || "20:00",
        },
      ];

      const res = await settingsService.update(payload);
      if (res.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Saved",
            message: "Owner dashboard settings updated",
          }),
        );
      } else {
        throw new Error(res.message || "Save failed");
      }
    } catch (err) {
      dispatch(
        addToast({
          type: "error",
          title: "Save failed",
          message: err.message || "Could not save settings",
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        <span className="ml-3 text-zinc-600">Loading settings...</span>
      </Card>
    );
  }

  const canAddMore = recipients.length < MAX_RECIPIENTS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-semibold text-zinc-800">
                Daily Owner Dashboard
              </h2>
              <Badge variant={enabled ? "success" : "secondary"}>
                {enabled ? "Active" : "Disabled"}
              </Badge>
            </div>
            <p className="text-sm text-zinc-600">
              Send the daily owner dashboard PDF to one or more WhatsApp numbers
              every day. The PDF includes transactions, cash flow, inventory,
              gold prices, and a 7-day trend.
            </p>
          </div>
        </div>
      </Card>

      {/* Configuration */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-zinc-800 uppercase tracking-wider mb-4">
          Configuration
        </h3>

        {/* Enable toggle */}
        <div className="flex items-center justify-between py-3 border-b border-zinc-100">
          <div>
            <p className="text-sm font-medium text-zinc-800">
              Enable daily WhatsApp delivery
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              When on, the dashboard is sent every day at the configured time.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors " +
              (enabled ? "bg-amber-500" : "bg-zinc-300")
            }
          >
            <span
              className={
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform " +
                (enabled ? "translate-x-6" : "translate-x-1")
              }
            />
          </button>
        </div>

        {/* Recipients */}
        <div className="py-4 border-b border-zinc-100">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-zinc-700">
              Recipient WhatsApp Numbers
            </label>
            <span className="text-xs text-zinc-500">
              {recipients.length} / {MAX_RECIPIENTS}
            </span>
          </div>

          {/* Existing recipients list */}
          {recipients.length > 0 && (
            <div className="space-y-2 mb-3">
              {recipients.map((phone) => (
                <div
                  key={phone}
                  className="flex items-center justify-between px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm font-mono text-zinc-800">
                      {phone}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveNumber(phone)}
                    className="text-zinc-400 hover:text-red-500 transition-colors"
                    aria-label={"Remove " + phone}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new number */}
          {canAddMore ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  leftIcon={Phone}
                  placeholder="+60123456789"
                  value={draftNumber}
                  onChange={(e) => setDraftNumber(e.target.value)}
                  onKeyDown={handleDraftKeyDown}
                />
              </div>
              <Button
                variant="secondary"
                leftIcon={Plus}
                onClick={handleAddNumber}
                disabled={!draftNumber.trim()}
              >
                Add
              </Button>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic">
              Maximum {MAX_RECIPIENTS} recipients reached. Remove one to add
              another.
            </p>
          )}

          <p className="text-xs text-zinc-500 mt-2">
            Defaults to Malaysia (+60). Accepts <code>+60123456789</code>,{" "}
            <code>60123456789</code>, <code>0123456789</code>, or{" "}
            <code>123456789</code>. For other countries, include the{" "}
            <code>+</code> prefix (e.g. <code>+65...</code>).
          </p>
        </div>

        {/* Send time */}
        <div className="py-4">
          <Input
            type="time"
            label="Daily send time"
            leftIcon={Clock}
            value={sendTime}
            onChange={(e) => setSendTime(e.target.value)}
            helperText="Server timezone is Asia/Kuala_Lumpur. Default 20:00 (8 PM)."
          />
        </div>

        {/* Save */}
        <div className="flex justify-end pt-4">
          <Button
            variant="accent"
            leftIcon={Save}
            onClick={handleSave}
            loading={isSaving}
          >
            Save Settings
          </Button>
        </div>
      </Card>

      {/* How it works */}
      <Card className="p-6 bg-blue-50 border-blue-100">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 space-y-2">
            <p className="font-semibold">How it works</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-800">
              <li>
                Each day at the configured time, the system generates the Owner
                Dashboard PDF for the current branch.
              </li>
              <li>
                The PDF is sent to every number in the list above via WhatsApp
                (using the UltraMsg account configured under the{" "}
                <strong>WhatsApp</strong> tab).
              </li>
              <li>
                A copy is saved on the server and a log entry is recorded in
                WhatsApp history for each recipient.
              </li>
            </ol>
            <p className="text-xs text-blue-700 pt-2">
              Requires: WhatsApp (UltraMsg) configured and enabled, plus a cron
              entry on cPanel running <code>php artisan schedule:run</code>{" "}
              every minute.
            </p>
          </div>
        </div>
      </Card>

      {/* Warning if WhatsApp not configured */}
      {enabled && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold mb-1">Before this works</p>
              <p className="text-amber-800">
                Make sure <strong>WhatsApp → UltraMsg</strong> is configured and
                connected. Without that, the PDF cannot be delivered.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
