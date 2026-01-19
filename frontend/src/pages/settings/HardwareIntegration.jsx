/**
 * Hardware Integration Settings
 * Manage printers, scanners, and other devices
 *
 * NOW USES API (dynamic) instead of localStorage
 */

import { useState, useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import hardwareService from "@/services/hardwareService";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select, Badge, Modal } from "@/components/common";
import {
  Printer,
  ScanLine,
  Settings,
  Check,
  X,
  RefreshCw,
  Wifi,
  WifiOff,
  Usb,
  Monitor,
  TestTube,
  Save,
  Trash2,
  Plus,
  Edit,
  AlertCircle,
  CheckCircle,
  Info,
  Loader2,
  FileText,
  Barcode,
  Receipt,
  Scale,
  Zap,
  HelpCircle,
  ExternalLink,
  Copy,
  Volume2,
  VolumeX,
  Clock,
  BookOpen,
} from "lucide-react";

// Device types
const DEVICE_TYPES = {
  DOT_MATRIX_PRINTER: "dot_matrix_printer",
  THERMAL_PRINTER: "thermal_printer",
  BARCODE_SCANNER: "barcode_scanner",
  WEIGHING_SCALE: "weighing_scale",
};

// Connection types
const CONNECTION_TYPES = {
  USB: "usb",
  ETHERNET: "ethernet",
  SERIAL: "serial",
  BLUETOOTH: "bluetooth",
  WIRELESS: "wireless",
};

// Default device templates (for quick add)
const DEVICE_TEMPLATES = {
  epson_lq310: {
    name: "Epson LQ-310",
    type: DEVICE_TYPES.DOT_MATRIX_PRINTER,
    brand: "Epson",
    model: "LQ-310",
    connection: CONNECTION_TYPES.USB,
    paper_size: "A5",
    description: "24-pin dot matrix printer for multi-copy receipts",
    settings: {
      copies: 2,
      charactersPerLine: 42,
      cpi: 10,
      lpi: 6,
    },
  },
  aiyin_an803: {
    name: "Aiyin AN803",
    type: DEVICE_TYPES.THERMAL_PRINTER,
    brand: "Xiamen Aiyin",
    model: "AN803",
    connection: CONNECTION_TYPES.USB,
    paper_size: "80mm",
    description: "Thermal receipt printer for barcode labels",
    settings: {
      labelWidth: 50,
      labelHeight: 25,
      dpi: 203,
      speed: "medium",
    },
  },
  henex_hc3208r: {
    name: "Henex HC-3208R",
    type: DEVICE_TYPES.BARCODE_SCANNER,
    brand: "Henex",
    model: "HC-3208R",
    connection: CONNECTION_TYPES.WIRELESS,
    description: "2D wireless barcode scanner",
    settings: {
      mode: "keyboard_wedge",
      suffix: "enter",
      beepOnScan: true,
      vibrate: false,
    },
  },
};

// Device Setup Guides
const DEVICE_SETUP_GUIDES = {
  [DEVICE_TYPES.DOT_MATRIX_PRINTER]: {
    title: "Dot Matrix Printer Setup",
    icon: Receipt,
    difficulty: "Medium",
    timeRequired: "10-15 minutes",
    steps: [
      {
        title: "Install Drivers",
        description:
          "Download and install the printer driver from the manufacturer's website. For Epson LQ-310, visit epson.com/support.",
        important: true,
      },
      {
        title: "Connect the Printer",
        description:
          "Connect the printer to your computer using USB or parallel cable. Ensure the power is on.",
      },
      {
        title: "Load Paper",
        description:
          'Insert continuous paper (A5 or 9.5" x 5.5") into the paper feeder. Align the paper holes with the tractor feed pins.',
      },
      {
        title: "Set as Windows Default (Optional)",
        description:
          "Go to Settings > Printers & Scanners > Set as default if this is your main receipt printer.",
      },
      {
        title: "Configure in PawnSys",
        description:
          "Add the printer in Hardware Integration with the correct settings. Set copies to 2 for office and customer copies.",
      },
      {
        title: "Test Print",
        description:
          "Click 'Test Connection' to verify the printer is working. A test page will be printed.",
      },
    ],
    tips: [
      "Use genuine Epson ribbons for best print quality",
      "Set CPI (characters per inch) to 10 for standard receipts",
      "Clean the print head monthly to prevent smudging",
    ],
    troubleshooting: [
      {
        problem: "Printer not detected",
        solution: "Reinstall driver and try a different USB port",
      },
      { problem: "Faded print", solution: "Replace the ink ribbon cartridge" },
      {
        problem: "Paper jamming",
        solution: "Check paper alignment and tractor feed adjustment",
      },
    ],
  },
  [DEVICE_TYPES.THERMAL_PRINTER]: {
    title: "Thermal Printer Setup",
    icon: Barcode,
    difficulty: "Easy",
    timeRequired: "5-10 minutes",
    steps: [
      {
        title: "Install Drivers",
        description:
          "Most thermal printers are plug-and-play. If needed, install drivers from the manufacturer.",
      },
      {
        title: "Connect via USB",
        description:
          "Connect the thermal printer to your computer using the provided USB cable.",
        important: true,
      },
      {
        title: "Load Thermal Paper",
        description:
          "Open the paper cover and insert the thermal paper roll with the thermal side facing up (shiny side down).",
      },
      {
        title: "Configure Paper Size",
        description:
          "Set the label/receipt size in printer preferences. Common sizes: 80mm, 58mm, 50x25mm labels.",
      },
      {
        title: "Add to PawnSys",
        description:
          "Configure the printer in Hardware Integration with correct paper size and DPI settings.",
      },
    ],
    tips: [
      "Store thermal paper away from heat and sunlight",
      "Use appropriate paper width for your printer model",
      "Clean print head with isopropyl alcohol if print quality degrades",
    ],
    troubleshooting: [
      {
        problem: "Blank prints",
        solution: "Paper loaded wrong side up - flip the roll",
      },
      {
        problem: "Partial printing",
        solution: "Check paper width setting matches actual paper",
      },
      {
        problem: "Faded prints",
        solution: "Increase print density in printer settings",
      },
    ],
  },
  [DEVICE_TYPES.BARCODE_SCANNER]: {
    title: "Barcode Scanner Setup",
    icon: ScanLine,
    difficulty: "Easy",
    timeRequired: "2-5 minutes",
    steps: [
      {
        title: "Connect the Scanner",
        description:
          "Plug the USB receiver (for wireless) or cable into your computer. The scanner should beep when connected.",
        important: true,
      },
      {
        title: "Keyboard Wedge Mode",
        description:
          "Most scanners work in 'keyboard wedge' mode - they type the barcode directly into any focused text field.",
      },
      {
        title: "Configure Suffix",
        description:
          "By default, scanners add 'Enter' after scanning. This is ideal for PawnSys search fields.",
      },
      {
        title: "Test Scanning",
        description:
          "Open any text field (like Notepad) and scan a barcode. The code should appear and auto-submit.",
      },
      {
        title: "Add to PawnSys",
        description:
          "Register the scanner in Hardware Integration for status tracking and configuration backup.",
      },
    ],
    tips: [
      "Keep the scanner lens clean for reliable scanning",
      "For wireless scanners, charge fully before first use",
      "Position 10-15cm from barcode for optimal scanning",
      "PawnSys auto-detects barcode input in search fields",
    ],
    troubleshooting: [
      {
        problem: "Scanner not responding",
        solution:
          "Check USB connection, try different port, or re-pair wireless receiver",
      },
      {
        problem: "Wrong characters",
        solution:
          "Scanner may be in wrong keyboard layout mode - scan reset barcode from manual",
      },
      {
        problem: "Slow scanning",
        solution: "Ensure barcode labels are clean and not damaged",
      },
    ],
  },
};

export default function HardwareIntegration() {
  const dispatch = useAppDispatch();

  // State
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(null); // Device type for guide
  const [testingDevice, setTestingDevice] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form state for adding/editing device
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    brand: "",
    model: "",
    connection: CONNECTION_TYPES.USB,
    paper_size: "",
    description: "",
    ip_address: "",
    port: "",
    is_default: false,
    is_active: true,
    settings: {},
  });

  // Load devices from API on mount
  useEffect(() => {
    loadDevices();
  }, []);

  // ============================================
  // API FUNCTIONS
  // ============================================

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const response = await hardwareService.getAll();
      if (response.success && response.data?.devices) {
        setDevices(response.data.devices);
      } else {
        setDevices([]);
      }
    } catch (error) {
      console.error("Error loading devices:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to load hardware devices",
        })
      );
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add new device
  const handleAddDevice = async () => {
    if (!formData.name || !formData.type) {
      dispatch(
        addToast({
          type: "error",
          title: "Required",
          message: "Please fill in device name and type",
        })
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await hardwareService.create(formData);
      if (response.success) {
        await loadDevices(); // Reload list
        setShowAddModal(false);
        resetForm();
        dispatch(
          addToast({
            type: "success",
            title: "Success",
            message: "Device added successfully",
          })
        );
      } else {
        throw new Error(response.message || "Failed to add device");
      }
    } catch (error) {
      console.error("Error adding device:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.response?.data?.message || "Failed to add device",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Update device
  const handleUpdateDevice = async () => {
    if (!selectedDevice) return;

    setIsSaving(true);
    try {
      const response = await hardwareService.update(
        selectedDevice.id,
        formData
      );
      if (response.success) {
        await loadDevices(); // Reload list
        setSelectedDevice(response.data);
        setIsEditing(false);
        dispatch(
          addToast({
            type: "success",
            title: "Success",
            message: "Device updated successfully",
          })
        );
      } else {
        throw new Error(response.message || "Failed to update device");
      }
    } catch (error) {
      console.error("Error updating device:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.response?.data?.message || "Failed to update device",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Delete device
  const handleDeleteDevice = async (deviceId) => {
    if (!confirm("Are you sure you want to delete this device?")) return;

    try {
      const response = await hardwareService.delete(deviceId);
      if (response.success) {
        await loadDevices(); // Reload list
        if (selectedDevice?.id === deviceId) {
          setSelectedDevice(null);
        }
        dispatch(
          addToast({
            type: "success",
            title: "Success",
            message: "Device deleted successfully",
          })
        );
      } else {
        throw new Error(response.message || "Failed to delete device");
      }
    } catch (error) {
      console.error("Error deleting device:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.response?.data?.message || "Failed to delete device",
        })
      );
    }
  };

  // Toggle device active status
  const handleToggleActive = async (deviceId) => {
    try {
      const response = await hardwareService.toggleActive(deviceId);
      if (response.success) {
        await loadDevices(); // Reload list
        if (selectedDevice?.id === deviceId) {
          setSelectedDevice({
            ...selectedDevice,
            is_active: response.data.is_active,
          });
        }
        dispatch(
          addToast({
            type: "success",
            title: "Success",
            message: response.message,
          })
        );
      }
    } catch (error) {
      console.error("Error toggling device:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to toggle device status",
        })
      );
    }
  };

  // Set as default for type
  const handleSetDefault = async (deviceId) => {
    try {
      const response = await hardwareService.setDefault(deviceId);
      if (response.success) {
        await loadDevices(); // Reload list
        if (selectedDevice?.id === deviceId) {
          setSelectedDevice({ ...selectedDevice, is_default: true });
        }
        dispatch(
          addToast({
            type: "success",
            title: "Success",
            message: "Device set as default",
          })
        );
      }
    } catch (error) {
      console.error("Error setting default:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to set default device",
        })
      );
    }
  };

  // Test device connection
  const handleTestDevice = async (device) => {
    setTestingDevice(device);
    setShowTestModal(true);
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await hardwareService.testConnection(device.id);

      if (response.success) {
        setTestResult({
          success: response.data.success,
          message: response.data.message,
          details: response.data.details || [],
        });

        // Reload to get updated status
        await loadDevices();

        // Update selected device status
        if (selectedDevice?.id === device.id) {
          setSelectedDevice({
            ...selectedDevice,
            status: response.data.status,
            last_tested_at: response.data.last_tested_at,
          });
        }
      } else {
        setTestResult({
          success: false,
          message: response.message || "Test failed",
          details: [],
        });
      }
    } catch (error) {
      console.error("Error testing device:", error);
      setTestResult({
        success: false,
        message: error.response?.data?.message || "Connection test failed",
        details: [],
      });
    } finally {
      setIsTesting(false);
    }
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const resetForm = () => {
    setFormData({
      name: "",
      type: "",
      brand: "",
      model: "",
      connection: CONNECTION_TYPES.USB,
      paper_size: "",
      description: "",
      ip_address: "",
      port: "",
      is_default: false,
      is_active: true,
      settings: {},
    });
  };

  const applyTemplate = (templateKey) => {
    const template = DEVICE_TEMPLATES[templateKey];
    if (template) {
      setFormData({ ...formData, ...template });
    }
  };

  // Get device type label
  const getDeviceTypeLabel = (type) => {
    switch (type) {
      case DEVICE_TYPES.DOT_MATRIX_PRINTER:
        return "Dot Matrix Printer";
      case DEVICE_TYPES.THERMAL_PRINTER:
        return "Thermal Printer";
      case DEVICE_TYPES.BARCODE_SCANNER:
        return "Barcode Scanner";
      case DEVICE_TYPES.WEIGHING_SCALE:
        return "Weighing Scale";
      default:
        return type;
    }
  };

  // Get device type icon
  const getDeviceTypeIcon = (type) => {
    switch (type) {
      case DEVICE_TYPES.DOT_MATRIX_PRINTER:
        return Receipt;
      case DEVICE_TYPES.THERMAL_PRINTER:
        return Barcode;
      case DEVICE_TYPES.BARCODE_SCANNER:
        return ScanLine;
      case DEVICE_TYPES.WEIGHING_SCALE:
        return Scale;
      default:
        return Settings;
    }
  };

  // Get connection icon
  const getConnectionIcon = (connection) => {
    switch (connection) {
      case CONNECTION_TYPES.USB:
        return Usb;
      case CONNECTION_TYPES.ETHERNET:
        return Wifi;
      case CONNECTION_TYPES.WIRELESS:
        return Wifi;
      case CONNECTION_TYPES.BLUETOOTH:
        return Wifi;
      default:
        return Monitor;
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case "connected":
        return <Badge variant="success">Connected</Badge>;
      case "error":
        return <Badge variant="error">Error</Badge>;
      case "disconnected":
        return <Badge variant="warning">Disconnected</Badge>;
      default:
        return <Badge variant="default">Unknown</Badge>;
    }
  };

  // Group devices by type
  const groupedDevices = devices.reduce((acc, device) => {
    if (!acc[device.type]) {
      acc[device.type] = [];
    }
    acc[device.type].push(device);
    return acc;
  }, {});

  // ============================================
  // RENDER
  // ============================================

  if (isLoading) {
    return (
      <PageWrapper
        title="Hardware Integration"
        subtitle="Manage printers, scanners, and other devices"
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Hardware Integration"
      subtitle="Manage printers, scanners, and other devices"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={RefreshCw} onClick={loadDevices}>
            Refresh
          </Button>
          <Button
            variant="primary"
            leftIcon={Plus}
            onClick={() => setShowAddModal(true)}
          >
            Add Device
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Devices List */}
        <div className="lg:col-span-1 space-y-4">
          {/* Quick Stats */}
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-zinc-800">
                  {devices.length}
                </p>
                <p className="text-xs text-zinc-500">Total Devices</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">
                  {devices.filter((d) => d.status === "connected").length}
                </p>
                <p className="text-xs text-zinc-500">Connected</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">
                  {devices.filter((d) => d.is_active).length}
                </p>
                <p className="text-xs text-zinc-500">Active</p>
              </div>
            </div>
          </Card>

          {/* Devices by Type */}
          {Object.keys(groupedDevices).length === 0 ? (
            <Card className="p-8 text-center">
              <Settings className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <h3 className="font-semibold text-zinc-600 mb-2">No Devices</h3>
              <p className="text-sm text-zinc-500 mb-4">
                Add your first hardware device to get started.
              </p>
              <Button
                variant="primary"
                size="sm"
                leftIcon={Plus}
                onClick={() => setShowAddModal(true)}
              >
                Add Device
              </Button>
            </Card>
          ) : (
            Object.entries(groupedDevices).map(([type, typeDevices]) => {
              const TypeIcon = getDeviceTypeIcon(type);
              return (
                <Card key={type} className="overflow-hidden">
                  <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-3 flex items-center gap-2">
                    <TypeIcon className="w-4 h-4 text-amber-600" />
                    <h3 className="font-semibold text-zinc-800">
                      {getDeviceTypeLabel(type)}
                    </h3>
                    <span className="text-xs text-zinc-500">
                      {typeDevices.length}
                    </span>
                    {DEVICE_SETUP_GUIDES[type] && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSetupGuide(type);
                        }}
                        className="ml-auto flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 hover:underline"
                      >
                        <BookOpen className="w-3 h-3" />
                        Setup Guide
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {typeDevices.map((device) => {
                      const ConnectionIcon = getConnectionIcon(
                        device.connection
                      );
                      return (
                        <div
                          key={device.id}
                          onClick={() => {
                            setSelectedDevice(device);
                            setFormData({
                              name: device.name || "",
                              type: device.type || "",
                              brand: device.brand || "",
                              model: device.model || "",
                              connection:
                                device.connection || CONNECTION_TYPES.USB,
                              paper_size: device.paper_size || "",
                              description: device.description || "",
                              ip_address: device.ip_address || "",
                              port: device.port || "",
                              is_default: device.is_default || false,
                              is_active: device.is_active ?? true,
                              settings: device.settings || {},
                            });
                            setIsEditing(false);
                          }}
                          className={cn(
                            "p-3 cursor-pointer transition-colors",
                            selectedDevice?.id === device.id
                              ? "bg-amber-50 border-l-4 border-amber-500"
                              : "hover:bg-zinc-50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "w-2 h-2 rounded-full",
                                  device.status === "connected"
                                    ? "bg-emerald-500"
                                    : device.status === "error"
                                      ? "bg-red-500"
                                      : "bg-zinc-300"
                                )}
                              />
                              <span className="font-medium text-zinc-800">
                                {device.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {device.is_default && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                              <ConnectionIcon className="w-4 h-4 text-zinc-400" />
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">
                            {device.brand} {device.model}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Device Details / Edit Panel */}
        <div className="lg:col-span-2">
          {selectedDevice ? (
            <Card className="overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 text-white">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {(() => {
                      const DeviceIcon = getDeviceTypeIcon(selectedDevice.type);
                      return (
                        <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                          <DeviceIcon className="w-7 h-7" />
                        </div>
                      );
                    })()}
                    <div>
                      <h2 className="text-xl font-bold">
                        {selectedDevice.name}
                      </h2>
                      <p className="text-amber-100">
                        {selectedDevice.brand} {selectedDevice.model}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {getStatusBadge(selectedDevice.status)}
                        {selectedDevice.is_default && (
                          <Badge variant="warning">Default</Badge>
                        )}
                        {!selectedDevice.is_active && (
                          <Badge variant="default">Disabled</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {DEVICE_SETUP_GUIDES[selectedDevice.type] && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setShowSetupGuide(selectedDevice.type)}
                        className="text-white hover:bg-white/20"
                        title="Setup Guide"
                      >
                        <BookOpen className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setIsEditing(!isEditing)}
                      className="text-white hover:bg-white/20"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteDevice(selectedDevice.id)}
                      className="text-white hover:bg-red-500/50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {isEditing ? (
                  // Edit Form
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Device Name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                      />
                      <Select
                        label="Device Type"
                        value={formData.type}
                        onChange={(e) =>
                          setFormData({ ...formData, type: e.target.value })
                        }
                        options={[
                          { value: "", label: "Select type..." },
                          ...Object.entries(DEVICE_TYPES).map(
                            ([key, value]) => ({
                              value,
                              label: getDeviceTypeLabel(value),
                            })
                          ),
                        ]}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Brand"
                        value={formData.brand}
                        onChange={(e) =>
                          setFormData({ ...formData, brand: e.target.value })
                        }
                      />
                      <Input
                        label="Model"
                        value={formData.model}
                        onChange={(e) =>
                          setFormData({ ...formData, model: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Select
                        label="Connection"
                        value={formData.connection}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            connection: e.target.value,
                          })
                        }
                        options={Object.entries(CONNECTION_TYPES).map(
                          ([key, value]) => ({
                            value,
                            label: key,
                          })
                        )}
                      />
                      <Input
                        label="Paper Size"
                        value={formData.paper_size}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            paper_size: e.target.value,
                          })
                        }
                        placeholder="A5, 80mm, etc."
                      />
                    </div>
                    {(formData.connection === CONNECTION_TYPES.ETHERNET ||
                      formData.connection === CONNECTION_TYPES.WIRELESS) && (
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="IP Address"
                          value={formData.ip_address}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              ip_address: e.target.value,
                            })
                          }
                          placeholder="192.168.1.100"
                        />
                        <Input
                          label="Port"
                          value={formData.port}
                          onChange={(e) =>
                            setFormData({ ...formData, port: e.target.value })
                          }
                          placeholder="9100"
                        />
                      </div>
                    )}
                    <Input
                      label="Description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Optional description"
                    />
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_default}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              is_default: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm text-zinc-700">
                          Set as default for this type
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              is_active: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm text-zinc-700">Active</span>
                      </label>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false);
                          setFormData({
                            name: selectedDevice.name || "",
                            type: selectedDevice.type || "",
                            brand: selectedDevice.brand || "",
                            model: selectedDevice.model || "",
                            connection:
                              selectedDevice.connection || CONNECTION_TYPES.USB,
                            paper_size: selectedDevice.paper_size || "",
                            description: selectedDevice.description || "",
                            ip_address: selectedDevice.ip_address || "",
                            port: selectedDevice.port || "",
                            is_default: selectedDevice.is_default || false,
                            is_active: selectedDevice.is_active ?? true,
                            settings: selectedDevice.settings || {},
                          });
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        leftIcon={isSaving ? Loader2 : Save}
                        onClick={handleUpdateDevice}
                        disabled={isSaving}
                        className={isSaving ? "animate-pulse" : ""}
                      >
                        {isSaving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Details
                  <div className="space-y-6">
                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={TestTube}
                        onClick={() => handleTestDevice(selectedDevice)}
                      >
                        Test Connection
                      </Button>
                      {!selectedDevice.is_default && (
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={Zap}
                          onClick={() => handleSetDefault(selectedDevice.id)}
                        >
                          Set as Default
                        </Button>
                      )}
                      <Button
                        variant={
                          selectedDevice.is_active ? "outline" : "primary"
                        }
                        size="sm"
                        leftIcon={selectedDevice.is_active ? WifiOff : Wifi}
                        onClick={() => handleToggleActive(selectedDevice.id)}
                      >
                        {selectedDevice.is_active ? "Disable" : "Enable"}
                      </Button>
                    </div>

                    {/* Device Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-zinc-50 rounded-lg">
                        <p className="text-xs text-zinc-500">Type</p>
                        <p className="font-medium text-zinc-800">
                          {getDeviceTypeLabel(selectedDevice.type)}
                        </p>
                      </div>
                      <div className="p-3 bg-zinc-50 rounded-lg">
                        <p className="text-xs text-zinc-500">Connection</p>
                        <p className="font-medium text-zinc-800">
                          {selectedDevice.connection?.toUpperCase()}
                        </p>
                      </div>
                      <div className="p-3 bg-zinc-50 rounded-lg">
                        <p className="text-xs text-zinc-500">Paper Size</p>
                        <p className="font-medium text-zinc-800">
                          {selectedDevice.paper_size || "N/A"}
                        </p>
                      </div>
                      <div className="p-3 bg-zinc-50 rounded-lg">
                        <p className="text-xs text-zinc-500">Last Tested</p>
                        <p className="font-medium text-zinc-800">
                          {selectedDevice.last_tested_at
                            ? new Date(
                                selectedDevice.last_tested_at
                              ).toLocaleDateString("en-MY")
                            : "Never"}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    {selectedDevice.description && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                          <p className="text-sm text-blue-800">
                            {selectedDevice.description}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Network Info */}
                    {(selectedDevice.ip_address || selectedDevice.port) && (
                      <div className="p-4 bg-zinc-50 rounded-xl">
                        <h4 className="font-semibold text-zinc-800 mb-3">
                          Network Configuration
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {selectedDevice.ip_address && (
                            <div className="text-sm">
                              <p className="text-zinc-500">IP Address</p>
                              <p className="font-medium text-zinc-800">
                                {selectedDevice.ip_address}
                              </p>
                            </div>
                          )}
                          {selectedDevice.port && (
                            <div className="text-sm">
                              <p className="text-zinc-500">Port</p>
                              <p className="font-medium text-zinc-800">
                                {selectedDevice.port}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Device-specific settings display */}
                    {selectedDevice.settings &&
                      Object.keys(selectedDevice.settings).length > 0 && (
                        <div className="p-4 bg-zinc-50 rounded-xl">
                          <h4 className="font-semibold text-zinc-800 mb-3">
                            Device Settings
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.entries(selectedDevice.settings).map(
                              ([key, value]) => (
                                <div key={key} className="text-sm">
                                  <p className="text-zinc-500 capitalize">
                                    {key.replace(/([A-Z])/g, " $1").trim()}
                                  </p>
                                  <p className="font-medium text-zinc-800">
                                    {typeof value === "boolean"
                                      ? value
                                        ? "Yes"
                                        : "No"
                                      : String(value)}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-8">
              <div className="text-center mb-6">
                <Settings className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-zinc-600 mb-2">
                  Select a Device
                </h3>
                <p className="text-zinc-500">
                  Click on a device from the list to view details and settings.
                </p>
              </div>

              {/* Quick Setup Guides */}
              <div className="border-t border-zinc-200 pt-6 mt-6">
                <h4 className="font-semibold text-zinc-700 mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Quick Setup Guides
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.entries(DEVICE_SETUP_GUIDES).map(([type, guide]) => {
                    const GuideIcon = guide.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => setShowSetupGuide(type)}
                        className="flex items-center gap-3 p-4 bg-zinc-50 hover:bg-amber-50 rounded-lg border border-zinc-200 hover:border-amber-300 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <GuideIcon className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium text-zinc-800">
                            {guide.title}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {guide.difficulty} • {guide.timeRequired}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Barcode Scanner Note */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">
                        Barcode Scanner Tip
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        Most USB barcode scanners work immediately as "keyboard
                        wedge" devices. Simply plug in the scanner, focus any
                        search field in PawnSys, and scan a barcode. The barcode
                        value will be typed automatically.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Add Device Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title="Add Hardware Device"
        size="lg"
      >
        <div className="space-y-4">
          {/* Quick Templates */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Quick Setup Templates
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(DEVICE_TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => applyTemplate(key)}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left transition-colors",
                    formData.name === template.name
                      ? "border-amber-500 bg-amber-50"
                      : "border-zinc-200 hover:border-amber-300"
                  )}
                >
                  <p className="font-medium text-sm text-zinc-800">
                    {template.name}
                  </p>
                  <p className="text-xs text-zinc-500">{template.brand}</p>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-zinc-200" />

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Device Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
            <Select
              label="Device Type"
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
              options={[
                { value: "", label: "Select type..." },
                ...Object.entries(DEVICE_TYPES).map(([key, value]) => ({
                  value,
                  label: getDeviceTypeLabel(value),
                })),
              ]}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Brand"
              value={formData.brand}
              onChange={(e) =>
                setFormData({ ...formData, brand: e.target.value })
              }
            />
            <Input
              label="Model"
              value={formData.model}
              onChange={(e) =>
                setFormData({ ...formData, model: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Connection"
              value={formData.connection}
              onChange={(e) =>
                setFormData({ ...formData, connection: e.target.value })
              }
              options={Object.entries(CONNECTION_TYPES).map(([key, value]) => ({
                value,
                label: key,
              }))}
            />
            <Input
              label="Paper Size"
              value={formData.paper_size}
              onChange={(e) =>
                setFormData({ ...formData, paper_size: e.target.value })
              }
              placeholder="A5, 80mm, etc."
            />
          </div>
          {(formData.connection === CONNECTION_TYPES.ETHERNET ||
            formData.connection === CONNECTION_TYPES.WIRELESS) && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="IP Address"
                value={formData.ip_address}
                onChange={(e) =>
                  setFormData({ ...formData, ip_address: e.target.value })
                }
                placeholder="192.168.1.100"
              />
              <Input
                label="Port"
                value={formData.port}
                onChange={(e) =>
                  setFormData({ ...formData, port: e.target.value })
                }
                placeholder="9100"
              />
            </div>
          )}
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Optional description"
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) =>
                  setFormData({ ...formData, is_default: e.target.checked })
                }
                className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-zinc-700">
                Set as default for this type
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              leftIcon={isSaving ? Loader2 : Plus}
              onClick={handleAddDevice}
              disabled={isSaving}
              className={isSaving ? "animate-pulse" : ""}
            >
              {isSaving ? "Adding..." : "Add Device"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Test Connection Modal */}
      <Modal
        isOpen={showTestModal}
        onClose={() => {
          setShowTestModal(false);
          setTestingDevice(null);
          setTestResult(null);
        }}
        title="Test Device Connection"
        size="md"
      >
        {testingDevice && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-lg">
              {(() => {
                const DeviceIcon = getDeviceTypeIcon(testingDevice.type);
                return <DeviceIcon className="w-8 h-8 text-amber-600" />;
              })()}
              <div>
                <p className="font-semibold text-zinc-800">
                  {testingDevice.name}
                </p>
                <p className="text-sm text-zinc-500">
                  {testingDevice.brand} {testingDevice.model}
                </p>
              </div>
            </div>

            {isTesting ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="w-12 h-12 animate-spin text-amber-600 mb-4" />
                <p className="text-zinc-600">Testing connection...</p>
              </div>
            ) : testResult ? (
              <div className="space-y-4">
                <div
                  className={cn(
                    "p-4 rounded-lg border",
                    testResult.success
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-red-50 border-red-200"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {testResult.success ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    )}
                    <div>
                      <p
                        className={cn(
                          "font-medium",
                          testResult.success
                            ? "text-emerald-800"
                            : "text-red-800"
                        )}
                      >
                        {testResult.success
                          ? "Connection Successful"
                          : "Connection Failed"}
                      </p>
                      <p
                        className={cn(
                          "text-sm",
                          testResult.success
                            ? "text-emerald-700"
                            : "text-red-700"
                        )}
                      >
                        {testResult.message}
                      </p>
                    </div>
                  </div>
                </div>

                {testResult.details && testResult.details.length > 0 && (
                  <div className="space-y-2">
                    {testResult.details.map((detail, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg"
                      >
                        <span className="text-sm text-zinc-600">
                          {detail.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-800">
                            {detail.value}
                          </span>
                          {detail.status === "ok" && (
                            <Check className="w-4 h-4 text-emerald-500" />
                          )}
                          {detail.status === "error" && (
                            <X className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTestModal(false);
                  setTestingDevice(null);
                  setTestResult(null);
                }}
              >
                Close
              </Button>
              {!isTesting && (
                <Button
                  variant="primary"
                  leftIcon={RefreshCw}
                  onClick={() => handleTestDevice(testingDevice)}
                >
                  Test Again
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Setup Guide Modal */}
      <Modal
        isOpen={!!showSetupGuide}
        onClose={() => setShowSetupGuide(null)}
        title={DEVICE_SETUP_GUIDES[showSetupGuide]?.title || "Setup Guide"}
        size="lg"
      >
        {showSetupGuide && DEVICE_SETUP_GUIDES[showSetupGuide] && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg">
              {(() => {
                const GuideIcon = DEVICE_SETUP_GUIDES[showSetupGuide].icon;
                return (
                  <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
                    <GuideIcon className="w-6 h-6 text-white" />
                  </div>
                );
              })()}
              <div>
                <h3 className="font-semibold text-zinc-800">
                  {DEVICE_SETUP_GUIDES[showSetupGuide].title}
                </h3>
                <div className="flex items-center gap-3 text-sm text-zinc-600 mt-1">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {DEVICE_SETUP_GUIDES[showSetupGuide].difficulty}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {DEVICE_SETUP_GUIDES[showSetupGuide].timeRequired}
                  </span>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div>
              <h4 className="font-semibold text-zinc-800 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Setup Steps
              </h4>
              <div className="space-y-3">
                {DEVICE_SETUP_GUIDES[showSetupGuide].steps.map(
                  (step, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex gap-3 p-3 rounded-lg border",
                        step.important
                          ? "bg-amber-50 border-amber-200"
                          : "bg-zinc-50 border-zinc-200"
                      )}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold",
                          step.important
                            ? "bg-amber-500 text-white"
                            : "bg-zinc-300 text-zinc-700"
                        )}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-800">
                          {step.title}
                        </p>
                        <p className="text-sm text-zinc-600 mt-1">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Tips */}
            <div>
              <h4 className="font-semibold text-zinc-800 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" />
                Pro Tips
              </h4>
              <ul className="space-y-2">
                {DEVICE_SETUP_GUIDES[showSetupGuide].tips.map((tip, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-zinc-600"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Troubleshooting */}
            <div>
              <h4 className="font-semibold text-zinc-800 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Troubleshooting
              </h4>
              <div className="space-y-2">
                {DEVICE_SETUP_GUIDES[showSetupGuide].troubleshooting.map(
                  (item, index) => (
                    <div
                      key={index}
                      className="p-3 bg-zinc-50 rounded-lg border border-zinc-200"
                    >
                      <p className="font-medium text-red-600 text-sm">
                        ⚠️ {item.problem}
                      </p>
                      <p className="text-sm text-zinc-600 mt-1">
                        ✓ {item.solution}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button variant="primary" onClick={() => setShowSetupGuide(null)}>
                Got it!
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageWrapper>
  );
}
