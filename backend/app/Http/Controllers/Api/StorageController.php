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
            $slotsPerBox = 20; // Fixed 20 slots per box

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
                    'name' => 'Box ' . $boxNum,
                    'total_slots' => $slotsPerBox,
                ]);

                // Create 20 slots per box
                for ($slotNum = 1; $slotNum <= $slotsPerBox; $slotNum++) {
                    Slot::create([
                        'box_id' => $box->id,
                        'slot_number' => $slotNum,
                    ]);
                }
            }

            DB::commit();

            return $this->success(
                $vault->load('boxes'),
                'Vault created successfully with ' . $numberOfBoxes . ' boxes',
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
            'box_number' => 'nullable|integer|min:1',
            'name' => 'nullable|string|max:50',
            'total_slots' => 'required|integer|min:1|max:100',
            'description' => 'nullable|string|max:255',
        ]);

        $vault = Vault::find($validated['vault_id']);

        if ($vault->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        // Auto-generate box_number if not provided
        if (empty($validated['box_number'])) {
            $lastBox = Box::where('vault_id', $validated['vault_id'])
                ->orderBy('box_number', 'desc')
                ->first();

            $validated['box_number'] = $lastBox ? ($lastBox->box_number + 1) : 1;
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
            $box = Box::create([
                'vault_id' => $validated['vault_id'],
                'box_number' => $validated['box_number'],
                'name' => $validated['name'] ?? ('Box ' . $validated['box_number']),
                'total_slots' => $validated['total_slots'],
                'description' => $validated['description'] ?? null,
            ]);

            // Create slots
            for ($i = 1; $i <= $validated['total_slots']; $i++) {
                Slot::create([
                    'box_id' => $box->id,
                    'slot_number' => $i,
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

        $slots = $box->slots()
            ->with(['currentItem.pledge.customer:id,name'])
            ->orderBy('slot_number')
            ->get();

        return $this->success($slots);
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

        return $this->success([
            'slot' => $slot,
            'location_string' => sprintf(
                '%s / Box %d / Slot %d',
                $slot->box->vault->name,
                $slot->box->box_number,
                $slot->slot_number
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
}
