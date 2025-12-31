<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pledge;
use App\Models\Renewal;
use App\Models\Redemption;
use App\Models\Customer;
use App\Models\PledgeItem;
use App\Models\PledgeReceipt;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Pledges Report
     */
    public function pledges(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        
        $query = Pledge::where('branch_id', $branchId)
            ->with(['customer:id,name,ic_number,phone', 'items:id,pledge_id,category_id,net_weight,net_value', 'createdBy:id,name']);

        // Date filters
        if ($from = $request->get('from_date')) {
            $query->whereDate('pledge_date', '>=', $from);
        }
        if ($to = $request->get('to_date')) {
            $query->whereDate('pledge_date', '<=', $to);
        }

        // Status filter
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        $pledges = $query->orderBy('pledge_date', 'desc')->get();

        // Summary
        $summary = [
            'total_count' => $pledges->count(),
            'total_loan_amount' => $pledges->sum('loan_amount'),
            'total_items' => $pledges->sum(fn($p) => $p->items->count()),
            'total_weight' => $pledges->sum('total_weight'),
            'by_status' => $pledges->groupBy('status')->map->count(),
        ];

        return $this->success([
            'pledges' => $pledges,
            'summary' => $summary,
        ]);
    }

    /**
     * Renewals Report
     */
    public function renewals(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = Renewal::where('branch_id', $branchId)
            ->with(['pledge.customer:id,name,ic_number', 'createdBy:id,name']);

        // Date filters
        if ($from = $request->get('from_date')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->get('to_date')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $renewals = $query->orderBy('created_at', 'desc')->get();

        $summary = [
            'total_count' => $renewals->count(),
            'total_interest' => $renewals->sum('interest_amount'),
            'total_collected' => $renewals->sum('total_payable'),
            'cash_collected' => $renewals->sum('cash_amount'),
            'transfer_collected' => $renewals->sum('transfer_amount'),
        ];

        return $this->success([
            'renewals' => $renewals,
            'summary' => $summary,
        ]);
    }

    /**
     * Redemptions Report
     */
    public function redemptions(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = Redemption::where('branch_id', $branchId)
            ->with(['pledge.customer:id,name,ic_number', 'createdBy:id,name']);

        // Date filters
        if ($from = $request->get('from_date')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->get('to_date')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $redemptions = $query->orderBy('created_at', 'desc')->get();

        $summary = [
            'total_count' => $redemptions->count(),
            'total_principal' => $redemptions->sum('principal_amount'),
            'total_interest' => $redemptions->sum('interest_amount'),
            'total_collected' => $redemptions->sum('total_payable'),
            'cash_collected' => $redemptions->sum('cash_amount'),
            'transfer_collected' => $redemptions->sum('transfer_amount'),
        ];

        return $this->success([
            'redemptions' => $redemptions,
            'summary' => $summary,
        ]);
    }

    /**
     * Outstanding Pledges Report
     */
    public function outstanding(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $pledges = Pledge::where('branch_id', $branchId)
            ->where('status', 'active')
            ->with(['customer:id,name,ic_number,phone', 'items.category'])
            ->orderBy('due_date')
            ->get();

        // Calculate current interest for each
        $pledges->each(function ($pledge) {
            $pledge->current_interest = $pledge->current_interest_amount;
            $pledge->total_outstanding = $pledge->loan_amount + $pledge->current_interest;
        });

        $summary = [
            'total_pledges' => $pledges->count(),
            'total_principal' => $pledges->sum('loan_amount'),
            'total_interest' => $pledges->sum('current_interest'),
            'total_outstanding' => $pledges->sum('total_outstanding'),
        ];

        return $this->success([
            'pledges' => $pledges,
            'summary' => $summary,
        ]);
    }

    /**
     * Overdue Pledges Report
     */
    public function overdue(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $today = Carbon::today();

        $pledges = Pledge::where('branch_id', $branchId)
            ->where('status', 'active')
            ->where('due_date', '<', $today)
            ->with(['customer:id,name,ic_number,phone', 'items.category'])
            ->orderBy('due_date')
            ->get();

        // Add days overdue
        $pledges->each(function ($pledge) use ($today) {
            $pledge->days_overdue_calc = $today->diffInDays($pledge->due_date);
            $pledge->current_interest = $pledge->current_interest_amount;
        });

        // Group by overdue period
        $byPeriod = [
            '1_7_days' => $pledges->filter(fn($p) => $p->days_overdue_calc >= 1 && $p->days_overdue_calc <= 7)->count(),
            '8_14_days' => $pledges->filter(fn($p) => $p->days_overdue_calc >= 8 && $p->days_overdue_calc <= 14)->count(),
            '15_30_days' => $pledges->filter(fn($p) => $p->days_overdue_calc >= 15 && $p->days_overdue_calc <= 30)->count(),
            'over_30_days' => $pledges->filter(fn($p) => $p->days_overdue_calc > 30)->count(),
        ];

        $summary = [
            'total_overdue' => $pledges->count(),
            'total_amount' => $pledges->sum('loan_amount'),
            'by_period' => $byPeriod,
        ];

        return $this->success([
            'pledges' => $pledges,
            'summary' => $summary,
        ]);
    }

    /**
     * Payment Split Report (Cash vs Transfer)
     */
    public function paymentSplit(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $fromDate = $request->get('from_date', Carbon::today()->startOfMonth()->toDateString());
        $toDate = $request->get('to_date', Carbon::today()->toDateString());

        // Pledges
        $pledges = Pledge::where('branch_id', $branchId)
            ->whereBetween('pledge_date', [$fromDate, $toDate])
            ->with('payments')
            ->get();

        $pledgePayments = [
            'count' => $pledges->count(),
            'total' => $pledges->sum('loan_amount'),
            'cash' => $pledges->sum(fn($p) => $p->payments->sum('cash_amount')),
            'transfer' => $pledges->sum(fn($p) => $p->payments->sum('transfer_amount')),
        ];

        // Renewals
        $renewals = Renewal::where('branch_id', $branchId)
            ->whereBetween(DB::raw('DATE(created_at)'), [$fromDate, $toDate])
            ->get();

        $renewalPayments = [
            'count' => $renewals->count(),
            'total' => $renewals->sum('total_payable'),
            'cash' => $renewals->sum('cash_amount'),
            'transfer' => $renewals->sum('transfer_amount'),
        ];

        // Redemptions
        $redemptions = Redemption::where('branch_id', $branchId)
            ->whereBetween(DB::raw('DATE(created_at)'), [$fromDate, $toDate])
            ->get();

        $redemptionPayments = [
            'count' => $redemptions->count(),
            'total' => $redemptions->sum('total_payable'),
            'cash' => $redemptions->sum('cash_amount'),
            'transfer' => $redemptions->sum('transfer_amount'),
        ];

        return $this->success([
            'period' => [
                'from' => $fromDate,
                'to' => $toDate,
            ],
            'pledges' => $pledgePayments,
            'renewals' => $renewalPayments,
            'redemptions' => $redemptionPayments,
            'totals' => [
                'cash' => $pledgePayments['cash'] + $renewalPayments['cash'] + $redemptionPayments['cash'],
                'transfer' => $pledgePayments['transfer'] + $renewalPayments['transfer'] + $redemptionPayments['transfer'],
                'grand_total' => $pledgePayments['total'] + $renewalPayments['total'] + $redemptionPayments['total'],
            ],
        ]);
    }

    /**
     * Inventory Report
     */
    public function inventory(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $items = PledgeItem::whereHas('pledge', function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->where('status', 'active');
            })
            ->where('status', 'stored')
            ->with(['pledge.customer:id,name', 'category', 'purity', 'vault', 'box', 'slot'])
            ->get();

        // Group by category
        $byCategory = $items->groupBy('category.name_en')->map(function ($group) {
            return [
                'count' => $group->count(),
                'total_weight' => round($group->sum('net_weight'), 3),
                'total_value' => round($group->sum('net_value'), 2),
            ];
        });

        // Group by purity
        $byPurity = $items->groupBy('purity.code')->map(function ($group) {
            return [
                'count' => $group->count(),
                'total_weight' => round($group->sum('net_weight'), 3),
                'total_value' => round($group->sum('net_value'), 2),
            ];
        });

        // Group by vault
        $byVault = $items->groupBy('vault.name')->map(function ($group) {
            return [
                'count' => $group->count(),
                'total_weight' => round($group->sum('net_weight'), 3),
            ];
        });

        $summary = [
            'total_items' => $items->count(),
            'total_weight' => round($items->sum('net_weight'), 3),
            'total_value' => round($items->sum('net_value'), 2),
            'by_category' => $byCategory,
            'by_purity' => $byPurity,
            'by_vault' => $byVault,
        ];

        return $this->success([
            'items' => $items,
            'summary' => $summary,
        ]);
    }

    /**
     * Customers Report
     */
    public function customers(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = Customer::where('branch_id', $branchId)
            ->withCount(['pledges', 'activePledges']);

        // Filter
        if ($request->boolean('blacklisted')) {
            $query->where('is_blacklisted', true);
        }

        if ($request->boolean('has_active_pledges')) {
            $query->has('activePledges');
        }

        $customers = $query->orderBy('created_at', 'desc')->get();

        $summary = [
            'total_customers' => $customers->count(),
            'with_active_pledges' => $customers->filter(fn($c) => $c->active_pledges_count > 0)->count(),
            'blacklisted' => $customers->filter(fn($c) => $c->is_blacklisted)->count(),
            'total_loan_amount' => $customers->sum('total_loan_amount'),
        ];

        return $this->success([
            'customers' => $customers,
            'summary' => $summary,
        ]);
    }

    /**
     * Daily Transactions Report
     */
    public function transactions(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $date = $request->get('date', Carbon::today()->toDateString());

        // Pledges
        $pledges = Pledge::where('branch_id', $branchId)
            ->whereDate('pledge_date', $date)
            ->with(['customer:id,name', 'payments', 'createdBy:id,name'])
            ->orderBy('created_at')
            ->get();

        // Renewals
        $renewals = Renewal::where('branch_id', $branchId)
            ->whereDate('created_at', $date)
            ->with(['pledge.customer:id,name', 'createdBy:id,name'])
            ->orderBy('created_at')
            ->get();

        // Redemptions
        $redemptions = Redemption::where('branch_id', $branchId)
            ->whereDate('created_at', $date)
            ->with(['pledge.customer:id,name', 'createdBy:id,name'])
            ->orderBy('created_at')
            ->get();

        return $this->success([
            'date' => $date,
            'pledges' => [
                'items' => $pledges,
                'count' => $pledges->count(),
                'total' => $pledges->sum('loan_amount'),
            ],
            'renewals' => [
                'items' => $renewals,
                'count' => $renewals->count(),
                'total' => $renewals->sum('total_payable'),
            ],
            'redemptions' => [
                'items' => $redemptions,
                'count' => $redemptions->count(),
                'total' => $redemptions->sum('total_payable'),
            ],
        ]);
    }

    /**
     * Reprint Charges Report
     */
    public function reprints(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = PledgeReceipt::whereHas('pledge', function ($q) use ($branchId) {
                $q->where('branch_id', $branchId);
            })
            ->where('print_type', 'reprint')
            ->with(['pledge:id,pledge_no,receipt_no', 'printedBy:id,name']);

        // Date filters
        if ($from = $request->get('from_date')) {
            $query->whereDate('printed_at', '>=', $from);
        }
        if ($to = $request->get('to_date')) {
            $query->whereDate('printed_at', '<=', $to);
        }

        $reprints = $query->orderBy('printed_at', 'desc')->get();

        $summary = [
            'total_reprints' => $reprints->count(),
            'total_charges' => $reprints->sum('charge_amount'),
            'paid' => $reprints->where('charge_paid', true)->sum('charge_amount'),
            'unpaid' => $reprints->where('charge_paid', false)->sum('charge_amount'),
        ];

        return $this->success([
            'reprints' => $reprints,
            'summary' => $summary,
        ]);
    }

    /**
     * Export report data (CSV)
     */
    public function export(Request $request): JsonResponse
    {
        $reportType = $request->get('report_type');
        $format = $request->get('format', 'csv');

        // This would typically generate a file and return download URL
        // For now, return the data that would be exported

        $data = match ($reportType) {
            'pledges' => $this->pledges($request)->getData()->data,
            'renewals' => $this->renewals($request)->getData()->data,
            'redemptions' => $this->redemptions($request)->getData()->data,
            'outstanding' => $this->outstanding($request)->getData()->data,
            'overdue' => $this->overdue($request)->getData()->data,
            default => null,
        };

        if (!$data) {
            return $this->error('Invalid report type', 400);
        }

        // TODO: Generate actual file and upload to storage
        // For now, just acknowledge
        return $this->success([
            'message' => 'Export would be generated',
            'report_type' => $reportType,
            'format' => $format,
            'record_count' => count($data->pledges ?? $data->renewals ?? $data->redemptions ?? []),
        ]);
    }
}
