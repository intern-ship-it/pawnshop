/**
 * Rack / Locker Map - Fully API Integrated
 * No localStorage - All data from backend
 * ISSUE 3 FIX: Added item image display in slot modal
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import storageService from "@/services/storageService";
import inventoryService from "@/services/inventoryService";
import reportService from "@/services/reportService";
import { formatCurrency } from "@/utils/formatters";
import { getStorageUrl } from "@/utils/helpers"; // ISSUE 3 FIX: Import for image URLs
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Badge, Modal, Select } from "@/components/common";
import {
  Grid3X3,
  Package,
  Box,
  Search,
  Plus,
  RefreshCw,
  Scale,
  DollarSign,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Printer,
  Image as ImageIcon, // ISSUE 3 FIX: For image placeholder
  ZoomIn, // ISSUE 3 FIX: For view image button
  Trash2,
  Minus,
  Download,
} from "lucide-react";

// Resolve a slot's [group, subslot] — prefer stored columns, fall back to formula.
// Module scope: depends only on its arguments, so it is stable across renders.
const slotPos = (slot, box) => {
  const per = box?.subslots_per_slot || 1;
  const group =
    slot.slot_group != null ? slot.slot_group : Math.ceil(slot.slot_number / per);
  const sub =
    slot.subslot_number != null
      ? slot.subslot_number
      : ((slot.slot_number - 1) % per) + 1;
  return [group, sub];
};

// Label a locate() match exactly as the grid labels that slot, so the result list
// and the shelf agree. A subslotted drawer is "Slot 02 · 2" — its raw slot_number
// (6) is an internal sequence nobody writes on a drawer.
const matchSlotLabel = (match) => {
  if (!match.box_has_subslots) {
    return `Slot ${match.slot_number}`;
  }

  const [group, sub] = slotPos(
    {
      slot_number: match.slot_number,
      slot_group: match.slot_group,
      subslot_number: match.subslot_number,
    },
    { subslots_per_slot: match.subslots_per_slot },
  );

  return `Slot ${String(group).padStart(2, "0")} · ${sub}`;
};

// Every string a slot can be found by: its own position, plus the paperwork of
// whatever is stored in it. Renewal and redemption numbers are included because a
// customer walks in holding whichever ticket was printed last — searching the number
// off a renewal receipt used to return nothing at all. Kept as separate terms rather
// than one joined string so a query cannot straddle two fields.
const slotSearchTerms = (slot, box) => {
  const terms = [String(slot.slot_number)];

  if (box?.has_subslots) {
    const [group, sub] = slotPos(slot, box);
    terms.push(`${group}-${sub}`);
  }

  const items = slot.current_items?.length
    ? slot.current_items
    : [slot.current_item || slot.pledge_item].filter(Boolean);

  items.forEach((item) => {
    const pledge = item?.pledge;
    terms.push(
      item?.barcode,
      pledge?.pledge_no,
      pledge?.receipt_no,
      pledge?.customer?.name,
      pledge?.customer?.ic_number,
      ...(pledge?.renewals || []).map((r) => r.renewal_no),
      ...(pledge?.redemption || []).map((r) => r.redemption_no),
    );
  });

  return terms.filter(Boolean).map((term) => String(term).toLowerCase());
};

export default function RackMap({ embedded = false }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // State
  const [vaults, setVaults] = useState([]);
  const [selectedVault, setSelectedVault] = useState(null);
  const [boxes, setBoxes] = useState([]);
  const [selectedBox, setSelectedBox] = useState(null);
  const [slots, setSlots] = useState([]);
  const [boxSummaries, setBoxSummaries] = useState({});
  const [inventorySummary, setInventorySummary] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  // Where the search term was found across every OTHER drawer. The grid can only
  // filter the drawer it has loaded, so without this a match one drawer away just
  // reads as "no slots" — see the /storage/locate endpoint.
  const [locateResults, setLocateResults] = useState([]);
  const [locateTruncated, setLocateTruncated] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  // A slot in a drawer we are still loading; opened as soon as its slots arrive.
  const [pendingSlotId, setPendingSlotId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBoxes, setIsLoadingBoxes] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Modal State
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotItems, setSlotItems] = useState([]);
  const [showAddVaultModal, setShowAddVaultModal] = useState(false);
  const [showAddBoxModal, setShowAddBoxModal] = useState(false);
  const [newVaultName, setNewVaultName] = useState("");
  const [newVaultCode, setNewVaultCode] = useState("");
  const [newVaultDescription, setNewVaultDescription] = useState("");
  const [newBoxName, setNewBoxName] = useState("");
  const [newBoxCode, setNewBoxCode] = useState("");
  const [newBoxSlots, setNewBoxSlots] = useState(9);
  const [newBoxHasSubslots, setNewBoxHasSubslots] = useState(false);
  const [newBoxSubslots, setNewBoxSubslots] = useState(5);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSlotItems, setIsLoadingSlotItems] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Load initial data
  useEffect(() => {
    fetchVaults();
    fetchInventorySummary();
  }, []);

  // Load boxes when vault changes
  useEffect(() => {
    if (selectedVault) {
      fetchBoxes(selectedVault);
    }
  }, [selectedVault]);

  // Load slots and summary when box changes
  useEffect(() => {
    if (selectedBox) {
      fetchSlots(selectedBox);
      fetchBoxSummary(selectedBox);
    }
  }, [selectedBox]);

  // Ask the server where the term is stored, across every drawer. Debounced so a
  // typed ticket number is one query, not one per keystroke. Short terms are left
  // to the local slot-number filter.
  useEffect(() => {
    const query = searchQuery.trim();

    if (query.length < 2 || /^\d{1,2}$/.test(query)) {
      setLocateResults([]);
      setLocateTruncated(false);
      return;
    }

    let cancelled = false;
    setIsLocating(true);

    const timer = setTimeout(async () => {
      try {
        const response = await storageService.locate(query);
        if (cancelled) return;
        setLocateResults(response.data?.matches || []);
        setLocateTruncated(Boolean(response.data?.truncated));
      } catch {
        // A failed lookup must not blank the grid; the local filter still works.
        if (!cancelled) {
          setLocateResults([]);
          setLocateTruncated(false);
        }
      } finally {
        if (!cancelled) setIsLocating(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Open the drawer a match lives in and its slot detail. When the match is already
  // in the open drawer the slot is in hand, so open it now; otherwise switch drawers
  // and let the pending-slot effect below open it once those slots arrive.
  const goToMatch = (match) => {
    const alreadyHere = match.box_id === selectedBox;
    const loaded = alreadyHere && slots.find((slot) => slot.id === match.slot_id);

    if (loaded) {
      handleSlotClick(loaded);
      return;
    }

    setPendingSlotId(match.slot_id);
    if (match.vault_id && match.vault_id !== selectedVault) {
      setSelectedVault(match.vault_id);
    }
    if (match.box_id && match.box_id !== selectedBox) {
      setSelectedBox(match.box_id);
    }
  };

  // Slots for the drawer we jumped to have arrived — open the one that was asked for.
  useEffect(() => {
    if (!pendingSlotId) return;

    const slot = slots.find((s) => s.id === pendingSlotId);
    if (slot) {
      setPendingSlotId(null);
      handleSlotClick(slot);
    }
  }, [slots, pendingSlotId]);

  // Fetch all vaults (racks)
  const fetchVaults = async () => {
    setIsLoading(true);
    try {
      const response = await storageService.getVaults();
      if (response.success && response.data) {
        setVaults(response.data);
        if (response.data.length > 0 && !selectedVault) {
          setSelectedVault(response.data[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching vaults:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to load vaults",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch boxes for a vault
  const fetchBoxes = async (vaultId) => {
    setIsLoadingBoxes(true);
    setBoxes([]);
    setSelectedBox(null);
    setSlots([]);
    try {
      const response = await storageService.getBoxes(vaultId);
      if (response.success && response.data) {
        setBoxes(response.data);
        // Fetch summaries for all boxes
        response.data.forEach((box) => fetchBoxSummary(box.id));
        if (response.data.length > 0) {
          setSelectedBox(response.data[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching boxes:", error);
    } finally {
      setIsLoadingBoxes(false);
    }
  };

  // Fetch slots for a box
  const fetchSlots = async (boxId) => {
    setIsLoadingSlots(true);
    try {
      // Only this fetch feeds the on-screen search box, so it is the only one that
      // asks for the extra ticket numbers.
      const response = await storageService.getSlots(boxId, { with_search_terms: 1 });
      if (response.success && response.data) {
        setSlots(response.data);
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // CHANGE TO:
  const fetchBoxSummary = async (boxId) => {
    try {
      const response = await storageService.getBoxSummary(boxId);
      if (response.success && response.data) {
        // Extract summary and map field names
        const summaryData = response.data.summary || {};
        setBoxSummaries((prev) => ({
          ...prev,
          [boxId]: {
            item_count: summaryData.total_items || 0,
            total_weight: parseFloat(summaryData.total_weight) || 0,
            total_value: parseFloat(summaryData.total_value) || 0,
            occupied_slots: summaryData.occupied_slots || 0,
            available_slots: summaryData.available_slots || 0,
            overdue_count: summaryData.overdue_count || 0,
          },
        }));
      }
    } catch (error) {
      console.error("Error fetching box summary:", error);
    }
  };

  // Fetch overall inventory summary
  const fetchInventorySummary = async () => {
    try {
      const response = await inventoryService.getSummary();
      if (response.success && response.data) {
        setInventorySummary(response.data);
      }
    } catch (error) {
      console.error("Error fetching inventory summary:", error);
    }
  };

  // Get current vault/box data
  const currentVault = vaults.find((v) => v.id === selectedVault);
  const currentBox = boxes.find((b) => b.id === selectedBox);
  const currentBoxSummary = boxSummaries[selectedBox] || {};

  // Filter slots by search
  const filteredSlots = useMemo(() => {
    if (!searchQuery) return slots;
    const query = searchQuery.trim().toLowerCase();
    // If query is a short number (1-2 digits), match slot number exactly
    const isSlotNumberSearch = /^\d{1,2}$/.test(query);

    return slots.filter((slot) => {
      if (isSlotNumberSearch) {
        const slotNum = String(slot.slot_number).padStart(2, "0");
        const paddedQuery = query.padStart(2, "0");
        return slotNum === paddedQuery;
      }
      // For longer queries, search across all fields
      return slotSearchTerms(slot, currentBox).some((term) => term.includes(query));
    });
  }, [slots, searchQuery, currentBox]);

  // Overall stats
  const overallStats = useMemo(
    () => ({
      totalVaults: vaults.length,
      totalItems: inventorySummary.total_items || 0,
      totalWeight: inventorySummary.total_weight || 0,
      totalValue: inventorySummary.total_value || 0,
      overdueItems: inventorySummary.overdue_count || 0,
    }),
    [vaults, inventorySummary],
  );
  // CHANGE TO:
  const handleSlotClick = async (slot) => {
    setSelectedSlot(slot);
    setSlotItems([]);
    setShowSlotModal(true);
    setIsLoadingSlotItems(true);

    // Use current_items (plural) from the slot data - this is the HasMany relationship
    // that returns ALL pledge items stored in this slot (supports multi-item pledges sharing one slot)
    if (slot.is_occupied && slot.current_items && slot.current_items.length > 0) {
      setSlotItems(slot.current_items);
    } else if (slot.is_occupied && slot.current_item_id) {
      // Fallback: fetch single item if current_items not available
      try {
        const response = await inventoryService.getById(slot.current_item_id);
        if (response.success && response.data) {
          setSlotItems([response.data]);
        }
      } catch (error) {
        console.error("Error fetching slot item:", error);
      }
    } else if (slot.is_occupied && slot.current_item) {
      setSlotItems([slot.current_item]);
    }
    setIsLoadingSlotItems(false);
  };
  // Navigate to pledge
  const handleViewPledge = (pledgeId) => {
    setShowSlotModal(false);
    navigate(`/pledges/${pledgeId}`);
  };

  // Add new vault
  const handleAddVault = async () => {
    if (!newVaultName.trim()) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please enter a vault name",
        }),
      );
      return;
    }
    if (!newVaultCode.trim()) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please enter a vault code",
        }),
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await storageService.createVault({
        name: newVaultName,
        code: newVaultCode.toUpperCase().replace(/\s+/g, "-"),
        description: newVaultDescription,
      });

      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Vault Created",
            message: `${newVaultName} has been created`,
          }),
        );
        setShowAddVaultModal(false);
        setNewVaultName("");
        setNewVaultCode("");
        setNewVaultDescription("");
        fetchVaults();
      } else {
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: response.message || "Failed to create vault",
          }),
        );
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to create vault",
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Add new box
  const handleAddBox = async () => {
    if (!newBoxName.trim() || !selectedVault) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please enter a box name",
        }),
      );
      return;
    }
    if (!newBoxCode.trim()) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please enter a box number",
        }),
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await storageService.createBox({
        vault_id: selectedVault,
        name: newBoxName,
        box_number: newBoxCode,
        total_slots: parseInt(newBoxSlots) || 9,
        has_subslots: newBoxHasSubslots,
        subslots_per_slot: newBoxHasSubslots ? (parseInt(newBoxSubslots) || 5) : 1,
      });

      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Box Created",
            message: `${newBoxName} has been created`,
          }),
        );
        setShowAddBoxModal(false);
        setNewBoxName("");
        setNewBoxCode("");
        setNewBoxSlots(9);
        setNewBoxHasSubslots(false);
        setNewBoxSubslots(5);
        fetchBoxes(selectedVault);
      } else {
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: response.message || "Failed to create box",
          }),
        );
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to create box",
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Add a new slot (group) to the selected drawer
  const handleAddSlot = async () => {
    if (!selectedBox) return;
    setIsSaving(true);
    try {
      const response = await storageService.addSlot(selectedBox);
      if (response.success) {
        dispatch(addToast({ type: "success", title: "Slot Added", message: "A new slot was added to this drawer" }));
        fetchSlots(selectedBox);
        fetchBoxSummary(selectedBox);
        fetchBoxes(selectedVault);
      } else {
        dispatch(addToast({ type: "error", title: "Error", message: response.message || "Failed to add slot" }));
      }
    } catch (error) {
      dispatch(addToast({ type: "error", title: "Error", message: error.message || "Failed to add slot" }));
    } finally {
      setIsSaving(false);
    }
  };

  // Add one subslot to a specific slot group
  const handleAddSubslot = async (slotGroup) => {
    if (!selectedBox) return;
    try {
      const response = await storageService.addSubslot(selectedBox, slotGroup);
      if (response.success) {
        dispatch(addToast({ type: "success", title: "Subslot Added", message: `Added a subslot to Slot ${String(slotGroup).padStart(2, "0")}` }));
        fetchSlots(selectedBox);
        fetchBoxSummary(selectedBox);
      } else {
        dispatch(addToast({ type: "error", title: "Error", message: response.message || "Failed to add subslot" }));
      }
    } catch (error) {
      dispatch(addToast({ type: "error", title: "Error", message: error.message || "Failed to add subslot" }));
    }
  };

  // Remove one empty subslot (server refuses if it holds an item)
  const handleRemoveSubslot = async (slot) => {
    if (!selectedBox || slot.is_occupied) return;
    if (!window.confirm("Remove this empty subslot? This cannot be undone.")) return;
    try {
      const response = await storageService.removeSubslot(slot.id);
      if (response.success) {
        dispatch(addToast({ type: "success", title: "Subslot Removed", message: "The empty subslot was removed" }));
        fetchSlots(selectedBox);
        fetchBoxSummary(selectedBox);
      } else {
        dispatch(addToast({ type: "error", title: "Error", message: response.message || "Failed to remove subslot" }));
      }
    } catch (error) {
      dispatch(addToast({ type: "error", title: "Error", message: error.message || "Failed to remove subslot" }));
    }
  };

  // Remove a whole slot/group (server refuses if any subslot holds an item)
  const handleRemoveSlot = async (slotGroup) => {
    if (!selectedBox) return;
    if (!window.confirm(`Remove Slot ${String(slotGroup).padStart(2, "0")} and all its empty subslots? This cannot be undone.`)) return;
    try {
      const response = await storageService.removeSlot(selectedBox, slotGroup);
      if (response.success) {
        dispatch(addToast({ type: "success", title: "Slot Removed", message: `Slot ${String(slotGroup).padStart(2, "0")} was removed` }));
        fetchSlots(selectedBox);
        fetchBoxSummary(selectedBox);
        fetchBoxes(selectedVault);
      } else {
        dispatch(addToast({ type: "error", title: "Error", message: response.message || "Failed to remove slot" }));
      }
    } catch (error) {
      dispatch(addToast({ type: "error", title: "Error", message: error.message || "Failed to remove slot" }));
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-MY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  /**
   * ISSUE 3 FIX: Get item photo URL
   * Checks multiple possible photo field names
   */
  const getItemPhotoUrl = (item) => {
    // Check various possible field names for the photo
    const photoPath =
      item.photo || item.photo_url || item.image || item.image_url;
    if (!photoPath) return null;

    // If it's already a full URL or base64 data URL, return as is
    if (
      photoPath.startsWith("http://") ||
      photoPath.startsWith("https://") ||
      photoPath.startsWith("data:")
    ) {
      return photoPath;
    }

    // Use the helper to build storage URL
    return getStorageUrl(photoPath);
  };

  /**
   * Open image in new tab - handles large base64 images properly
   * Browsers have URL length limits, so we create an HTML document for base64 images
   */
  const openImageInNewTab = (imageUrl) => {
    if (!imageUrl) return;

    // For base64 data URLs, create an HTML document to display the image
    // This is necessary because browsers have URL length limits for window.open()
    if (imageUrl.startsWith("data:")) {
      const newWindow = window.open("", "_blank");
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Item Photo</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                background: #1a1a1a;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
              }
              img {
                max-width: 100%;
                max-height: 100vh;
                object-fit: contain;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
              }
            </style>
          </head>
          <body>
            <img src="${imageUrl}" alt="Item Photo" />
          </body>
          </html>
        `);
        newWindow.document.close();
      }
    } else {
      // For regular URLs, just open them directly
      window.open(imageUrl, "_blank");
    }
  };

  // Export an Excel listing every empty location across all lockers & drawers
  // Columns: Locker | Drawer | Location. Generated server-side via the shared report export.
  const handleExportEmptySlots = async () => {
    setIsExporting(true);
    try {
      const response = await reportService.exportReport("empty_slots", "xlsx");
      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Export Started",
            message: "Empty slots report downloaded",
          }),
        );
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Export Failed",
          message: error.message || "Failed to export empty slots",
        }),
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Print a reconciliation sheet: every slot in every locker & drawer, each with an
  // empty tick box, so staff can physically walk the lockers and mark what they find.
  const handlePrintReconciliation = async () => {
    setIsPrinting(true);
    try {
      // The page only holds the selected drawer's slots, so fetch all slots for every
      // box across every vault before building the sheet.
      const sections = [];
      for (const vault of vaults) {
        const boxesRes = await storageService.getBoxes(vault.id);
        const vaultBoxes = boxesRes.success && boxesRes.data ? boxesRes.data : [];
        for (const box of vaultBoxes) {
          const slotsRes = await storageService.getSlots(box.id);
          const boxSlots = slotsRes.success && slotsRes.data ? slotsRes.data : [];
          sections.push({ vault, box, slots: boxSlots });
        }
      }

      if (sections.length === 0) {
        dispatch(
          addToast({
            type: "error",
            title: "Nothing to print",
            message: "No lockers or drawers found",
          }),
        );
        return;
      }

      const escapeHtml = (str) =>
        String(str ?? "").replace(/[&<>"']/g, (c) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]);

      const sectionsHtml = sections
        .map(({ vault, box, slots: boxSlots }) => {
          const occupied = boxSlots.filter((s) => s.is_occupied).length;
          const empty = boxSlots.length - occupied;

          const slotsHtml = boxSlots
            .map((slot) => {
              const isOccupied = slot.is_occupied;
              const item =
                (slot.current_items && slot.current_items[0]) ||
                slot.current_item ||
                slot.pledge_item;
              const label = box.has_subslots
                ? `${slotPos(slot, box)[0]}-${slotPos(slot, box)[1]}`
                : String(slot.slot_number).padStart(2, "0");
              const pledgeNo = isOccupied ? item?.pledge?.pledge_no || "" : "";
              return `
                <div class="slot ${isOccupied ? "occupied" : "empty"}">
                  <span class="tick"></span>
                  <span class="slot-number">${escapeHtml(label)}</span>
                  <span class="slot-status">${isOccupied ? "Occupied" : "Empty"}</span>
                  <span class="slot-pledge">${escapeHtml(pledgeNo)}</span>
                </div>
              `;
            })
            .join("");

          return `
            <div class="box-section">
              <div class="box-header">
                <span class="box-name">${escapeHtml(vault.name)} → ${escapeHtml(box.name)}</span>
                <span class="box-stats">${boxSlots.length} slots • ${occupied} occupied • ${empty} empty</span>
              </div>
              <div class="slots-grid">${slotsHtml}</div>
            </div>
          `;
        })
        .join("");

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Slot Reconciliation Sheet</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
            .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .header h1 { font-size: 22px; margin-bottom: 4px; }
            .header p { color: #666; font-size: 12px; }
            .signoff { display: flex; gap: 40px; margin: 10px 0 12px; font-size: 12px; }
            .signoff div { flex: 1; border-bottom: 1px solid #999; padding-bottom: 2px; }
            .box-section { margin-bottom: 16px; border: 1px solid #ccc; padding: 10px; }
            .box-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid #eee; }
            .box-name { font-weight: bold; font-size: 14px; }
            .box-stats { font-size: 11px; color: #666; }
            .slots-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
            .slot { min-width: 0; overflow: hidden; border: 1px solid #ccc; border-radius: 4px; padding: 5px 3px; text-align: center; font-size: 10px; position: relative; min-height: 58px; page-break-inside: avoid; }
            .slot.occupied { background: #fff7ed; border-color: #f59e0b; }
            .slot.empty { background: #f9fafb; }
            .tick { display: block; width: 16px; height: 16px; border: 1.5px solid #333; border-radius: 3px; margin: 0 auto 3px; background: #fff; }
            .slot-number { display: block; font-weight: bold; font-size: 12px; }
            .slot-status { display: block; font-size: 8px; color: #555; text-transform: uppercase; letter-spacing: 0.3px; }
            .slot-pledge { display: block; font-size: 8px; color: #888; margin-top: 1px; overflow-wrap: anywhere; }
            .legend { display: flex; gap: 18px; margin: 6px 0 12px; font-size: 11px; }
            .legend-item { display: flex; align-items: center; gap: 5px; }
            .legend-box { width: 14px; height: 14px; border: 1px solid #ccc; }
            .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
            @page { size: A4 portrait; margin: 12mm; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Slot Reconciliation Sheet</h1>
            <p>Printed on: ${escapeHtml(new Date().toLocaleString("en-MY"))} — tick each slot as you physically verify it</p>
          </div>

          <div class="signoff">
            <div>Checked by: ____________________</div>
            <div>Date: ____________________</div>
            <div>Signature: ____________________</div>
          </div>

          <div class="legend">
            <div class="legend-item"><div class="legend-box" style="background: #fff7ed; border-color: #f59e0b;"></div> System: Occupied</div>
            <div class="legend-item"><div class="legend-box" style="background: #f9fafb;"></div> System: Empty</div>
            <div class="legend-item"><div class="legend-box"></div> Tick when verified</div>
          </div>

          ${sectionsHtml}

          <div class="footer">
            <p>PawnSys - Pawn Shop Management System</p>
          </div>
        </body>
        </html>
      `;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      } else {
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: "Please allow popups to print",
          }),
        );
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Print Failed",
          message: error.message || "Failed to build reconciliation sheet",
        }),
      );
    } finally {
      setIsPrinting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading locker map...</p>
        </div>
      </div>
    );
  }

  const content = (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Grid3X3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Lockers</p>
              <p className="text-xl font-bold text-zinc-800">
                {overallStats.totalVaults}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Items</p>
              <p className="text-xl font-bold text-amber-600">
                {overallStats.totalItems}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Scale className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Weight</p>
              <p className="text-xl font-bold text-emerald-600">
                {overallStats.totalWeight}g
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Value</p>
              <p className="text-xl font-bold text-purple-600">
                {formatCurrency(overallStats.totalValue)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Overdue Items</p>
              <p className="text-xl font-bold text-red-600">
                {overallStats.overdueItems}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Vaults */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-800">Lockers</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddVaultModal(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {vaults.length === 0 ? (
              <div className="text-center py-8">
                <Grid3X3 className="w-12 h-12 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No lockers configured</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowAddVaultModal(true)}
                >
                  Add Locker
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {vaults.map((vault) => (
                  <button
                    key={vault.id}
                    onClick={() => setSelectedVault(vault.id)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-all",
                      selectedVault === vault.id
                        ? "bg-amber-100 border-2 border-amber-300"
                        : "bg-zinc-50 hover:bg-zinc-100 border-2 border-transparent",
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-zinc-800">
                        {vault.name}
                      </span>
                      <Badge variant="default" size="sm">
                        {vault.total_boxes || 0} drawers
                      </Badge>
                    </div>
                    {vault.description && (
                      <p className="text-xs text-zinc-500 truncate">
                        {vault.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Boxes */}
          {selectedVault && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-zinc-800">Drawers</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddBoxModal(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {isLoadingBoxes ? (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 text-amber-500 animate-spin mx-auto" />
                </div>
              ) : boxes.length === 0 ? (
                <div className="text-center py-4">
                  <Box className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">No drawers</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {boxes.map((box) => {
                    const summary = boxSummaries[box.id] || {};
                    return (
                      <button
                        key={box.id}
                        onClick={() => setSelectedBox(box.id)}
                        className={cn(
                          "w-full p-3 rounded-lg text-left transition-all",
                          selectedBox === box.id
                            ? "bg-amber-100 border-2 border-amber-300"
                            : "bg-zinc-50 hover:bg-zinc-100 border-2 border-transparent",
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-zinc-800">
                            {currentVault?.name} → {box.name}
                          </span>
                          <Badge
                            variant={
                              summary.overdue_count > 0 ? "error" : "default"
                            }
                            size="sm"
                          >
                            {summary.item_count || 0}
                          </Badge>
                        </div>

                        {/* Box Totals */}
                        <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                          <div className="flex items-center gap-1 text-zinc-500">
                            <Scale className="w-3 h-3" />
                            <span>
                              {(summary.total_weight || 0).toFixed(1)}g
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-zinc-500">
                            <DollarSign className="w-3 h-3" />
                            <span>
                              {formatCurrency(summary.total_value || 0)}
                            </span>
                          </div>
                        </div>

                        {/* Occupancy Bar */}
                        <div className="mt-2 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              summary.overdue_count > 0
                                ? "bg-red-500"
                                : "bg-amber-500",
                            )}
                            style={{
                              width: `${Math.min(
                                ((box.occupied_slots || 0) /
                                  (box.total_slots || 1)) *
                                  100,
                                100,
                              )}%`,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* Legend */}
          <Card className="p-4">
            <p className="text-xs font-medium text-zinc-500 mb-3">LEGEND</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200" />
                <span className="text-zinc-600">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-amber-100 border border-amber-200" />
                <span className="text-zinc-600">Occupied</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-100 border border-red-200" />
                <span className="text-zinc-600">Overdue</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Slot Grid */}
        <div className="lg:col-span-3">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-zinc-800">
                  {currentVault?.name || "Select a Locker"}{" "}
                  {currentBox ? `→ ${currentBox.name}` : ""}
                </h3>
                {currentBox && (
                  <p className="text-sm text-zinc-500">
                    {currentBoxSummary.item_count || 0} items •{" "}
                    {(currentBoxSummary.total_weight || 0).toFixed(1)}g •{" "}
                    {formatCurrency(currentBoxSummary.total_value || 0)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search slot, pledge, renewal no, or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={Search}
                  className="w-48"
                />
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={RefreshCw}
                  onClick={() => selectedBox && fetchSlots(selectedBox)}
                >
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={Plus}
                  onClick={handleAddSlot}
                  disabled={!currentBox || isSaving}
                >
                  Add Slot
                </Button>
              </div>
            </div>

            {/* Matches found anywhere in the branch. The grid below only ever holds
                one drawer, so without this a hit in another drawer is invisible. */}
            {searchQuery.trim().length >= 2 && !isLocating && locateResults.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Found in {locateResults.length} location
                  {locateResults.length === 1 ? "" : "s"}
                  {locateTruncated && " (showing first 200)"}
                </p>
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                  {locateResults.map((match) => {
                    const isCurrent = match.box_id === selectedBox;
                    return (
                      <button
                        key={`${match.slot_id}-${match.pledge_no}`}
                        type="button"
                        onClick={() => goToMatch(match)}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-white px-3 py-2 text-left text-sm shadow-sm ring-1 ring-amber-100 hover:ring-amber-300"
                      >
                        <span className="font-semibold text-zinc-800">
                          {match.vault_name} → {match.box_name}
                        </span>
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                          {matchSlotLabel(match)}
                        </span>
                        <span className="font-mono text-xs text-zinc-600">
                          {match.pledge_no}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {match.customer_name}
                          {match.item_count > 1 && ` · ${match.item_count} items`}
                        </span>
                        {isCurrent && (
                          <span className="text-xs text-emerald-600">· in this drawer</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {searchQuery.trim().length >= 2 &&
              !isLocating &&
              locateResults.length === 0 &&
              filteredSlots.length === 0 && (
                <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500">
                  Nothing matching “{searchQuery.trim()}” is stored in any drawer.
                </div>
              )}

            {isLoadingSlots ? (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-4" />
                <p className="text-zinc-500">Loading slots...</p>
              </div>
            ) : currentBox && filteredSlots.length > 0 ? (
              currentBox.has_subslots ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {Object.entries(
                    filteredSlots.reduce((acc, slot) => {
                      const [slotNum] = slotPos(slot, currentBox);
                      if (!acc[slotNum]) acc[slotNum] = [];
                      acc[slotNum].push(slot);
                      return acc;
                    }, {})
                  ).map(([mainSlotNum, subslots]) => (
                    <div key={mainSlotNum} className="border-2 border-zinc-200 rounded-xl p-3 bg-white shadow-sm hover:border-zinc-300 transition-colors">
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-100">
                        <div className="flex items-center gap-2">
                          <Grid3X3 className="w-4 h-4 text-zinc-400" />
                          <h4 className="text-sm font-bold text-zinc-700">Slot {String(mainSlotNum).padStart(2, "0")}</h4>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-zinc-500 px-2 py-0.5 bg-zinc-100 rounded-full">
                            {subslots.filter(s => s.is_occupied).length}/{subslots.length} used
                          </span>
                          <button
                            type="button"
                            title="Add subslot"
                            onClick={() => handleAddSubslot(Number(mainSlotNum))}
                            className="w-5 h-5 flex items-center justify-center rounded-full text-zinc-500 hover:bg-amber-100 hover:text-amber-600 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {subslots.every((s) => !s.is_occupied) && (
                            <button
                              type="button"
                              title="Remove this slot (empty only)"
                              onClick={() => handleRemoveSlot(Number(mainSlotNum))}
                              className="w-5 h-5 flex items-center justify-center rounded-full text-zinc-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-5 gap-1.5">
                        {subslots.map((slot) => {
                          const isOccupied = slot.is_occupied;
                          const item = (slot.current_items && slot.current_items[0]) || slot.current_item || slot.pledge_item;
                          const hasOverdue = item?.pledge?.status === "overdue" || (slot.current_items || []).some(i => i.pledge?.status === "overdue");
                          const subslotNum = slotPos(slot, currentBox)[1];

                          return (
                            <div key={slot.id} className="relative group">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleSlotClick(slot)}
                                title={item ? `${item.pledge?.pledge_no || ''} (${(slot.current_items || []).length} items)` : `Subslot ${subslotNum} (Empty)`}
                                className={cn(
                                  "w-full aspect-square rounded flex items-center justify-center text-[11px] font-bold transition-all relative",
                                  isOccupied
                                    ? hasOverdue
                                      ? "bg-red-100 text-red-600 hover:bg-red-200"
                                      : "bg-amber-100 text-amber-600 hover:bg-amber-200"
                                    : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200",
                                )}
                              >
                                {subslotNum}
                                {hasOverdue && (
                                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white shadow-sm" />
                                )}
                              </motion.button>
                              {!isOccupied && (
                                <button
                                  type="button"
                                  title="Remove this empty subslot"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveSubslot(slot);
                                  }}
                                  className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-white border border-zinc-300 text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-sm"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {filteredSlots.map((slot) => {
                  const isOccupied = slot.is_occupied;
                  const item = (slot.current_items && slot.current_items[0]) || slot.current_item || slot.pledge_item;
                  const hasOverdue = item?.pledge?.status === "overdue" || (slot.current_items || []).some(i => i.pledge?.status === "overdue");

                  return (
                    <div key={slot.id} className="relative group">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSlotClick(slot)}
                        className={cn(
                          "w-full aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-1 transition-all relative",
                          isOccupied
                            ? hasOverdue
                              ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300"
                              : "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100 hover:border-amber-300"
                            : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-300",
                        )}
                      >
                        <span className="text-xs font-mono font-medium">
                          {currentBox?.has_subslots
                            ? `${slotPos(slot, currentBox)[0]}-${slotPos(slot, currentBox)[1]}`
                            : String(slot.slot_number).padStart(2, "0")}
                        </span>
                        {isOccupied &&
                          (slot.current_items?.length > 0 || slot.current_item || slot.pledge_item) && (
                            <span className="text-[10px] mt-0.5 truncate max-w-full px-1">
                              {((slot.current_items && slot.current_items[0]) || slot.current_item || slot.pledge_item)?.pledge
                                ?.pledge_no || "Item"}
                            </span>
                          )}

                        {hasOverdue && (
                          <AlertTriangle className="w-3 h-3 absolute top-1 right-1 text-red-500" />
                        )}
                      </motion.button>
                      {!isOccupied && (
                        <button
                          type="button"
                          title="Remove this empty slot"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSlot(slotPos(slot, currentBox)[0]);
                          }}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-white border border-zinc-300 text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-sm"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              )
            ) : currentBox ? (
              <div className="text-center py-12">
                <Grid3X3 className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                <p className="text-zinc-500">No slots in this drawer</p>
              </div>
            ) : (
              <div className="text-center py-12">
                <Grid3X3 className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                <p className="text-zinc-500">
                  Select a locker and drawer to view slots
                </p>
              </div>
            )}

            {currentBox && slots.length > 0 && (
              <div className="mt-6 pt-4 border-t border-zinc-200 flex items-center gap-4 text-sm">
                <span className="text-zinc-500">
                  <strong className="text-zinc-800">
                    {slots.filter((s) => s.is_occupied).length}
                  </strong>{" "}
                  occupied
                </span>
                <span className="text-zinc-500">
                  <strong className="text-zinc-800">
                    {slots.filter((s) => !s.is_occupied).length}
                  </strong>{" "}
                  empty
                </span>
                <span className="text-zinc-500">
                  <strong className="text-red-600">
                    {
                      slots.filter(
                        (s) => s.pledge_item?.pledge?.status === "overdue",
                      ).length
                    }
                  </strong>{" "}
                  overdue
                </span>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Slot Detail Modal - ISSUE 3 FIX: Added item image display */}
      <Modal
        isOpen={showSlotModal}
        onClose={() => setShowSlotModal(false)}
        title={`Slot ${
          selectedSlot?.slot_number
            ? currentBox?.has_subslots
              ? `${slotPos(selectedSlot, currentBox)[0]}-${slotPos(selectedSlot, currentBox)[1]}`
              : String(selectedSlot.slot_number).padStart(2, "0")
            : ""
        }`}
        size="lg"
      >
        <div className="p-5">
          {isLoadingSlotItems ? (
            <div className="text-center py-12">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-4" />
              <p className="text-zinc-500">Loading item details...</p>
            </div>
          ) : selectedSlot?.is_occupied && slotItems.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <Package className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-amber-600">
                    {slotItems.length}
                  </p>
                  <p className="text-xs text-amber-700">Items</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <Scale className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-emerald-600">
                    {slotItems
                      .reduce(
                        (sum, item) =>
                          sum +
                          (parseFloat(item.net_weight) ||
                            parseFloat(item.weight) ||
                            0),
                        0,
                      )
                      .toFixed(2)}
                    g
                  </p>
                  <p className="text-xs text-emerald-700">Weight</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <DollarSign className="w-6 h-6 text-purple-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-purple-600">
                    {formatCurrency(
                      slotItems.reduce(
                        (sum, item) =>
                          sum +
                          (parseFloat(item.net_value) ||
                            parseFloat(item.estimated_value) ||
                            0),
                        0,
                      ),
                    )}
                  </p>
                  <p className="text-xs text-purple-700">Value</p>
                </div>
              </div>

              <h4 className="font-semibold text-zinc-800 mb-3">
                Items in this Slot
              </h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {slotItems.map((item) => {
                  // ISSUE 3 FIX: Get item photo URL
                  const photoUrl = getItemPhotoUrl(item);

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "p-4 rounded-xl border",
                        item.pledge?.status === "overdue"
                          ? "bg-red-50 border-red-200"
                          : "bg-zinc-50 border-zinc-200",
                      )}
                    >
                      {/* ISSUE 3 FIX: Item Image Section */}
                      <div className="flex gap-4 mb-3">
                        {/* Item Photo */}
                        <div className="flex-shrink-0">
                          {photoUrl ? (
                            <div
                              className="w-24 h-24 rounded-lg border border-zinc-200 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative group"
                              onClick={() => openImageInNewTab(photoUrl)}
                            >
                              <img
                                src={photoUrl}
                                alt={`Item ${item.barcode || "photo"}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // If image fails to load, show placeholder
                                  e.target.style.display = "none";
                                  e.target.nextSibling.style.display = "flex";
                                }}
                              />
                              {/* Fallback placeholder (hidden by default) */}
                              <div className="w-full h-full bg-amber-100 items-center justify-center hidden">
                                <ImageIcon className="w-8 h-8 text-amber-400" />
                              </div>
                              {/* Zoom overlay on hover */}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="w-6 h-6 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-24 h-24 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                              <div className="text-center">
                                <ImageIcon className="w-8 h-8 text-zinc-300 mx-auto" />
                                <p className="text-[10px] text-zinc-400 mt-1">
                                  No Image
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Item Header Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-zinc-800">
                                  {item.pledge?.pledge_no || "N/A"}
                                </span>
                                <Badge
                                  variant={
                                    item.pledge?.status === "overdue"
                                      ? "error"
                                      : "success"
                                  }
                                >
                                  {item.pledge?.status || "active"}
                                </Badge>
                              </div>
                              <p className="text-sm text-zinc-500 mt-1">
                                {item.pledge?.customer?.name ||
                                  "Unknown Customer"}
                              </p>
                              {/* Category & Purity inline */}
                              <p className="text-sm text-amber-600 font-medium mt-1">
                                {item.category?.name_en ||
                                  item.category?.name ||
                                  "Gold"}{" "}
                                •{" "}
                                {item.purity?.name ||
                                  item.purity?.code ||
                                  "916"}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={ExternalLink}
                              onClick={() =>
                                handleViewPledge(
                                  item.pledge?.id || item.pledge_id,
                                )
                              }
                            >
                              View Pledge
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Item Details Grid */}
                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-zinc-500">Category</p>
                          <p className="font-medium">
                            {item.category?.name_en ||
                              item.category?.name ||
                              "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Purity</p>
                          <p className="font-medium">
                            {item.purity?.name || item.purity?.code || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Weight</p>
                          <p className="font-medium">
                            {item.net_weight || item.weight || 0}g
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Value</p>
                          <p className="font-medium">
                            {formatCurrency(
                              item.net_value || item.estimated_value || 0,
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Barcode */}
                      {item.barcode && (
                        <div className="mt-2 pt-2 border-t border-zinc-200">
                          <p className="text-xs text-zinc-500">Barcode</p>
                          <code className="text-sm font-mono bg-zinc-100 px-2 py-0.5 rounded">
                            {item.barcode}
                          </code>
                        </div>
                      )}

                      {/* Description if available */}
                      {item.description && (
                        <div className="mt-2">
                          <p className="text-xs text-zinc-500">Description</p>
                          <p className="text-sm text-zinc-700">
                            {item.description}
                          </p>
                        </div>
                      )}

                      {/* Due Date */}
                      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                        <Clock className="w-3 h-3" />
                        Due: {formatDate(item.pledge?.due_date)}
                      </div>

                      {/* ISSUE 3 FIX: View Image Button (if image exists) */}
                      {photoUrl && (
                        <div className="mt-3 pt-3 border-t border-zinc-200">
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={ImageIcon}
                            onClick={() => openImageInNewTab(photoUrl)}
                          >
                            View Full Image
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Box className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <p className="text-zinc-500">This slot is empty</p>
              <p className="text-sm text-zinc-400 mt-1">
                Assign items during pledge creation
              </p>
            </div>
          )}
          <Button
            variant="outline"
            fullWidth
            className="mt-6"
            onClick={() => setShowSlotModal(false)}
          >
            Close
          </Button>
        </div>
      </Modal>

      {/* Add Vault Modal */}
      <Modal
        isOpen={showAddVaultModal}
        onClose={() => setShowAddVaultModal(false)}
        title="Add New Locker"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Locker Name"
            placeholder="e.g., Locker Room, Locker A"
            value={newVaultName}
            onChange={(e) => setNewVaultName(e.target.value)}
          />
          <Input
            label="Locker Code"
            placeholder="e.g., LOCKER-01, LOCKER-A"
            value={newVaultCode}
            onChange={(e) => setNewVaultCode(e.target.value)}
            helperText="Unique identifier code (required)"
          />
          <Input
            label="Description (Optional)"
            placeholder="e.g., High value items"
            value={newVaultDescription}
            onChange={(e) => setNewVaultDescription(e.target.value)}
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowAddVaultModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              fullWidth
              leftIcon={Plus}
              onClick={handleAddVault}
              loading={isSaving}
            >
              Add Locker
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Box Modal */}
      <Modal
        isOpen={showAddBoxModal}
        onClose={() => setShowAddBoxModal(false)}
        title="Add New Drawer"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Input
            label="Drawer Name"
            placeholder="e.g. DRAWER A, DRAWER B"
            value={newBoxName}
            onChange={(e) => setNewBoxName(e.target.value)}
          />
          <Input
            label="Drawer Number"
            placeholder="e.g., A, B, C, D"
            value={newBoxCode}
            onChange={(e) => setNewBoxCode(e.target.value)}
            helperText="Single alphanumeric character drawer label"
          />
          <Select
            label="Number of Slots"
            value={newBoxSlots.toString()}
            onChange={(e) => setNewBoxSlots(e.target.value)}
            options={Array.from({ length: 100 }, (_, i) => ({
              label: `${i + 1}`,
              value: (i + 1).toString(),
            }))}
            placeholder="Select number of slots"
          />
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="hasSubslots"
              checked={newBoxHasSubslots}
              onChange={(e) => setNewBoxHasSubslots(e.target.checked)}
              className="w-4 h-4 text-amber-500 border-zinc-300 rounded focus:ring-amber-500"
            />
            <label htmlFor="hasSubslots" className="text-sm font-medium text-zinc-700">
              Slots have subslots?
            </label>
          </div>
          {newBoxHasSubslots && (
            <Select
              label="Number of Subslots per Slot"
              value={newBoxSubslots.toString()}
              onChange={(e) => setNewBoxSubslots(e.target.value)}
              options={Array.from({ length: 50 }, (_, i) => ({
                label: `${i + 1}`,
                value: (i + 1).toString(),
              }))}
              placeholder="e.g. 5"
            />
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowAddBoxModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              fullWidth
              leftIcon={Plus}
              onClick={handleAddBox}
              loading={isSaving}
            >
              Add Drawer
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );

  if (embedded) return content;

  return (
    <PageWrapper
      title="Locker Map"
      subtitle="Visual storage location management"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            leftIcon={Download}
            onClick={handleExportEmptySlots}
            loading={isExporting}
          >
            Export Empty Slots
          </Button>
          <Button
            variant="outline"
            leftIcon={Printer}
            onClick={handlePrintReconciliation}
            loading={isPrinting}
          >
            Print Reconciliation
          </Button>
          <Button
            variant="accent"
            leftIcon={Plus}
            onClick={() => setShowAddVaultModal(true)}
          >
            Add Locker
          </Button>
        </div>
      }
    >
      {content}
    </PageWrapper>
  );
}
