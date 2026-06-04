# Design: Add slots & subslots to existing drawers

**Date:** 2026-06-03
**Status:** Approved (pending written-spec review)

## Problem

In the inventory system, storage is organised as **Locker (Vault) → Drawer (Box) →
Slot → Subslot**. A client has a full drawer (Drawer C: 9 slots × 4 subslots = 59
items stored) and wants to add capacity to it. Two operations are needed:

1. **Add a subslot to one specific slot** — e.g. Slot 01 goes from 4 → 5 subslots,
   while Slots 02–09 keep their 4.
2. **Add a brand-new slot to a drawer** — e.g. Drawer C gains a 10th slot.

The hard requirement: **no item already stored may be moved or relabeled.**

## Root cause: position is calculated, not stored

A `Slot` row only stores its flat `slot_number` (1, 2, 3 … N). The visible label
"Slot X / Subslot Y" is *computed* at display time from a single drawer-wide
`subslots_per_slot` value:

```
slot_group     = ceil(slot_number / subslots_per_slot)
subslot_number = ((slot_number - 1) % subslots_per_slot) + 1
```

This formula assumes **every slot in the drawer has the same number of subslots**.
The moment Slot 01 has 5 and Slot 02 has 4, there is no single `subslots_per_slot`
that yields correct labels — every row after the inserted one mislabels, and those
rows point at stored items. The data model therefore cannot represent uneven slots.

The fix is to **store position explicitly** instead of calculating it.

## Confirmed scope

- Add a subslot to a specific slot. ✅
- Add a brand-new slot to a drawer; the new slot starts with the drawer's default
  subslot count (`subslots_per_slot`). ✅
- Works on **both** drawer kinds — subslot drawers and plain drawers (a plain drawer
  is treated as slots with exactly 1 subslot each). ✅
- New subslots/slots **append at the end**; no existing label changes. ✅

### Out of scope
Removing slots/subslots, inserting in the middle, reordering. The new foundation
makes these easy to add later if requested.

## Data model change

Add two columns to the `slots` table:

| Column           | Type        | Meaning                                              |
|------------------|-------------|------------------------------------------------------|
| `slot_group`     | int         | Which visual slot the row belongs to (1, 2, 3 …).    |
| `subslot_number` | int         | Position within that slot (1 for plain drawers).     |

After these exist, position is **read** from the row; the `ceil`/`%` formula is
retired everywhere.

## Backend

### Migration 1 — schema
Add `slot_group` and `subslot_number` to `slots`. Both reversible in `down()`.

### Migration 2 — data backfill (one-time, idempotent, reversible)
For every existing `Slot`, compute `slot_group`/`subslot_number` once using today's
formula (respecting `box.has_subslots` / `box.subslots_per_slot`; plain drawers get
`slot_group = slot_number`, `subslot_number = 1`) and write the values. This freezes
all current labels exactly as they are today — nothing shifts.

### New endpoints (both in `StorageController`, transaction-wrapped, pure inserts)

**`POST /storage/slots/add-subslot`** — body `{ box_id, slot_group }`
- Validate box belongs to the user's branch; validate `slot_group` exists in the box.
- `max = max(subslot_number) WHERE box_id, slot_group`.
- Insert one empty `Slot`: next flat `slot_number = max(slot_number in box) + 1`,
  `slot_group = slot_group`, `subslot_number = max + 1`, unoccupied.
- `box->increment('total_slots')`.

**`POST /storage/boxes/add-slot`** — body `{ box_id }`
- Validate box belongs to the user's branch.
- `newGroup = max(slot_group in box) + 1`.
- `count = box.has_subslots ? box.subslots_per_slot : 1`.
- Insert `count` empty `Slot` rows: `slot_group = newGroup`,
  `subslot_number = 1..count`, continuing the flat `slot_number` sequence.
- `box->increment('total_slots', count)`.

### Read-path updates
- `Slot::getLocationCodeAttribute` — read `slot_group`/`subslot_number` instead of
  computing.
- `StorageController::nextAvailableSlot` — same.

### Routes
Register the two POST routes in `routes/api.php` beside the existing box routes
(`/boxes`, `/boxes/{box}`).

## Frontend

### RackMap.jsx (the Locker Map page — the screen in the screenshot)
- Change the slot-card grouping key from the computed `ceil(...)` to the stored
  `slot_group`; label subslots from stored `subslot_number`. Read the new columns
  with a fallback to the old `ceil`/`%` formula when they are null, so the grid
  renders correctly even before the backfill migration has run.
- Add **"+ Add slot"** in the drawer grid header (beside Refresh).
- Add **"+ Add subslot"** on each slot card header.
- New handlers `handleAddSlot` / `handleAddSubslot` call the endpoints and refresh
  the grid on success (toast on error), following the existing `handleAddBox` pattern.

### InventoryList.jsx
- `formatLocation` and the barcode-label builders read the stored columns, so the
  table and printed labels stay correct.

### storageService.js
- Add `addSlot(boxId)` and `addSubslot(boxId, slotGroup)` wrappers.

## Safety guarantees ("don't break occupied")

1. Migration only *adds* columns + backfills — freezes existing labels, shifts nothing.
2. Add operations are pure inserts of new empty rows — occupied rows are never read
   or written.
3. All multi-step writes run inside DB transactions.
4. **Verification step:** on a copy of production data, confirm every item's computed
   label is identical before and after Migration 2 (all 336 items), and that the
   RackMap grid renders unchanged for occupied drawers.

## Affected files (reference)

- `backend/database/migrations/` — two new migrations.
- `backend/app/Http/Controllers/Api/StorageController.php` — two endpoints + read paths.
- `backend/app/Models/Slot.php` — `getLocationCodeAttribute`.
- `backend/routes/api.php` — two routes.
- `frontend/src/pages/inventory/RackMap.jsx` — grouping + two buttons + handlers.
- `frontend/src/pages/inventory/InventoryList.jsx` — `formatLocation` + label builders.
- `frontend/src/services/storageService.js` — two service wrappers.
