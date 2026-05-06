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
     * Get overdue pledges (3+ days overdue by default, eligible for auction/forfeit)
     */
    public function overduePledges(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $today = Carbon::today();
        $minDays = $request->get('min_days_overdue', 3);

        $query = Pledge::where('branch_id', $branchId)
            ->where('status', 'active')
            ->where('due_date', '<', $today->copy()->subDays($minDays - 1))
            ->with([
                'customer:id,name,ic_number,phone,country_code',
                'items.category',
                'items.purity',
                'items.vault',
                'items.box',
                'items.slot',
            ])
            ->withCount('items');

        // Search filter
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('pledge_no', 'like', "%{$search}%")
                  ->orWhere('receipt_no', 'like', "%{$search}%")
                  ->orWhereHas('customer', function ($cq) use ($search) {
                      $cq->where('name', 'like', "%{$search}%")
                        ->orWhere('ic_number', 'like', "%{$search}%");
                  });
            });
        }

        // Sort
        $sortBy = $request->get('sort_by', 'overdue-days');
        switch ($sortBy) {
            case 'amount-high':
                $query->orderBy('loan_amount', 'desc');
                break;
            case 'amount-low':
                $query->orderBy('loan_amount', 'asc');
                break;
            case 'newest':
                $query->orderBy('created_at', 'desc');
                break;
            default: // overdue-days
                $query->orderBy('due_date', 'asc');
                break;
        }

        $pledges = $query->get()->map(function ($pledge) use ($today) {
            $daysOverdue = $today->diffInDays(Carbon::parse($pledge->due_date));
            $pledge->days_overdue = $daysOverdue;
            $pledge->location_string = $this->buildLocationString($pledge);
            return $pledge;
        });

        return $this->success($pledges);
    }

    /**
     * Get forfeited pledges
     */
    public function forfeitedPledges(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = Pledge::where('branch_id', $branchId)
            ->where('status', 'forfeited')
            ->with([
                'customer:id,name,ic_number,phone,country_code',
                'items.category',
                'items.purity',
            ])
            ->withCount('items');

        // Search filter
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('pledge_no', 'like', "%{$search}%")
                  ->orWhere('receipt_no', 'like', "%{$search}%")
                  ->orWhereHas('customer', function ($cq) use ($search) {
                      $cq->where('name', 'like', "%{$search}%")
                        ->orWhere('ic_number', 'like', "%{$search}%");
                  });
            });
        }

        $sortBy = $request->get('sort_by', 'newest');
        switch ($sortBy) {
            case 'amount-high':
                $query->orderBy('loan_amount', 'desc');
                break;
            case 'amount-low':
                $query->orderBy('loan_amount', 'asc');
                break;
            default:
                $query->orderBy('forfeited_at', 'desc');
                break;
        }

        $pledges = $query->get();

        return $this->success($pledges);
    }

    /**
     * Get auctioned pledges (completed sales)
     */
    public function auctionedPledges(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = Pledge::where('branch_id', $branchId)
            ->where('status', 'auctioned')
            ->with([
                'customer:id,name,ic_number,phone,country_code',
                'items.category',
                'items.purity',
                'items.auctionItems' => function ($q) {
                    $q->where('status', 'sold')->with('auction');
                },
            ])
            ->withCount('items');

        // Search filter
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('pledge_no', 'like', "%{$search}%")
                  ->orWhere('receipt_no', 'like', "%{$search}%")
                  ->orWhereHas('customer', function ($cq) use ($search) {
                      $cq->where('name', 'like', "%{$search}%")
                        ->orWhere('ic_number', 'like', "%{$search}%");
                  });
            });
        }

        $sortBy = $request->get('sort_by', 'newest');
        switch ($sortBy) {
            case 'amount-high':
                $query->orderBy('loan_amount', 'desc');
                break;
            case 'amount-low':
                $query->orderBy('loan_amount', 'asc');
                break;
            default:
                $query->orderBy('updated_at', 'desc');
                break;
        }

        $pledges = $query->get();

        return $this->success($pledges);
    }

    /**
     * Get auction statistics
     */
    public function stats(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $today = Carbon::today();

        // Overdue 3+ days
        $overdueCount = Pledge::where('branch_id', $branchId)
            ->where('status', 'active')
            ->where('due_date', '<', $today->copy()->subDays(2))
            ->count();

        $overdueAmount = Pledge::where('branch_id', $branchId)
            ->where('status', 'active')
            ->where('due_date', '<', $today->copy()->subDays(2))
            ->sum('loan_amount');

        // Forfeited
        $forfeitedCount = Pledge::where('branch_id', $branchId)
            ->where('status', 'forfeited')
            ->count();

        $forfeitedValue = Pledge::where('branch_id', $branchId)
            ->where('status', 'forfeited')
            ->sum('net_value');

        // Auctioned
        $auctionedCount = Pledge::where('branch_id', $branchId)
            ->where('status', 'auctioned')
            ->count();

        $auctionedRevenue = AuctionItem::whereHas('pledgeItem.pledge', function ($q) use ($branchId) {
                $q->where('branch_id', $branchId);
            })
            ->where('status', 'sold')
            ->sum('sold_price');

        return $this->success([
            'overdue' => [
                'count' => $overdueCount,
                'amount' => (float) $overdueAmount,
            ],
            'forfeited' => [
                'count' => $forfeitedCount,
                'value' => (float) $forfeitedValue,
            ],
            'auctioned' => [
                'count' => $auctionedCount,
                'revenue' => (float) $auctionedRevenue,
            ],
        ]);
    }

    /**
     * Forfeit a pledge (change status to forfeited)
     */
    public function forfeitPledge(Request $request, Pledge $pledge): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        if ($pledge->branch_id !== $branchId) {
            return $this->error('Unauthorized', 403);
        }

        if ($pledge->status !== 'active') {
            return $this->error('Only active pledges can be forfeited', 422);
        }

        // Check if overdue
        if (Carbon::parse($pledge->due_date)->isFuture()) {
            return $this->error('Pledge is not yet overdue', 422);
        }

        DB::beginTransaction();

        try {
            $pledge->update([
                'status' => 'forfeited',
                'forfeited_at' => now(),
                'forfeited_by' => $request->user()->id,
            ]);

            // Note: pledge_items stay as 'stored' since they remain physically in storage
            // They will be updated to 'auctioned' when actually sold at auction

            DB::commit();

            return $this->success($pledge->fresh()->load(['customer:id,name', 'items']), 'Pledge forfeited successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to forfeit pledge: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Sell a forfeited pledge directly (quick auction sale)
     */
    public function sellForfeitedPledge(Request $request, Pledge $pledge): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        if ($pledge->branch_id !== $branchId) {
            return $this->error('Unauthorized', 403);
        }

        if ($pledge->status !== 'forfeited') {
            return $this->error('Only forfeited pledges can be auctioned', 422);
        }

        $validated = $request->validate([
            'sold_price' => 'required|numeric|min:0',
            'buyer_name' => 'required|string|max:100',
            'buyer_ic' => 'nullable|string|max:20',
            'buyer_phone' => 'nullable|string|max:20',
            'notes' => 'nullable|string|max:500',
        ]);

        DB::beginTransaction();

        try {
            // Update pledge status
            $pledge->update([
                'status' => 'auctioned',
            ]);

            // Update all pledge items to auctioned and release storage
            foreach ($pledge->items as $item) {
                // Release slot
                if ($item->slot_id) {
                    Slot::where('id', $item->slot_id)->update([
                        'is_occupied' => false,
                        'current_item_id' => null,
                        'occupied_at' => null,
                    ]);
                }

                $item->update([
                    'status' => 'auctioned',
                    'released_at' => now(),
                ]);
            }

            DB::commit();

            return $this->success([
                'pledge' => $pledge->fresh()->load(['customer:id,name', 'items']),
                'sale' => [
                    'sold_price' => (float) $validated['sold_price'],
                    'buyer_name' => $validated['buyer_name'],
                    'buyer_ic' => $validated['buyer_ic'] ?? null,
                    'buyer_phone' => $validated['buyer_phone'] ?? null,
                    'notes' => $validated['notes'] ?? null,
                    'sold_at' => now()->toISOString(),
                ],
            ], 'Pledge auctioned successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to process auction sale: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Build location string for a pledge
     */
    private function buildLocationString(Pledge $pledge): string
    {
        $locations = [];
        foreach ($pledge->items as $item) {
            $parts = [];
            if ($item->vault) $parts[] = $item->vault->name;
            if ($item->box) $parts[] = $item->box->name;
            if ($item->slot) $parts[] = $item->slot->name;
            if (!empty($parts)) {
                $locations[] = implode('-', $parts);
            }
        }
        return implode(', ', array_unique($locations));
    }


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
