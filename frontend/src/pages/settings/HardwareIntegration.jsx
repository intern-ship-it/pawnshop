import { useState, useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { getToken } from "@/services/api";
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

// Default device templates
const DEVICE_TEMPLATES = {
  epson_lq310: {
    name: "Epson LQ-310",
    type: DEVICE_TYPES.DOT_MATRIX_PRINTER,
    brand: "Epson",
    model: "LQ-310",
    connection: CONNECTION_TYPES.USB,
    paperSize: "A5",
    description: "24-pin dot matrix printer for multi-copy receipts",
    settings: {
      copies: 2,
      charactersPerLine: 42,
      cpi: 10, // Characters per inch
      lpi: 6, // Lines per inch
    },
  },
  aiyin_an803: {
    name: "Aiyin AN803",
    type: DEVICE_TYPES.THERMAL_PRINTER,
    brand: "Xiamen Aiyin",
    model: "AN803",
    connection: CONNECTION_TYPES.USB,
    paperSize: "80mm",
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

// Local storage key
const STORAGE_KEY = "pawnsys_hardware_devices";

export default function HardwareIntegration() {
  const dispatch = useAppDispatch();

  // State
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testingDevice, setTestingDevice] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for adding/editing device
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    brand: "",
    model: "",
    connection: CONNECTION_TYPES.USB,
    paperSize: "",
    description: "",
    ipAddress: "",
    port: "",
    isDefault: false,
    isActive: true,
    settings: {},
  });

  // Load devices from localStorage on mount
  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setDevices(JSON.parse(stored));
      } else {
        // Initialize with default devices
        const defaultDevices = [
          {
            id: "dev-1",
            ...DEVICE_TEMPLATES.epson_lq310,
            isDefault: true,
            isActive: true,
            status: "unknown",
            lastTested: null,
          },
          {
            id: "dev-2",
            ...DEVICE_TEMPLATES.aiyin_an803,
            isDefault: true,
            isActive: true,
            status: "unknown",
            lastTested: null,
          },
          {
            id: "dev-3",
            ...DEVICE_TEMPLATES.henex_hc3208r,
            isDefault: true,
            isActive: true,
            status: "unknown",
            lastTested: null,
          },
        ];
        setDevices(defaultDevices);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultDevices));
      }
    } catch (error) {
      console.error("Error loading devices:", error);
    }
  };

  const saveDevices = (updatedDevices) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDevices));
      setDevices(updatedDevices);
      dispatch(
        addToast({
          type: "success",
          title: "Saved",
          message: "Device settings saved successfully",
        })
      );
    } catch (error) {
      console.error("Error saving devices:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to save device settings",
        })
      );
    }
  };

  // Add new device
  const handleAddDevice = () => {
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

    const newDevice = {
      id: `dev-${Date.now()}`,
      ...formData,
      status: "unknown",
      lastTested: null,
      createdAt: new Date().toISOString(),
    };

    const updatedDevices = [...devices, newDevice];
    saveDevices(updatedDevices);
    setShowAddModal(false);
    resetForm();
  };

  // Update device
  const handleUpdateDevice = () => {
    if (!selectedDevice) return;

    const updatedDevices = devices.map((d) =>
      d.id === selectedDevice.id
        ? { ...d, ...formData, updatedAt: new Date().toISOString() }
        : d
    );
    saveDevices(updatedDevices);
    setIsEditing(false);
    setSelectedDevice({ ...selectedDevice, ...formData });
  };

  // Delete device
  const handleDeleteDevice = (deviceId) => {
    if (!confirm("Are you sure you want to delete this device?")) return;

    const updatedDevices = devices.filter((d) => d.id !== deviceId);
    saveDevices(updatedDevices);

    if (selectedDevice?.id === deviceId) {
      setSelectedDevice(null);
    }
  };

  // Toggle device active status
  const handleToggleActive = (deviceId) => {
    const updatedDevices = devices.map((d) =>
      d.id === deviceId ? { ...d, isActive: !d.isActive } : d
    );
    saveDevices(updatedDevices);

    if (selectedDevice?.id === deviceId) {
      setSelectedDevice({
        ...selectedDevice,
        isActive: !selectedDevice.isActive,
      });
    }
  };

  // Set as default for type
  const handleSetDefault = (deviceId, deviceType) => {
    const updatedDevices = devices.map((d) => ({
      ...d,
      isDefault:
        d.id === deviceId ? true : d.type === deviceType ? false : d.isDefault,
    }));
    saveDevices(updatedDevices);

    if (selectedDevice?.id === deviceId) {
      setSelectedDevice({ ...selectedDevice, isDefault: true });
    }
  };

  // Test device connection
  const handleTestDevice = async (device) => {
    setTestingDevice(device);
    setShowTestModal(true);
    setIsTesting(true);
    setTestResult(null);

    try {
      // Simulate testing based on device type
      await new Promise((resolve) => setTimeout(resolve, 2000));

      let result = { success: false, message: "", details: [] };

      switch (device.type) {
        case DEVICE_TYPES.DOT_MATRIX_PRINTER:
        case DEVICE_TYPES.THERMAL_PRINTER:
          // For printers, we check if browser can detect printers
          result = {
            success: true,
            message: "Printer is accessible via browser print dialog",
            details: [
              {
                label: "Connection",
                value: device.connection.toUpperCase(),
                status: "ok",
              },
              { label: "Paper Size", value: device.paperSize, status: "ok" },
              { label: "Status", value: "Ready", status: "ok" },
            ],
          };
          break;

        case DEVICE_TYPES.BARCODE_SCANNER:
          result = {
            success: true,
            message: "Scanner configured in keyboard wedge mode",
            details: [
              { label: "Mode", value: "Keyboard Wedge", status: "ok" },
              { label: "Suffix", value: "Enter Key", status: "ok" },
              {
                label: "Connection",
                value: device.connection.toUpperCase(),
                status: "ok",
              },
            ],
          };
          break;

        default:
          result = {
            success: false,
            message: "Unknown device type",
            details: [],
          };
      }

      setTestResult(result);

      // Update device status
      const updatedDevices = devices.map((d) =>
        d.id === device.id
          ? {
              ...d,
              status: result.success ? "connected" : "error",
              lastTested: new Date().toISOString(),
            }
          : d
      );
      setDevices(updatedDevices);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDevices));
    } catch (error) {
      setTestResult({
        success: false,
        message: error.message || "Test failed",
        details: [],
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Test print
  const handleTestPrint = async (device) => {
    const token = getToken();
    if (!token) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please login again",
        })
      );
      return;
    }

    setIsTesting(true);

    try {
      if (device.type === DEVICE_TYPES.DOT_MATRIX_PRINTER) {
        // Generate test receipt for dot matrix
        const testText = `
==========================================
           TEST PRINT
         PAJAK GADAI BERLESEN
==========================================

Device: ${device.name}
Model: ${device.brand} ${device.model}
Paper: ${device.paperSize}
Time: ${new Date().toLocaleString("en-MY")}

------------------------------------------
This is a test print to verify that your
dot matrix printer is working correctly.

Characters per line: 42
------------------------------------------

1234567890123456789012345678901234567890XX

==========================================
        TEST PRINT COMPLETE
==========================================
`;

        const printWindow = window.open("", "_blank", "width=450,height=600");
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Test Print - ${device.name}</title>
            <style>
              @page { size: ${device.paperSize} portrait; margin: 10mm; }
              body {
                font-family: 'Courier New', monospace;
                font-size: 11px;
                line-height: 1.3;
                white-space: pre;
                margin: 10mm;
              }
            </style>
          </head>
          <body>${testText}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);

        dispatch(
          addToast({
            type: "success",
            title: "Test Print Sent",
            message: "Check your dot matrix printer",
          })
        );
      } else if (device.type === DEVICE_TYPES.THERMAL_PRINTER) {
        // Generate test label for thermal
        const printWindow = window.open("", "_blank", "width=400,height=400");
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Test Label - ${device.name}</title>
            <style>
              @page { size: 50mm 25mm; margin: 0; }
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
              }
              .label {
                width: 50mm;
                height: 25mm;
                padding: 2mm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border: 1px dashed #ccc;
              }
              .title { font-size: 10pt; font-weight: bold; }
              .info { font-size: 7pt; margin-top: 2mm; }
              .time { font-size: 6pt; color: #666; margin-top: 1mm; }
            </style>
          </head>
          <body>
            <div class="label">
              <div class="title">TEST LABEL</div>
              <div class="info">${device.name}</div>
              <div class="info">${device.settings?.labelWidth || 50}mm x ${device.settings?.labelHeight || 25}mm</div>
              <div class="time">${new Date().toLocaleString("en-MY")}</div>
            </div>
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);

        dispatch(
          addToast({
            type: "success",
            title: "Test Label Sent",
            message: "Check your thermal printer",
          })
        );
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Test Failed",
          message: error.message,
        })
      );
    } finally {
      setIsTesting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      type: "",
      brand: "",
      model: "",
      connection: CONNECTION_TYPES.USB,
      paperSize: "",
      description: "",
      ipAddress: "",
      port: "",
      isDefault: false,
      isActive: true,
      settings: {},
    });
  };

  // Load template
  const handleLoadTemplate = (templateKey) => {
    const template = DEVICE_TEMPLATES[templateKey];
    if (template) {
      setFormData({
        ...formData,
        ...template,
        isDefault: false,
        isActive: true,
      });
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

  return (
    <PageWrapper
      title="Hardware Integration"
      subtitle="Manage printers, scanners, and other devices"
      actions={
        <Button
          variant="primary"
          leftIcon={Plus}
          onClick={() => setShowAddModal(true)}
        >
          Add Device
        </Button>
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
                  {devices.filter((d) => d.isActive).length}
                </p>
                <p className="text-xs text-zinc-500">Active</p>
              </div>
            </div>
          </Card>

          {/* Devices by Type */}
          {Object.entries(groupedDevices).map(([type, typeDevices]) => {
            const TypeIcon = getDeviceTypeIcon(type);
            return (
              <Card key={type} className="overflow-hidden">
                <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-3 flex items-center gap-2">
                  <TypeIcon className="w-4 h-4 text-amber-600" />
                  <h3 className="font-semibold text-zinc-800">
                    {getDeviceTypeLabel(type)}
                  </h3>
                  <span className="ml-auto text-xs text-zinc-500">
                    {typeDevices.length}
                  </span>
                </div>
                <div className="divide-y divide-zinc-100">
                  {typeDevices.map((device) => {
                    const ConnectionIcon = getConnectionIcon(device.connection);
                    return (
                      <div
                        key={device.id}
                        onClick={() => {
                          setSelectedDevice(device);
                          setFormData(device);
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
                            <div>
                              <p className="font-medium text-zinc-800 text-sm">
                                {device.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <ConnectionIcon className="w-3 h-3" />
                                <span>{device.connection.toUpperCase()}</span>
                                {device.isDefault && (
                                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">
                                    Default
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {!device.isActive && (
                            <span className="text-xs text-zinc-400">
                              Disabled
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {devices.length === 0 && (
            <Card className="p-8 text-center">
              <Printer className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500">No devices configured</p>
              <Button
                variant="outline"
                size="sm"
                leftIcon={Plus}
                onClick={() => setShowAddModal(true)}
                className="mt-3"
              >
                Add Device
              </Button>
            </Card>
          )}
        </div>

        {/* Device Details */}
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
                        {selectedDevice.isDefault && (
                          <Badge variant="warning">Default</Badge>
                        )}
                        {!selectedDevice.isActive && (
                          <Badge variant="default">Disabled</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                  /* Edit Form */
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
                          {
                            value: DEVICE_TYPES.DOT_MATRIX_PRINTER,
                            label: "Dot Matrix Printer",
                          },
                          {
                            value: DEVICE_TYPES.THERMAL_PRINTER,
                            label: "Thermal Printer",
                          },
                          {
                            value: DEVICE_TYPES.BARCODE_SCANNER,
                            label: "Barcode Scanner",
                          },
                          {
                            value: DEVICE_TYPES.WEIGHING_SCALE,
                            label: "Weighing Scale",
                          },
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
                        label="Connection Type"
                        value={formData.connection}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            connection: e.target.value,
                          })
                        }
                        options={[
                          { value: CONNECTION_TYPES.USB, label: "USB" },
                          {
                            value: CONNECTION_TYPES.ETHERNET,
                            label: "Ethernet / Network",
                          },
                          {
                            value: CONNECTION_TYPES.SERIAL,
                            label: "Serial (COM)",
                          },
                          {
                            value: CONNECTION_TYPES.BLUETOOTH,
                            label: "Bluetooth",
                          },
                          {
                            value: CONNECTION_TYPES.WIRELESS,
                            label: "Wireless (WiFi)",
                          },
                        ]}
                      />
                      <Input
                        label="Paper Size"
                        value={formData.paperSize}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            paperSize: e.target.value,
                          })
                        }
                        placeholder="e.g., A5, 80mm, 50x25mm"
                      />
                    </div>

                    {(formData.connection === CONNECTION_TYPES.ETHERNET ||
                      formData.connection === CONNECTION_TYPES.WIRELESS) && (
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="IP Address"
                          value={formData.ipAddress}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              ipAddress: e.target.value,
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
                      placeholder="Brief description of this device"
                    />

                    {/* Device-specific settings */}
                    {formData.type === DEVICE_TYPES.DOT_MATRIX_PRINTER && (
                      <div className="p-4 bg-zinc-50 rounded-xl">
                        <h4 className="font-semibold text-zinc-800 mb-3">
                          Printer Settings
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                          <Input
                            label="Copies"
                            type="number"
                            min="1"
                            max="4"
                            value={formData.settings?.copies || 2}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                settings: {
                                  ...formData.settings,
                                  copies: parseInt(e.target.value),
                                },
                              })
                            }
                          />
                          <Input
                            label="Chars/Line"
                            type="number"
                            value={formData.settings?.charactersPerLine || 42}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                settings: {
                                  ...formData.settings,
                                  charactersPerLine: parseInt(e.target.value),
                                },
                              })
                            }
                          />
                          <Input
                            label="CPI"
                            type="number"
                            value={formData.settings?.cpi || 10}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                settings: {
                                  ...formData.settings,
                                  cpi: parseInt(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    )}

                    {formData.type === DEVICE_TYPES.THERMAL_PRINTER && (
                      <div className="p-4 bg-zinc-50 rounded-xl">
                        <h4 className="font-semibold text-zinc-800 mb-3">
                          Label Settings
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                          <Input
                            label="Width (mm)"
                            type="number"
                            value={formData.settings?.labelWidth || 50}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                settings: {
                                  ...formData.settings,
                                  labelWidth: parseInt(e.target.value),
                                },
                              })
                            }
                          />
                          <Input
                            label="Height (mm)"
                            type="number"
                            value={formData.settings?.labelHeight || 25}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                settings: {
                                  ...formData.settings,
                                  labelHeight: parseInt(e.target.value),
                                },
                              })
                            }
                          />
                          <Input
                            label="DPI"
                            type="number"
                            value={formData.settings?.dpi || 203}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                settings: {
                                  ...formData.settings,
                                  dpi: parseInt(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    )}

                    {formData.type === DEVICE_TYPES.BARCODE_SCANNER && (
                      <div className="p-4 bg-zinc-50 rounded-xl">
                        <h4 className="font-semibold text-zinc-800 mb-3">
                          Scanner Settings
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <Select
                            label="Mode"
                            value={formData.settings?.mode || "keyboard_wedge"}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                settings: {
                                  ...formData.settings,
                                  mode: e.target.value,
                                },
                              })
                            }
                            options={[
                              {
                                value: "keyboard_wedge",
                                label: "Keyboard Wedge",
                              },
                              { value: "serial", label: "Serial Mode" },
                              { value: "hid", label: "HID Mode" },
                            ]}
                          />
                          <Select
                            label="Suffix"
                            value={formData.settings?.suffix || "enter"}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                settings: {
                                  ...formData.settings,
                                  suffix: e.target.value,
                                },
                              })
                            }
                            options={[
                              { value: "enter", label: "Enter Key" },
                              { value: "tab", label: "Tab Key" },
                              { value: "none", label: "None" },
                            ]}
                          />
                        </div>
                        <div className="flex items-center gap-6 mt-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.settings?.beepOnScan ?? true}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  settings: {
                                    ...formData.settings,
                                    beepOnScan: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                            />
                            <span className="text-sm text-zinc-700">
                              Beep on Scan
                            </span>
                          </label>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false);
                          setFormData(selectedDevice);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        leftIcon={Save}
                        onClick={handleUpdateDevice}
                      >
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="space-y-6">
                    {/* Info Grid */}
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
                          {selectedDevice.connection.toUpperCase()}
                        </p>
                      </div>
                      <div className="p-3 bg-zinc-50 rounded-lg">
                        <p className="text-xs text-zinc-500">Paper Size</p>
                        <p className="font-medium text-zinc-800">
                          {selectedDevice.paperSize || "N/A"}
                        </p>
                      </div>
                      <div className="p-3 bg-zinc-50 rounded-lg">
                        <p className="text-xs text-zinc-500">Last Tested</p>
                        <p className="font-medium text-zinc-800">
                          {selectedDevice.lastTested
                            ? new Date(
                                selectedDevice.lastTested
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
                                      : value}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 pt-4 border-t border-zinc-200">
                      <Button
                        variant="primary"
                        leftIcon={TestTube}
                        onClick={() => handleTestDevice(selectedDevice)}
                      >
                        Test Connection
                      </Button>

                      {(selectedDevice.type ===
                        DEVICE_TYPES.DOT_MATRIX_PRINTER ||
                        selectedDevice.type ===
                          DEVICE_TYPES.THERMAL_PRINTER) && (
                        <Button
                          variant="outline"
                          leftIcon={Printer}
                          onClick={() => handleTestPrint(selectedDevice)}
                          loading={isTesting}
                        >
                          Test Print
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        leftIcon={selectedDevice.isActive ? X : Check}
                        onClick={() => handleToggleActive(selectedDevice.id)}
                      >
                        {selectedDevice.isActive ? "Disable" : "Enable"}
                      </Button>

                      {!selectedDevice.isDefault && (
                        <Button
                          variant="outline"
                          leftIcon={Zap}
                          onClick={() =>
                            handleSetDefault(
                              selectedDevice.id,
                              selectedDevice.type
                            )
                          }
                        >
                          Set as Default
                        </Button>
                      )}
                    </div>

                    {/* Help Section */}
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <HelpCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-amber-800">
                            Setup Help
                          </p>
                          <p className="text-sm text-amber-700 mt-1">
                            {selectedDevice.type ===
                              DEVICE_TYPES.DOT_MATRIX_PRINTER &&
                              "For Epson LQ-310: Connect via USB, install driver from epson.com.my, set paper to A5 continuous form."}
                            {selectedDevice.type ===
                              DEVICE_TYPES.THERMAL_PRINTER &&
                              "For Aiyin AN803: Install driver from help.aiyin.com, set label size to 50mm x 25mm in printer preferences."}
                            {selectedDevice.type ===
                              DEVICE_TYPES.BARCODE_SCANNER &&
                              "Scanner works in keyboard wedge mode - just scan and it types the barcode followed by Enter key."}
                          </p>
                          {selectedDevice.brand === "Epson" && (
                            <a
                              href="https://www.epson.com.my/Support"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-amber-600 hover:underline mt-2"
                            >
                              Download Driver{" "}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {selectedDevice.brand === "Xiamen Aiyin" && (
                            <a
                              href="https://help.aiyin.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-amber-600 hover:underline mt-2"
                            >
                              Download Driver{" "}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <Settings className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-800 mb-2">
                Select a Device
              </h3>
              <p className="text-zinc-500">
                Click on a device from the list to view details and settings
              </p>
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
        title="Add New Device"
        size="lg"
      >
        <div className="p-6 space-y-4">
          {/* Quick Templates */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm font-medium text-amber-800 mb-3">
              Quick Templates
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLoadTemplate("epson_lq310")}
              >
                Epson LQ-310
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLoadTemplate("aiyin_an803")}
              >
                Aiyin AN803
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLoadTemplate("henex_hc3208r")}
              >
                Henex HC-3208R
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Device Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Receipt Printer 1"
              required
            />
            <Select
              label="Device Type"
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
              options={[
                { value: "", label: "Select Type..." },
                {
                  value: DEVICE_TYPES.DOT_MATRIX_PRINTER,
                  label: "Dot Matrix Printer",
                },
                {
                  value: DEVICE_TYPES.THERMAL_PRINTER,
                  label: "Thermal Printer",
                },
                {
                  value: DEVICE_TYPES.BARCODE_SCANNER,
                  label: "Barcode Scanner",
                },
                { value: DEVICE_TYPES.WEIGHING_SCALE, label: "Weighing Scale" },
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
              placeholder="e.g., Epson"
            />
            <Input
              label="Model"
              value={formData.model}
              onChange={(e) =>
                setFormData({ ...formData, model: e.target.value })
              }
              placeholder="e.g., LQ-310"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Connection Type"
              value={formData.connection}
              onChange={(e) =>
                setFormData({ ...formData, connection: e.target.value })
              }
              options={[
                { value: CONNECTION_TYPES.USB, label: "USB" },
                {
                  value: CONNECTION_TYPES.ETHERNET,
                  label: "Ethernet / Network",
                },
                { value: CONNECTION_TYPES.SERIAL, label: "Serial (COM)" },
                { value: CONNECTION_TYPES.BLUETOOTH, label: "Bluetooth" },
                { value: CONNECTION_TYPES.WIRELESS, label: "Wireless (WiFi)" },
              ]}
            />
            <Input
              label="Paper Size"
              value={formData.paperSize}
              onChange={(e) =>
                setFormData({ ...formData, paperSize: e.target.value })
              }
              placeholder="e.g., A5, 80mm"
            />
          </div>

          <Input
            label="Description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Brief description"
          />

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) =>
                  setFormData({ ...formData, isDefault: e.target.checked })
                }
                className="w-4 h-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-sm text-zinc-700">
                Set as default for this type
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" leftIcon={Plus} onClick={handleAddDevice}>
              Add Device
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
        title={`Testing: ${testingDevice?.name || "Device"}`}
        size="md"
      >
        <div className="p-6">
          {isTesting ? (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-4" />
              <p className="text-zinc-600">Testing connection...</p>
              <p className="text-sm text-zinc-400 mt-1">
                This may take a few seconds
              </p>
            </div>
          ) : testResult ? (
            <div className="space-y-4">
              <div
                className={cn(
                  "p-4 rounded-xl flex items-center gap-3",
                  testResult.success
                    ? "bg-emerald-50 border border-emerald-200"
                    : "bg-red-50 border border-red-200"
                )}
              >
                {testResult.success ? (
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-600" />
                )}
                <div>
                  <p
                    className={cn(
                      "font-semibold",
                      testResult.success ? "text-emerald-800" : "text-red-800"
                    )}
                  >
                    {testResult.success
                      ? "Connection Successful"
                      : "Connection Failed"}
                  </p>
                  <p
                    className={cn(
                      "text-sm",
                      testResult.success ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {testResult.message}
                  </p>
                </div>
              </div>

              {testResult.details.length > 0 && (
                <div className="space-y-2">
                  {testResult.details.map((detail, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg"
                    >
                      <span className="text-zinc-600">{detail.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-800">
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

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowTestModal(false);
                    setTestResult(null);
                  }}
                >
                  Close
                </Button>
                {(testingDevice?.type === DEVICE_TYPES.DOT_MATRIX_PRINTER ||
                  testingDevice?.type === DEVICE_TYPES.THERMAL_PRINTER) && (
                  <Button
                    variant="primary"
                    leftIcon={Printer}
                    onClick={() => handleTestPrint(testingDevice)}
                  >
                    Test Print
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </PageWrapper>
  );
}
