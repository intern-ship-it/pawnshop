<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Auction;
use App\Models\AuctionItem;
use App\Models\Pledge;
use App\Models\PledgeItem;
use App\Models\Slot;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AuctionController extends Controller
{
    /**
     * List all auctions
     */
    public function index(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = Auction::where('branch_id', $branchId)
            ->withCount('items')
            ->with('createdBy:id,name');

        // Filter by status
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        $auctions = $query->orderBy('auction_date', 'desc')
            ->paginate($request->get('per_page', 15));

        return $this->paginated($auctions);
    }

    /**
     * Create auction
     */
    public function store(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $userId = $request->user()->id;

        $validated = $request->validate([
            'auction_date' => 'required|date|after_or_equal:today',
            'auction_time' => 'nullable|date_format:H:i',
            'location' => 'nullable|string|max:255',
        ]);

        // Generate auction number
        $auctionNo = sprintf('AUC-%s-%s-%04d',
            $request->user()->branch->code,
            date('Y'),
            Auction::where('branch_id', $branchId)->whereYear('created_at', date('Y'))->count() + 1
        );

        $auction = Auction::create([
            'branch_id' => $branchId,
            'auction_no' => $auctionNo,
            'auction_date' => $validated['auction_date'],
            'auction_time' => $validated['auction_time'] ?? null,
            'location' => $validated['location'] ?? null,
            'status' => 'scheduled',
            'created_by' => $userId,
        ]);

        return $this->success($auction, 'Auction created successfully', 201);
    }

    /**
     * Get auction details
     */
    public function show(Request $request, Auction $auction): JsonResponse
    {
        if ($auction->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $auction->load([
            'items.pledgeItem.pledge.customer:id,name',
            'items.pledgeItem.category',
            'items.pledgeItem.purity',
            'createdBy:id,name',
        ]);

        return $this->success($auction);
    }

    /**
     * Update auction
     */
    public function update(Request $request, Auction $auction): JsonResponse
    {
        if ($auction->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        if ($auction->status === 'completed') {
            return $this->error('Cannot modify completed auction', 422);
        }

        $validated = $request->validate([
            'auction_date' => 'sometimes|date',
            'auction_time' => 'nullable|date_format:H:i',
            'location' => 'nullable|string|max:255',
        ]);

        $auction->update($validated);

        return $this->success($auction, 'Auction updated successfully');
    }

    /**
     * Get auction items
     */
    public function items(Request $request, Auction $auction): JsonResponse
    {
        if ($auction->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $items = $auction->items()
            ->with(['pledgeItem.pledge.customer:id,name', 'pledgeItem.category', 'pledgeItem.purity'])
            ->orderBy('lot_number')
            ->get();

        return $this->success($items);
    }

    /**
     * Get eligible items for auction (forfeited pledges)
     */
    public function eligibleItems(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $today = Carbon::today();
        $graceDays = config('pawnsys.grace_period_days', 7);

        // Items from pledges that are overdue beyond grace period
        $items = PledgeItem::whereHas('pledge', function ($q) use ($branchId, $today, $graceDays) {
                $q->where('branch_id', $branchId)
                    ->where('status', 'active')
                    ->where('grace_end_date', '<', $today);
            })
            ->where('status', 'stored')
            ->whereDoesntHave('auctionItems', function ($q) {
                $q->whereIn('status', ['pending', 'sold']);
            })
            ->with(['pledge.customer:id,name,ic_number', 'category', 'purity'])
            ->get();

        return $this->success($items);
    }

    /**
     * Add items to auction
     */
    public function addItems(Request $request, Auction $auction): JsonResponse
    {
        if ($auction->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        if (!in_array($auction->status, ['scheduled'])) {
            return $this->error('Can only add items to scheduled auctions', 422);
        }

        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.pledge_item_id' => 'required|exists:pledge_items,id',
            'items.*.reserve_price' => 'required|numeric|min:0',
        ]);

        $branchId = $request->user()->branch_id;
        $added = 0;
        $errors = [];

        DB::beginTransaction();

        try {
            // Get current max lot number
            $maxLot = $auction->items()->max('lot_number') ?? 0;

            foreach ($validated['items'] as $itemData) {
                $pledgeItem = PledgeItem::find($itemData['pledge_item_id']);

                // Verify branch
                if ($pledgeItem->pledge->branch_id !== $branchId) {
                    $errors[] = "Item {$pledgeItem->barcode}: unauthorized";
                    continue;
                }

                // Check if already in another auction
                $existingAuction = AuctionItem::where('pledge_item_id', $pledgeItem->id)
                    ->whereIn('status', ['pending', 'sold'])
                    ->exists();

                if ($existingAuction) {
                    $errors[] = "Item {$pledgeItem->barcode}: already in auction";
                    continue;
                }

                $maxLot++;

                AuctionItem::create([
                    'auction_id' => $auction->id,
                    'pledge_item_id' => $pledgeItem->id,
                    'lot_number' => $maxLot,
                    'reserve_price' => $itemData['reserve_price'],
                    'status' => 'pending',
                ]);

                $added++;
            }

            // Update auction totals
            $auction->update([
                'total_items' => $auction->items()->count(),
                'total_reserve_price' => $auction->items()->sum('reserve_price'),
            ]);

            DB::commit();

            return $this->success([
                'added' => $added,
                'errors' => $errors,
            ], "$added items added to auction");

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to add items: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Remove item from auction
     */
    public function removeItem(Request $request, Auction $auction, AuctionItem $auctionItem): JsonResponse
    {
        if ($auction->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        if ($auctionItem->auction_id !== $auction->id) {
            return $this->error('Item does not belong to this auction', 422);
        }

        if ($auctionItem->status !== 'pending') {
            return $this->error('Can only remove pending items', 422);
        }

        $auctionItem->delete();

        // Update auction totals
        $auction->update([
            'total_items' => $auction->items()->count(),
            'total_reserve_price' => $auction->items()->sum('reserve_price'),
        ]);

        return $this->success(null, 'Item removed from auction');
    }

    /**
     * Sell item at auction
     */
    public function sellItem(Request $request, Auction $auction, AuctionItem $auctionItem): JsonResponse
    {
        if ($auction->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        if ($auctionItem->auction_id !== $auction->id) {
            return $this->error('Item does not belong to this auction', 422);
        }

        if ($auctionItem->status !== 'pending') {
            return $this->error('Item already processed', 422);
        }

        $validated = $request->validate([
            'sold_price' => 'required|numeric|min:0',
            'buyer_name' => 'required|string|max:100',
            'buyer_ic' => 'required|string|max:20',
            'buyer_phone' => 'nullable|string|max:20',
        ]);

        DB::beginTransaction();

        try {
            $auctionItem->update([
                'sold_price' => $validated['sold_price'],
                'buyer_name' => $validated['buyer_name'],
                'buyer_ic' => $validated['buyer_ic'],
                'buyer_phone' => $validated['buyer_phone'] ?? null,
                'status' => 'sold',
                'sold_at' => now(),
            ]);

            // Update pledge item status
            $pledgeItem = $auctionItem->pledgeItem;
            
            // Release slot
            if ($pledgeItem->slot_id) {
                Slot::where('id', $pledgeItem->slot_id)->update([
                    'is_occupied' => false,
                    'current_item_id' => null,
                    'occupied_at' => null,
                ]);
            }

            $pledgeItem->update([
                'status' => 'auctioned',
                'released_at' => now(),
            ]);

            // Update auction totals
            $auction->update([
                'total_sold' => $auction->items()->where('status', 'sold')->count(),
                'total_sold_amount' => $auction->items()->where('status', 'sold')->sum('sold_price'),
            ]);

            // Check if all items from pledge are auctioned, then update pledge status
            $pledge = $pledgeItem->pledge;
            $remainingItems = $pledge->items()->where('status', 'stored')->count();
            
            if ($remainingItems === 0) {
                $pledge->update(['status' => 'auctioned']);
            }

            DB::commit();

            return $this->success($auctionItem->fresh(), 'Item sold successfully');

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to process sale: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Mark item as unsold
     */
    public function markUnsold(Request $request, Auction $auction, AuctionItem $auctionItem): JsonResponse
    {
        if ($auction->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        if ($auctionItem->auction_id !== $auction->id) {
            return $this->error('Item does not belong to this auction', 422);
        }

        if ($auctionItem->status !== 'pending') {
            return $this->error('Item already processed', 422);
        }

        $auctionItem->update(['status' => 'unsold']);

        // Update auction totals
        $auction->update([
            'total_unsold' => $auction->items()->where('status', 'unsold')->count(),
        ]);

        return $this->success(null, 'Item marked as unsold');
    }

    /**
     * Complete auction
     */
    public function complete(Request $request, Auction $auction): JsonResponse
    {
        if ($auction->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        if ($auction->status === 'completed') {
            return $this->error('Auction already completed', 422);
        }

        // Mark remaining pending items as unsold
        $auction->items()
            ->where('status', 'pending')
            ->update(['status' => 'unsold']);

        // Update totals
        $auction->update([
            'status' => 'completed',
            'total_sold' => $auction->items()->where('status', 'sold')->count(),
            'total_unsold' => $auction->items()->where('status', 'unsold')->count(),
            'total_sold_amount' => $auction->items()->where('status', 'sold')->sum('sold_price'),
        ]);

        return $this->success($auction->fresh(), 'Auction completed');
    }

    /**
     * Cancel auction
     */
    public function cancel(Request $request, Auction $auction): JsonResponse
    {
        if ($auction->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        if ($auction->status === 'completed') {
            return $this->error('Cannot cancel completed auction', 422);
        }

        // Check if any items sold
        if ($auction->items()->where('status', 'sold')->exists()) {
            return $this->error('Cannot cancel auction with sold items', 422);
        }

        // Withdraw all items
        $auction->items()->update(['status' => 'withdrawn']);

        $auction->update(['status' => 'cancelled']);

        return $this->success(null, 'Auction cancelled');
    }
}
