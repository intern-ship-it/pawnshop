<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\GoldPriceService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class GoldPriceController extends Controller
{
    protected GoldPriceService $goldPriceService;

    public function __construct(GoldPriceService $goldPriceService)
    {
        $this->goldPriceService = $goldPriceService;
    }

    /**
     * Get latest gold prices
     * GET /api/gold-prices/latest
     */
    public function latest(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id ?? null;

        $prices = $this->goldPriceService->getLatestPrices($branchId);

        if (!$prices) {
            return response()->json([
                'success' => false,
                'message' => 'No gold prices found. Please fetch prices first.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $prices,
        ]);
    }

    /**
     * Fetch fresh prices from APIs (Metals.Dev + BNM)
     * POST /api/gold-prices/fetch
     */
    public function fetch(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id ?? null;
        $userId = $request->user()->id ?? null;

        $result = $this->goldPriceService->fetchAndStorePrices($branchId, $userId);

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch gold prices',
                'errors' => $result['errors'],
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Gold prices fetched and stored successfully',
            'data' => [
                'price_date' => $result['price_date'],
                'active_source' => $result['active_source'],
                'prices' => $result['prices'],
                'metals_dev' => $result['metals_dev'] ? [
                    'spot' => $result['metals_dev']['spot'],
                    'bid' => $result['metals_dev']['bid'],
                    'ask' => $result['metals_dev']['ask'],
                    'timestamp' => $result['metals_dev']['timestamp'],
                ] : null,
                'bnm' => $result['bnm'] ? [
                    'buying_per_gram' => $result['bnm']['buying_per_gram'],
                    'selling_per_gram' => $result['bnm']['selling_per_gram'],
                    'effective_date' => $result['bnm']['effective_date'],
                ] : null,
                'audit_id' => $result['audit_id'],
                'response_time_ms' => $result['response_time_ms'],
            ],
        ]);
    }

    /**
     * Get prices for a specific date
     * GET /api/gold-prices/date/{date}
     */
    public function forDate(Request $request, string $date): JsonResponse
    {
        // Validate date format
        try {
            $parsedDate = Carbon::parse($date)->format('Y-m-d');
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid date format. Use YYYY-MM-DD.',
            ], 400);
        }

        $branchId = $request->user()->branch_id ?? null;
        $prices = $this->goldPriceService->getPricesForDate($parsedDate, $branchId);

        if (!$prices) {
            return response()->json([
                'success' => false,
                'message' => "No gold prices found for {$parsedDate}",
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $prices,
        ]);
    }

    /**
     * Get audit history for KPKT compliance
     * GET /api/gold-prices/audit
     */
    public function audit(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $branchId = $request->user()->branch_id ?? null;

        $history = $this->goldPriceService->getAuditHistory(
            $request->start_date,
            $request->end_date,
            $branchId
        );

        return response()->json([
            'success' => true,
            'data' => $history,
            'meta' => [
                'start_date' => $request->start_date,
                'end_date' => $request->end_date,
                'total_records' => count($history),
            ],
        ]);
    }

    /**
     * Get API source status and usage
     * GET /api/gold-prices/sources
     */
    public function sources(Request $request): JsonResponse
    {
        $sources = $this->goldPriceService->getSourceStatus();

        return response()->json([
            'success' => true,
            'data' => $sources,
        ]);
    }

    /**
     * Get price history for charts/reports
     * GET /api/gold-prices/history
     */
    public function history(Request $request): JsonResponse
    {
        $request->validate([
            'days' => 'integer|min:1|max:365',
            'purity' => 'string|in:999,916,875,750',
        ]);

        $days = $request->input('days', 30);
        $purity = $request->input('purity', '999');
        $branchId = $request->user()->branch_id ?? null;

        $startDate = Carbon::today()->subDays($days)->format('Y-m-d');
        $endDate = Carbon::today()->format('Y-m-d');

        $history = DB::table('gold_prices')
            ->select([
                'price_date',
                "price_{$purity} as price",
                'bid_price_999',
                'ask_price_999',
                'bnm_buying_999',
                'bnm_selling_999',
                'price_source',
            ])
            ->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)
                    ->orWhereNull('branch_id');
            })
            ->whereBetween('price_date', [$startDate, $endDate])
            ->orderBy('price_date', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $history,
            'meta' => [
                'purity' => $purity,
                'days' => $days,
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
        ]);
    }

    /**
     * Manual price entry (for override or when APIs fail)
     * POST /api/gold-prices/manual
     */
    public function manual(Request $request): JsonResponse
    {
        $request->validate([
            'price_date' => 'required|date',
            'price_999' => 'required|numeric|min:0',
            'price_916' => 'required|numeric|min:0',
            'price_875' => 'required|numeric|min:0',
            'price_750' => 'required|numeric|min:0',
            'price_585' => 'nullable|numeric|min:0',
            'price_375' => 'nullable|numeric|min:0',
            'reason' => 'required|string|max:255',
        ]);

        $branchId = $request->user()->branch_id ?? null;
        $userId = $request->user()->id;

        try {
            // Store audit record
            $auditId = DB::table('gold_price_audit')->insertGetId([
                'branch_id' => $branchId,
                'price_date' => $request->price_date,
                'fetched_at' => now(),
                'active_source' => 'manual',
                'price_999' => $request->price_999,
                'price_916' => $request->price_916,
                'price_875' => $request->price_875,
                'price_750' => $request->price_750,
                'price_585' => $request->price_585,
                'price_375' => $request->price_375,
                'fetch_status' => 'success',
                'error_message' => 'Manual entry: ' . $request->reason,
                'created_by' => $userId,
                'ip_address' => $request->ip(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Update or insert gold_prices
            DB::table('gold_prices')->updateOrInsert(
                [
                    'price_date' => $request->price_date,
                    'branch_id' => $branchId,
                ],
                [
                    'price_999' => $request->price_999,
                    'price_916' => $request->price_916,
                    'price_875' => $request->price_875,
                    'price_750' => $request->price_750,
                    'price_585' => $request->price_585,
                    'price_375' => $request->price_375,
                    'source' => 'manual',
                    'price_source' => 'manual',
                    'audit_id' => $auditId,
                    'created_by' => $userId,
                    'updated_at' => now(),
                ]
            );

            return response()->json([
                'success' => true,
                'message' => 'Gold prices saved manually',
                'data' => [
                    'audit_id' => $auditId,
                    'price_date' => $request->price_date,
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to save manual prices',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Compare prices from both sources
     * GET /api/gold-prices/compare
     */
    public function compare(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id ?? null;

        // Get latest audit record with both sources
        $latest = DB::table('gold_price_audit')
            ->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)
                    ->orWhereNull('branch_id');
            })
            ->whereNotNull('metals_dev_spot')
            ->whereNotNull('bnm_buying_per_gram')
            ->orderBy('fetched_at', 'desc')
            ->first();

        if (!$latest) {
            return response()->json([
                'success' => false,
                'message' => 'No comparison data available. Fetch prices from both sources first.',
            ], 404);
        }

        $metalsDev = $latest->metals_dev_bid ?? $latest->metals_dev_spot;
        $bnm = $latest->bnm_buying_per_gram;
        $difference = $metalsDev - $bnm;
        $percentDiff = $bnm > 0 ? round(($difference / $bnm) * 100, 2) : 0;

        return response()->json([
            'success' => true,
            'data' => [
                'price_date' => $latest->price_date,
                'fetched_at' => $latest->fetched_at,
                'metals_dev' => [
                    'source' => 'Metals.Dev (Real-time)',
                    'spot' => (float) $latest->metals_dev_spot,
                    'bid' => (float) $latest->metals_dev_bid,
                    'ask' => (float) $latest->metals_dev_ask,
                    'timestamp' => $latest->metals_dev_timestamp,
                ],
                'bnm' => [
                    'source' => 'BNM Kijang Emas (Official)',
                    'buying' => (float) $latest->bnm_buying_per_gram,
                    'selling' => (float) $latest->bnm_selling_per_gram,
                    'effective_date' => $latest->bnm_effective_date,
                ],
                'comparison' => [
                    'difference_myr' => round($difference, 2),
                    'difference_percent' => $percentDiff,
                    'higher_source' => $difference > 0 ? 'metals_dev' : ($difference < 0 ? 'bnm' : 'equal'),
                    'note' => $difference > 0
                        ? 'Metals.Dev price is higher (more real-time market data)'
                        : ($difference < 0
                            ? 'BNM price is higher (includes Kijang Emas premium)'
                            : 'Prices are equal'),
                ],
                'active_source' => $latest->active_source,
                'applied_price_999' => (float) $latest->price_999,
            ],
        ]);
    }

    /**
     * Generate KPKT compliance report
     * GET /api/gold-prices/compliance-report
     */
    public function complianceReport(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $branchId = $request->user()->branch_id ?? null;

        $records = DB::table('gold_price_audit')
            ->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)
                    ->orWhereNull('branch_id');
            })
            ->whereBetween('price_date', [$request->start_date, $request->end_date])
            ->orderBy('price_date', 'asc')
            ->get();

        $report = [
            'report_title' => 'Gold Price Audit Report for KPKT Compliance',
            'generated_at' => now()->format('Y-m-d H:i:s'),
            'period' => [
                'start' => $request->start_date,
                'end' => $request->end_date,
            ],
            'summary' => [
                'total_records' => $records->count(),
                'successful_fetches' => $records->where('fetch_status', 'success')->count(),
                'failed_fetches' => $records->where('fetch_status', 'failed')->count(),
                'primary_source_records' => $records->where('active_source', 'metals_dev')->count(),
                'secondary_source_records' => $records->where('active_source', 'bnm')->count(),
                'manual_entries' => $records->where('active_source', 'manual')->count(),
            ],
            'daily_records' => $records->map(function ($record) {
                return [
                    'date' => $record->price_date,
                    'fetch_time' => $record->fetched_at,
                    'source' => $record->active_source,
                    'metals_dev_bid' => $record->metals_dev_bid,
                    'bnm_buying' => $record->bnm_buying_per_gram,
                    'applied_price_999' => $record->price_999,
                    'applied_price_916' => $record->price_916,
                    'applied_price_875' => $record->price_875,
                    'applied_price_750' => $record->price_750,
                    'status' => $record->fetch_status,
                ];
            }),
        ];

        return response()->json([
            'success' => true,
            'data' => $report,
        ]);
    }
}