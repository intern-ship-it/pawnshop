<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pledge;
use App\Models\Renewal;
use App\Models\Redemption;
use App\Models\Customer;
use App\Models\GoldPrice;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;

class DashboardController extends Controller
{
    /**
     * Get dashboard summary
     */
    public function summary(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $today = Carbon::today();

        // Today's stats
        $todayPledges = Pledge::where('branch_id', $branchId)
            ->whereDate('created_at', $today)
            ->selectRaw('COUNT(*) as count, COALESCE(SUM(loan_amount), 0) as total')
            ->first();

        $todayRenewals = Renewal::where('branch_id', $branchId)
            ->whereDate('created_at', $today)
            ->selectRaw('COUNT(*) as count, COALESCE(SUM(total_payable), 0) as total')
            ->first();

        $todayRedemptions = Redemption::where('branch_id', $branchId)
            ->whereDate('created_at', $today)
            ->selectRaw('COUNT(*) as count, COALESCE(SUM(total_payable), 0) as total')
            ->first();

        // Active pledges
        $activePledges = Pledge::where('branch_id', $branchId)
            ->where('status', 'active')
            ->count();

        // Overdue pledges
        $overduePledges = Pledge::where('branch_id', $branchId)
            ->where('status', 'active')
            ->where('due_date', '<', $today)
            ->count();

        // Total customers
        $totalCustomers = Customer::where('branch_id', $branchId)->count();

        return $this->success([
            'today' => [
                'pledges' => [
                    'count' => $todayPledges->count,
                    'total' => (float) $todayPledges->total,
                ],
                'renewals' => [
                    'count' => $todayRenewals->count,
                    'total' => (float) $todayRenewals->total,
                ],
                'redemptions' => [
                    'count' => $todayRedemptions->count,
                    'total' => (float) $todayRedemptions->total,
                ],
            ],
            'active_pledges' => $activePledges,
            'overdue_pledges' => $overduePledges,
            'total_customers' => $totalCustomers,
        ]);
    }

    /**
     * Get today's statistics with payment split
     */
    public function todayStats(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $today = Carbon::today();

        // Pledges with payment split
        $pledges = Pledge::where('branch_id', $branchId)
            ->whereDate('created_at', $today)
            ->with('payments')
            ->get();

        $pledgeStats = [
            'count' => $pledges->count(),
            'total' => $pledges->sum('loan_amount'),
            'cash' => $pledges->sum(fn($p) => $p->payments->sum('cash_amount')),
            'transfer' => $pledges->sum(fn($p) => $p->payments->sum('transfer_amount')),
        ];

        // Renewals with payment split
        $renewals = Renewal::where('branch_id', $branchId)
            ->whereDate('created_at', $today)
            ->get();

        $renewalStats = [
            'count' => $renewals->count(),
            'total' => $renewals->sum('total_payable'),
            'cash' => $renewals->sum('cash_amount'),
            'transfer' => $renewals->sum('transfer_amount'),
        ];

        // Redemptions with payment split
        $redemptions = Redemption::where('branch_id', $branchId)
            ->whereDate('created_at', $today)
            ->get();

        $redemptionStats = [
            'count' => $redemptions->count(),
            'total' => $redemptions->sum('total_payable'),
            'cash' => $redemptions->sum('cash_amount'),
            'transfer' => $redemptions->sum('transfer_amount'),
        ];

        return $this->success([
            'pledges' => $pledgeStats,
            'renewals' => $renewalStats,
            'redemptions' => $redemptionStats,
            'totals' => [
                'cash' => $pledgeStats['cash'] + $renewalStats['cash'] + $redemptionStats['cash'],
                'transfer' => $pledgeStats['transfer'] + $renewalStats['transfer'] + $redemptionStats['transfer'],
            ],
        ]);
    }

    /**
     * Get payment split report
     */
    public function paymentSplit(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $date = $request->get('date', Carbon::today()->toDateString());

        $pledgePayments = Pledge::where('branch_id', $branchId)
            ->whereDate('created_at', $date)
            ->with('payments')
            ->get();

        $renewalPayments = Renewal::where('branch_id', $branchId)
            ->whereDate('created_at', $date)
            ->get();

        $redemptionPayments = Redemption::where('branch_id', $branchId)
            ->whereDate('created_at', $date)
            ->get();

        return $this->success([
            'date' => $date,
            'pledges' => [
                'cash' => $pledgePayments->sum(fn($p) => $p->payments->sum('cash_amount')),
                'transfer' => $pledgePayments->sum(fn($p) => $p->payments->sum('transfer_amount')),
            ],
            'renewals' => [
                'cash' => $renewalPayments->sum('cash_amount'),
                'transfer' => $renewalPayments->sum('transfer_amount'),
            ],
            'redemptions' => [
                'cash' => $redemptionPayments->sum('cash_amount'),
                'transfer' => $redemptionPayments->sum('transfer_amount'),
            ],
        ]);
    }

    /**
     * Get due date reminders
     */
    public function dueReminders(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $today = Carbon::today();

        // Due in 7 days
        $dueIn7Days = Pledge::where('branch_id', $branchId)
            ->where('status', 'active')
            ->whereBetween('due_date', [$today, $today->copy()->addDays(7)])
            ->with(['customer:id,name,phone', 'items:id,pledge_id,category_id'])
            ->orderBy('due_date')
            ->limit(20)
            ->get(['id', 'pledge_no', 'receipt_no', 'customer_id', 'loan_amount', 'due_date']);

        // Due in 3 days
        $dueIn3Days = Pledge::where('branch_id', $branchId)
            ->where('status', 'active')
            ->whereBetween('due_date', [$today, $today->copy()->addDays(3)])
            ->count();

        // Due tomorrow
        $dueTomorrow = Pledge::where('branch_id', $branchId)
            ->where('status', 'active')
            ->whereDate('due_date', $today->copy()->addDay())
            ->count();

        return $this->success([
            'due_in_7_days' => $dueIn7Days,
            'counts' => [
                'due_in_3_days' => $dueIn3Days,
                'due_tomorrow' => $dueTomorrow,
            ],
        ]);
    }

    /**
     * Get overdue pledges
     */
    public function overduePledges(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $today = Carbon::today();

        $overdue = Pledge::where('branch_id', $branchId)
            ->where('status', 'active')
            ->where('due_date', '<', $today)
            ->with(['customer:id,name,phone'])
            ->orderBy('due_date')
            ->paginate($request->get('per_page', 15));

        return $this->paginated($overdue);
    }

    /**
     * Get current gold prices
     */
    public function goldPrices(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $prices = GoldPrice::where(function ($query) use ($branchId) {
                $query->where('branch_id', $branchId)
                    ->orWhereNull('branch_id');
            })
            ->orderBy('price_date', 'desc')
            ->first();

        if (!$prices) {
            return $this->success([
                'price_date' => null,
                'prices' => [],
            ]);
        }

        return $this->success([
            'price_date' => $prices->price_date->toDateString(),
            'prices' => [
                '999' => (float) $prices->price_999,
                '916' => (float) $prices->price_916,
                '875' => (float) $prices->price_875,
                '750' => (float) $prices->price_750,
                '585' => (float) $prices->price_585,
                '375' => (float) $prices->price_375,
            ],
            'source' => $prices->source,
        ]);
    }
}
