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
use App\Models\WhatsAppConfig;
use App\Models\WhatsAppLog;
use Carbon\Carbon;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SendDailyOwnerDashboard extends Command
{
    protected $signature = 'dashboard:send-owner-daily
        {--date= : The date to generate the report for (Y-m-d)}
        {--branch= : Branch ID to generate for}
        {--no-save : Do not persist the PDF to storage}
        {--no-send : Generate only — do not send via WhatsApp}';

    protected $description = 'Generate the Daily Owner Dashboard PDF and send to configured WhatsApp recipients';

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
                $result = $this->generateForBranch($branch, $date);
                $this->info("  -> {$result['path']}");

                if (!$this->option('no-send') && !$this->option('no-save')) {
                    $this->sendToWhatsApp($branch, $result['rel_path'], $result['file_name']);
                }
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

    protected function generateForBranch(Branch $branch, Carbon $date): array
    {
        $data = $this->buildData($branch, $date);

        $pdf = Pdf::loadView('pdf.owner-dashboard', $data)
            ->setPaper('a4', 'portrait');

        // Random suffix so the public URL is unguessable (PDF contains financial data)
        $fileName = sprintf(
            'Management_Report_%s_%s_%s.pdf',
            preg_replace('/[^A-Za-z0-9_-]/', '_', $branch->code ?: $branch->name),
            $date->format('Y-m-d'),
            Str::random(10)
        );

        if ($this->option('no-save')) {
            return [
                'path'      => '(not saved) ' . $fileName,
                'rel_path'  => null,
                'file_name' => $fileName,
            ];
        }

        $relPath = "owner-dashboards/{$fileName}";
        Storage::disk('public')->put($relPath, $pdf->output());

        return [
            'path'      => storage_path("app/public/{$relPath}"),
            'rel_path'  => $relPath,
            'file_name' => $fileName,
        ];
    }

    /**
     * Send the generated PDF to every WhatsApp recipient configured in
     * settings (category=`owner_dashboard`) for this branch, via UltraMsg.
     */
    protected function sendToWhatsApp(Branch $branch, string $relPath, string $fileName): void
    {
        $branchId = $branch->id;

        // ── 1. Read owner_dashboard settings ──
        $settings = Setting::where('category', 'owner_dashboard')
            ->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->orWhereNull('branch_id');
            })
            ->get()
            ->pluck('value', 'key_name');

        $enabled    = ($settings['enabled'] ?? '0') === '1';
        $rawNumbers = $settings['whatsapp_number'] ?? '';

        if (!$enabled) {
            $this->info('  -> WhatsApp delivery disabled for this branch — skipping send');
            return;
        }

        $recipients = collect(explode(',', $rawNumbers))
            ->map(fn ($p) => trim($p))
            ->filter()
            ->unique()
            ->values();

        if ($recipients->isEmpty()) {
            $this->warn('  ! No recipients configured — skipping send');
            return;
        }

        // ── 2. Read WhatsApp (UltraMsg) config for this branch ──
        $config = WhatsAppConfig::where('branch_id', $branchId)
            ->where('is_enabled', true)
            ->first();

        if (!$config) {
            $this->error('  ! WhatsApp not configured or disabled for this branch — skipping send');
            return;
        }

        if ($config->provider !== 'ultramsg') {
            $this->error("  ! Only UltraMsg is supported for document send, got '{$config->provider}' — skipping");
            return;
        }

        // ── 3. Build the public URL for the PDF ──
        $publicUrl = Storage::disk('public')->url($relPath);
        // Storage::url may return a relative path if APP_URL is unset — make it absolute.
        if (!str_starts_with($publicUrl, 'http')) {
            $publicUrl = rtrim(config('app.url'), '/') . '/' . ltrim($publicUrl, '/');
        }

        $caption = $this->buildCaption($branch);

        // ── 4. Send to each recipient ──
        foreach ($recipients as $phone) {
            $log = WhatsAppLog::create([
                'branch_id'       => $branchId,
                'recipient_phone' => $phone,
                'message_content' => $caption,
                'attachment_url'  => $publicUrl,
                'status'          => 'pending',
                'related_type'    => 'OwnerDashboard',
            ]);

            $result = $this->sendUltraMsgDocument(
                $config,
                $phone,
                $publicUrl,
                $fileName,
                $caption
            );

            if ($result['success']) {
                $log->update([
                    'status'  => 'sent',
                    'sent_at' => now(),
                ]);
                $this->info("  ✓ Sent to {$phone}");
            } else {
                $log->update([
                    'status'        => 'failed',
                    'error_message' => substr($result['error'] ?? 'Unknown error', 0, 500),
                ]);
                $this->error("  ✗ Failed for {$phone}: " . ($result['error'] ?? 'Unknown error'));
            }
        }
    }

    /**
     * Build a short WhatsApp caption to accompany the PDF attachment.
     */
    protected function buildCaption(Branch $branch): string
    {
        $company = $this->companySettings($branch);
        $today   = Carbon::now('Asia/Kuala_Lumpur');

        return implode("\n", [
            '*Daily Owner Dashboard*',
            $company['name'],
            'Branch: ' . $branch->name,
            'Date: ' . $today->format('d M Y'),
            'Generated: ' . $today->format('H:i'),
        ]);
    }

    /**
     * Send a PDF via UltraMsg `/messages/document` endpoint.
     * UltraMsg fetches the file from the public URL we provide.
     */
    protected function sendUltraMsgDocument(
        WhatsAppConfig $config,
        string $phone,
        string $documentUrl,
        string $fileName,
        string $caption
    ): array {
        try {
            $url = "https://api.ultramsg.com/{$config->instance_id}/messages/document";

            $params = [
                'token'    => $config->api_token,
                'to'       => $phone,
                'filename' => $fileName,
                'document' => $documentUrl,
                'caption'  => $caption,
            ];

            $ch = curl_init();
            $curlOptions = [
                CURLOPT_URL            => $url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_ENCODING       => '',
                CURLOPT_MAXREDIRS      => 10,
                CURLOPT_TIMEOUT        => 60,
                CURLOPT_HTTP_VERSION   => CURL_HTTP_VERSION_1_1,
                CURLOPT_CUSTOMREQUEST  => 'POST',
                CURLOPT_POSTFIELDS     => http_build_query($params),
                CURLOPT_HTTPHEADER     => ['content-type: application/x-www-form-urlencoded'],
            ];

            if (app()->environment('local')) {
                $curlOptions[CURLOPT_SSL_VERIFYHOST] = 0;
                $curlOptions[CURLOPT_SSL_VERIFYPEER] = 0;
            }

            curl_setopt_array($ch, $curlOptions);
            $response = curl_exec($ch);
            $err      = curl_error($ch);
            curl_close($ch);

            if ($err) {
                return ['success' => false, 'error' => 'cURL: ' . $err];
            }

            $result = json_decode($response, true);

            if (isset($result['sent']) && $result['sent'] === 'true') {
                return ['success' => true, 'message_id' => $result['id'] ?? null];
            }

            return ['success' => false, 'error' => $result['error'] ?? $response];
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
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

        // ── Online (bank transfer) flow ──
        $onlineIn       = $renewalTransfer + $redemptionTransfer + $intPayTransfer;
        $onlineOut      = $pledgeTransfer;
        $onlineClosing  = $onlineIn - $onlineOut;

        // ── Inventory: pledge items received today by purity / category ──
        $items = PledgeItem::whereHas('pledge', function ($q) use ($branchId, $date) {
            $q->where('branch_id', $branchId)->whereDate('pledge_date', $date);
        })->with(['purity', 'category', 'pledge'])->get();

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

        $byCategory = $items->groupBy(function ($i) {
            $receipt = $i->pledge->receipt_no ?? $i->pledge->pledge_no ?? '—';
            $cat = $i->category->name_en ?? $i->category->code ?? 'Uncategorised';
            $pur = $i->purity->code ?? 'N/A';
            return $receipt . '|' . $cat . '|' . $pur;
        })->map(function ($g) {
            $first = $g->first();
            return [
                'receipt'  => $first->pledge->receipt_no ?? $first->pledge->pledge_no ?? '—',
                'category' => $first->category->name_en ?? $first->category->code ?? 'Uncategorised',
                'purity'   => $first->purity->code ?? 'N/A',
                'count'    => $g->count(),
                'weight'   => (float) $g->sum('net_weight'),
            ];
        })->sortBy(['receipt', 'category', 'purity'])->values()->all();

        // Receipts in = today's pledges; Receipts out = today's redemptions
        $receiptsIn  = $pledgeCount;
        $receiptsOut = $redemptionCount;

        // Items released today (full + partial redemptions)
        $releasedItems = PledgeItem::whereDate('redeemed_at', $date)
            ->whereHas('pledge', fn ($q) => $q->where('branch_id', $branchId))
            ->with(['purity', 'category', 'pledge'])
            ->get();

        $itemsOut          = $releasedItems->count();
        $totalWeightOut    = (float) $releasedItems->sum('net_weight');

        $releasedByCategory = $releasedItems->groupBy(function ($i) {
            $receipt = $i->pledge->receipt_no ?? $i->pledge->pledge_no ?? '—';
            $cat = $i->category->name_en ?? $i->category->code ?? 'Uncategorised';
            $pur = $i->purity->code ?? 'N/A';
            return $receipt . '|' . $cat . '|' . $pur;
        })->map(function ($g) {
            $first = $g->first();
            return [
                'receipt'  => $first->pledge->receipt_no ?? $first->pledge->pledge_no ?? '—',
                'category' => $first->category->name_en ?? $first->category->code ?? 'Uncategorised',
                'purity'   => $first->purity->code ?? 'N/A',
                'count'    => $g->count(),
                'weight'   => (float) $g->sum('net_weight'),
            ];
        })->sortBy(['receipt', 'category', 'purity'])->values()->all();

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

        // ── 7-day trend (ending today, inclusive) ──
        $trend = $this->buildWeeklyTrend($branchId, $date);

        // ── Charts (QuickChart.io → base64 PNG) ──
        $txChart = $this->chartTransactions(
            $pledgeCount, $intPayCount, $renewalCount, $redemptionCount
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
        $incomeChart     = $this->chartIncomeVsOutflow($totalIncome, $totalOutflow);
        $trendChart      = $this->chartWeeklyTrend($trend);
        $cashTrendChart   = $this->chartWeeklyTrendSplit($trend['labels'], $trend['cash_in'], $trend['cash_out'], 'Cash');
        $onlineTrendChart = $this->chartWeeklyTrendSplit($trend['labels'], $trend['online_in'], $trend['online_out'], 'Online');

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
                    ['label' => 'Advance Interest Payment',  'count' => $intPayCount,     'amount' => $intPayTotal,         'color' => '#3b82f6'],
                    ['label' => 'Renewals',           'count' => $renewalCount,    'amount' => $renewalTotal,        'color' => '#f59e0b'],
                    ['label' => 'Redemptions',        'count' => $redemptionCount, 'amount' => $redemptionTotal,     'color' => '#10b981'],
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
                'online_in'        => $onlineIn,
                'online_out'       => $onlineOut,
                'online_closing'   => $onlineClosing,
                'online_chart'     => $this->chartOnlineFlow($onlineIn, $onlineOut, $onlineClosing),
                'has_data'         => $report !== null || $cashIn > 0 || $cashOut > 0 || $onlineIn > 0 || $onlineOut > 0,
            ],

            'inventory' => [
                'items_in'             => $itemsIn,
                'items_out'            => $itemsOut,
                'receipts_in'          => $receiptsIn,
                'receipts_out'         => $receiptsOut,
                'total_weight'         => $totalWeightIn,
                'total_weight_out'     => $totalWeightOut,
                'by_purity'            => $byPurity,
                'by_category'          => $byCategory,
                'released_by_category' => $releasedByCategory,
                'chart'                => $purityChart,
                'has_data'             => $receiptsIn > 0 || $receiptsOut > 0 || $itemsIn > 0 || $itemsOut > 0,
            ],

            'gold' => [
                'prices'     => $goldPrices,
                'source'     => $goldRow->source ?? null,
                'price_date' => $goldRow ? Carbon::parse($goldRow->price_date)->format('d M Y') : null,
                'has_data'   => count($goldPrices) > 0,
            ],

            'final' => [
                'income'         => $totalIncome,
                'outflow'        => $totalOutflow,
                'net_movement'   => $netMovement,
                'cash_in'        => $cashIn,
                'cash_out'       => $cashOut,
                'cash_net'       => $cashIn - $cashOut,
                'online_in'      => $onlineIn,
                'online_out'     => $onlineOut,
                'online_net'     => $onlineIn - $onlineOut,
                'chart'              => $incomeChart,
                'trend_chart'        => $trendChart,
                'cash_trend_chart'   => $cashTrendChart,
                'online_trend_chart' => $onlineTrendChart,
                'cash_trend_has_data'   => array_sum($trend['cash_in']) + array_sum($trend['cash_out']) > 0,
                'online_trend_has_data' => array_sum($trend['online_in']) + array_sum($trend['online_out']) > 0,
                'trend_has_data' => array_sum($trend['income']) + array_sum($trend['outflow']) > 0,
                'has_data'       => ($totalIncome + $totalOutflow) > 0,
            ],
        ];
    }

    /**
     * Build a 7-day series of total income vs total outflow ending on $endDate (inclusive).
     * One DB roundtrip per source, grouped by day in PHP — keeps it simple and fast.
     */
    protected function buildWeeklyTrend(int $branchId, Carbon $endDate): array
    {
        $start = $endDate->copy()->subDays(6)->startOfDay();
        $end   = $endDate->copy()->endOfDay();

        $labels       = [];
        $income       = [];
        $outflow      = [];
        $cashIn       = [];
        $cashOut      = [];
        $onlineIn     = [];
        $onlineOut    = [];
        $cursor       = $start->copy();

        // Pledges (outflow) — cash/transfer come from related PledgePayment rows
        $pledges = Pledge::where('branch_id', $branchId)
            ->whereBetween('pledge_date', [$start, $end])
            ->with('payments')
            ->get(['id', 'pledge_date', 'payout_amount']);

        $pledgeByDay = $pledges->groupBy(fn ($p) => Carbon::parse($p->pledge_date)->toDateString());
        $pledgeOut       = $pledgeByDay->map(fn ($g) => (float) $g->sum('payout_amount'));
        $pledgeCashOut   = $pledgeByDay->map(fn ($g) => (float) $g->flatMap->payments->sum('cash_amount'));
        $pledgeOnlineOut = $pledgeByDay->map(fn ($g) => (float) $g->flatMap->payments->sum('transfer_amount'));

        // Helper to aggregate per-day sums for renewal/redemption/interest sources
        $aggIn = function ($collection) {
            return $collection
                ->groupBy(fn ($r) => Carbon::parse($r->created_at)->toDateString())
                ->map(fn ($g) => [
                    'total'    => (float) $g->sum('total_payable'),
                    'cash'     => (float) $g->sum('cash_amount'),
                    'transfer' => (float) $g->sum('transfer_amount'),
                ]);
        };

        $renIn = $aggIn(Renewal::where('branch_id', $branchId)
            ->whereBetween('created_at', [$start, $end])
            ->get(['created_at', 'total_payable', 'cash_amount', 'transfer_amount']));

        $redIn = $aggIn(Redemption::where('branch_id', $branchId)
            ->whereBetween('created_at', [$start, $end])
            ->get(['created_at', 'total_payable', 'cash_amount', 'transfer_amount']));

        $ipIn = $aggIn(InterestPayment::where('branch_id', $branchId)
            ->whereBetween('created_at', [$start, $end])
            ->get(['created_at', 'total_payable', 'cash_amount', 'transfer_amount']));

        $pick = fn ($map, $key, $field) => $map[$key][$field] ?? 0;

        for ($i = 0; $i < 7; $i++) {
            $key      = $cursor->toDateString();
            $labels[] = $cursor->format('d M');

            $income[]     = $pick($renIn, $key, 'total') + $pick($redIn, $key, 'total') + $pick($ipIn, $key, 'total');
            $outflow[]    = $pledgeOut[$key] ?? 0;
            $cashIn[]     = $pick($renIn, $key, 'cash') + $pick($redIn, $key, 'cash') + $pick($ipIn, $key, 'cash');
            $onlineIn[]   = $pick($renIn, $key, 'transfer') + $pick($redIn, $key, 'transfer') + $pick($ipIn, $key, 'transfer');
            $cashOut[]    = $pledgeCashOut[$key] ?? 0;
            $onlineOut[]  = $pledgeOnlineOut[$key] ?? 0;

            $cursor->addDay();
        }

        return [
            'labels'      => $labels,
            'income'      => $income,
            'outflow'     => $outflow,
            'cash_in'     => $cashIn,
            'cash_out'    => $cashOut,
            'online_in'   => $onlineIn,
            'online_out'  => $onlineOut,
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

    private function chartTransactions(int $p, int $i, int $r, int $d): ?string
    {
        if (($p + $r + $d + $i) === 0) return null;

        return $this->quickChart([
            'type' => 'doughnut',
            'data' => [
                'labels'   => ['Pledges', 'Interest Pay', 'Renewals', 'Redemptions'],
                'datasets' => [[
                    'label'           => 'Transactions',
                    'data'            => [$p, $i, $r, $d],
                    'backgroundColor' => ['#1e3a5f', '#3b82f6', '#f59e0b', '#10b981'],
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
                    'label'           => '',
                    'data'            => [$cash, $transfer],
                    'backgroundColor' => ['#f59e0b', '#3b82f6'],
                    'borderRadius'    => 6,
                    'barThickness'    => 56,
                ]],
            ],
            'options' => [
                'layout'  => ['padding' => ['top' => 30, 'bottom' => 4, 'left' => 12, 'right' => 12]],
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
                    'x' => ['grid' => ['display' => false], 'ticks' => ['font' => ['size' => 12, 'weight' => 'bold'], 'color' => '#475569']],
                    'y' => ['display' => false, 'beginAtZero' => true],
                ],
            ],
        ], 540, 230);
    }

    private function chartInterestSources(float $r, float $d, float $i): ?string
    {
        if (($r + $d + $i) <= 0) return null;

        return $this->quickChart([
            'type' => 'bar',
            'data' => [
                'labels'   => ['From Renewals', 'From Redemptions', 'Advance Interest Payment'],
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

    private function chartOnlineFlow(float $in, float $out, float $closing): ?string
    {
        return $this->quickChart([
            'type' => 'bar',
            'data' => [
                'labels'   => ['Online In', 'Online Out', 'Closing'],
                'datasets' => [[
                    'label'           => '',
                    'data'            => [$in, $out, $closing],
                    'backgroundColor' => ['#10b981', '#ef4444', '#c8973e'],
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

    private function chartWeeklyTrend(array $trend): ?string
    {
        $totalAll = array_sum($trend['income']) + array_sum($trend['outflow']);
        if ($totalAll <= 0) return null;

        return $this->quickChart([
            'type' => 'line',
            'data' => [
                'labels'   => $trend['labels'],
                'datasets' => [
                    [
                        'label'           => 'Income',
                        'data'            => $trend['income'],
                        'borderColor'     => '#10b981',
                        'backgroundColor' => 'rgba(16,185,129,0.15)',
                        'borderWidth'     => 2.5,
                        'tension'         => 0.35,
                        'fill'            => true,
                        'pointRadius'     => 4,
                        'pointBackgroundColor' => '#10b981',
                        'pointBorderColor'     => '#ffffff',
                        'pointBorderWidth'     => 2,
                    ],
                    [
                        'label'           => 'Outflow',
                        'data'            => $trend['outflow'],
                        'borderColor'     => '#ef4444',
                        'backgroundColor' => 'rgba(239,68,68,0.12)',
                        'borderWidth'     => 2.5,
                        'tension'         => 0.35,
                        'fill'            => true,
                        'pointRadius'     => 4,
                        'pointBackgroundColor' => '#ef4444',
                        'pointBorderColor'     => '#ffffff',
                        'pointBorderWidth'     => 2,
                    ],
                ],
            ],
            'options' => [
                'layout'  => ['padding' => ['top' => 24, 'bottom' => 8, 'left' => 12, 'right' => 12]],
                'plugins' => [
                    'legend' => [
                        'position' => 'top',
                        'align'    => 'end',
                        'labels'   => [
                            'usePointStyle' => true,
                            'pointStyle'    => 'circle',
                            'font'          => ['size' => 11, 'weight' => 'bold'],
                            'color'         => '#334155',
                            'padding'       => 12,
                        ],
                    ],
                    'datalabels' => ['display' => false],
                ],
                'scales' => [
                    'x' => [
                        'grid'  => ['display' => false],
                        'ticks' => ['font' => ['size' => 11, 'weight' => 'bold'], 'color' => '#475569'],
                    ],
                    'y' => [
                        'beginAtZero' => true,
                        'grid'  => ['color' => '#f1f5f9', 'drawBorder' => false],
                        'ticks' => [
                            'font'   => ['size' => 10],
                            'color'  => '#94a3b8',
                            'callback' => "(v) => 'RM ' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v)",
                        ],
                    ],
                ],
            ],
        ], 720, 260);
    }

    private function chartWeeklyTrendSplit(array $labels, array $inSeries, array $outSeries, string $titleHint): ?string
    {
        if (array_sum($inSeries) + array_sum($outSeries) <= 0) return null;

        return $this->quickChart([
            'type' => 'line',
            'data' => [
                'labels'   => $labels,
                'datasets' => [
                    [
                        'label'           => $titleHint . ' In',
                        'data'            => $inSeries,
                        'borderColor'     => '#10b981',
                        'backgroundColor' => 'rgba(16,185,129,0.15)',
                        'borderWidth'     => 2.5,
                        'tension'         => 0.35,
                        'fill'            => true,
                        'pointRadius'     => 4,
                        'pointBackgroundColor' => '#10b981',
                        'pointBorderColor'     => '#ffffff',
                        'pointBorderWidth'     => 2,
                    ],
                    [
                        'label'           => $titleHint . ' Out',
                        'data'            => $outSeries,
                        'borderColor'     => '#ef4444',
                        'backgroundColor' => 'rgba(239,68,68,0.12)',
                        'borderWidth'     => 2.5,
                        'tension'         => 0.35,
                        'fill'            => true,
                        'pointRadius'     => 4,
                        'pointBackgroundColor' => '#ef4444',
                        'pointBorderColor'     => '#ffffff',
                        'pointBorderWidth'     => 2,
                    ],
                ],
            ],
            'options' => [
                'layout'  => ['padding' => ['top' => 24, 'bottom' => 8, 'left' => 12, 'right' => 12]],
                'plugins' => [
                    'legend' => [
                        'position' => 'top',
                        'align'    => 'end',
                        'labels'   => [
                            'usePointStyle' => true,
                            'pointStyle'    => 'circle',
                            'font'          => ['size' => 11, 'weight' => 'bold'],
                            'color'         => '#334155',
                            'padding'       => 12,
                        ],
                    ],
                    'datalabels' => ['display' => false],
                ],
                'scales' => [
                    'x' => [
                        'grid'  => ['display' => false],
                        'ticks' => ['font' => ['size' => 11, 'weight' => 'bold'], 'color' => '#475569'],
                    ],
                    'y' => [
                        'beginAtZero' => true,
                        'grid'  => ['color' => '#f1f5f9', 'drawBorder' => false],
                        'ticks' => [
                            'font'   => ['size' => 10],
                            'color'  => '#94a3b8',
                            'callback' => "(v) => 'RM ' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v)",
                        ],
                    ],
                ],
            ],
        ], 720, 240);
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
