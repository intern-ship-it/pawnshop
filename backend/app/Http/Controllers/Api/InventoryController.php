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
     * 
     * ISSUE 2 FIX: Support both item_status and pledge_status filters
     */
    public function index(Request $request): JsonResponse
    {
        // Server-side pagination: only the rows on the current page are loaded
        // and serialized, so we never pull the whole table into memory.
        // Relations select only the columns the list/labels actually use.
        // Restrict only the large relations (pledge + customer) to the columns the
        // list/labels use. The small lookup tables (category, purity, vault, box,
        // slot) are loaded in full because the frontend/model rely on accessors
        // and the per-row cost is negligible. Pagination is what bounds the payload.
        // Exclude the heavy `photo` column (base64 image, ~110KB/row) which the
        // list/labels never use — it dominates the payload otherwise.
        $itemColumns = array_values(array_diff(
            \Illuminate\Support\Facades\Schema::getColumnListing('pledge_items'),
            ['photo']
        ));

        $query = PledgeItem::select($itemColumns)->with([
            'pledge:id,pledge_no,receipt_no,customer_id,status',
            'pledge.customer:id,name,ic_number',
            'category',
            'purity',
            'vault',
            'box',
            'slot',
        ]);

        // ISSUE 2 FIX: Filter by item status (stored/released)
        if ($status = $request->get('status')) {
            if ($status === 'all') {
                // No filter - show all items
            } elseif ($status === 'in_storage' || $status === 'stored') {
                // In Storage = item status is 'stored' (or null for legacy data)
                $query->where(function ($q) {
                    $q->where('status', 'stored')
                        ->orWhereNull('status');
                });
            } elseif ($status === 'released' || $status === 'redeemed') {
                // Released = item has been released/redeemed
                $query->where('status', 'released');
            } else {
                // Direct status match
                $query->where('status', $status);
            }
        } else {
            // Default: only stored items (items still in storage)
            $query->where(function ($q) {
                $q->where('status', 'stored')
                    ->orWhereNull('status');
            });
        }

        // ISSUE 2 FIX: Filter by pledge status (active/overdue/redeemed)
        if ($pledgeStatus = $request->get('pledge_status')) {
            $query->whereHas('pledge', function ($q) use ($pledgeStatus) {
                if ($pledgeStatus === 'active') {
                    $q->whereIn('status', ['active', 'overdue']);
                } else {
                    $q->where('status', $pledgeStatus);
                }
            });
        }

        // Filter by category (accepts id or name for client compatibility)
        if ($categoryId = $request->get('category_id')) {
            $query->where('category_id', $categoryId);
        }
        if ($category = $request->get('category')) {
            $query->whereHas('category', function ($q) use ($category) {
                $q->where('name_en', $category)->orWhere('code', $category);
            });
        }

        // Filter by purity (accepts id or code, e.g. "916")
        if ($purityId = $request->get('purity_id')) {
            $query->where('purity_id', $purityId);
        }
        if ($purity = $request->get('purity')) {
            $query->whereHas('purity', function ($q) use ($purity) {
                $q->where('code', $purity)->orWhere('name', $purity);
            });
        }

        // Filter unassigned (no slot)
        if ($request->get('location') === 'unassigned') {
            $query->whereNull('slot_id');
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
                    })
                    ->orWhereHas('pledge.customer', function ($cq) use ($search) {
                        $cq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        // Cap page size so a single request can never pull the whole table.
        $perPage = min(max((int) $request->get('per_page', 20), 1), 100);

        $items = $query->orderBy('created_at', 'desc')
            ->paginate($perPage);

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
            ->where(function ($q) {
                $q->where('status', 'stored')->orWhereNull('status');
            })
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

        // Only allow location update for stored items
        if ($pledgeItem->status === 'released') {
            return $this->error('Cannot move released items', 422);
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
            $newSlot = Slot::find($validated['slot_id']);
            
            // Allow multiple items in the same slot (no validation check for is_occupied)

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
                'status' => 'stored', // Ensure status is stored
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

                // Verify status - only move stored items
                if ($item->status === 'released') {
                    $errors[] = "Item {$item->barcode}: already released";
                    continue;
                }

                $newSlot = Slot::find($itemData['slot_id']);
                // Allow multiple items in the same slot (no validation check or auto-spill)

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
                    'status' => 'stored',
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
     * 
     * ISSUE 2 FIX: Return proper counts for all statuses
     */
    public function summary(Request $request): JsonResponse
    {
        // All counts/sums are computed in SQL — we never load the table into PHP.

        // "Stored" = status 'stored' or NULL (legacy). Reused below.
        // Column is qualified because this scope is also used after a JOIN to
        // `pledges` (which also has a `status` column), where a bare `status`
        // would be ambiguous.
        $storedScope = function ($q) {
            $q->where('pledge_items.status', 'stored')
                ->orWhereNull('pledge_items.status');
        };

        // One aggregate row for the stored totals (COUNT/SUM in the DB).
        $stored = PledgeItem::where($storedScope)
            ->selectRaw('COUNT(*) as cnt')
            ->selectRaw('COALESCE(SUM(net_weight), 0) as net_weight')
            ->selectRaw('COALESCE(SUM(net_value), 0) as net_value')
            ->selectRaw('COALESCE(SUM(gross_value), 0) as gross_value')
            ->selectRaw('COALESCE(SUM(slot_id IS NULL), 0) as unassigned')
            ->first();

        $totalItems = PledgeItem::count();
        $releasedCount = PledgeItem::where('status', 'released')->count();

        // Pledge-status counts for stored items, grouped in SQL.
        $pledgeStatusCounts = PledgeItem::where($storedScope)
            ->join('pledges', 'pledge_items.pledge_id', '=', 'pledges.id')
            ->groupBy('pledges.status')
            ->selectRaw('pledges.status as status, COUNT(*) as cnt')
            ->pluck('cnt', 'status');

        // Per-category and per-purity breakdowns, grouped in SQL.
        $byCategory = PledgeItem::where($storedScope)
            ->groupBy('category_id')
            ->selectRaw('category_id, COUNT(*) as count')
            ->selectRaw('COALESCE(SUM(net_weight), 0) as weight')
            ->selectRaw('COALESCE(SUM(net_value), 0) as value')
            ->selectRaw('COALESCE(SUM(gross_value), 0) as gross_value')
            ->get()->keyBy('category_id')->map(fn($g) => [
                'count' => (int) $g->count,
                'weight' => round((float) $g->weight, 3),
                'value' => round((float) $g->value, 2),
                'gross_value' => round((float) $g->gross_value, 2),
            ]);

        $byPurity = PledgeItem::where($storedScope)
            ->groupBy('purity_id')
            ->selectRaw('purity_id, COUNT(*) as count')
            ->selectRaw('COALESCE(SUM(net_weight), 0) as weight')
            ->selectRaw('COALESCE(SUM(net_value), 0) as value')
            ->selectRaw('COALESCE(SUM(gross_value), 0) as gross_value')
            ->get()->keyBy('purity_id')->map(fn($g) => [
                'count' => (int) $g->count,
                'weight' => round((float) $g->weight, 3),
                'value' => round((float) $g->value, 2),
                'gross_value' => round((float) $g->gross_value, 2),
            ]);

        $summary = [
            'total_items' => $totalItems,

            'in_storage' => (int) $stored->cnt,
            'released' => $releasedCount,

            'active_count' => (int) ($pledgeStatusCounts['active'] ?? 0),
            'overdue_count' => (int) ($pledgeStatusCounts['overdue'] ?? 0),

            'total_weight' => round((float) $stored->net_weight, 3),
            'total_value' => round((float) $stored->net_value, 2),
            'total_gross_value' => round((float) $stored->gross_value, 2),

            'by_category' => $byCategory,
            'by_purity' => $byPurity,

            'unassigned' => (int) $stored->unassigned,
        ];

        return $this->success($summary);
    }
}