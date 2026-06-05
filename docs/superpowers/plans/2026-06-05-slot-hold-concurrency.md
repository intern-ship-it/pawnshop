# Plan: Slot Hold (Concurrency Safety) — Prevent Two Pledges Booking the Same Subslot

**Date:** 2026-06-05
**Goal:** Stop two staff from assigning the same slot/subslot at the same time, with clear visual feedback — **without changing any existing slot-assignment logic.**

---

## Scope guardrail (read first)

| ✅ ADD (new, additive only) | ❌ DO NOT TOUCH |
|---|---|
| New `slot_holds` table | `PledgeController@store` slot-assignment block (lines 657–668) |
| New endpoints: claim / read / renew / release holds | `Slot::update(...)` occupy logic, `Slot::occupy()` / `release()` |
| Frontend: grey rendering, poll, check-on-click, renew-while-open in `NewPledge.jsx` slot grid | How items map to slot/subslot, the wizard flow, pledge creation |

The hold layer is **advisory** and lives/dies *before* the real assignment ever runs. The existing assignment code stays byte-for-byte identical.

---

## Decisions locked in

- **Storage:** New DB table `slot_holds` (best fit for the existing Laravel/MySQL stack; survives restarts; works across app servers; lazy expiry via `expires_at`). *(Chosen over Redis since Redis isn't assumed configured.)*
- **TTL:** **1 minute**, **renew-while-open** — page re-stamps `expires_at` every ~30s while the form is open; hold dies 1 min after the staff leaves/closes.
- **Final guard at Create:** **Yes** — one atomic "still free?" check *before* the existing assignment runs (a guard in front of the logic, not a change to it). Last-resort net for the rare click-then-click overlap.

---

## How it behaves (the four moments)

A hold record = `{ slot_id, held_by (user_id), expires_at }`.

1. **Staff A clicks Slot 1-5** → server creates a hold (`expires_at = now + 60s`), atomically (only if no live hold exists). Slot becomes orange for A.
2. **Any page loads / polls** → server returns all holds where `expires_at > now`. Other staff paint that slot **grey**.
3. **60s pass with no renewal** → hold is simply not returned anymore (lazy expiry). Slot goes green again. (Row cleaned up lazily; no cron required.)
4. **A clicks Create within the window** → existing assignment logic runs unchanged; the hold is released after commit.

**Visual feedback for B without refresh** = two layers:
- **Background poll (~5s):** grey appears on B's screen by itself.
- **Check-on-click:** if B clicks during the poll gap, the click verifies against the server and greys it instantly.

---

## Color legend (frontend)

| Color | Meaning | Source |
|---|---|---|
| 🟩 Green | Free | not occupied AND no live hold |
| ⬜ Grey | Held by **another** user (temporary) | live hold, `held_by != me` |
| 🟧 Orange | Held/selected by **me** | live hold, `held_by == me` |
| 🟥 Red | Permanently occupied | existing `is_occupied` (unchanged) |

---

## Backend changes (all additive)

### 1. Migration — `slot_holds` table
New file: `backend/database/migrations/2026_06_05_000000_create_slot_holds_table.php`
```
- id
- slot_id        (FK slots.id, indexed)
- held_by        (FK users.id)
- expires_at     (datetime, indexed)
- created_at / updated_at
- UNIQUE(slot_id)   // at most one live hold row per slot
```
> The `UNIQUE(slot_id)` is the atomic guarantee: two simultaneous claim inserts → only one succeeds, the other gets a duplicate error and is rejected.

### 2. Model — `SlotHold`
New file: `backend/app/Models/SlotHold.php` — fillable `slot_id, held_by, expires_at`; cast `expires_at` datetime; scope `live()` = `where('expires_at', '>', now())`.

### 3. Controller — `SlotHoldController` (new)
New file: `backend/app/Http/Controllers/Api/SlotHoldController.php`
- `claim(slot_id)` — delete any expired row for the slot, then **atomic** `insert` of a fresh hold (`expires_at = now+60s`). On duplicate-key (someone holds it) → `409 { message: "Slot just taken by another user" }`. If `held_by == me` already, just renew.
- `index(box_id)` — return live holds for all slots in the box: `[{ slot_id, held_by, mine: bool, expires_at }]`. (Used by poll + reload.)
- `renew(slot_id)` — if I own the live hold, push `expires_at = now+60s`; else `409`. (Called every ~30s while form open.)
- `release(slot_id)` — delete my hold (on slot change / cancel / unmount).

### 4. Routes (additive)
In `backend/routes/api.php`, alongside the existing `/storage/...` group:
```
POST   /storage/holds/{slot}/claim
POST   /storage/holds/{slot}/renew
DELETE /storage/holds/{slot}/release
GET    /storage/boxes/{box}/holds
```

### 5. Final guard at Create (guard *in front of*, not inside, assignment)
In `PledgeController@store`, **immediately before** the existing `if (isset($item['slot_id'])) { Slot::where(...)->update(...) }` block (line 657), add a pre-check inside the existing transaction:
```
- If slot_id set: confirm no *other* pledge already occupies it (re-read is_occupied) AND no live hold by another user.
- If conflict → DB::rollBack(); return 409 "Slot just taken, please pick another."
- Else: fall through to the EXISTING untouched assignment block.
- After commit: delete the hold (release).
```
> This adds lines *above* the assignment block and a release *after* commit. The assignment block itself (657–668) is not edited.

---

## Frontend changes (in `NewPledge.jsx` slot grid + `storageService.js`)

### 1. `storageService.js` — add 4 thin methods
`claimHold(slotId)`, `renewHold(slotId)`, `releaseHold(slotId)`, `getHolds(boxId)` — mirror existing `getSlots` style.

### 2. Slot grid (`NewPledge.jsx` ~3127–3300, the subslot cards)
- **State:** `holds` map `{ slot_id: { mine, expires_at } }`.
- **On box select / mount:** `getHolds(boxId)` → populate `holds`.
- **Poll:** `setInterval(getHolds, 5000)` while on the Storage step; clear on unmount/step-change.
- **Render color:** apply legend above — grey when `holds[id] && !holds[id].mine`; disable click on grey.
- **On slot click (check-on-click):** call `claimHold(slotId)`.
  - `200` → mark mine (orange), proceed with existing selection logic (unchanged).
  - `409` → set that slot grey + toast "Just taken, pick another"; refresh `holds`.
- **Renew-while-open:** `setInterval(renewHold(myHeldSlot), 30000)` while a slot is held by me and form open.
- **Release:** call `releaseHold` when changing slot, cancelling, or leaving the page (`beforeunload` + unmount). Belt-and-suspenders only — the 60s TTL frees it anyway.

> The existing `handleSlot...` selection logic and the assignment payload are **not** changed — claim/release are wrapped *around* the click, not inside the assignment.

---

## Test plan

1. **Happy path:** A claims Slot 1-5 → B's grid greys it within ~5s (poll) → A creates → slot red → B's grid frees others correctly.
2. **Check-on-click in poll gap:** B clicks Slot 1-5 within 5s of A's claim → instant 409 + grey.
3. **Simultaneous claim:** fire two `claim` requests at the same slot → exactly one `200`, one `409` (UNIQUE proves it).
4. **Abandon:** A claims, closes tab → after ~60s with no renewal, slot frees on next poll.
5. **Slow-but-active:** A holds, keeps form open 3 min (renewals firing) → hold stays alive → A still creates successfully.
6. **Final guard:** simulate both passing holds (disable poll) → second Create gets 409, no double-booking; first pledge intact (no orphaned slot, box `occupied_slots` correct).
7. **Multi-item pledge:** all items of ONE pledge into the same slot still works (guard blocks only *other* pledges).

---

## Rollback
Drop `slot_holds` table, remove the 4 routes + controller + model + 4 service methods + grid hold-state. The pre-check at `store` is removable independently. Assignment logic was never modified, so removing the hold layer returns to exact current behavior.
