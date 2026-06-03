# Add Slots & Subslots to Existing Drawers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin add a subslot to one specific slot, or add a whole new slot to a drawer, on the Locker Map — without moving or relabeling any item already stored.

**Architecture:** Stop *calculating* a slot's "Slot X / Subslot Y" position from a drawer-wide `subslots_per_slot` and instead *store* it in two new columns (`slot_group`, `subslot_number`). A one-time backfill migration freezes every existing label exactly as-is. Adds become pure inserts of empty rows. Two new transaction-wrapped endpoints power two new buttons in RackMap.

**Tech Stack:** Laravel 11 (PHP, MySQL `pawnsys`), React (Vite), Redux Toolkit, the project's `apiGet/apiPost` service layer.

**Verification approach:** This project has no automated test harness. Verification is by direct execution — an artisan/tinker before-after label comparison on real data for the risky migration, plus manual UI checks. Each task states the exact command and expected output.

**Important:** Do NOT `git push`. Local commits only.

---

## File Structure

- `backend/database/migrations/<ts>_add_slot_group_to_slots_table.php` — **Create.** Schema: add `slot_group`, `subslot_number` to `slots`.
- `backend/database/migrations/<ts>_backfill_slot_group_on_slots_table.php` — **Create.** Data: backfill the two columns from the existing formula.
- `backend/app/Models/Slot.php` — **Modify.** Add the columns to `$fillable`; change `getLocationCodeAttribute` to read stored columns with a formula fallback.
- `backend/app/Http/Controllers/Api/StorageController.php` — **Modify.** Add `addSubslot` and `addSlot` methods; update `nextAvailableSlot` to read stored columns.
- `backend/routes/api.php` — **Modify.** Register two POST routes.
- `frontend/src/services/storageService.js` — **Modify.** Add `addSubslot` and `addSlot` wrappers.
- `frontend/src/pages/inventory/RackMap.jsx` — **Modify.** Group by stored `slot_group` (formula fallback); add two buttons + handlers.
- `frontend/src/pages/inventory/InventoryList.jsx` — **Modify.** `formatLocation` + label builders read stored columns (formula fallback).

A shared helper `slotPosition(slot, box)` is defined once in each frontend file's existing style to avoid repeating the fallback logic.

---

## Task 1: Schema migration — add the two columns

**Files:**
- Create: `backend/database/migrations/2026_06_03_100000_add_slot_group_to_slots_table.php`

- [ ] **Step 1: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            $table->integer('slot_group')->nullable()->after('slot_number');
            $table->integer('subslot_number')->nullable()->after('slot_group');
        });
    }

    public function down(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            $table->dropColumn(['slot_group', 'subslot_number']);
        });
    }
};
```

- [ ] **Step 2: Run the migration**

Run: `cd c:/pawan/backend && php artisan migrate`
Expected: output shows `...add_slot_group_to_slots_table ... DONE`. No errors.

- [ ] **Step 3: Verify the columns exist**

Run: `cd c:/pawan/backend && php artisan tinker --execute="echo implode(',', \Illuminate\Support\Facades\Schema::getColumnListing('slots'));"`
Expected: the printed list includes `slot_group` and `subslot_number`.

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_06_03_100000_add_slot_group_to_slots_table.php
git commit -m "feat: add slot_group and subslot_number columns to slots"
```

---

## Task 2: Backfill migration — freeze existing positions

This computes each slot's group/subslot from today's formula once and stores it, so no
label changes. Plain drawers (`has_subslots = false`) get `slot_group = slot_number`,
`subslot_number = 1`.

**Files:**
- Create: `backend/database/migrations/2026_06_03_100100_backfill_slot_group_on_slots_table.php`

- [ ] **Step 1: Write the data migration**

```php
<?php

use App\Models\Box;
use App\Models\Slot;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Box::with('slots')->chunk(50, function ($boxes) {
            foreach ($boxes as $box) {
                $per = $box->has_subslots ? max(1, (int) $box->subslots_per_slot) : 1;
                foreach ($box->slots as $slot) {
                    if ($box->has_subslots) {
                        $group = (int) ceil($slot->slot_number / $per);
                        $sub   = (($slot->slot_number - 1) % $per) + 1;
                    } else {
                        $group = $slot->slot_number;
                        $sub   = 1;
                    }
                    $slot->update([
                        'slot_group' => $group,
                        'subslot_number' => $sub,
                    ]);
                }
            }
        });
    }

    public function down(): void
    {
        Slot::query()->update(['slot_group' => null, 'subslot_number' => null]);
    }
};
```

- [ ] **Step 2: Capture BEFORE labels (safety snapshot)**

Run this and save the output to compare after migrating:

```
cd c:/pawan/backend && php artisan tinker --execute="\$out=[]; foreach(\App\Models\Slot::with('box.vault')->get() as \$s){ \$out[\$s->id]=\$s->location_code; } file_put_contents(storage_path('slot_labels_before.json'), json_encode(\$out)); echo 'saved '.count(\$out).' labels';"
```

Expected: `saved <N> labels` (N = total slot rows, e.g. ~ several hundred). This uses the
CURRENT `getLocationCodeAttribute` (still formula-based at this point).

- [ ] **Step 3: Run the backfill migration**

Run: `cd c:/pawan/backend && php artisan migrate`
Expected: `...backfill_slot_group_on_slots_table ... DONE`. No errors.

- [ ] **Step 4: Verify backfill populated every row**

Run: `cd c:/pawan/backend && php artisan tinker --execute="echo 'null_groups='.\App\Models\Slot::whereNull('slot_group')->count();"`
Expected: `null_groups=0`.

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/2026_06_03_100100_backfill_slot_group_on_slots_table.php
git commit -m "feat: backfill slot_group/subslot_number from existing positions"
```

> The BEFORE snapshot in Step 2 is used for verification in Task 3 Step 4. Keep
> `storage/slot_labels_before.json` until then.

---

## Task 3: Slot model — read stored position, fall back to formula

**Files:**
- Modify: `backend/app/Models/Slot.php`

- [ ] **Step 1: Add the columns to `$fillable`**

In `backend/app/Models/Slot.php`, change the `$fillable` array to include the new columns:

```php
    protected $fillable = [
        'box_id',
        'slot_number',
        'slot_group',
        'subslot_number',
        'is_occupied',
        'current_item_id',
        'occupied_at',
    ];
```

- [ ] **Step 2: Update `getLocationCodeAttribute` to use stored columns**

Replace the body of `getLocationCodeAttribute` (currently `Slot.php:65-80`) with:

```php
    public function getLocationCodeAttribute(): string
    {
        $slotStr = $this->slot_number;
        if ($this->box->has_subslots) {
            // Prefer stored position; fall back to the legacy formula if not backfilled.
            if ($this->slot_group !== null && $this->subslot_number !== null) {
                $slotStr = sprintf('%d-%d', $this->slot_group, $this->subslot_number);
            } else {
                $subslotsPerSlot = $this->box->subslots_per_slot ?: 1;
                $slotNum = ceil($this->slot_number / $subslotsPerSlot);
                $subslotNum = (($this->slot_number - 1) % $subslotsPerSlot) + 1;
                $slotStr = sprintf('%d-%d', $slotNum, $subslotNum);
            }
        }

        return sprintf('%s-B%s-S%s',
            $this->box->vault->code,
            $this->box->box_number,
            $slotStr
        );
    }
```

- [ ] **Step 3: Capture AFTER labels**

Run:

```
cd c:/pawan/backend && php artisan tinker --execute="\$out=[]; foreach(\App\Models\Slot::with('box.vault')->get() as \$s){ \$out[\$s->id]=\$s->location_code; } file_put_contents(storage_path('slot_labels_after.json'), json_encode(\$out)); echo 'saved '.count(\$out).' labels';"
```

Expected: `saved <N> labels` (same N as the before snapshot).

- [ ] **Step 4: Verify labels are IDENTICAL before vs after (the critical safety check)**

Run:

```
cd c:/pawan/backend && php artisan tinker --execute="\$b=json_decode(file_get_contents(storage_path('slot_labels_before.json')),true); \$a=json_decode(file_get_contents(storage_path('slot_labels_after.json')),true); \$diff=0; foreach(\$b as \$id=>\$lbl){ if((\$a[\$id]??null)!==\$lbl) \$diff++; } echo 'mismatches='.\$diff;"
```

Expected: `mismatches=0`. If non-zero, STOP — the backfill is wrong; do not proceed.

- [ ] **Step 5: Clean up snapshot files**

Run: `cd c:/pawan/backend && php -r "@unlink('storage/slot_labels_before.json'); @unlink('storage/slot_labels_after.json'); echo 'cleaned';"`
Expected: `cleaned`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Models/Slot.php
git commit -m "feat: read slot position from stored columns with formula fallback"
```

---

## Task 4: Backend endpoint — add a subslot to a specific slot

**Files:**
- Modify: `backend/app/Http/Controllers/Api/StorageController.php`

- [ ] **Step 1: Add the `addSubslot` method**

Add this method to `StorageController` (place it right after the existing `updateBox`
method, around `StorageController.php:271`):

```php
    /**
     * Add one empty subslot to a specific slot group within a box.
     * Pure insert — never touches existing/occupied rows.
     */
    public function addSubslot(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'box_id' => 'required|exists:boxes,id',
            'slot_group' => 'required|integer|min:1',
        ]);

        $box = Box::find($validated['box_id']);

        if ($box->vault->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $groupExists = Slot::where('box_id', $box->id)
            ->where('slot_group', $validated['slot_group'])
            ->exists();

        if (!$groupExists) {
            return $this->error('Slot not found in this drawer', 422);
        }

        DB::beginTransaction();

        try {
            $nextSubslot = (int) Slot::where('box_id', $box->id)
                ->where('slot_group', $validated['slot_group'])
                ->max('subslot_number') + 1;

            $nextSlotNumber = (int) Slot::where('box_id', $box->id)
                ->max('slot_number') + 1;

            $slot = Slot::create([
                'box_id' => $box->id,
                'slot_number' => $nextSlotNumber,
                'slot_group' => $validated['slot_group'],
                'subslot_number' => $nextSubslot,
                'is_occupied' => false,
            ]);

            $box->increment('total_slots');

            DB::commit();

            return $this->success($slot, 'Subslot added successfully', 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to add subslot: ' . $e->getMessage(), 500);
        }
    }
```

- [ ] **Step 2: Register the route**

In `backend/routes/api.php`, in the storage write group (next to `Route::post('/boxes', ...)`
around line 388), add:

```php
                Route::post('/slots/add-subslot', [StorageController::class , 'addSubslot']);
```

- [ ] **Step 3: Verify the endpoint via tinker (no HTTP needed)**

Run (uses the first subslot-enabled box and its first slot group):

```
cd c:/pawan/backend && php artisan tinker --execute="\$box=\App\Models\Box::where('has_subslots',true)->first(); \$g=\App\Models\Slot::where('box_id',\$box->id)->min('slot_group'); \$before=\App\Models\Slot::where('box_id',\$box->id)->where('slot_group',\$g)->count(); \$max=(int)\App\Models\Slot::where('box_id',\$box->id)->where('slot_group',\$g)->max('subslot_number'); \$n=(int)\App\Models\Slot::where('box_id',\$box->id)->max('slot_number')+1; \App\Models\Slot::create(['box_id'=>\$box->id,'slot_number'=>\$n,'slot_group'=>\$g,'subslot_number'=>\$max+1,'is_occupied'=>false]); \$after=\App\Models\Slot::where('box_id',\$box->id)->where('slot_group',\$g)->count(); echo 'group '.\$g.': '.\$before.' -> '.\$after; \App\Models\Slot::where('box_id',\$box->id)->where('slot_group',\$g)->where('subslot_number',\$max+1)->delete();"
```

Expected: prints `group <g>: <before> -> <before+1>` and then removes the test row.
This proves the insert logic is sound. (Endpoint itself is exercised in Task 6 via the UI.)

- [ ] **Step 4: Commit**

```bash
git add backend/app/Http/Controllers/Api/StorageController.php backend/routes/api.php
git commit -m "feat: add endpoint to append a subslot to a specific slot"
```

---

## Task 5: Backend endpoint — add a new slot to a drawer

**Files:**
- Modify: `backend/app/Http/Controllers/Api/StorageController.php`

- [ ] **Step 1: Add the `addSlot` method**

Add this method to `StorageController`, immediately after `addSubslot`:

```php
    /**
     * Add one new slot (a new slot_group) to a box, with the box's default
     * number of subslots (1 for plain drawers). Pure insert.
     */
    public function addSlot(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'box_id' => 'required|exists:boxes,id',
        ]);

        $box = Box::find($validated['box_id']);

        if ($box->vault->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        DB::beginTransaction();

        try {
            $newGroup = (int) Slot::where('box_id', $box->id)->max('slot_group') + 1;
            $count = $box->has_subslots ? max(1, (int) $box->subslots_per_slot) : 1;
            $nextSlotNumber = (int) Slot::where('box_id', $box->id)->max('slot_number');

            for ($i = 1; $i <= $count; $i++) {
                $nextSlotNumber++;
                Slot::create([
                    'box_id' => $box->id,
                    'slot_number' => $nextSlotNumber,
                    'slot_group' => $newGroup,
                    'subslot_number' => $i,
                    'is_occupied' => false,
                ]);
            }

            $box->increment('total_slots', $count);

            DB::commit();

            return $this->success(
                ['slot_group' => $newGroup, 'subslots_created' => $count],
                'Slot added successfully',
                201
            );
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to add slot: ' . $e->getMessage(), 500);
        }
    }
```

- [ ] **Step 2: Register the route**

In `backend/routes/api.php`, next to the `add-subslot` route added in Task 4, add:

```php
                Route::post('/boxes/add-slot', [StorageController::class , 'addSlot']);
```

- [ ] **Step 3: Verify the insert logic via tinker**

Run:

```
cd c:/pawan/backend && php artisan tinker --execute="\$box=\App\Models\Box::where('has_subslots',true)->first(); \$ng=(int)\App\Models\Slot::where('box_id',\$box->id)->max('slot_group')+1; \$cnt=max(1,(int)\$box->subslots_per_slot); \$n=(int)\App\Models\Slot::where('box_id',\$box->id)->max('slot_number'); for(\$i=1;\$i<=\$cnt;\$i++){\$n++;\App\Models\Slot::create(['box_id'=>\$box->id,'slot_number'=>\$n,'slot_group'=>\$ng,'subslot_number'=>\$i,'is_occupied'=>false]);} echo 'new group '.\$ng.' with '.\App\Models\Slot::where('box_id',\$box->id)->where('slot_group',\$ng)->count().' subslots'; \App\Models\Slot::where('box_id',\$box->id)->where('slot_group',\$ng)->delete();"
```

Expected: prints `new group <ng> with <subslots_per_slot> subslots`, then removes the test rows.

- [ ] **Step 4: Commit**

```bash
git add backend/app/Http/Controllers/Api/StorageController.php backend/routes/api.php
git commit -m "feat: add endpoint to append a new slot to a drawer"
```

---

## Task 6: Update `nextAvailableSlot` to read stored columns

The auto-suggest endpoint still uses the formula; align it so suggestions match the
new model.

**Files:**
- Modify: `backend/app/Http/Controllers/Api/StorageController.php`

- [ ] **Step 1: Replace the formula block in `nextAvailableSlot`**

In `nextAvailableSlot` (around `StorageController.php:392-398`), replace:

```php
        $slotStr = $slot->slot_number;
        if ($slot->box->has_subslots) {
            $subslotsPerSlot = $slot->box->subslots_per_slot ?: 1;
            $slotNum = ceil($slot->slot_number / $subslotsPerSlot);
            $subslotNum = (($slot->slot_number - 1) % $subslotsPerSlot) + 1;
            $slotStr = sprintf('%d-%d', $slotNum, $subslotNum);
        }
```

with:

```php
        $slotStr = $slot->slot_number;
        if ($slot->box->has_subslots) {
            if ($slot->slot_group !== null && $slot->subslot_number !== null) {
                $slotStr = sprintf('%d-%d', $slot->slot_group, $slot->subslot_number);
            } else {
                $subslotsPerSlot = $slot->box->subslots_per_slot ?: 1;
                $slotNum = ceil($slot->slot_number / $subslotsPerSlot);
                $subslotNum = (($slot->slot_number - 1) % $subslotsPerSlot) + 1;
                $slotStr = sprintf('%d-%d', $slotNum, $subslotNum);
            }
        }
```

- [ ] **Step 2: Verify it returns without error**

Run: `cd c:/pawan/backend && php artisan tinker --execute="echo app(\App\Http\Controllers\Api\StorageController::class) ? 'controller loads' : 'fail';"`
Expected: `controller loads` (confirms no PHP syntax error in the file).

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/StorageController.php
git commit -m "feat: align nextAvailableSlot with stored slot position"
```

---

## Task 7: Frontend service wrappers

**Files:**
- Modify: `frontend/src/services/storageService.js`

- [ ] **Step 1: Add the two wrappers**

In `frontend/src/services/storageService.js`, inside the `// ============ SLOTS ============`
section (after `getSlots`, around line 103), add:

```js
  /**
   * Add one subslot to a specific slot group in a box
   * @param {number} boxId
   * @param {number} slotGroup
   * @returns {Promise}
   */
  async addSubslot(boxId, slotGroup) {
    return apiPost('/storage/slots/add-subslot', { box_id: boxId, slot_group: slotGroup })
  },

  /**
   * Add a new slot (group) to a box
   * @param {number} boxId
   * @returns {Promise}
   */
  async addSlot(boxId) {
    return apiPost('/storage/boxes/add-slot', { box_id: boxId })
  },
```

- [ ] **Step 2: Verify the build still compiles**

Run: `cd c:/pawan/frontend && npx vite build --mode development 2>&1 | tail -5`
Expected: build completes (`built in ...`) with no error referencing `storageService.js`.
(If a full build is slow, `npx eslint src/services/storageService.js` is an acceptable
substitute — expected: no errors.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/storageService.js
git commit -m "feat: add addSubslot/addSlot storage service wrappers"
```

---

## Task 8: RackMap — group by stored position + add the two buttons

**Files:**
- Modify: `frontend/src/pages/inventory/RackMap.jsx`

- [ ] **Step 1: Add a position helper near the top of the component**

In `RackMap.jsx`, just after the `const currentBoxSummary = ...` line (around line 194),
add a helper that prefers stored columns and falls back to the formula:

```js
  // Resolve a slot's [group, subslot] — prefer stored columns, fall back to formula
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
```

- [ ] **Step 2: Use the helper in the subslot grouping**

Replace the grouping block (around `RackMap.jsx:954-960`) that builds `acc[slotNum]`:

```js
                  {Object.entries(
                    filteredSlots.reduce((acc, slot) => {
                      const [slotNum] = slotPos(slot, currentBox);
                      if (!acc[slotNum]) acc[slotNum] = [];
                      acc[slotNum].push(slot);
                      return acc;
                    }, {})
                  ).map(([mainSlotNum, subslots]) => (
```

- [ ] **Step 3: Use the helper for the subslot label**

Replace the `subslotNum` computation inside the subslot card (around `RackMap.jsx:978`):

```js
                          const subslotNum = slotPos(slot, currentBox)[1];
```

- [ ] **Step 4: Add the `handleAddSlot` and `handleAddSubslot` handlers**

After the existing `handleAddBox` function (around `RackMap.jsx:407`), add:

```js
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
```

- [ ] **Step 5: Add the "Add Slot" button in the drawer grid header**

In the grid header action row (around `RackMap.jsx:935-942`, next to the Refresh button),
add a button — for subslot drawers it adds a slot, for plain drawers it also adds a slot:

```jsx
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={Plus}
                  onClick={handleAddSlot}
                  disabled={!currentBox || isSaving}
                >
                  Add Slot
                </Button>
```

- [ ] **Step 6: Add the "+" Add-subslot control on each slot card header**

In the subslot card header (around `RackMap.jsx:968-970`, the `<span>...used</span>`),
wrap the right side so the count badge and a "+" button sit together:

```jsx
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
                        </div>
```

(Replace the existing single `<span>...used</span>` element with this block.)

- [ ] **Step 7: Verify the UI manually**

Start the app (per the project's run method) and open the Locker Map page.
- Pick a subslot drawer (e.g. Drawer C). Confirm existing occupied subslots are unchanged.
- Click the "+" on Slot 01 → a new empty subslot appears (e.g. 4/4 becomes 4/5), occupied ones untouched.
- Click "Add Slot" → a new empty slot card appears at the end.
- Refresh the page → the additions persist.
Expected: all of the above; no console errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/inventory/RackMap.jsx
git commit -m "feat: add 'Add Slot' and 'Add Subslot' controls to Locker Map"
```

---

## Task 9: InventoryList — read stored position for table + labels

**Files:**
- Modify: `frontend/src/pages/inventory/InventoryList.jsx`

- [ ] **Step 1: Update `formatLocation` to prefer stored columns**

In `formatLocation` (around `InventoryList.jsx:262-297`), both `has_subslots` branches
compute `sNum`/`subNum` from the formula. Replace each pair of:

```js
        const subPerSlot = item.box.subslots_per_slot || 5;
        const sNum = Math.ceil(item.slot.slot_number / subPerSlot);
        const subNum = ((item.slot.slot_number - 1) % subPerSlot) + 1;
```

with (use the matching `item.box`/`item.slot.box` object for each branch):

```js
        const subPerSlot = item.box.subslots_per_slot || 5;
        const sNum = item.slot.slot_group != null
          ? item.slot.slot_group
          : Math.ceil(item.slot.slot_number / subPerSlot);
        const subNum = item.slot.subslot_number != null
          ? item.slot.subslot_number
          : ((item.slot.slot_number - 1) % subPerSlot) + 1;
```

For the nested branch (`item.slot.box.vault`), use `item.slot.box.subslots_per_slot`
for `subPerSlot` and the same `item.slot.slot_group`/`subslot_number` fields.

- [ ] **Step 2: Update the barcode-label builders**

In `handlePrintBarcodeLabels` (around `InventoryList.jsx:762-766`) and
`handlePrintSingleLabel` (around `InventoryList.jsx:864-868`), each computes
`sNum`/`subNum` (or `sN`/`subN`) from the absolute slot number. Replace the
formula lines with the stored-column-preferring version, e.g. for `handlePrintBarcodeLabels`:

```js
                  const subPerSlot = boxObj.subslots_per_slot || 5;
                  const sNum = slotObj?.slot_group != null
                    ? slotObj.slot_group
                    : Math.ceil(absSlotNum / subPerSlot);
                  const subNum = slotObj?.subslot_number != null
                    ? slotObj.subslot_number
                    : ((absSlotNum - 1) % subPerSlot) + 1;
```

and the analogous change in `handlePrintSingleLabel` using its `sObj`/`slotNumRaw`/`sPerS`
variables (`sN`, `subN`).

- [ ] **Step 3: Verify the build compiles**

Run: `cd c:/pawan/frontend && npx vite build --mode development 2>&1 | tail -5`
Expected: build completes with no error referencing `InventoryList.jsx`.
(Substitute `npx eslint src/pages/inventory/InventoryList.jsx` if build is slow — expected: no errors.)

- [ ] **Step 4: Verify labels manually**

In the running app, open Inventory (table view) for items in a subslot drawer.
- Confirm the Location column reads identically to before for existing items.
- Print a label for one item and confirm the storage code (e.g. `1-C1-1`) matches its slot.
Expected: unchanged location strings for existing items.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/inventory/InventoryList.jsx
git commit -m "feat: read stored slot position in inventory table and labels"
```

---

## Final verification (whole feature)

- [ ] Existing occupied subslots/slots show the same labels as before (Task 3 Step 4 passed; Task 8/9 manual checks passed).
- [ ] "Add Subslot" adds exactly one empty subslot to the chosen slot and persists after refresh.
- [ ] "Add Slot" adds one new slot with the drawer's default subslot count and persists.
- [ ] No items were moved or relabeled at any point.
- [ ] No `git push` was run; all commits are local.
