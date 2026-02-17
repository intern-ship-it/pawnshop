import { useState, useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { getStorageItem, setStorageItem } from "@/utils/localStorage";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Card, Button, Input, Badge, Modal } from "@/components/common";
import whatsappService from "@/services/whatsappService";
import settingsService from "@/services/settingsService";
import {
  MessageCircle,
  Settings,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Phone,
  Key,
  Globe,
  FileText,
  Clock,
  Users,
  Bell,
  Edit,
  Save,
  RotateCcw,
  TestTube,
  History,
  Smartphone,
  Link,
  Check,
  X,
  Eye,
  RefreshCw,
  Zap,
  ChevronUp,
  ChevronDown,
  Maximize2,
} from "lucide-react";

// Default message templates
const defaultTemplates = [
  {
    id: "pledge_created",
    name: "Pledge Created",
    event: "New Pledge",
    enabled: true,
    template: `Salam {customer_name},

Terima kasih kerana memilih {company_name}.

📋 *Butiran Pajak Gadai*
No. Pajak: {pledge_no}
Tarikh: {date}
Jumlah Pinjaman: RM{loan_amount}
Tarikh Tamat: {due_date}

Sila simpan mesej ini untuk rujukan.

Terima kasih.
{company_name}
{company_phone}`,
  },
  {
    id: "renewal_done",
    name: "Renewal Confirmation",
    event: "After Renewal",
    enabled: true,
    template: `Salam {customer_name},

Pembaharuan pajak gadai anda telah berjaya.

📋 *Butiran Pembaharuan*
No. Pajak: {pledge_no}
Faedah Dibayar: RM{interest_paid}
Tarikh Tamat Baru: {new_due_date}

Terima kasih.
{company_name}`,
  },
  {
    id: "redemption_done",
    name: "Redemption Confirmation",
    event: "After Redemption",
    enabled: true,
    template: `Salam {customer_name},

Pajak gadai anda telah ditebus dengan jayanya.

📋 *Butiran Tebusan*
No. Pajak: {pledge_no}
Jumlah Dibayar: RM{total_paid}

Terima kasih kerana berurusan dengan kami. Kami mengalu-alukan anda kembali.

{company_name}`,
  },
  {
    id: "due_reminder_7",
    name: "7 Days Reminder",
    event: "7 Days Before Due",
    enabled: true,
    template: `Salam {customer_name},

⏰ *Peringatan: 7 Hari Lagi*

Pajak gadai anda akan tamat tempoh dalam 7 hari.

No. Pajak: {pledge_no}
Tarikh Tamat: {due_date}
Jumlah Tebus: RM{redemption_amount}

Sila hubungi kami untuk tebusan atau pembaharuan.

{company_name}
{company_phone}`,
  },
  {
    id: "due_reminder_3",
    name: "3 Days Reminder",
    event: "3 Days Before Due",
    enabled: true,
    template: `Salam {customer_name},

⚠️ *Peringatan Segera: 3 Hari Lagi*

Pajak gadai anda akan tamat tempoh dalam 3 hari.

No. Pajak: {pledge_no}
Tarikh Tamat: {due_date}

Sila ambil tindakan segera untuk mengelakkan pelucuthakan.

{company_name}
{company_phone}`,
  },
  {
    id: "due_reminder_1",
    name: "1 Day Reminder",
    event: "1 Day Before Due",
    enabled: true,
    template: `Salam {customer_name},

🚨 *Peringatan Akhir: ESOK*

Pajak gadai anda akan tamat tempoh ESOK.

No. Pajak: {pledge_no}
Tarikh Tamat: {due_date}

Sila hubungi kami dengan segera.

{company_name}
{company_phone}`,
  },
  {
    id: "overdue_notice",
    name: "Overdue Notice",
    event: "After Due Date",
    enabled: true,
    template: `Salam {customer_name},

❌ *Notis: Pajak Gadai Tamat Tempoh*

Pajak gadai anda telah tamat tempoh.

No. Pajak: {pledge_no}
Tarikh Tamat: {due_date}
Hari Tertunggak: {days_overdue} hari

Sila hubungi kami dalam masa 14 hari untuk mengelakkan pelucuthakan.

{company_name}
{company_phone}`,
  },
  {
    id: "auction_notice",
    name: "Auction Notice",
    event: "Before Auction",
    enabled: false,
    template: `Salam {customer_name},

📢 *Notis Lelongan*

Pajak gadai anda telah dijadualkan untuk lelongan.

No. Pajak: {pledge_no}
Tarikh Lelongan: {auction_date}

Sila hubungi kami segera jika anda ingin menebus barang anda.

{company_name}
{company_phone}`,
  },
];

// Default WhatsApp config
const defaultConfig = {
  enabled: false,
  provider: "ultramsg", // ultramsg, twilio, wati
  instanceId: "",
  token: "",
  phoneNumberId: "",
  defaultCountryCode: "+60",
  companyName: "PawnSys Sdn Bhd",
  companyPhone: "03-1234 5678",
};

export default function WhatsAppSettings() {
  const dispatch = useAppDispatch();

  // State
  const [config, setConfig] = useState(defaultConfig);
  const [templates, setTemplates] = useState(defaultTemplates);
  const [activeTab, setActiveTab] = useState("config"); // config, templates, history, test
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected"); // connected, disconnected, checking

  // Edit template modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Test modal
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testTemplate, setTestTemplate] = useState("pledge_created");
  const [isSending, setIsSending] = useState(false);

  // Message history
  const [messageHistory, setMessageHistory] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [hasExistingToken, setHasExistingToken] = useState(false);

  // FIX: Add state for viewing full message
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  // FIX: Add state for expanded messages (inline expansion)
  const [expandedMessages, setExpandedMessages] = useState({});

  useEffect(() => {
    loadFromApi();
  }, []);

  const loadFromApi = async () => {
    setIsLoading(true);
    try {
      // Load WhatsApp config
      const configRes = await whatsappService.getConfig();

      // Load company settings (for company name/phone)
      const settingsRes = await settingsService.getAll();

      let companyName = "PawnSys Sdn Bhd";
      let companyPhone = "03-1234 5678";

      // Extract company info from settings
      // Format: { data: { company: [{key_name: 'name', value: '...', branch_id: ...}] } }
      if (settingsRes.success && settingsRes.data?.company) {
        const companySettings = settingsRes.data.company;

        // Helper to get setting value (prefer branch-specific over global)
        const getCompanySetting = (keyName) => {
          // First try to find branch-specific (branch_id not null)
          const branchSetting = companySettings.find(
            (item) => item.key_name === keyName && item.branch_id !== null,
          );
          if (branchSetting) return branchSetting.value;

          // Fallback to global (branch_id is null)
          const globalSetting = companySettings.find(
            (item) => item.key_name === keyName && item.branch_id === null,
          );
          return globalSetting?.value;
        };

        companyName = getCompanySetting("name") || companyName;
        companyPhone = getCompanySetting("phone") || companyPhone;
      }

      // Set WhatsApp config
      if (configRes.success && configRes.data?.config) {
        const c = configRes.data.config;
        // Check if token exists (backend returns ******** for existing tokens)
        const tokenExists = c.api_token === "********";
        setHasExistingToken(tokenExists);

        setConfig({
          enabled: c.is_enabled || false,
          provider: c.provider || "ultramsg",
          instanceId: c.instance_id || "",
          token: tokenExists ? "" : "", // Keep empty, we'll show indicator separately
          defaultCountryCode: c.phone_number || "+60",
          companyName: companyName,
          companyPhone: companyPhone,
        });
        if (c.last_connected_at) setConnectionStatus("connected");
      } else {
        // No WhatsApp config yet, but still set company info
        setConfig((prev) => ({
          ...prev,
          companyName: companyName,
          companyPhone: companyPhone,
        }));
      }

      // Load templates
      const templatesRes = await whatsappService.getTemplates();
      if (
        templatesRes.success &&
        templatesRes.data &&
        templatesRes.data.length > 0
      ) {
        setTemplates(
          templatesRes.data.map((t) => ({
            id: t.template_key,
            name: t.name,
            event: t.template_key,
            enabled: t.is_enabled,
            template: t.content,
          })),
        );
      }

      // Load history
      const historyRes = await whatsappService.getLogs();
      if (historyRes.success && historyRes.data) {
        setMessageHistory(historyRes.data.data || historyRes.data);
      }
    } catch (error) {
      console.error("Failed to load WhatsApp settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Normalize country code - ensure it starts with +
      let countryCode = config.defaultCountryCode || "+60";
      countryCode = countryCode.trim();
      if (!countryCode.startsWith("+")) {
        countryCode = "+" + countryCode;
      }

      const payload = {
        provider: config.provider,
        instance_id: config.instanceId,
        phone_number: countryCode, // Always has + prefix now
        is_enabled: config.enabled,
      };

      // Only send token if user entered a new one
      // If hasExistingToken and config.token is empty, user wants to keep existing
      if (config.token && config.token.trim() !== "") {
        payload.api_token = config.token;
      }

      const response = await whatsappService.updateConfig(payload);

      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Saved",
            message: "WhatsApp settings saved",
          }),
        );
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      dispatch(
        addToast({ type: "error", title: "Error", message: error.message }),
      );
    } finally {
      setIsSaving(false);
    }
  };


  // FIX: Toggle message expansion inline
  const toggleMessageExpansion = (msgId) => {
    setExpandedMessages((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  // FIX: Open message in modal
  const openMessageModal = (msg) => {
    setSelectedMessage(msg);
    setShowMessageModal(true);
  };

  const handleTestConnection = async () => {
    setConnectionStatus("checking");
    try {
      const response = await whatsappService.testConnection();
      if (response.success) {
        setConnectionStatus("connected");
        dispatch(
          addToast({
            type: "success",
            title: "Connected",
            message: "WhatsApp API connection successful",
          }),
        );
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      setConnectionStatus("disconnected");
      dispatch(
        addToast({
          type: "error",
          title: "Failed",
          message: error.message || "Connection failed",
        }),
      );
    }
  };

  // Toggle template via API
  const toggleTemplate = async (templateId) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    const newEnabled = !template.enabled;

    try {
      const response = await whatsappService.updateTemplate(templateId, {
        is_enabled: newEnabled,
      });

      if (response.success) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === templateId ? { ...t, enabled: newEnabled } : t,
          ),
        );
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to update template",
        }),
      );
    }
  };

  // Edit template
  const openEditTemplate = (template) => {
    setEditingTemplate({ ...template });
    setShowEditModal(true);
  };
  // Save template to API
  const saveTemplate = async () => {
    try {
      const response = await whatsappService.updateTemplate(
        editingTemplate.id,
        {
          name: editingTemplate.name,
          content: editingTemplate.template,
          is_enabled: editingTemplate.enabled,
        },
      );

      if (response.success) {
        // Update local state
        setTemplates((prev) =>
          prev.map((t) => (t.id === editingTemplate.id ? editingTemplate : t)),
        );
        setShowEditModal(false);
        dispatch(
          addToast({
            type: "success",
            title: "Template Updated",
            message: editingTemplate.name,
          }),
        );
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to save template",
        }),
      );
    }
  };
  // Send test message
  const handleSendTest = async () => {
    if (!testPhone) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please enter phone number",
        }),
      );
      return;
    }

    setIsSending(true);
    try {
      // Normalize phone number - add country code if not present
      let normalizedPhone = testPhone
        .trim()
        .replace(/\s+/g, "")
        .replace(/-/g, "");

      // Get country code from settings (without the +)
      const countryCode = (config.defaultCountryCode || "+60").replace("+", "");

      // If phone doesn't start with country code, add it
      if (
        !normalizedPhone.startsWith(countryCode) &&
        !normalizedPhone.startsWith("+")
      ) {
        // Remove leading 0 if present (e.g., 0123456789 -> 123456789)
        if (normalizedPhone.startsWith("0")) {
          normalizedPhone = normalizedPhone.substring(1);
        }
        normalizedPhone = countryCode + normalizedPhone;
      }
      // If starts with +, remove it (WhatsApp API usually wants just digits)
      normalizedPhone = normalizedPhone.replace("+", "");

      const response = await whatsappService.send({
        template_key: testTemplate,
        recipient_phone: normalizedPhone,
        recipient_name: "Test Customer",
        data: {
          customer_name: "Test Customer",
          customer_phone: testPhone,
          customer_ic: "900101-01-1234",
          pledge_no: "PLG-2024-TEST",
          receipt_no: "PLG-2024-TEST",
          date: new Date().toLocaleDateString("en-MY"),
          loan_amount: "2,500.00",
          due_date: new Date(
            Date.now() + 180 * 24 * 60 * 60 * 1000,
          ).toLocaleDateString("en-MY"),
          interest_paid: "50.00",
          new_due_date: new Date(
            Date.now() + 180 * 24 * 60 * 60 * 1000,
          ).toLocaleDateString("en-MY"),
          total_paid: "2,550.00",
          redemption_amount: "2,550.00",
          days_overdue: "0",
          auction_date: new Date(
            Date.now() + 210 * 24 * 60 * 60 * 1000,
          ).toLocaleDateString("en-MY"),
          company_name: config.companyName || "Dsara Asset Ventures Sdn Bhd",
          company_phone: config.companyPhone || "03-21234567",
        },
      });

      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Sent",
            message: "Test message sent!",
          }),
        );
        loadFromApi(); // Refresh history
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      dispatch(
        addToast({ type: "error", title: "Failed", message: error.message }),
      );
    } finally {
      setIsSending(false);
    }
  };
  // Available variables
  const variables = [
    "{customer_name}",
    "{customer_phone}",
    "{customer_ic}",
    "{pledge_no}",
    "{date}",
    "{loan_amount}",
    "{due_date}",
    "{interest_paid}",
    "{new_due_date}",
    "{total_paid}",
    "{redemption_amount}",
    "{days_overdue}",
    "{auction_date}",
    "{company_name}",
    "{company_phone}",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-800">
              WhatsApp Integration
            </h2>
            <p className="text-sm text-zinc-500">
              Send automated notifications via WhatsApp
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config.enabled ? "success" : "secondary"}>
            {config.enabled ? "Enabled" : "Disabled"}
          </Badge>
          <Button
            variant="accent"
            leftIcon={Save}
            onClick={handleSave}
            loading={isSaving}
          >
            Save Settings
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200">
        {[
          { id: "config", label: "Configuration", icon: Settings },
          { id: "templates", label: "Message Templates", icon: FileText },
          { id: "history", label: "History", icon: History },
          { id: "test", label: "Test", icon: TestTube },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-zinc-500 hover:text-zinc-700",
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "config" && (
          <motion.div
            key="config"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* API Configuration */}
            <Card className="p-6">
              <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-500" />
                API Configuration
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                  <span className="text-sm font-medium">Enable WhatsApp</span>
                  <button
                    onClick={() =>
                      setConfig({ ...config, enabled: !config.enabled })
                    }
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      config.enabled ? "bg-green-500" : "bg-zinc-300",
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform",
                        config.enabled ? "translate-x-6" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Provider
                  </label>
                  <select
                    value={config.provider}
                    onChange={(e) =>
                      setConfig({ ...config, provider: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="ultramsg">UltraMsg</option>
                    <option value="twilio">Twilio</option>
                    <option value="wati">WATI</option>
                  </select>
                </div>

                <Input
                  label="Instance ID"
                  placeholder="Enter instance ID"
                  value={config.instanceId}
                  onChange={(e) =>
                    setConfig({ ...config, instanceId: e.target.value })
                  }
                  leftIcon={Globe}
                />

                <div>
                  <Input
                    label="API Token"
                    type="password"
                    placeholder={
                      hasExistingToken && !config.token
                        ? "••••••••••••••••"
                        : "Enter API token"
                    }
                    value={config.token}
                    onChange={(e) =>
                      setConfig({ ...config, token: e.target.value })
                    }
                    leftIcon={Key}
                  />
                  {hasExistingToken && !config.token && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Token configured - enter new value to change
                    </p>
                  )}
                </div>

                <Input
                  label="Default Country Code"
                  placeholder="+60"
                  value={config.defaultCountryCode}
                  onChange={(e) =>
                    setConfig({ ...config, defaultCountryCode: e.target.value })
                  }
                  leftIcon={Phone}
                />

                {/* Connection Status */}
                <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full",
                        connectionStatus === "connected"
                          ? "bg-green-500"
                          : connectionStatus === "checking"
                            ? "bg-amber-500 animate-pulse"
                            : "bg-red-500",
                      )}
                    />
                    <span className="text-sm text-zinc-600">
                      {connectionStatus === "connected"
                        ? "Connected"
                        : connectionStatus === "checking"
                          ? "Checking..."
                          : "Disconnected"}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={RefreshCw}
                    onClick={handleTestConnection}
                    loading={connectionStatus === "checking"}
                  >
                    Test Connection
                  </Button>
                </div>
              </div>
            </Card>

            {/* Company Info */}
            <Card className="p-6">
              <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-500" />
                Company Info (for messages)
              </h3>

              <div className="space-y-4">
                <Input
                  label="Company Name"
                  placeholder="Your Company Sdn Bhd"
                  value={config.companyName}
                  onChange={(e) =>
                    setConfig({ ...config, companyName: e.target.value })
                  }
                />

                <Input
                  label="Company Phone"
                  placeholder="03-1234 5678"
                  value={config.companyPhone}
                  onChange={(e) =>
                    setConfig({ ...config, companyPhone: e.target.value })
                  }
                  leftIcon={Phone}
                />
              </div>

              {/* Info Box */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex gap-3">
                  <MessageCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">How it works:</p>
                    <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                      <li>Sign up at ultramsg.com or similar provider</li>
                      <li>Get your Instance ID and Token</li>
                      <li>Enter credentials above</li>
                      <li>Test connection</li>
                      <li>Customize message templates</li>
                      <li>Messages will be sent automatically!</li>
                    </ol>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === "templates" && (
          <motion.div
            key="templates"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50">
                <p className="text-sm text-zinc-600">
                  Configure automatic WhatsApp messages for different events.
                  Use variables like{" "}
                  <code className="bg-zinc-200 px-1 rounded">
                    {"{customer_name}"}
                  </code>{" "}
                  to personalize messages.
                </p>
              </div>

              <div className="divide-y divide-zinc-100">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => toggleTemplate(template.id)}
                          className={cn(
                            "w-10 h-6 rounded-full transition-colors relative",
                            template.enabled ? "bg-green-500" : "bg-zinc-300",
                          )}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded-full bg-white absolute top-1 transition-transform",
                              template.enabled
                                ? "translate-x-5"
                                : "translate-x-1",
                            )}
                          />
                        </button>
                        <div>
                          <p className="font-medium text-zinc-800">
                            {template.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {template.event}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={Edit}
                        onClick={() => openEditTemplate(template)}
                      >
                        Edit
                      </Button>
                    </div>

                    {/* Preview */}
                    <div className="mt-3 ml-14">
                      <pre className="text-xs text-zinc-500 bg-zinc-100 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-24">
                        {template.template.slice(0, 150)}...
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
        {activeTab === "history" && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
                <h3 className="font-semibold text-zinc-800">Message History</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={RefreshCw}
                    onClick={loadFromApi}
                  >
                    Refresh
                  </Button>
                  <Badge variant="info">{messageHistory.length} messages</Badge>
                </div>
              </div>

              {messageHistory.length === 0 ? (
                <div className="p-12 text-center">
                  <History className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                  <p className="text-zinc-500">No messages sent yet</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 max-h-[600px] overflow-y-auto">
                  {messageHistory.map((msg) => {
                    const messageContent = msg.message_content || msg.message || "";
                    const isExpanded = expandedMessages[msg.id];
                    const isLongMessage = messageContent.length > 150;

                    return (
                      <div key={msg.id} className="p-4 hover:bg-zinc-50">
                        {/* Header Row */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-zinc-400" />
                            <span className="font-medium text-zinc-800">
                              {msg.recipient_phone || msg.phone}
                            </span>
                            {msg.recipient_name && (
                              <span className="text-sm text-zinc-500">
                                ({msg.recipient_name})
                              </span>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {msg.template?.name || msg.template_key || msg.template || "Manual"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {msg.status === "sent" ? (
                              <span className="flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                Sent
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-red-600">
                                <XCircle className="w-4 h-4" />
                                Failed
                              </span>
                            )}
                            <span className="text-xs text-zinc-400">
                              {msg.created_at || msg.sent_at
                                ? new Date(msg.created_at || msg.sent_at).toLocaleString("en-MY")
                                : "N/A"}
                            </span>
                          </div>
                        </div>

                        {/* Message Content - Expandable */}
                        <div className="relative">
                          <pre
                            className={cn(
                              "text-xs text-zinc-600 bg-zinc-100 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap transition-all",
                              isExpanded ? "max-h-none" : "max-h-24"
                            )}
                          >
                            {isExpanded || !isLongMessage
                              ? messageContent
                              : `${messageContent.slice(0, 150)}...`}
                          </pre>

                          {/* Expand/Collapse & View Full buttons */}
                          {isLongMessage && (
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() => toggleMessageExpansion(msg.id)}
                                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3 h-3" />
                                    Show Less
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3" />
                                    Show More
                                  </>
                                )}
                              </button>
                              <span className="text-zinc-300">|</span>
                              <button
                                onClick={() => openMessageModal(msg)}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                              >
                                <Maximize2 className="w-3 h-3" />
                                View Full
                              </button>
                            </div>
                          )}

                          {/* Short message - still show View Details option */}
                          {!isLongMessage && messageContent && (
                            <div className="mt-2">
                              <button
                                onClick={() => openMessageModal(msg)}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                              >
                                <Eye className="w-3 h-3" />
                                View Details
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Error message if failed */}
                        {msg.status === "failed" && msg.error_message && (
                          <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
                            <strong>Error:</strong> {msg.error_message}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {activeTab === "test" && (
          <motion.div
            key="test"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-xl"
          >
            <Card className="p-6">
              <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                <TestTube className="w-5 h-5 text-amber-500" />
                Send Test Message
              </h3>

              <div className="space-y-4">
                <Input
                  label="Phone Number"
                  placeholder="0123456789 or 60123456789"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  leftIcon={Phone}
                  hint={`Country code ${config.defaultCountryCode || "+60"} will be added automatically if not included`}
                />

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Template
                  </label>
                  <select
                    value={testTemplate}
                    onChange={(e) => setTestTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Message Preview
                  </label>
                  <pre className="text-xs text-zinc-600 bg-zinc-100 p-3 rounded-lg whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {templates
                      .find((t) => t.id === testTemplate)
                      ?.template.replace("{customer_name}", "Test Customer")
                      .replace("{company_name}", config.companyName)
                      .replace("{company_phone}", config.companyPhone)
                      .replace("{pledge_no}", "PLG-2024-001234")
                      .replace("{date}", new Date().toLocaleDateString("en-MY"))
                      .replace("{loan_amount}", "2,500.00")
                      .replace("{due_date}", "24/01/2025")}
                  </pre>
                </div>

                <Button
                  variant="accent"
                  fullWidth
                  leftIcon={Send}
                  onClick={handleSendTest}
                  loading={isSending}
                  disabled={!testPhone}
                >
                  Send Test Message
                </Button>
              </div>

              {/* Note */}
              <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                <p className="text-xs text-amber-700">
                  <strong>Note:</strong> In this prototype, messages are
                  simulated. In production, messages will be sent via the
                  configured WhatsApp API provider.
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Template Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Message Template"
        size="lg"
      >
        <div className="p-5">
          {editingTemplate && (
            <div className="space-y-4">
              <Input
                label="Template Name"
                value={editingTemplate.name}
                onChange={(e) =>
                  setEditingTemplate({
                    ...editingTemplate,
                    name: e.target.value,
                  })
                }
              />

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Message Template
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono text-sm"
                  rows={12}
                  value={editingTemplate.template}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      template: e.target.value,
                    })
                  }
                />
              </div>

              {/* Variables */}
              <div>
                <p className="text-xs text-zinc-500 mb-2">
                  Available Variables (click to insert):
                </p>
                <div className="flex flex-wrap gap-1">
                  {variables.map((v) => (
                    <button
                      key={v}
                      onClick={() =>
                        setEditingTemplate({
                          ...editingTemplate,
                          template: editingTemplate.template + v,
                        })
                      }
                      className="px-2 py-1 text-xs bg-zinc-100 hover:bg-zinc-200 rounded transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  fullWidth
                  leftIcon={Save}
                  onClick={saveTemplate}
                >
                  Save Template
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
      {/* View Full Message Modal */}
      <Modal
        isOpen={showMessageModal}
        onClose={() => {
          setShowMessageModal(false);
          setSelectedMessage(null);
        }}
        title="Message Details"
        size="lg"
      >
        <div className="p-5">
          {selectedMessage && (
            <div className="space-y-4">
              {/* Message Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-zinc-500">Recipient</label>
                  <p className="font-medium text-zinc-800">
                    {selectedMessage.recipient_phone || selectedMessage.phone}
                    {selectedMessage.recipient_name && (
                      <span className="text-zinc-500 font-normal ml-2">
                        ({selectedMessage.recipient_name})
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-zinc-500">Status</label>
                  <p className="font-medium">
                    {selectedMessage.status === "sent" ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Sent
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center gap-1">
                        <XCircle className="w-4 h-4" />
                        Failed
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-zinc-500">Template</label>
                  <p className="font-medium text-zinc-800">
                    {selectedMessage.template?.name ||
                      selectedMessage.template_key ||
                      selectedMessage.template ||
                      "Manual"}
                  </p>
                </div>
                <div>
                  <label className="text-zinc-500">Sent At</label>
                  <p className="font-medium text-zinc-800">
                    {selectedMessage.created_at || selectedMessage.sent_at
                      ? new Date(
                        selectedMessage.created_at || selectedMessage.sent_at
                      ).toLocaleString("en-MY")
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Full Message Content */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  Full Message
                </label>
                <pre className="text-sm text-zinc-700 bg-zinc-100 p-4 rounded-lg whitespace-pre-wrap max-h-96 overflow-y-auto border border-zinc-200">
                  {selectedMessage.message_content ||
                    selectedMessage.message ||
                    "No message content"}
                </pre>
              </div>

              {/* Error Message if any */}
              {selectedMessage.status === "failed" && selectedMessage.error_message && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <label className="block text-sm font-medium text-red-700 mb-1">
                    Error Details
                  </label>
                  <p className="text-sm text-red-600">
                    {selectedMessage.error_message}
                  </p>
                </div>
              )}

              {/* Close Button */}
              <div className="pt-4 border-t border-zinc-200">
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    setShowMessageModal(false);
                    setSelectedMessage(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
