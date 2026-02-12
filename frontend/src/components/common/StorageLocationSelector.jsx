/**
 * Storage Location Selector - Cascading Dropdowns
 * Vault → Box → Slot selection with real-time availability
 */

import { useState, useEffect } from "react";
import { Select } from "@/components/common";
import { MapPin, Package, Grid3X3, Loader2 } from "lucide-react";
import storageService from "@/services/storageService";

export default function StorageLocationSelector({
  value = { vault_id: "", box_id: "", slot_id: "" },
  onChange,
  disabled = false,
  showAvailability = true,
}) {
  const [vaults, setVaults] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState({
    vaults: false,
    boxes: false,
    slots: false,
  });

  // Load vaults on mount
  useEffect(() => {
    fetchVaults();
  }, []);

  // Load boxes when vault changes
  useEffect(() => {
    if (value.vault_id) {
      fetchBoxes(value.vault_id);
    } else {
      setBoxes([]);
      setSlots([]);
    }
  }, [value.vault_id]);

  // Load slots when box changes
  useEffect(() => {
    if (value.box_id) {
      fetchSlots(value.box_id);
    } else {
      setSlots([]);
    }
  }, [value.box_id]);

  const fetchVaults = async () => {
    setLoading((prev) => ({ ...prev, vaults: true }));
    try {
      const response = await storageService.getVaults();
      if (response.success && response.data) {
        setVaults(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error("Failed to load vaults:", error);
      setVaults([]);
    } finally {
      setLoading((prev) => ({ ...prev, vaults: false }));
    }
  };

  const fetchBoxes = async (vaultId) => {
    setLoading((prev) => ({ ...prev, boxes: true }));
    try {
      const response = await storageService.getBoxes(vaultId);
      if (response.success && response.data) {
        setBoxes(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error("Failed to load boxes:", error);
      setBoxes([]);
    } finally {
      setLoading((prev) => ({ ...prev, boxes: false }));
    }
  };

  const fetchSlots = async (boxId) => {
    setLoading((prev) => ({ ...prev, slots: true }));
    try {
      const response = await storageService.getSlots(boxId);
      if (response.success && response.data) {
        setSlots(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error("Failed to load slots:", error);
      setSlots([]);
    } finally {
      setLoading((prev) => ({ ...prev, slots: false }));
    }
  };

  const handleVaultChange = (e) => {
    const vaultId = e.target.value;
    onChange({
      vault_id: vaultId,
      box_id: "",
      slot_id: "",
    });
  };

  const handleBoxChange = (e) => {
    const boxId = e.target.value;
    onChange({
      ...value,
      box_id: boxId,
      slot_id: "",
    });
  };

  const handleSlotChange = (e) => {
    const slotId = e.target.value;
    onChange({
      ...value,
      slot_id: slotId,
    });
  };

  // Format vault options
  const vaultOptions = [
    { value: "", label: "Select Vault" },
    ...vaults.map((vault) => ({
      value: vault.id.toString(),
      label: `${vault.name || vault.code}${
        showAvailability && vault.available_slots !== undefined
          ? ` (${vault.available_slots} available)`
          : ""
      }`,
    })),
  ];

  // Format box options
  const boxOptions = [
    { value: "", label: "Select Box" },
    ...boxes.map((box) => ({
      value: box.id.toString(),
      label: `Box ${box.box_number || box.name}${
        showAvailability && box.available_slots !== undefined
          ? ` (${box.available_slots} available)`
          : ""
      }`,
    })),
  ];

  // Format slot options
  const slotOptions = [
    { value: "", label: "Select Slot" },
    ...slots.map((slot) => ({
      value: slot.id.toString(),
      label: `Slot ${slot.slot_number}${
        slot.is_occupied ? " (Occupied)" : " (Available)"
      }`,
      disabled: slot.is_occupied,
    })),
  ];

  return (
    <div className="space-y-4">
      {/* Vault Selection */}
      <div className="relative">
        <Select
          label={
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-500" />
              <span>Vault / Safe Room</span>
            </div>
          }
          value={value.vault_id}
          onChange={handleVaultChange}
          options={vaultOptions}
          disabled={disabled || loading.vaults}
        />
        {loading.vaults && (
          <div className="absolute right-3 top-9">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          </div>
        )}
      </div>

      {/* Box Selection */}
      <div className="relative">
        <Select
          label={
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-500" />
              <span>Box / Container</span>
            </div>
          }
          value={value.box_id}
          onChange={handleBoxChange}
          options={boxOptions}
          disabled={disabled || !value.vault_id || loading.boxes}
        />
        {loading.boxes && (
          <div className="absolute right-3 top-9">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          </div>
        )}
      </div>

      {/* Slot Selection */}
      <div className="relative">
        <Select
          label={
            <div className="flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-amber-500" />
              <span>Slot Number</span>
            </div>
          }
          value={value.slot_id}
          onChange={handleSlotChange}
          options={slotOptions}
          disabled={disabled || !value.box_id || loading.slots}
        />
        {loading.slots && (
          <div className="absolute right-3 top-9">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          </div>
        )}
      </div>

      {/* Selected Location Preview */}
      {value.vault_id && value.box_id && value.slot_id && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-medium text-amber-700 mb-1">
            Selected Location:
          </p>
          <p className="text-sm font-semibold text-amber-900">
            {vaults.find((v) => v.id.toString() === value.vault_id)?.name ||
              "Vault"}{" "}
            →{" "}
            {boxes.find((b) => b.id.toString() === value.box_id)?.box_number
              ? `Box ${
                  boxes.find((b) => b.id.toString() === value.box_id)
                    ?.box_number
                }`
              : "Box"}{" "}
            →{" "}
            {slots.find((s) => s.id.toString() === value.slot_id)?.slot_number
              ? `Slot ${
                  slots.find((s) => s.id.toString() === value.slot_id)
                    ?.slot_number
                }`
              : "Slot"}
          </p>
        </div>
      )}
    </div>
  );
}
