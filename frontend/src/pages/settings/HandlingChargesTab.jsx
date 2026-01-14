import { useState, useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { settingsService } from "@/services";
import { Card, Button, Input, Select, Badge } from "@/components/common";
import { Banknote, Save, Loader2, DollarSign, Percent } from "lucide-react";

export default function HandlingChargesTab() {
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [settings, setSettings] = useState({
    type: "fixed", // 'fixed' or 'percentage'
    value: 0,
    min_amount: 0, // Minimum charge if percentage
  });

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await settingsService.getAll();
      if (response.success && response.data) {
        // Find handling charge settings from the generic settings array
        const handlingSettings = response.data.pledge || [];
        const type =
          handlingSettings.find((s) => s.key_name === "handling_charge_type")
            ?.value || "fixed";
        const value = parseFloat(
          handlingSettings.find((s) => s.key_name === "handling_charge_value")
            ?.value || 0
        );
        const minAmount = parseFloat(
          handlingSettings.find((s) => s.key_name === "handling_charge_min")
            ?.value || 0
        );

        setSettings({
          type,
          value,
          min_amount: minAmount,
        });
      }
    } catch (err) {
      console.error("Error fetching handling settings:", err);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to load handling charge settings",
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = [
        {
          category: "pledge",
          key_name: "handling_charge_type",
          value: settings.type,
        },
        {
          category: "pledge",
          key_name: "handling_charge_value",
          value: settings.value.toString(),
        },
        {
          category: "pledge",
          key_name: "handling_charge_min",
          value: settings.min_amount.toString(),
        },
      ];

      const response = await settingsService.update(payload);

      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Saved",
            message: "Handling charge settings updated successfully",
          })
        );
      } else {
        throw new Error(response.message || "Failed to save");
      }
    } catch (err) {
      console.error("Error saving handling settings:", err);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: err.message || "Failed to update settings",
        })
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

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
          <Banknote className="w-5 h-5 text-amber-500" />
          Handling Charges
        </h2>
        <Button
          variant="accent"
          leftIcon={Save}
          onClick={handleSave}
          loading={isSaving}
        >
          Save Changes
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-700">
          Configure the default handling charge / processing fee applied to new
          pledges. This amount will be deducted from the loan payout amount.
        </p>
      </div>

      <div className="max-w-xl space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Charge Type
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSettings({ ...settings, type: "fixed" })}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                settings.type === "fixed"
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-zinc-200 hover:border-zinc-300 text-zinc-600"
              }`}
            >
              <DollarSign className="w-6 h-6" />
              <span className="font-medium">Fixed Amount</span>
            </button>
            <button
              onClick={() => setSettings({ ...settings, type: "percentage" })}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                settings.type === "percentage"
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-zinc-200 hover:border-zinc-300 text-zinc-600"
              }`}
            >
              <Percent className="w-6 h-6" />
              <span className="font-medium">Percentage of Loan</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label={settings.type === "fixed" ? "Amount (RM)" : "Percentage (%)"}
            type="number"
            min="0"
            step={settings.type === "fixed" ? "0.01" : "0.1"}
            value={settings.value}
            onChange={(e) =>
              setSettings({
                ...settings,
                value: parseFloat(e.target.value) || 0,
              })
            }
            placeholder="0.00"
            rightElement={
              <span className="text-zinc-400">
                {settings.type === "fixed" ? "RM" : "%"}
              </span>
            }
          />

          {settings.type === "percentage" && (
            <Input
              label="Minimum Charge (RM)"
              type="number"
              min="0"
              step="0.01"
              value={settings.min_amount}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  min_amount: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="0.00"
              helperText="Minimum amount to charge if percentage is lower"
              rightElement={<span className="text-zinc-400">RM</span>}
            />
          )}
        </div>

        <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200">
          <h4 className="text-sm font-medium text-zinc-700 mb-2">
            Example Calculation
          </h4>
          <div className="text-sm text-zinc-600 space-y-1">
            <div className="flex justify-between">
              <span>Loan Amount:</span>
              <span>RM 1,000.00</span>
            </div>
            <div className="flex justify-between text-amber-600 font-medium">
              <span>Handling Charge:</span>
              <span>
                - RM{" "}
                {settings.type === "fixed"
                  ? settings.value.toFixed(2)
                  : Math.max(
                      1000 * (settings.value / 100),
                      settings.min_amount
                    ).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t border-zinc-300 pt-1 font-bold">
              <span>Net Payout:</span>
              <span>
                RM{" "}
                {(
                  1000 -
                  (settings.type === "fixed"
                    ? settings.value
                    : Math.max(
                        1000 * (settings.value / 100),
                        settings.min_amount
                      ))
                ).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
