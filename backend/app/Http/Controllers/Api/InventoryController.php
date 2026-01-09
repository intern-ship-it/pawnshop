<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PledgeItem;
use App\Models\ItemLocationHistory;
use App\Models\Slot;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class InventoryController extends Controller
{
    /**
     * List all inventory items
     */
    public function index(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = PledgeItem::whereHas('pledge', function ($q) use ($branchId) {
            $q->where('branch_id', $branchId);
        })
            ->with(['pledge.customer:id,name,ic_number', 'category', 'purity', 'vault', 'box', 'slot']);

        // Filter by status
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        } else {
            // Default: only stored items
            $query->where('status', 'stored');
        }

        // Filter by category
        if ($categoryId = $request->get('category_id')) {
            $query->where('category_id', $categoryId);
        }

        // Filter by purity
        if ($purityId = $request->get('purity_id')) {
            $query->where('purity_id', $purityId);
        }

        // Filter by vault
        if ($vaultId = $request->get('vault_id')) {
            $query->where('vault_id', $vaultId);
        }

        // Search by barcode or pledge number
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('barcode', 'like', "%{$search}%")
                    ->orWhere('item_no', 'like', "%{$search}%")
                    ->orWhereHas('pledge', function ($pq) use ($search) {
                        $pq->where('pledge_no', 'like', "%{$search}%")
                            ->orWhere('receipt_no', 'like', "%{$search}%");
                    });
            });
        }

        $items = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 20));

        return $this->paginated($items);
    }

    /**
     * Get item details
     */
    public function show(Request $request, $id): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $pledgeItem = PledgeItem::with([
            'pledge.customer',
            'category',
            'purity',
            'vault',
            'box',
            'slot',
            'locationHistory.performedBy:id,name',
        ])
            ->whereHas('pledge', function ($q) use ($branchId) {
                $q->where('branch_id', $branchId);
            })
            ->find($id);

        if (!$pledgeItem) {
            return $this->error('Item not found', 404);
        }

        return $this->success($pledgeItem);
    }

    /**
     * Get items by location
     */
    public function byLocation(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $validated = $request->validate([
            'vault_id' => 'required|exists:vaults,id',
            'box_id' => 'nullable|exists:boxes,id',
            'slot_id' => 'nullable|exists:slots,id',
        ]);

        $query = PledgeItem::whereHas('pledge', function ($q) use ($branchId) {
            $q->where('branch_id', $branchId);
        })
            ->where('status', 'stored')
            ->where('vault_id', $validated['vault_id']);

        if (isset($validated['box_id'])) {
            $query->where('box_id', $validated['box_id']);
        }

        if (isset($validated['slot_id'])) {
            $query->where('slot_id', $validated['slot_id']);
        }

        $items = $query->with(['pledge.customer:id,name', 'category', 'purity', 'box', 'slot'])
            ->get();

        return $this->success($items);
    }

    /**
     * Search item by barcode
     */
    public function search(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $validated = $request->validate([
            'barcode' => 'required|string',
        ]);

        $item = PledgeItem::whereHas('pledge', function ($q) use ($branchId) {
            $q->where('branch_id', $branchId);
        })
            ->where('barcode', $validated['barcode'])
            ->with(['pledge.customer', 'category', 'purity', 'vault', 'box', 'slot'])
            ->first();

        if (!$item) {
            return $this->error('Item not found', 404);
        }

        return $this->success($item);
    }

    /**
     * Update item location
     */
    public function updateLocation(Request $request, PledgeItem $pledgeItem): JsonResponse
    {
        if ($pledgeItem->pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        if ($pledgeItem->status !== 'stored') {
            return $this->error('Can only move stored items', 422);
        }

        $validated = $request->validate([
            'vault_id' => 'required|exists:vaults,id',
            'box_id' => 'required|exists:boxes,id',
            'slot_id' => 'required|exists:slots,id',
            'reason' => 'nullable|string|max:255',
        ]);

        $userId = $request->user()->id;

        DB::beginTransaction();

        try {
            // Check if new slot is available
            $newSlot = Slot::find($validated['slot_id']);
            if ($newSlot->is_occupied && $newSlot->current_item_id !== $pledgeItem->id) {
                return $this->error('Selected slot is already occupied', 422);
            }

            $oldSlotId = $pledgeItem->slot_id;

            // Release old slot
            if ($oldSlotId) {
                Slot::where('id', $oldSlotId)->update([
                    'is_occupied' => false,
                    'current_item_id' => null,
                    'occupied_at' => null,
                ]);
            }

            // Update item location
            $pledgeItem->update([
                'vault_id' => $validated['vault_id'],
                'box_id' => $validated['box_id'],
                'slot_id' => $validated['slot_id'],
                'location_assigned_at' => now(),
                'location_assigned_by' => $userId,
            ]);

            // Occupy new slot
            $newSlot->update([
                'is_occupied' => true,
                'current_item_id' => $pledgeItem->id,
                'occupied_at' => now(),
            ]);

            // Record history
            ItemLocationHistory::create([
                'pledge_item_id' => $pledgeItem->id,
                'action' => 'moved',
                'from_slot_id' => $oldSlotId,
                'to_slot_id' => $validated['slot_id'],
                'reason' => $validated['reason'] ?? null,
                'performed_by' => $userId,
                'performed_at' => now(),
            ]);

            DB::commit();

            $pledgeItem->load(['vault', 'box', 'slot']);

            return $this->success($pledgeItem, 'Item location updated');

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to update location: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get item location history
     */
    public function locationHistory(Request $request, PledgeItem $pledgeItem): JsonResponse
    {
        if ($pledgeItem->pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $history = $pledgeItem->locationHistory()
            ->with(['fromSlot.box.vault', 'toSlot.box.vault', 'performedBy:id,name'])
            ->orderBy('performed_at', 'desc')
            ->get();

        return $this->success($history);
    }

    /**
     * Bulk update locations (for reorganization)
     */
    public function bulkUpdateLocation(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.item_id' => 'required|exists:pledge_items,id',
            'items.*.vault_id' => 'required|exists:vaults,id',
            'items.*.box_id' => 'required|exists:boxes,id',
            'items.*.slot_id' => 'required|exists:slots,id',
            'reason' => 'nullable|string|max:255',
        ]);

        $branchId = $request->user()->branch_id;
        $userId = $request->user()->id;
        $reason = $validated['reason'] ?? 'Bulk reorganization';

        $updated = 0;
        $errors = [];

        DB::beginTransaction();

        try {
            foreach ($validated['items'] as $itemData) {
                $item = PledgeItem::find($itemData['item_id']);

                // Verify branch
                if ($item->pledge->branch_id !== $branchId) {
                    $errors[] = "Item {$item->barcode}: unauthorized";
                    continue;
                }

                // Verify status
                if ($item->status !== 'stored') {
                    $errors[] = "Item {$item->barcode}: not stored";
                    continue;
                }

                // Check slot availability
                $newSlot = Slot::find($itemData['slot_id']);
                if ($newSlot->is_occupied && $newSlot->current_item_id !== $item->id) {
                    $errors[] = "Item {$item->barcode}: slot occupied";
                    continue;
                }

                $oldSlotId = $item->slot_id;

                // Release old slot
                if ($oldSlotId) {
                    Slot::where('id', $oldSlotId)->update([
                        'is_occupied' => false,
                        'current_item_id' => null,
                        'occupied_at' => null,
                    ]);
                }

                // Update item
                $item->update([
                    'vault_id' => $itemData['vault_id'],
                    'box_id' => $itemData['box_id'],
                    'slot_id' => $itemData['slot_id'],
                    'location_assigned_at' => now(),
                    'location_assigned_by' => $userId,
                ]);

                // Occupy new slot
                $newSlot->update([
                    'is_occupied' => true,
                    'current_item_id' => $item->id,
                    'occupied_at' => now(),
                ]);

                // Record history
                ItemLocationHistory::create([
                    'pledge_item_id' => $item->id,
                    'action' => 'moved',
                    'from_slot_id' => $oldSlotId,
                    'to_slot_id' => $itemData['slot_id'],
                    'reason' => $reason,
                    'performed_by' => $userId,
                    'performed_at' => now(),
                ]);

                $updated++;
            }

            DB::commit();

            return $this->success([
                'updated' => $updated,
                'errors' => $errors,
            ], "Updated $updated items");

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Bulk update failed: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get inventory summary
     */
    public function summary(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $items = PledgeItem::whereHas('pledge', function ($q) use ($branchId) {
            $q->where('branch_id', $branchId)->where('status', 'active');
        })
            ->where('status', 'stored')
            ->get();

        $summary = [
            'total_items' => $items->count(),
            'total_weight' => round($items->sum('net_weight'), 3),
            'total_value' => round($items->sum('net_value'), 2),
            'by_category' => $items->groupBy('category_id')->map(fn($g) => [
                'count' => $g->count(),
                'weight' => round($g->sum('net_weight'), 3),
                'value' => round($g->sum('net_value'), 2),
            ]),
            'by_purity' => $items->groupBy('purity_id')->map(fn($g) => [
                'count' => $g->count(),
                'weight' => round($g->sum('net_weight'), 3),
                'value' => round($g->sum('net_value'), 2),
            ]),
            'unassigned' => $items->whereNull('slot_id')->count(),
        ];

        return $this->success($summary);
    }
}
