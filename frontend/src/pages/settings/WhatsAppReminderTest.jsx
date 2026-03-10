/**
 * WhatsApp Reminder Test Page
 * Settings > WhatsApp Reminders
 *
 * Allows admin to:
 * - Preview what reminders would be sent today
 * - Run dry-run (no actual sending)
 * - Trigger actual reminder send
 * - View today's reminder logs
 */

import { useState, useEffect, useCallback } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Card, Button, Badge } from "@/components/common";
import api from "@/services/api";
import {
  Bell,
  Send,
  Play,
  Eye,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Calendar,
  Users,
  Phone,
  PhoneOff,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Timer,
  ArrowLeft,
  FileText,
  Activity,
  Shield,
} from "lucide-react";
import { Link } from "react-router";

// ─── API Calls ───────────────────────────────────────────────────────
const reminderApi = {
  preview: () => api.get("/whatsapp/reminders/preview"),
  send: (dryRun = false) =>
    api.post("/whatsapp/reminders/send", { dry_run: dryRun }),
  logs: (date) =>
    api.get("/whatsapp/reminders/logs", { params: { date } }),
};

// ─── Reminder Type Config ────────────────────────────────────────────
const REMINDER_CONFIG = {
  reminder_7days: {
    color: "blue",
    icon: Clock,
    bgClass: "bg-blue-50",
    borderClass: "border-blue-200",
    textClass: "text-blue-700",
    badgeClass: "bg-blue-100 text-blue-700",
    dotClass: "bg-blue-500",
  },
  reminder_3days: {
    color: "amber",
    icon: AlertTriangle,
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
    textClass: "text-amber-700",
    badgeClass: "bg-amber-100 text-amber-700",
    dotClass: "bg-amber-500",
  },
  reminder_1day: {
    color: "orange",
    icon: Timer,
    bgClass: "bg-orange-50",
    borderClass: "border-orange-200",
    textClass: "text-orange-700",
    badgeClass: "bg-orange-100 text-orange-700",
    dotClass: "bg-orange-500",
  },
  overdue_notice: {
    color: "red",
    icon: AlertTriangle,
    bgClass: "bg-red-50",
    borderClass: "border-red-200",
    textClass: "text-red-700",
    badgeClass: "bg-red-100 text-red-700",
    dotClass: "bg-red-500",
  },
};

// ─── Main Component ──────────────────────────────────────────────────
export default function WhatsAppReminderTest() {
  const dispatch = useAppDispatch();

  // State
  const [preview, setPreview] = useState(null);
  const [logs, setLogs] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [activeTab, setActiveTab] = useState("preview"); // preview, logs, output
  const [expandedSections, setExpandedSections] = useState({});
  const [showConfirmSend, setShowConfirmSend] = useState(false);

  // ─── Load Preview ────────────────────────────────────────────
  const loadPreview = useCallback(async () => {
    setIsLoadingPreview(true);
    try {
      const response = await reminderApi.preview();
      const data = response.data?.data || response.data;
      setPreview(data);
    } catch (error) {
      console.error("Preview error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message:
            error.response?.data?.message || "Failed to load preview",
        })
      );
    } finally {
      setIsLoadingPreview(false);
    }
  }, [dispatch]);

  // ─── Load Logs ───────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const response = await reminderApi.logs(
        new Date().toISOString().split("T")[0]
      );
      const data = response.data?.data || response.data;
      setLogs(data);
    } catch (error) {
      console.error("Logs error:", error);
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  // ─── Run Dry Run ─────────────────────────────────────────────
  const handleDryRun = async () => {
    setIsDryRunning(true);
    setSendResult(null);
    try {
      const response = await reminderApi.send(true);
      const data = response.data?.data || response.data;
      setSendResult(data);
      setActiveTab("output");
      dispatch(
        addToast({
          type: "info",
          title: "Dry Run Complete",
          message: `Would send ${data.summary?.sent || 0} message(s)`,
        })
      );
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Dry Run Failed",
          message: error.response?.data?.message || "Failed",
        })
      );
    } finally {
      setIsDryRunning(false);
    }
  };

  // ─── Send For Real ───────────────────────────────────────────
  const handleSend = async () => {
    setShowConfirmSend(false);
    setIsSending(true);
    setSendResult(null);
    try {
      const response = await reminderApi.send(false);
      const data = response.data?.data || response.data;
      setSendResult(data);
      setActiveTab("output");

      // Refresh preview and logs
      loadPreview();
      loadLogs();

      dispatch(
        addToast({
          type: "success",
          title: "Reminders Sent",
          message: `${data.summary?.sent || 0} sent, ${data.summary?.failed || 0} failed`,
        })
      );
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Send Failed",
          message: error.response?.data?.message || "Failed to send reminders",
        })
      );
    } finally {
      setIsSending(false);
    }
  };

  // ─── Toggle Section ──────────────────────────────────────────
  const toggleSection = (key) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Initial Load ────────────────────────────────────────────
  useEffect(() => {
    loadPreview();
    loadLogs();
  }, [loadPreview, loadLogs]);

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/settings/whatsapp"
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">
              WhatsApp Reminders
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Test and trigger due date reminder messages via cron
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={loadPreview}
            disabled={isLoadingPreview}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50"
          >
            <RefreshCw
              className={cn("w-4 h-4", isLoadingPreview && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Cards Row */}
      {preview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatusCard
            icon={MessageCircle}
            label="Total Pledges"
            value={preview.total_pledges}
            color="zinc"
          />
          <StatusCard
            icon={CheckCircle}
            label="Already Sent Today"
            value={preview.already_sent_today}
            color="green"
          />
          <StatusCard
            icon={Zap}
            label="WhatsApp"
            value={preview.whatsapp_enabled ? "Enabled" : "Disabled"}
            color={preview.whatsapp_enabled ? "green" : "red"}
            small
          />
          <StatusCard
            icon={Calendar}
            label="Date"
            value={preview.date_display?.split(" (")[0] || "Today"}
            sub={preview.date_display?.match(/\((.+)\)/)?.[1] || ""}
            color="blue"
            small
          />
        </div>
      )}

      {/* WhatsApp Not Enabled Warning */}
      {preview && !preview.whatsapp_enabled && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">
              WhatsApp is not enabled for this branch
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Configure WhatsApp in{" "}
              <Link to="/settings/whatsapp" className="underline font-medium">
                Settings → WhatsApp
              </Link>{" "}
              before sending reminders.
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleDryRun}
          disabled={isDryRunning || isSending}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
            "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-300",
            (isDryRunning || isSending) && "opacity-50 cursor-not-allowed"
          )}
        >
          <Eye
            className={cn("w-4 h-4", isDryRunning && "animate-pulse")}
          />
          {isDryRunning ? "Running..." : "Dry Run"}
        </button>

        <button
          onClick={() => setShowConfirmSend(true)}
          disabled={
            isDryRunning ||
            isSending ||
            !preview?.whatsapp_enabled ||
            preview?.total_pledges === 0
          }
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
            "bg-green-600 text-white hover:bg-green-700 shadow-sm",
            (isDryRunning ||
              isSending ||
              !preview?.whatsapp_enabled ||
              preview?.total_pledges === 0) &&
              "opacity-50 cursor-not-allowed"
          )}
        >
          <Send className={cn("w-4 h-4", isSending && "animate-pulse")} />
          {isSending ? "Sending..." : "Send Reminders Now"}
        </button>

        {logs?.summary?.total > 0 && (
          <span className="text-xs text-zinc-500 ml-2">
            {logs.summary.sent} sent today · {logs.summary.failed} failed
          </span>
        )}
      </div>

      {/* Confirm Dialog */}
      <AnimatePresence>
        {showConfirmSend && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-amber-50 border border-amber-300 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  Confirm: Send WhatsApp Reminders
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  This will send real WhatsApp messages to{" "}
                  <strong>
                    {(preview?.total_pledges || 0) -
                      (preview?.already_sent_today || 0)}
                  </strong>{" "}
                  customer(s). Already-sent pledges will be skipped. This action
                  cannot be undone.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleSend}
                    className="px-4 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition"
                  >
                    Yes, Send Now
                  </button>
                  <button
                    onClick={() => setShowConfirmSend(false)}
                    className="px-4 py-1.5 bg-white text-zinc-700 text-sm font-medium rounded-lg border border-zinc-300 hover:bg-zinc-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-200">
        {[
          { key: "preview", label: "Preview", icon: Eye },
          { key: "logs", label: "Today's Logs", icon: Activity },
          { key: "output", label: "Command Output", icon: FileText },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === tab.key
                ? "border-amber-500 text-amber-700"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.key === "logs" && logs?.summary?.total > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-zinc-100 text-zinc-600 rounded-full">
                {logs.summary.total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "preview" && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {isLoadingPreview ? (
              <LoadingState text="Loading preview..." />
            ) : preview?.reminders?.length > 0 ? (
              preview.reminders.map((reminder) => (
                <ReminderSection
                  key={reminder.template_key}
                  reminder={reminder}
                  expanded={expandedSections[reminder.template_key]}
                  onToggle={() => toggleSection(reminder.template_key)}
                />
              ))
            ) : (
              <EmptyState text="No reminder data available" />
            )}
          </motion.div>
        )}

        {activeTab === "logs" && (
          <motion.div
            key="logs"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {isLoadingLogs ? (
              <LoadingState text="Loading logs..." />
            ) : logs?.logs?.length > 0 ? (
              <LogsTable logs={logs} />
            ) : (
              <EmptyState text="No reminder logs for today" />
            )}
          </motion.div>
        )}

        {activeTab === "output" && (
          <motion.div
            key="output"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {sendResult ? (
              <CommandOutput result={sendResult} />
            ) : (
              <EmptyState text="Run a dry run or send to see output here" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub Components ──────────────────────────────────────────────────

function StatusCard({ icon: Icon, label, value, sub, color, small }) {
  const colorMap = {
    zinc: "bg-zinc-50 text-zinc-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-700",
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("p-1.5 rounded-lg", colorMap[color] || colorMap.zinc)}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-zinc-500 font-medium">{label}</span>
      </div>
      <p className={cn("font-bold", small ? "text-lg" : "text-2xl", "text-zinc-900")}>
        {value}
      </p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ReminderSection({ reminder, expanded, onToggle }) {
  const config = REMINDER_CONFIG[reminder.template_key] || REMINDER_CONFIG.reminder_7days;
  const Icon = config.icon;
  const hasItems = reminder.count > 0;

  return (
    <div
      className={cn(
        "border rounded-xl overflow-hidden transition-colors",
        config.borderClass,
        hasItems ? config.bgClass : "bg-white"
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
        disabled={!hasItems}
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-2.5 h-2.5 rounded-full", config.dotClass)} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-900">
                {reminder.label}
              </span>
              {!reminder.template_enabled && (
                <span className="text-xs px-2 py-0.5 bg-zinc-200 text-zinc-600 rounded-full">
                  Template Disabled
                </span>
              )}
            </div>
            <span className="text-xs text-zinc-500">
              {reminder.days_before > 0
                ? `Due in ${reminder.days_before} day(s)`
                : "Past due date"}{" "}
              · {reminder.count} pledge(s)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-sm font-bold px-3 py-1 rounded-full",
              hasItems ? config.badgeClass : "bg-zinc-100 text-zinc-400"
            )}
          >
            {reminder.count}
          </span>
          {hasItems &&
            (expanded ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            ))}
        </div>
      </button>

      {/* Expanded Pledge List */}
      <AnimatePresence>
        {expanded && hasItems && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-zinc-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5 font-medium">Pledge No</th>
                      <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                      <th className="text-left px-4 py-2.5 font-medium">Phone</th>
                      <th className="text-right px-4 py-2.5 font-medium">Loan (RM)</th>
                      <th className="text-right px-4 py-2.5 font-medium">Interest (RM)</th>
                      <th className="text-center px-4 py-2.5 font-medium">Due Date</th>
                      <th className="text-center px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {reminder.pledges.map((p) => (
                      <tr key={p.pledge_id} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3">
                          <Link
                            to={`/pledges/${p.pledge_id}`}
                            className="font-mono text-xs font-semibold text-amber-700 hover:underline"
                          >
                            {p.pledge_no}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-900 text-sm">
                            {p.customer_name}
                          </div>
                          <div className="text-xs text-zinc-400">
                            {p.customer_ic}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {p.has_phone ? (
                            <div className="flex items-center gap-1.5 text-green-700">
                              <Phone className="w-3 h-3" />
                              <span className="text-xs">{p.customer_phone}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-red-500">
                              <PhoneOff className="w-3 h-3" />
                              <span className="text-xs">No phone</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {p.loan_amount.toLocaleString("en-MY", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {p.current_interest.toLocaleString("en-MY", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          {p.due_date_display}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.already_sent_today ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              Sent
                            </span>
                          ) : p.has_phone ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-500 rounded-full">
                              <XCircle className="w-3 h-3" />
                              No Phone
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LogsTable({ logs }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      {/* Summary Bar */}
      <div className="flex items-center gap-4 px-4 py-3 bg-zinc-50 border-b border-zinc-200 text-xs">
        <span className="text-zinc-500">
          Total: <strong className="text-zinc-900">{logs.summary.total}</strong>
        </span>
        <span className="text-green-600">
          Sent: <strong>{logs.summary.sent}</strong>
        </span>
        <span className="text-red-600">
          Failed: <strong>{logs.summary.failed}</strong>
        </span>
        <span className="text-zinc-400">|</span>
        <span className="text-blue-600">
          7d: {logs.summary.by_type.reminder_7days}
        </span>
        <span className="text-amber-600">
          3d: {logs.summary.by_type.reminder_3days}
        </span>
        <span className="text-orange-600">
          1d: {logs.summary.by_type.reminder_1day}
        </span>
        <span className="text-red-600">
          OD: {logs.summary.by_type.overdue_notice}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-100">
              <th className="text-left px-4 py-2.5 font-medium">Time</th>
              <th className="text-left px-4 py-2.5 font-medium">Type</th>
              <th className="text-left px-4 py-2.5 font-medium">Recipient</th>
              <th className="text-left px-4 py-2.5 font-medium">Phone</th>
              <th className="text-center px-4 py-2.5 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {logs.logs.map((log) => {
              const typeConfig =
                REMINDER_CONFIG[log.related_type] || REMINDER_CONFIG.reminder_7days;
              return (
                <tr key={log.id} className="hover:bg-zinc-50/50">
                  <td className="px-4 py-2.5 text-xs text-zinc-500 font-mono">
                    {new Date(log.created_at).toLocaleTimeString("en-MY", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        typeConfig.badgeClass
                      )}
                    >
                      {log.related_type?.replace("reminder_", "").replace("_", " ").replace("overdue notice", "Overdue") || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-zinc-900">
                    {log.recipient_name || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500 font-mono">
                    {log.recipient_phone}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {log.status === "sent" ? (
                      <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-red-500 max-w-[200px] truncate">
                    {log.error_message || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CommandOutput({ result }) {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">
            {result.summary?.sent || 0}
          </p>
          <p className="text-xs text-green-600 mt-0.5">
            {result.dry_run ? "Would Send" : "Sent"}
          </p>
        </div>
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-zinc-700">
            {result.summary?.skipped || 0}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">Skipped</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">
            {result.summary?.no_phone || 0}
          </p>
          <p className="text-xs text-amber-600 mt-0.5">No Phone</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-700">
            {result.summary?.failed || 0}
          </p>
          <p className="text-xs text-red-600 mt-0.5">Failed</p>
        </div>
      </div>

      {/* Dry Run Badge */}
      {result.dry_run && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <Eye className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-700 font-medium">
            DRY RUN — No messages were actually sent
          </span>
        </div>
      )}

      {/* Raw Output */}
      <div className="bg-zinc-900 rounded-xl p-4 overflow-x-auto">
        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">
          {result.output || "No output captured"}
        </pre>
      </div>
    </div>
  );
}

function LoadingState({ text }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex items-center gap-3 text-zinc-400">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-sm">{text}</span>
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
      <Bell className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
