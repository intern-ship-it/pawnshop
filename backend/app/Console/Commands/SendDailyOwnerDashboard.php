<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Branch;
use App\Models\DayEndReport;
use App\Models\Pledge;
use App\Models\Renewal;
use App\Models\Redemption;
use App\Models\InterestPayment;
use App\Models\PledgeItem;
use App\Models\GoldPrice;
use App\Models\Setting;
use Carbon\Carbon;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class SendDailyOwnerDashboard extends Command
{
    protected $signature = 'dashboard:send-owner-daily
        {--date= : The date to generate the report for (Y-m-d)}
        {--branch= : Branch ID to generate for}
        {--no-save : Do not persist the PDF to storage}';

    protected $description = 'Generate the high-level Daily Owner Dashboard PDF';

    public function handle()
    {
        $dateStr = $this->option('date') ?: Carbon::today()->toDateString();
        $date = Carbon::parse($dateStr);
        $branchId = $this->option('branch');

        $branches = $branchId
            ? Branch::where('id', $branchId)->get()
            : Branch::where('is_active', true)->get();

        foreach ($branches as $branch) {
            $this->info("Generating Owner Dashboard — {$branch->name} — {$dateStr}");

            try {
                $path = $this->generateForBranch($branch, $date);
                $this->info("  -> {$path}");
            } catch (\Throwable $e) {
                $this->error("  ! Failed: " . $e->getMessage());
                Log::error('Owner Dashboard generation failed', [
                    'branch_id' => $branch->id,
                    'date'      => $dateStr,
                    'exception' => $e,
                ]);
            }
        }

        $this->info('Done.');
        return self::SUCCESS;
    }

    protected function generateForBranch(Branch $branch, Carbon $date): string
    {
        $data = $this->buildData($branch, $date);

        $pdf = Pdf::loadView('pdf.owner-dashboard', $data)
            ->setPaper('a4', 'portrait');

        $fileName = sprintf(
            'Owner_Dashboard_%s_%s.pdf',
            preg_replace('/[^A-Za-z0-9_-]/', '_', $branch->code ?: $branch->name),
            $date->format('Y-m-d')
        );

        if ($this->option('no-save')) {
            return '(not saved) ' . $fileName;
        }

        $relPath = "owner-dashboards/{$fileName}";
        Storage::disk('public')->put($relPath, $pdf->output());

        return storage_path("app/public/{$relPath}");
    }

    /**
     * Build the single data contract consumed by the Blade view.
     * Public so HTTP controllers can reuse it for on-demand PDF rendering.
     */
    public function buildData(Branch $branch, Carbon $date): array
    {
        $branchId = $branch->id;

        // ── Aggregate source: DayEndReport (if it exists) ──
        $report = DayEndReport::where('branch_id', $branchId)
            ->whereDate('report_date', $date)
            ->first();

        // ── Pledges (loans disbursed) ──
        $pledges = Pledge::where('branch_id', $branchId)
            ->whereDate('pledge_date', $date)
            ->with('payments')
            ->get();

        $pledgeCount       = $pledges->count();
        $grossPledged      = (float) $pledges->sum('gross_value');
        $totalDeductions   = (float) $pledges->sum('total_deduction');
        $totalHandlingFees = (float) $pledges->sum('handling_fee');
        $loanAmount        = (float) $pledges->sum('loan_amount');
        $netReleased       = (float) $pledges->sum('payout_amount');
        $pledgeCash        = (float) $pledges->flatMap->payments->sum('cash_amount');
        $pledgeTransfer    = (float) $pledges->flatMap->payments->sum('transfer_amount');
        $avgRate           = $pledgeCount > 0 ? (float) $pledges->avg('interest_rate') : 0;
        $avgTicket         = $pledgeCount > 0 ? $loanAmount / $pledgeCount : 0;

        // ── Renewals ──
        $renewals = Renewal::where('branch_id', $branchId)
            ->whereDate('created_at', $date)
            ->get();

        $renewalCount    = $renewals->count();
        $renewalInterest = (float) $renewals->sum('interest_amount');
        $renewalTotal    = (float) $renewals->sum('total_payable');
        $renewalCash     = (float) $renewals->sum('cash_amount');
        $renewalTransfer = (float) $renewals->sum('transfer_amount');

        // ── Redemptions ──
        $redemptions = Redemption::where('branch_id', $branchId)
            ->whereDate('created_at', $date)
            ->get();

        $redemptionCount     = $redemptions->count();
        $redemptionInterest  = (float) $redemptions->sum('interest_amount');
        $redemptionTotal     = (float) $redemptions->sum('total_payable');
        $redemptionCash      = (float) $redemptions->sum('cash_amount');
        $redemptionTransfer  = (float) $redemptions->sum('transfer_amount');

        // ── Standalone interest payments ──
        $interestPayments = InterestPayment::where('branch_id', $branchId)
            ->whereDate('created_at', $date)
            ->get();

        $intPayCount    = $interestPayments->count();
        $intPayInterest = (float) $interestPayments->sum('interest_amount');
        $intPayTotal    = (float) $interestPayments->sum('total_payable');
        $intPayCash     = (float) $interestPayments->sum('cash_amount');
        $intPayTransfer = (float) $interestPayments->sum('transfer_amount');

        // ── Interest summary ──
        $interestTotal    = $renewalInterest + $redemptionInterest + $intPayInterest;
        $interestCash     = $renewalCash + $redemptionCash + $intPayCash;
        $interestTransfer = $renewalTransfer + $redemptionTransfer + $intPayTransfer;

        // ── Cash flow ──
        $openingBalance = $report ? (float) $report->opening_balance : 0;
        $cashIn         = $renewalCash + $redemptionCash + $intPayCash;
        $cashOut        = $pledgeCash;
        $netCash        = $cashIn - $cashOut;
        $expectedClosing = $openingBalance + $netCash;
        $actualClosing  = $report && $report->closing_balance !== null ? (float) $report->closing_balance : null;
        $variance       = $actualClosing !== null ? ($actualClosing - $expectedClosing) : 0;

        // ── Inventory: pledge items received today by purity ──
        $items = PledgeItem::whereHas('pledge', function ($q) use ($branchId, $date) {
            $q->where('branch_id', $branchId)->whereDate('pledge_date', $date);
        })->with('purity')->get();

        $itemsIn = $items->count();
        $totalWeightIn = (float) $items->sum('net_weight');

        $byPurity = $items->groupBy(fn ($i) => $i->purity->code ?? 'Other')
            ->map(fn ($g, $code) => [
                'code'   => $code,
                'count'  => $g->count(),
                'weight' => (float) $g->sum('net_weight'),
            ])
            ->sortByDesc('count')
            ->values()
            ->all();

        $itemsOut = $report ? (int) $report->items_out_count : 0;

        // ── Gold prices ──
        $goldRow = GoldPrice::where('branch_id', $branchId)
            ->whereDate('price_date', $date)
            ->latest('id')
            ->first();

        $goldPrices = [];
        if ($goldRow) {
            foreach ([
                '999' => 'price_999',
                '916' => 'price_916',
                '875' => 'price_875',
                '750' => 'price_750',
                '585' => 'price_585',
                '375' => 'price_375',
            ] as $code => $col) {
                $val = (float) ($goldRow->{$col} ?? 0);
                if ($val > 0) {
                    $goldPrices[] = ['code' => $code, 'price' => $val];
                }
            }
        }

        // ── Final summary ──
        $totalIncome  = $renewalTotal + $redemptionTotal + $intPayTotal;
        $totalOutflow = $netReleased;
        $netMovement  = $totalIncome - $totalOutflow;

        // ── Charts (QuickChart.io → base64 PNG) ──
        $txChart = $this->chartTransactions(
            $pledgeCount, $renewalCount, $redemptionCount, $intPayCount
        );
        $loanPaymentChart = $this->chartPaymentMethods(
            'Loan Payout Method', $pledgeCash, $pledgeTransfer
        );
        $interestChart = $this->chartInterestSources(
            $renewalInterest, $redemptionInterest, $intPayInterest
        );
        $cashFlowChart = $this->chartCashFlow(
            $openingBalance, $cashIn, $cashOut, $actualClosing ?? $expectedClosing
        );
        $purityChart   = $this->chartPurity($byPurity);
        $incomeChart   = $this->chartIncomeVsOutflow($totalIncome, $totalOutflow);

        $company = $this->companySettings($branch);

        return [
            'meta' => [
                'company_name'    => $company['name'],
                'company_chinese' => $company['name_chinese'],
                'registration_no' => $company['registration_no'],
                'address'         => $company['address'],
                'phone'           => $company['phone'],
                'email'           => $company['email'],
                'logo'            => $company['logo'],
                'branch_name'     => $branch->name,
                'branch_code'     => $branch->code,
                'license_no'      => $branch->license_no,
                'date'            => $date->copy(),
                'date_label'      => $date->format('d M Y'),
                'day_name'        => $date->format('l'),
                'generated_at'    => now(),
                'status'          => $report->status ?? null,
            ],

            'tx' => [
                'rows' => [
                    ['label' => 'Pledges',            'count' => $pledgeCount,     'amount' => $loanAmount,          'color' => '#1e3a5f'],
                    ['label' => 'Renewals',           'count' => $renewalCount,    'amount' => $renewalTotal,        'color' => '#f59e0b'],
                    ['label' => 'Redemptions',        'count' => $redemptionCount, 'amount' => $redemptionTotal,     'color' => '#10b981'],
                    ['label' => 'Interest Payments',  'count' => $intPayCount,     'amount' => $intPayTotal,         'color' => '#3b82f6'],
                ],
                'total_count'  => $pledgeCount + $renewalCount + $redemptionCount + $intPayCount,
                'total_amount' => $loanAmount + $renewalTotal + $redemptionTotal + $intPayTotal,
                'chart'        => $txChart,
                'has_data'     => ($pledgeCount + $renewalCount + $redemptionCount + $intPayCount) > 0,
            ],

            'loans' => [
                'count'             => $pledgeCount,
                'gross_pledged'     => $grossPledged,
                'total_deductions'  => $totalDeductions,
                'handling_fees'     => $totalHandlingFees,
                'loan_amount'       => $loanAmount,
                'net_released'      => $netReleased,
                'cash'              => $pledgeCash,
                'transfer'          => $pledgeTransfer,
                'avg_rate'          => $avgRate,
                'avg_ticket'        => $avgTicket,
                'payment_chart'     => $loanPaymentChart,
                'has_data'          => $pledgeCount > 0,
            ],

            'interest' => [
                'total'              => $interestTotal,
                'from_renewals'      => $renewalInterest,
                'from_redemptions'   => $redemptionInterest,
                'from_interest_pay'  => $intPayInterest,
                'cash'               => $interestCash,
                'transfer'           => $interestTransfer,
                'chart'              => $interestChart,
                'has_data'           => $interestTotal > 0,
            ],

            'cash_flow' => [
                'opening'          => $openingBalance,
                'cash_in'          => $cashIn,
                'cash_out'         => $cashOut,
                'other_income'     => 0.0,
                'net_cash'         => $netCash,
                'expected_closing' => $expectedClosing,
                'actual_closing'   => $actualClosing,
                'has_actual'       => $actualClosing !== null,
                'variance'         => $variance,
                'chart'            => $cashFlowChart,
                'has_data'         => $report !== null || $cashIn > 0 || $cashOut > 0,
            ],

            'inventory' => [
                'items_in'      => $itemsIn,
                'items_out'     => $itemsOut,
                'total_weight'  => $totalWeightIn,
                'by_purity'     => $byPurity,
                'chart'         => $purityChart,
                'has_data'      => $itemsIn > 0 || $itemsOut > 0,
            ],

            'gold' => [
                'prices'     => $goldPrices,
                'source'     => $goldRow->source ?? null,
                'price_date' => $goldRow ? Carbon::parse($goldRow->price_date)->format('d M Y') : null,
                'has_data'   => count($goldPrices) > 0,
            ],

            'final' => [
                'income'       => $totalIncome,
                'outflow'      => $totalOutflow,
                'net_movement' => $netMovement,
                'chart'        => $incomeChart,
                'has_data'     => ($totalIncome + $totalOutflow) > 0,
            ],
        ];
    }

    /**
     * Load company branding from Setting table, fall back to branch fields.
     * Mirrors the lookup used by the receipt PDFs.
     */
    protected function companySettings(Branch $branch): array
    {
        $settingsMap = [];
        try {
            $rows = Setting::query()->where('category', 'company')->get(['key_name', 'value']);
            foreach ($rows as $r) {
                $settingsMap[$r->key_name] = $r->value;
            }
        } catch (\Throwable $e) {
            // Setting table may not exist — use defaults
        }

        return [
            'name'            => $settingsMap['name'] ?? $branch->name ?? 'PAJAK GADAI SDN BHD',
            'name_chinese'    => $settingsMap['name_chinese'] ?? null,
            'registration_no' => $settingsMap['registration_no'] ?? null,
            'address'         => $settingsMap['address'] ?? $branch->address ?? null,
            'phone'           => $settingsMap['phone'] ?? $branch->phone ?? null,
            'email'           => $settingsMap['email'] ?? $branch->email ?? null,
            'logo'            => $this->resolveLogo($settingsMap['logo'] ?? $settingsMap['logo_url'] ?? $settingsMap['company_logo'] ?? null),
        ];
    }

    /**
     * Convert a logo URL/path into a base64 data URI that DomPDF can embed.
     */
    protected function resolveLogo(?string $logoUrl): ?string
    {
        if (!$logoUrl) return null;
        if (str_starts_with($logoUrl, 'data:')) return $logoUrl;

        $logoPath = null;
        $path = ltrim($logoUrl, '/');

        if (!str_starts_with($logoUrl, 'http')) {
            $logoPath = str_starts_with($path, 'storage/')
                ? public_path($path)
                : storage_path('app/public/' . $path);
        } else {
            $parsed = parse_url($logoUrl);
            $urlPath = ltrim($parsed['path'] ?? '', '/');
            if (str_starts_with($urlPath, 'storage/')) {
                $logoPath = public_path($urlPath);
            }
        }

        if ($logoPath && file_exists($logoPath)) {
            $mime = mime_content_type($logoPath) ?: 'image/png';
            return 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($logoPath));
        }
        return null;
    }

    // ────────────────────────────────────────────────────────────────
    //  Chart helpers (QuickChart.io)
    // ────────────────────────────────────────────────────────────────

    private function quickChart(array $config, int $w = 500, int $h = 260): ?string
    {
        $url = 'https://quickchart.io/chart?bkg=white&w=' . $w . '&h=' . $h
             . '&f=png&c=' . urlencode(json_encode($config));

        try {
            $ctx = stream_context_create(['http' => ['timeout' => 8]]);
            $img = @file_get_contents($url, false, $ctx);
            if ($img) {
                return 'data:image/png;base64,' . base64_encode($img);
            }
        } catch (\Throwable $e) {
            Log::warning('QuickChart fetch failed', ['error' => $e->getMessage()]);
        }
        return null;
    }

    private function chartTransactions(int $p, int $r, int $d, int $i): ?string
    {
        if (($p + $r + $d + $i) === 0) return null;

        return $this->quickChart([
            'type' => 'doughnut',
            'data' => [
                'labels'   => ['Pledges', 'Renewals', 'Redemptions', 'Interest Pay'],
                'datasets' => [[
                    'label'           => 'Transactions',
                    'data'            => [$p, $r, $d, $i],
                    'backgroundColor' => ['#1e3a5f', '#f59e0b', '#10b981', '#3b82f6'],
                    'borderColor'     => '#ffffff',
                    'borderWidth'     => 2,
                ]],
            ],
            'options' => [
                'cutout'  => '60%',
                'plugins' => [
                    'legend' => [
                        'position' => 'right',
                        'labels'   => ['font' => ['size' => 12], 'usePointStyle' => true],
                    ],
                    'datalabels' => [
                        'color'     => '#ffffff',
                        'font'      => ['weight' => 'bold', 'size' => 13],
                        'formatter' => "(v) => v > 0 ? v : ''",
                    ],
                ],
            ],
        ], 480, 240);
    }

    private function chartPaymentMethods(string $title, float $cash, float $transfer): ?string
    {
        if (($cash + $transfer) <= 0) return null;

        return $this->quickChart([
            'type' => 'bar',
            'data' => [
                'labels'   => ['Cash', 'Bank Transfer'],
                'datasets' => [[
                    'label'           => 'Amount (RM)',
                    'data'            => [$cash, $transfer],
                    'backgroundColor' => ['#f59e0b', '#3b82f6'],
                    'borderRadius'    => 6,
                    'barThickness'    => 36,
                ]],
            ],
            'options' => [
                'indexAxis' => 'y',
                'layout'    => ['padding' => ['top' => 6, 'bottom' => 4, 'left' => 8, 'right' => 60]],
                'plugins'   => [
                    'legend' => false,
                    'title'  => ['display' => true, 'text' => $title, 'font' => ['size' => 13, 'weight' => 'bold']],
                    'datalabels' => [
                        'anchor' => 'end', 'align' => 'end',
                        'color'  => '#1e293b',
                        'font'   => ['weight' => 'bold', 'size' => 11],
                        'formatter' => "(v) => 'RM ' + v.toLocaleString()",
                    ],
                ],
                'scales' => [
                    'x' => ['display' => false, 'grid' => ['display' => false]],
                    'y' => ['grid' => ['display' => false], 'ticks' => ['font' => ['size' => 12, 'weight' => 'bold']]],
                ],
            ],
        ], 500, 180);
    }

    private function chartInterestSources(float $r, float $d, float $i): ?string
    {
        if (($r + $d + $i) <= 0) return null;

        return $this->quickChart([
            'type' => 'bar',
            'data' => [
                'labels'   => ['From Renewals', 'From Redemptions', 'Interest Payments'],
                'datasets' => [[
                    'label'           => '',
                    'data'            => [$r, $d, $i],
                    'backgroundColor' => ['#f59e0b', '#10b981', '#3b82f6'],
                    'borderRadius'    => 6,
                    'barThickness'    => 50,
                ]],
            ],
            'options' => [
                'layout'  => ['padding' => ['top' => 26, 'bottom' => 4, 'left' => 8, 'right' => 8]],
                'plugins' => [
                    'legend' => false,
                    'datalabels' => [
                        'anchor' => 'end', 'align' => 'top', 'offset' => 4,
                        'color'  => '#1e293b',
                        'font'   => ['weight' => 'bold', 'size' => 11],
                        'formatter' => "(v) => 'RM ' + v.toLocaleString()",
                    ],
                ],
                'scales' => [
                    'x' => ['grid' => ['display' => false], 'ticks' => ['font' => ['size' => 11, 'weight' => 'bold']]],
                    'y' => ['display' => false, 'beginAtZero' => true],
                ],
            ],
        ], 540, 230);
    }

    private function chartCashFlow(float $open, float $in, float $out, float $close): ?string
    {
        return $this->quickChart([
            'type' => 'bar',
            'data' => [
                'labels'   => ['Opening', 'Cash In', 'Cash Out', 'Closing'],
                'datasets' => [[
                    'label'           => '',
                    'data'            => [$open, $in, $out, $close],
                    'backgroundColor' => ['#1e3a5f', '#10b981', '#ef4444', '#c8973e'],
                    'borderRadius'    => 6,
                    'barThickness'    => 42,
                ]],
            ],
            'options' => [
                'layout'  => ['padding' => ['top' => 26, 'bottom' => 4, 'left' => 8, 'right' => 8]],
                'plugins' => [
                    'legend' => false,
                    'datalabels' => [
                        'anchor' => 'end', 'align' => 'top', 'offset' => 4,
                        'color'  => '#1e293b',
                        'font'   => ['weight' => 'bold', 'size' => 11],
                        'formatter' => "(v) => 'RM ' + Math.round(v).toLocaleString()",
                    ],
                ],
                'scales' => [
                    'x' => ['grid' => ['display' => false], 'ticks' => ['font' => ['size' => 12, 'weight' => 'bold']]],
                    'y' => ['display' => false, 'grid' => ['display' => false], 'beginAtZero' => true],
                ],
            ],
        ], 540, 250);
    }

    private function chartPurity(array $byPurity): ?string
    {
        if (empty($byPurity)) return null;

        $labels  = array_map(fn ($p) => $p['code'], $byPurity);
        $weights = array_map(fn ($p) => $p['weight'], $byPurity);

        $palette = ['#c8973e', '#d4a84b', '#e0b958', '#ecc965', '#a3d977', '#7fc4a0'];
        $colors  = array_slice(array_merge($palette, $palette), 0, count($labels));

        return $this->quickChart([
            'type' => 'bar',
            'data' => [
                'labels'   => $labels,
                'datasets' => [[
                    'label'           => '',
                    'data'            => $weights,
                    'backgroundColor' => $colors,
                    'borderRadius'    => 6,
                    'barThickness'    => 38,
                ]],
            ],
            'options' => [
                'layout'  => ['padding' => ['top' => 24, 'bottom' => 4, 'left' => 8, 'right' => 8]],
                'plugins' => [
                    'legend' => false,
                    'datalabels' => [
                        'anchor' => 'end', 'align' => 'top', 'offset' => 4,
                        'color'  => '#1e293b',
                        'font'   => ['weight' => 'bold', 'size' => 11],
                        'formatter' => "(v) => v.toFixed(1) + 'g'",
                    ],
                ],
                'scales' => [
                    'x' => ['grid' => ['display' => false], 'ticks' => ['font' => ['size' => 12, 'weight' => 'bold']]],
                    'y' => ['display' => false, 'beginAtZero' => true],
                ],
            ],
        ], 540, 230);
    }

    private function chartIncomeVsOutflow(float $income, float $outflow): ?string
    {
        if (($income + $outflow) <= 0) return null;

        return $this->quickChart([
            'type' => 'bar',
            'data' => [
                'labels'   => ['Total Income', 'Total Outflow'],
                'datasets' => [[
                    'label'           => '',
                    'data'            => [$income, $outflow],
                    'backgroundColor' => ['#10b981', '#ef4444'],
                    'borderRadius'    => 6,
                    'barThickness'    => 56,
                ]],
            ],
            'options' => [
                'layout'  => ['padding' => ['top' => 28, 'bottom' => 4, 'left' => 8, 'right' => 8]],
                'plugins' => [
                    'legend' => false,
                    'datalabels' => [
                        'anchor' => 'end', 'align' => 'top', 'offset' => 4,
                        'color'  => '#1e293b',
                        'font'   => ['weight' => 'bold', 'size' => 12],
                        'formatter' => "(v) => 'RM ' + Math.round(v).toLocaleString()",
                    ],
                ],
                'scales' => [
                    'x' => ['grid' => ['display' => false], 'ticks' => ['font' => ['size' => 13, 'weight' => 'bold']]],
                    'y' => ['display' => false, 'beginAtZero' => true],
                ],
            ],
        ], 540, 230);
    }
}
