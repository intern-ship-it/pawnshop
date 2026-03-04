import { useState, useEffect } from "react";
import { Card } from "@/components/common";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Printer,
  CheckCircle,
  FileText,
  RotateCcw,
  Info,
} from "lucide-react";

const PRINT_FORMATS = [
  {
    id: "a5_landscape",
    label: "A5 Landscape",
    description: "Pre-printed carbonless form — A5 size, landscape orientation",
    details: [
      "Single page per receipt",
      "148 × 210 mm (A5)",
      "Used with pre-printed forms",
      "Standard format for dot-matrix / HP printers",
    ],
    pageSize: "A5",
    orientation: "landscape",
    icon: "🖨️",
  },
  {
    id: "a4_portrait",
    label: "A4 Portrait (2-Copy)",
    description: "Two copies printed on A4 portrait — office copy + customer copy",
    details: [
      "2 copies per print job",
      "210 × 297 mm (A4)",
      "Portrait orientation",
      "Suitable for inkjet / laser printers",
    ],
    pageSize: "A4",
    orientation: "portrait",
    icon: "📄",
  },
];

export default function PrintSettingsTab({ settings, updateSettings }) {
  const printSettings = settings.printSettings || { receiptFormat: "a5_landscape" };
  const selectedFormat = printSettings.receiptFormat || "a5_landscape";

  const handleFormatChange = (formatId) => {
    updateSettings("printSettings", {
      ...printSettings,
      receiptFormat: formatId,
    });

    // Also update localStorage immediately so other pages can read it
    try {
      const stored = JSON.parse(localStorage.getItem("pawnshop_settings") || "{}");
      stored.printSettings = { ...printSettings, receiptFormat: formatId };
      localStorage.setItem("pawnshop_settings", JSON.stringify(stored));

      // Dispatch event so any open pages can react
      window.dispatchEvent(
        new CustomEvent("printSettingsChanged", { detail: { receiptFormat: formatId } })
      );
    } catch (e) {
      console.error("Failed to update localStorage:", e);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-zinc-800 mb-2 flex items-center gap-2">
        <Printer className="w-5 h-5 text-amber-500" />
        Print Settings
      </h2>
      <p className="text-sm text-zinc-500 mb-6">
        Configure the global receipt print format. This setting applies to all receipt printing across
        Pledge, Renewal, and Redemption modules.
      </p>

      {/* Info banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">
            Global Print Format
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Changing this setting will affect how receipts are printed everywhere in the system —
            including auto-print after creating pledges, manual print from detail pages, and
            renewal/redemption receipts. Remember to click <strong>Save Changes</strong> to persist.
          </p>
        </div>
      </div>

      {/* Format selection cards */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-zinc-700 mb-3">
          Receipt Print Format
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRINT_FORMATS.map((format) => {
            const isSelected = selectedFormat === format.id;

            return (
              <motion.div
                key={format.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleFormatChange(format.id)}
                className={cn(
                  "relative cursor-pointer rounded-xl border-2 p-5 transition-all duration-200",
                  isSelected
                    ? "border-amber-500 bg-amber-50/50 shadow-md shadow-amber-100"
                    : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm"
                )}
              >
                {/* Selected indicator */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-3 right-3"
                  >
                    <CheckCircle className="w-6 h-6 text-amber-500" />
                  </motion.div>
                )}

                {/* Paper preview */}
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className={cn(
                      "flex-shrink-0 rounded-lg border-2 flex items-center justify-center bg-white",
                      format.orientation === "landscape"
                        ? "w-16 h-11"
                        : "w-11 h-16",
                      isSelected
                        ? "border-amber-400"
                        : "border-zinc-300"
                    )}
                  >
                    <span className="text-[10px] font-bold text-zinc-400">
                      {format.pageSize}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{format.icon}</span>
                      <h3
                        className={cn(
                          "font-semibold text-base",
                          isSelected ? "text-amber-700" : "text-zinc-800"
                        )}
                      >
                        {format.label}
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-500">{format.description}</p>
                  </div>
                </div>

                {/* Details list */}
                <ul className="space-y-1.5 ml-1">
                  {format.details.map((detail, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-zinc-600">
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full flex-shrink-0",
                          isSelected ? "bg-amber-400" : "bg-zinc-300"
                        )}
                      />
                      {detail}
                    </li>
                  ))}
                </ul>

                {/* Radio indicator */}
                <div className="mt-4 flex items-center gap-2">
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                      isSelected
                        ? "border-amber-500"
                        : "border-zinc-300"
                    )}
                  >
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-2 h-2 rounded-full bg-amber-500"
                      />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isSelected ? "text-amber-600" : "text-zinc-400"
                    )}
                  >
                    {isSelected ? "Selected" : "Click to select"}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Current selection summary */}
      <div className="mt-6 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-800">
              Current Format:{" "}
              <span className="text-amber-600">
                {PRINT_FORMATS.find((f) => f.id === selectedFormat)?.label || "A5 Landscape"}
              </span>
            </p>
            <p className="text-xs text-zinc-500">
              {selectedFormat === "a5_landscape"
                ? "All receipt prints will use A5 Landscape (pre-printed form overlay)"
                : "All receipt prints will use A4 Portrait with 2 copies (office + customer)"}
            </p>
          </div>
        </div>
      </div>

      {/* Affected modules */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { name: "Pledge", desc: "New pledge + detail page" },
          { name: "Renewal", desc: "Renewal receipts" },
          { name: "Redemption", desc: "Redemption receipts" },
        ].map((module) => (
          <div
            key={module.name}
            className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center"
          >
            <p className="text-xs font-semibold text-emerald-700">{module.name}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">{module.desc}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
