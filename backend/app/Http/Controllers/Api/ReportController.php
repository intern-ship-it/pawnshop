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
            'total_pledges' => $pledges->count(),
            'total_loan_amount' => $pledges->sum('loan_amount'),
            'average_loan' => $pledges->count() > 0 ? $pledges->avg('loan_amount') : 0,
            'unique_customers' => $pledges->unique('customer_id')->count(),
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
            'total_renewals' => $renewals->count(),
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
            'total_redemptions' => $redemptions->count(),
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

        $totalCash = $pledgePayments['cash'] + $renewalPayments['cash'] + $redemptionPayments['cash'];
        $totalTransfer = $pledgePayments['transfer'] + $renewalPayments['transfer'] + $redemptionPayments['transfer'];
        $grandTotal = $pledgePayments['total'] + $renewalPayments['total'] + $redemptionPayments['total'];
        $totalCount = $pledgePayments['count'] + $renewalPayments['count'] + $redemptionPayments['count'];

        return $this->success([
            'period' => [
                'from' => $fromDate,
                'to' => $toDate,
            ],
            'pledges' => $pledgePayments,
            'renewals' => $renewalPayments,
            'redemptions' => $redemptionPayments,
            'summary' => [
                'cash_total' => $totalCash,
                'transfer_total' => $totalTransfer,
                'total' => $grandTotal,
                'transaction_count' => $totalCount,
                'cash_percentage' => $grandTotal > 0 ? round(($totalCash / $grandTotal) * 100, 1) : 0,
                'transfer_percentage' => $grandTotal > 0 ? round(($totalTransfer / $grandTotal) * 100, 1) : 0,
            ],
        ]);
    }

    /**
     * Inventory Report
     */
    public function inventory(Request $request): JsonResponse
    {
        // Get all stored items from active pledges (no branch filter for now)
        $items = PledgeItem::whereHas('pledge', function ($q) {
            $q->where('status', 'active');
        })
            ->where('status', 'stored')
            ->with(['pledge.customer:id,name', 'category', 'purity', 'vault', 'box', 'slot'])
            ->get();

        // Group by category - use callback to properly access relationship
        $byCategory = $items->groupBy(function ($item) {
            return $item->category->name_en ?? 'Unknown';
        })->map(function ($group, $key) {
            return [
                'name' => $key,
                'count' => $group->count(),
                'total_weight' => round($group->sum('net_weight'), 3),
                'total_value' => round($group->sum('net_value'), 2),
            ];
        })->values();

        // Group by purity - use callback to properly access relationship
        $byPurity = $items->groupBy(function ($item) {
            return $item->purity->code ?? 'Unknown';
        })->map(function ($group, $key) {
            return [
                'name' => $key,
                'count' => $group->count(),
                'total_weight' => round($group->sum('net_weight'), 3),
                'total_value' => round($group->sum('net_value'), 2),
            ];
        })->values();

        // Group by vault - use callback to properly access relationship
        $byVault = $items->groupBy(function ($item) {
            return $item->vault->name ?? 'Unassigned';
        })->map(function ($group, $key) {
            return [
                'name' => $key,
                'count' => $group->count(),
                'total_weight' => round($group->sum('net_weight'), 3),
            ];
        })->values();

        // Count unique active pledges that have stored items
        $activePledgesCount = $items->pluck('pledge_id')->unique()->count();

        $summary = [
            'total_items' => $items->count(),
            'total_weight' => round($items->sum('net_weight'), 3),
            'total_value' => round($items->sum('net_value'), 2),
            'active_pledges' => $activePledgesCount,
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
    public function export(Request $request)
    {
        $reportType = $request->get('report_type');
        $format = $request->get('format', 'csv');

        // Validate report type
        $validTypes = ['overview', 'pledges', 'renewals', 'redemptions', 'outstanding', 'payments', 'inventory', 'customers', 'transactions', 'reprints'];

        if (!in_array($reportType, $validTypes)) {
            return $this->error('Invalid report type', 400);
        }

        // Get report data
        $data = match ($reportType) {
            'overview', 'pledges' => $this->pledges($request)->getData()->data,
            'renewals' => $this->renewals($request)->getData()->data,
            'redemptions' => $this->redemptions($request)->getData()->data,
            'outstanding' => $this->outstanding($request)->getData()->data,
            'payments' => $this->paymentSplit($request)->getData()->data,
            'inventory' => $this->inventory($request)->getData()->data,
            'customers' => $this->customers($request)->getData()->data,
            'transactions' => $this->transactions($request)->getData()->data,
            'reprints' => $this->reprints($request)->getData()->data,
            default => null,
        };

        if (!$data) {
            return $this->error('Failed to fetch report data', 500);
        }

        // Generate CSV
        $csv = $this->generateCSV($reportType, $data);

        // Return as downloadable file
        $filename = $reportType . '_report_' . date('Y-m-d_His') . '.csv';

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * Generate CSV content from report data
     */
    private function generateCSV(string $reportType, $data): string
    {
        $output = fopen('php://temp', 'r+');

        switch ($reportType) {
            case 'overview':
            case 'pledges':
                fputcsv($output, ['Date', 'Receipt No', 'Pledge No', 'Customer', 'IC Number', 'Items', 'Weight (g)', 'Loan Amount', 'Interest Rate', 'Due Date', 'Status']);
                foreach ($data->pledges as $pledge) {
                    fputcsv($output, [
                        date('d/m/Y', strtotime($pledge->pledge_date)),
                        $pledge->receipt_no,
                        $pledge->pledge_no,
                        $pledge->customer->name ?? '',
                        "\t" . ($pledge->customer->ic_number ?? ''),
                        is_array($pledge->items) ? count($pledge->items) : $pledge->items->count(),
                        number_format($pledge->total_weight, 3),
                        number_format($pledge->loan_amount, 2),
                        $pledge->interest_rate . '%',
                        date('d/m/Y', strtotime($pledge->due_date)),
                        ucfirst($pledge->status),
                    ]);
                }
                break;

            case 'renewals':
                fputcsv($output, ['Date', 'Receipt No', 'Pledge No', 'Customer', 'Interest Amount', 'New Due Date', 'Payment Method', 'Status']);
                foreach ($data->renewals as $renewal) {
                    fputcsv($output, [
                        date('d/m/Y H:i', strtotime($renewal->created_at)),
                        $renewal->receipt_no,
                        $renewal->pledge->pledge_no ?? '',
                        $renewal->pledge->customer->name ?? '',
                        number_format($renewal->interest_amount, 2),
                        date('d/m/Y', strtotime($renewal->new_due_date)),
                        $renewal->payment_method,
                        'Completed',
                    ]);
                }
                break;

            case 'redemptions':
                fputcsv($output, ['Date', 'Receipt No', 'Pledge No', 'Customer', 'Principal', 'Interest', 'Total Collected', 'Payment Method']);
                foreach ($data->redemptions as $redemption) {
                    fputcsv($output, [
                        date('d/m/Y H:i', strtotime($redemption->created_at)),
                        $redemption->receipt_no,
                        $redemption->pledge->pledge_no ?? '',
                        $redemption->pledge->customer->name ?? '',
                        number_format($redemption->principal_amount, 2),
                        number_format($redemption->interest_amount, 2),
                        number_format($redemption->total_payable, 2),
                        $redemption->payment_method,
                    ]);
                }
                break;

            case 'outstanding':
                fputcsv($output, ['Pledge No', 'Customer', 'IC Number', 'Loan Date', 'Due Date', 'Principal', 'Current Interest', 'Total Outstanding', 'Status']);
                foreach ($data->pledges as $pledge) {
                    fputcsv($output, [
                        $pledge->pledge_no,
                        $pledge->customer->name ?? '',
                        "\t" . ($pledge->customer->ic_number ?? ''),
                        date('d/m/Y', strtotime($pledge->pledge_date)),
                        date('d/m/Y', strtotime($pledge->due_date)),
                        number_format($pledge->loan_amount, 2),
                        number_format($pledge->current_interest, 2),
                        number_format($pledge->total_outstanding, 2),
                        ucfirst($pledge->status),
                    ]);
                }
                break;

            case 'payments':
                fputcsv($output, ['Transaction Type', 'Count', 'Total Amount', 'Cash', 'Transfer']);
                fputcsv($output, ['Pledges', $data->pledges->count, number_format($data->pledges->total, 2), number_format($data->pledges->cash, 2), number_format($data->pledges->transfer, 2)]);
                fputcsv($output, ['Renewals', $data->renewals->count, number_format($data->renewals->total, 2), number_format($data->renewals->cash, 2), number_format($data->renewals->transfer, 2)]);
                fputcsv($output, ['Redemptions', $data->redemptions->count, number_format($data->redemptions->total, 2), number_format($data->redemptions->cash, 2), number_format($data->redemptions->transfer, 2)]);
                fputcsv($output, ['TOTAL', '', number_format($data->summary->total, 2), number_format($data->summary->cash_total, 2), number_format($data->summary->transfer_total, 2)]);
                break;

            case 'inventory':
                fputcsv($output, ['Pledge No', 'Customer', 'Category', 'Purity', 'Weight (g)', 'Value', 'Vault', 'Box', 'Slot', 'Status']);
                foreach ($data->items as $item) {
                    fputcsv($output, [
                        $item->pledge->pledge_no ?? '',
                        $item->pledge->customer->name ?? '',
                        $item->category->name_en ?? '',
                        $item->purity->code ?? '',
                        number_format($item->net_weight, 3),
                        number_format($item->net_value, 2),
                        $item->vault->name ?? '',
                        $item->box->code ?? '',
                        $item->slot->code ?? '',
                        ucfirst($item->status),
                    ]);
                }
                break;

            case 'customers':
                fputcsv($output, ['Name', 'IC Number', 'Phone', 'Total Pledges', 'Active Pledges', 'Total Loan Amount', 'Blacklisted', 'Joined Date']);
                foreach ($data->customers as $customer) {
                    fputcsv($output, [
                        $customer->name,
                        "\t" . $customer->ic_number,
                        "\t" . ($customer->phone ?? ''),
                        $customer->pledges_count,
                        $customer->active_pledges_count,
                        number_format($customer->total_loan_amount ?? 0, 2),
                        $customer->is_blacklisted ? 'Yes' : 'No',
                        date('d/m/Y', strtotime($customer->created_at)),
                    ]);
                }
                break;

            case 'transactions':
                fputcsv($output, ['Time', 'Type', 'Receipt No', 'Pledge No', 'Customer', 'Amount', 'Created By']);

                // Pledges
                foreach ($data->pledges->items as $pledge) {
                    fputcsv($output, [
                        date('H:i', strtotime($pledge->created_at)),
                        'New Pledge',
                        $pledge->receipt_no,
                        $pledge->pledge_no,
                        $pledge->customer->name ?? '',
                        number_format($pledge->loan_amount, 2),
                        $pledge->createdBy->name ?? '',
                    ]);
                }

                // Renewals
                foreach ($data->renewals->items as $renewal) {
                    fputcsv($output, [
                        date('H:i', strtotime($renewal->created_at)),
                        'Renewal',
                        $renewal->receipt_no,
                        $renewal->pledge->pledge_no ?? '',
                        $renewal->pledge->customer->name ?? '',
                        number_format($renewal->total_payable, 2),
                        $renewal->createdBy->name ?? '',
                    ]);
                }

                // Redemptions
                foreach ($data->redemptions->items as $redemption) {
                    fputcsv($output, [
                        date('H:i', strtotime($redemption->created_at)),
                        'Redemption',
                        $redemption->receipt_no,
                        $redemption->pledge->pledge_no ?? '',
                        $redemption->pledge->customer->name ?? '',
                        number_format($redemption->total_payable, 2),
                        $redemption->createdBy->name ?? '',
                    ]);
                }
                break;

            case 'reprints':
                fputcsv($output, ['Date/Time', 'Receipt No', 'Pledge No', 'Charge Amount', 'Paid', 'Printed By']);
                foreach ($data->reprints as $reprint) {
                    fputcsv($output, [
                        date('d/m/Y H:i', strtotime($reprint->printed_at)),
                        $reprint->pledge->receipt_no ?? '',
                        $reprint->pledge->pledge_no ?? '',
                        number_format($reprint->charge_amount, 2),
                        $reprint->charge_paid ? 'Yes' : 'No',
                        $reprint->printedBy->name ?? '',
                    ]);
                }
                break;
        }

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        return $csv;
    }
}
