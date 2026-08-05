<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vault;
use App\Models\Box;
use App\Models\Slot;
use App\Models\PledgeItem;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class StorageController extends Controller
{

    /**
     * List all vaults
     */
    public function vaults(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $vaults = Vault::where('branch_id', $branchId)
            ->withCount('boxes')
            ->with(['boxes:id,vault_id,total_slots'])
            ->orderBy('name')
            ->get()
            ->map(function ($vault) {
                $totalSlots = $vault->boxes->sum('total_slots');
                return [
                    'id' => $vault->id,
                    'code' => $vault->code,
                    'name' => $vault->name,
                    'description' => $vault->description,
                    'is_active' => $vault->is_active,
                    'boxes_count' => $vault->boxes_count,
                    'total_slots' => $totalSlots,
                    'total_boxes' => $vault->total_boxes,
                ];
            });

        return $this->success($vaults);
    }

    /**
     * Create vault with optional boxes
     */
    public function createVault(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:20',
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'number_of_boxes' => 'nullable|integer|min:0|max:100',
        ]);

        $branchId = $request->user()->branch_id;

        // Check unique code
        $exists = Vault::where('branch_id', $branchId)
            ->where('code', $validated['code'])
            ->exists();

        if ($exists) {
            return $this->error('Vault code already exists', 422);
        }

        DB::beginTransaction();

        try {
            $numberOfBoxes = $validated['number_of_boxes'] ?? 0;
            $slotsPerBox = 9; // Default 9 slots per drawer

            $vault = Vault::create([
                'branch_id' => $branchId,
                'code' => $validated['code'],
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'total_boxes' => $numberOfBoxes,
            ]);

            // Create boxes with 20 slots each
            for ($boxNum = 1; $boxNum <= $numberOfBoxes; $boxNum++) {
                $box = Box::create([
                    'vault_id' => $vault->id,
                    'box_number' => $boxNum,
                    'name' => 'Drawer ' . $boxNum,
                    'total_slots' => $slotsPerBox,
                ]);

                // Create slots per box (plain drawers: group = slot number, subslot = 1)
                for ($slotNum = 1; $slotNum <= $slotsPerBox; $slotNum++) {
                    Slot::create([
                        'box_id' => $box->id,
                        'slot_number' => $slotNum,
                        'slot_group' => $slotNum,
                        'subslot_number' => 1,
                    ]);
                }
            }

            DB::commit();

            return $this->success(
                $vault->load('boxes'),
                'Safe created successfully with ' . $numberOfBoxes . ' drawers',
                201
            );

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to create vault: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Update vault
     */
    public function updateVault(Request $request, Vault $vault): JsonResponse
    {
        if ($vault->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'description' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        $vault->update($validated);

        return $this->success($vault, 'Vault updated successfully');
    }

    /**
     * Delete vault
     */
    public function deleteVault(Request $request, Vault $vault): JsonResponse
    {
        if ($vault->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        // Check if vault has items
        $hasItems = PledgeItem::where('vault_id', $vault->id)
            ->where('status', 'stored')
            ->exists();

        if ($hasItems) {
            return $this->error('Cannot delete vault with stored items', 422);
        }

        $vault->delete();

        return $this->success(null, 'Vault deleted successfully');
    }

    /**
     * List boxes in a vault
     */
    public function boxes(Request $request, Vault $vault): JsonResponse
    {
        if ($vault->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $boxes = $vault->boxes()
            ->withCount([
                'slots as occupied_slots' => function ($q) {
                    $q->where('is_occupied', true);
                }
            ])
            ->orderBy('box_number')
            ->get();

        return $this->success($boxes);
    }

    /**
     * Create box
     */
    public function createBox(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'vault_id' => 'required|exists:vaults,id',
            'box_number' => 'nullable|string|max:20',
            'name' => 'nullable|string|max:50',
            'total_slots' => 'required|integer|min:1|max:100',
            'has_subslots' => 'nullable|boolean',
            'subslots_per_slot' => 'nullable|integer|min:1|max:100',
            'description' => 'nullable|string|max:255',
        ]);

        $vault = Vault::find($validated['vault_id']);

        if ($vault->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        // Auto-generate box_number if not provided
        if (empty($validated['box_number'])) {
            $boxCount = Box::where('vault_id', $validated['vault_id'])->count();
            $validated['box_number'] = (string) ($boxCount + 1);
        }

        // Check unique box number
        $exists = Box::where('vault_id', $validated['vault_id'])
            ->where('box_number', $validated['box_number'])
            ->exists();

        if ($exists) {
            return $this->error('Box number already exists in this vault', 422);
        }

        DB::beginTransaction();

        try {
            $hasSubslots = $validated['has_subslots'] ?? false;
            $subslotsPerSlot = $hasSubslots ? ($validated['subslots_per_slot'] ?? 5) : 1;
            
            $actualTotalSlots = $validated['total_slots'] * $subslotsPerSlot;

            $box = Box::create([
                'vault_id' => $validated['vault_id'],
                'box_number' => $validated['box_number'],
                'name' => $validated['name'] ?? ('Drawer ' . $validated['box_number']),
                'total_slots' => $actualTotalSlots,
                'has_subslots' => $hasSubslots,
                'subslots_per_slot' => $subslotsPerSlot,
                'description' => $validated['description'] ?? null,
            ]);

            // Create slots with explicit stored position so new drawers are
            // consistent with backfilled ones (and the add-slot/subslot endpoints work).
            for ($i = 1; $i <= $actualTotalSlots; $i++) {
                Slot::create([
                    'box_id' => $box->id,
                    'slot_number' => $i,
                    'slot_group' => $hasSubslots ? (int) ceil($i / $subslotsPerSlot) : $i,
                    'subslot_number' => $hasSubslots ? (($i - 1) % $subslotsPerSlot) + 1 : 1,
                ]);
            }

            // Update vault box count
            $vault->increment('total_boxes');

            DB::commit();

            return $this->success($box->load('vault'), 'Box created successfully', 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to create box: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Update box
     */
    public function updateBox(Request $request, Box $box): JsonResponse
    {
        if ($box->vault->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'name' => 'nullable|string|max:50',
            'is_active' => 'sometimes|boolean',
        ]);

        $box->update($validated);

        return $this->success($box, 'Box updated successfully');
    }

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

    /**
     * Remove a single empty subslot. Refuses if the subslot holds an item.
     * Never renumbers remaining subslots, so no stored item's label changes.
     */
    public function removeSubslot(Request $request, Slot $slot): JsonResponse
    {
        $box = $slot->box;

        if ($box->vault->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        if ($this->slotHasItem($slot)) {
            return $this->error('Cannot remove a subslot that holds an item', 422);
        }

        DB::beginTransaction();

        try {
            $slot->delete();
            $box->decrement('total_slots');

            DB::commit();

            return $this->success(null, 'Subslot removed successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to remove subslot: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Remove an entire slot (group) and all its subslots. Refuses if ANY
     * subslot in the group holds an item. Never renumbers other groups.
     */
    public function removeSlotGroup(Request $request, Box $box, int $group): JsonResponse
    {
        if ($box->vault->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $slots = Slot::where('box_id', $box->id)
            ->where('slot_group', $group)
            ->get();

        if ($slots->isEmpty()) {
            return $this->error('Slot not found in this drawer', 422);
        }

        foreach ($slots as $slot) {
            if ($this->slotHasItem($slot)) {
                return $this->error('Cannot remove a slot that holds items', 422);
            }
        }

        DB::beginTransaction();

        try {
            $count = $slots->count();
            Slot::where('box_id', $box->id)
                ->where('slot_group', $group)
                ->delete();
            $box->decrement('total_slots', $count);

            DB::commit();

            return $this->success(['removed' => $count], 'Slot removed successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to remove slot: ' . $e->getMessage(), 500);
        }
    }

    /**
     * A subslot is considered occupied if its flag is set or any stored
     * pledge item still references it.
     */
    private function slotHasItem(Slot $slot): bool
    {
        if ($slot->is_occupied) {
            return true;
        }

        return PledgeItem::where('slot_id', $slot->id)
            ->where('status', 'stored')
            ->exists();
    }

    /**
     * Delete box
     */
    public function deleteBox(Request $request, Box $box): JsonResponse
    {
        if ($box->vault->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        // Check if box has items
        $hasItems = Slot::where('box_id', $box->id)
            ->where('is_occupied', true)
            ->exists();

        if ($hasItems) {
            return $this->error('Cannot delete box with stored items', 422);
        }

        DB::beginTransaction();

        try {
            $box->slots()->delete();
            $box->vault->decrement('total_boxes');
            $box->delete();

            DB::commit();

            return $this->success(null, 'Box deleted successfully');

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to delete box: ' . $e->getMessage(), 500);
        }
    }

    /**
     * List slots in a box
     */
    public function slots(Request $request, Box $box): JsonResponse
    {
        if ($box->vault->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        // Opt-in extras for the rack map's on-screen search: the paperwork a customer
        // can walk in holding (renewal/redemption ticket numbers, receipt no, IC).
        // Off by default so the callers that do NOT search -- the new-pledge slot
        // picker, and Print Reconciliation, which walks every box in the branch --
        // keep exactly the payload and query count they had before.
        $withSearchTerms = $request->boolean('with_search_terms');

        $itemRelations = $withSearchTerms
            ? [
                'pledge:id,pledge_no,receipt_no,status,customer_id,due_date',
                'pledge.customer:id,name,ic_number',
                'pledge.renewals:id,pledge_id,renewal_no',
                'pledge.redemption:id,pledge_id,redemption_no',
            ]
            : [
                'pledge:id,pledge_no,status,customer_id,due_date',
                'pledge.customer:id,name',
            ];

        $itemRelations[] = 'category:id,name_en,name_ms,code';
        $itemRelations[] = 'purity:id,name,code';

        $slots = $box->slots()
            ->with(['currentItems' => function ($q) use ($itemRelations) {
                $q->select('id', 'pledge_id', 'category_id', 'purity_id', 'net_weight', 'gross_weight', 'net_value', 'gross_value', 'description', 'barcode', 'slot_id', 'photo')
                  ->with($itemRelations);
            }])
            ->orderBy('slot_number')
            ->get();

        return $this->success($slots);
    }

    /**
     * Locate stored items anywhere in the branch, by any number a customer may quote.
     *
     * The rack map's own search can only filter the drawer currently on screen,
     * because that is the only drawer whose slots are ever loaded. An item sitting
     * three drawers away was never in the haystack, so searching its renewal number
     * reported "no slots in this drawer" — technically true, and useless. This asks
     * the database instead, and reports which drawer to open.
     *
     * Matches the same terms as the pledge list: pledge/receipt/renewal/redemption
     * numbers, customer name and IC, and the item barcode.
     */
    public function locate(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $search = trim((string) $request->get('search', ''));

        // One character matches most of the branch; the answer would be noise.
        if (mb_strlen($search) < 2) {
            return $this->success([]);
        }

        $items = PledgeItem::query()
            // Never select `photo` here: it is a base64 data-URI (~110KB a row) and
            // this query spans every drawer in the branch.
            ->select('id', 'pledge_id', 'slot_id', 'description', 'barcode')
            ->whereNotNull('slot_id')
            ->whereNotIn('status', ['redeemed', 'released'])
            ->whereHas('slot.box.vault', function ($q) use ($branchId) {
                $q->where('branch_id', $branchId);
            })
            ->where(function ($q) use ($search) {
                $q->where('barcode', 'like', "%{$search}%")
                    ->orWhereHas('pledge', function ($pq) use ($search) {
                        $pq->where('pledge_no', 'like', "%{$search}%")
                            ->orWhere('receipt_no', 'like', "%{$search}%")
                            ->orWhereHas('customer', function ($cq) use ($search) {
                                $cq->where('name', 'like', "%{$search}%")
                                    ->orWhere('ic_number', 'like', "%{$search}%");
                            })
                            ->orWhereHas('renewals', function ($rq) use ($search) {
                                $rq->where('renewal_no', 'like', "%{$search}%");
                            })
                            ->orWhereHas('redemption', function ($rq) use ($search) {
                                $rq->where('redemption_no', 'like', "%{$search}%");
                            });
                    });
            })
            ->with([
                'pledge:id,pledge_no,customer_id',
                'pledge.customer:id,name',
                'slot:id,box_id,slot_number,slot_group,subslot_number',
                'slot.box:id,vault_id,name,has_subslots,subslots_per_slot',
                'slot.box.vault:id,name',
            ])
            // A broad term (a common surname) could match hundreds. Cap it, and say
            // so, rather than shipping the whole branch to the browser.
            ->limit(201)
            ->get();

        $truncated = $items->count() > 200;

        // One row per pledge per slot. A four-item pledge sits in a single slot, and
        // listing "DRAWER B slot 3" four times tells the counter nothing extra.
        $matches = $items->take(200)
            ->groupBy(fn ($item) => $item->slot_id . ':' . $item->pledge_id)
            ->map(function ($group) {
                $item = $group->first();
                $slot = $item->slot;
                $box = $slot?->box;

                return [
                    'description' => $item->description,
                    'barcode' => $item->barcode,
                    'item_count' => $group->count(),
                    'pledge_no' => $item->pledge->pledge_no ?? null,
                    'customer_name' => $item->pledge->customer->name ?? null,
                    'vault_id' => $box->vault->id ?? null,
                    'vault_name' => $box->vault->name ?? null,
                    'box_id' => $box->id ?? null,
                    'box_name' => $box->name ?? null,
                    'slot_id' => $slot->id ?? null,
                    'slot_number' => $slot->slot_number ?? null,
                    // The grid labels a subslotted drawer "Slot 02 · 2", not by the
                    // raw sequential slot_number. Ship the box's layout so the
                    // result list can print the same label the shelf carries.
                    'slot_group' => $slot->slot_group,
                    'subslot_number' => $slot->subslot_number,
                    'box_has_subslots' => (bool) ($box->has_subslots ?? false),
                    'subslots_per_slot' => $box->subslots_per_slot ?? 1,
                ];
            })
            ->values();

        return $this->success([
            'matches' => $matches,
            'truncated' => $truncated,
        ]);
    }

    /**
     * Get available slots
     */
    public function availableSlots(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $vaultId = $request->get('vault_id');
        $boxId = $request->get('box_id');

        $query = Slot::where('is_occupied', false)
            ->whereHas('box.vault', function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->where('is_active', true);
            })
            ->whereHas('box', function ($q) {
                $q->where('is_active', true);
            });

        if ($vaultId) {
            $query->whereHas('box', function ($q) use ($vaultId) {
                $q->where('vault_id', $vaultId);
            });
        }

        if ($boxId) {
            $query->where('box_id', $boxId);
        }

        $slots = $query->with(['box.vault:id,code,name'])
            ->orderBy('box_id')
            ->orderBy('slot_number')
            ->get();

        return $this->success($slots);
    }

    /**
     * Get next available slot (auto-suggest)
     */
    public function nextAvailableSlot(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $slot = Slot::where('is_occupied', false)
            ->whereHas('box.vault', function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->where('is_active', true);
            })
            ->whereHas('box', function ($q) {
                $q->where('is_active', true);
            })
            ->with(['box.vault:id,code,name'])
            ->orderBy('box_id')
            ->orderBy('slot_number')
            ->first();

        if (!$slot) {
            return $this->error('No available slots', 404);
        }

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

        return $this->success([
            'slot' => $slot,
            'location_string' => sprintf(
                '%s → %s%s',
                $slot->box->vault->name,
                $slot->box->box_number,
                $slotStr
            ),
        ]);
    }

    /**
     * Get box summary (total value/grams)
     */
    public function boxSummary(Request $request, Box $box): JsonResponse
    {
        if ($box->vault->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $items = PledgeItem::where('box_id', $box->id)
            ->where('status', 'stored')
            ->get();

        $summary = [
            'total_items' => $items->count(),
            'total_weight' => round($items->sum('net_weight'), 3),
            'total_value' => round($items->sum('net_value'), 2),
            'occupied_slots' => $items->count(),
            'available_slots' => $box->total_slots - $items->count(),
        ];

        return $this->success([
            'box' => $box,
            'summary' => $summary,
            'items' => $items->load(['pledge.customer:id,name', 'category', 'purity']),
        ]);
    }

    /**
     * Get storage capacity summary (for dashboard/notifications)
     */
    public function capacity(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        // Get total slots count
        $totalSlots = Slot::whereHas('box.vault', function ($q) use ($branchId) {
            $q->where('branch_id', $branchId)->where('is_active', true);
        })
            ->whereHas('box', function ($q) {
                $q->where('is_active', true);
            })
            ->count();

        // Get occupied slots count
        $occupiedSlots = Slot::where('is_occupied', true)
            ->whereHas('box.vault', function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->where('is_active', true);
            })
            ->whereHas('box', function ($q) {
                $q->where('is_active', true);
            })
            ->count();

        // Calculate stats
        $availableSlots = $totalSlots - $occupiedSlots;
        $usagePercent = $totalSlots > 0 ? round(($occupiedSlots / $totalSlots) * 100, 1) : 0;
        $availablePercent = 100 - $usagePercent;

        // Determine status level
        $status = 'healthy'; // > 30% available
        if ($availablePercent <= 10) {
            $status = 'critical'; // ≤ 10% available
        } elseif ($availablePercent <= 20) {
            $status = 'warning'; // ≤ 20% available
        } elseif ($availablePercent <= 30) {
            $status = 'low'; // ≤ 30% available
        }

        return $this->success([
            'total_slots' => $totalSlots,
            'occupied_slots' => $occupiedSlots,
            'available_slots' => $availableSlots,
            'usage_percent' => $usagePercent,
            'available_percent' => $availablePercent,
            'status' => $status,
            'can_accept_pledge' => $availableSlots > 0,
            'message' => $this->getCapacityMessage($availableSlots, $status),
        ]);
    }

    /**
     * Get capacity message based on status
     */
    private function getCapacityMessage(int $availableSlots, string $status): string
    {
        if ($availableSlots === 0) {
            return 'Storage full! No slots available.';
        } elseif ($status === 'critical') {
            return "Only {$availableSlots} slots remaining. Urgently free up space!";
        } elseif ($status === 'warning') {
            return "{$availableSlots} slots remaining. Consider freeing up space soon.";
        } elseif ($status === 'low') {
            return "{$availableSlots} slots available. Monitor capacity.";
        } else {
            return "{$availableSlots} slots available.";
        }
    }
}

