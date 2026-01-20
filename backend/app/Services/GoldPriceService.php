<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use App\Models\GoldPrice;
use App\Models\GoldPriceAudit;
use App\Models\GoldPriceSource;
use Carbon\Carbon;

class GoldPriceService
{
    // Troy ounce to gram conversion
    const TROY_OZ_TO_GRAM = 31.1035;

    /**
     * Create HTTP client with auto SSL verification based on environment
     * LOCAL/DEVELOPMENT: SSL verification DISABLED (to fix Windows cURL certificate issues)
     * PRODUCTION/STAGING: SSL verification ENABLED (for security)
     */
    protected function createHttpClient(int $timeout = 10): \Illuminate\Http\Client\PendingRequest
    {
        $http = Http::timeout($timeout);

        // Auto-detect environment and configure SSL
        if (app()->environment('local', 'development')) {
            // Disable SSL verification for local development (Windows cURL fix)
            $http = $http->withOptions(['verify' => false]);
        }
        // Production/staging: SSL verification is enabled by default (secure)

        return $http;
    }

    // Purity ratios
    const PURITIES = [
        '999' => 0.999,
        '916' => 0.916,
        '875' => 0.875,
        '750' => 0.750,
        '585' => 0.585,
        '375' => 0.375,
    ];

    /**
     * Fetch gold prices from all sources and store audit trail
     * PRIMARY: Metals.Dev (real-time BID/ASK)
     * SECONDARY: BNM Kijang Emas (official reference)
     */
    public function fetchAndStorePrices(?int $branchId = null, ?int $userId = null): array
    {
        $startTime = microtime(true);
        $priceDate = Carbon::today()->toDateString();

        $result = [
            'success' => false,
            'price_date' => $priceDate,
            'metals_dev' => null,
            'bnm' => null,
            'active_source' => null,
            'prices' => [],
            'errors' => [],
        ];

        // 1. Fetch from PRIMARY: Metals.Dev
        $metalsDevData = $this->fetchFromMetalsDev();
        if ($metalsDevData['success']) {
            $result['metals_dev'] = $metalsDevData;
            $result['active_source'] = 'metals_dev';
        } else {
            $result['errors'][] = 'Metals.Dev: ' . ($metalsDevData['error'] ?? 'Unknown error');
        }

        // 2. Fetch from SECONDARY: BNM Kijang Emas
        $bnmData = $this->fetchFromBNM();
        if ($bnmData['success']) {
            $result['bnm'] = $bnmData;
            // Use BNM as active if Metals.Dev failed
            if (!$result['active_source']) {
                $result['active_source'] = 'bnm';
            }
        } else {
            $result['errors'][] = 'BNM: ' . ($bnmData['error'] ?? 'Unknown error');
        }

        // 3. Calculate purity prices based on active source
        if ($result['active_source']) {
            $basePrice = $this->determineBasePrice($result);
            $result['prices'] = $this->calculatePurityPrices($basePrice);
            $result['success'] = true;
        }

        // 4. Store audit trail for KPKT compliance
        $auditId = $this->storeAuditRecord($result, $branchId, $userId);
        $result['audit_id'] = $auditId;

        // 5. Update gold_prices table
        if ($result['success']) {
            $this->updateGoldPricesTable($result, $branchId, $userId, $auditId);
        }

        // 6. Update API usage counter
        $this->updateApiUsage($result);

        // Calculate response time
        $result['response_time_ms'] = round((microtime(true) - $startTime) * 1000);

        return $result;
    }

    /**
     * Fetch from Metals.Dev API (PRIMARY)
     * Returns spot, bid, ask prices - converted to per gram
     */
    protected function fetchFromMetalsDev(): array
    {
        $apiKey = config('services.metals_dev.api_key', env('METALS_DEV_API_KEY'));

        if (!$apiKey) {
            return [
                'success' => false,
                'error' => 'Metals.Dev API key not configured',
            ];
        }

        try {
            $startTime = microtime(true);

            $response = $this->createHttpClient()->get('https://api.metals.dev/v1/metal/spot', [
                'api_key' => $apiKey,
                'metal' => 'gold',
                'currency' => 'MYR',
            ]);

            $responseTime = round((microtime(true) - $startTime) * 1000);

            if (!$response->successful()) {
                return [
                    'success' => false,
                    'error' => 'HTTP ' . $response->status() . ': ' . $response->body(),
                    'response_time_ms' => $responseTime,
                ];
            }

            $data = $response->json();

            // Validate response structure
            if (!isset($data['status']) || $data['status'] !== 'success' || !isset($data['rate'])) {
                return [
                    'success' => false,
                    'error' => 'Invalid response: ' . json_encode($data),
                    'response_time_ms' => $responseTime,
                ];
            }

            // Extract rate object
            $rateData = $data['rate'];
            $unit = $data['unit'] ?? 'toz';

            // Convert to per gram if unit is troy ounce
            $divisor = ($unit === 'toz') ? self::TROY_OZ_TO_GRAM : 1;

            // Calculate per-gram prices
            $spotPerGram = isset($rateData['price']) ? round($rateData['price'] / $divisor, 2) : null;
            $bidPerGram = isset($rateData['bid']) ? round($rateData['bid'] / $divisor, 2) : null;
            $askPerGram = isset($rateData['ask']) ? round($rateData['ask'] / $divisor, 2) : null;
            $highPerGram = isset($rateData['high']) ? round($rateData['high'] / $divisor, 2) : null;
            $lowPerGram = isset($rateData['low']) ? round($rateData['low'] / $divisor, 2) : null;

            $result = [
                'success' => true,
                'source' => 'metals_dev',
                'spot' => $spotPerGram,
                'bid' => $bidPerGram,
                'ask' => $askPerGram,
                'high' => $highPerGram,
                'low' => $lowPerGram,
                'change' => $rateData['change'] ?? null,
                'change_percent' => $rateData['change_percent'] ?? null,
                'timestamp' => $data['timestamp'] ?? now()->toIso8601String(),
                'currency' => $data['currency'] ?? 'MYR',
                'unit' => 'gram', // Converted to gram
                'original_unit' => $unit,
                'raw_response' => $data,
                'response_time_ms' => $responseTime,
            ];

            // Log successful fetch
            Log::info('Metals.Dev fetch successful', [
                'spot' => $result['spot'],
                'bid' => $result['bid'],
                'ask' => $result['ask'],
                'original_unit' => $unit,
                'response_time_ms' => $responseTime,
            ]);

            return $result;

        } catch (\Exception $e) {
            Log::error('Metals.Dev API error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Fetch from BNM Kijang Emas API (SECONDARY)
     * Returns buying/selling prices per oz, converted to per gram
     */
    protected function fetchFromBNM(): array
    {
        try {
            $startTime = microtime(true);

            $response = $this->createHttpClient()
                ->withHeaders([
                    'Accept' => 'application/vnd.BNM.API.v1+json',
                ])
                ->get('https://api.bnm.gov.my/public/kijang-emas');

            $responseTime = round((microtime(true) - $startTime) * 1000);

            if (!$response->successful()) {
                return [
                    'success' => false,
                    'error' => 'HTTP ' . $response->status() . ': ' . $response->body(),
                    'response_time_ms' => $responseTime,
                ];
            }

            $data = $response->json();

            // Validate response structure
            if (!isset($data['data']['one_oz'])) {
                return [
                    'success' => false,
                    'error' => 'Invalid BNM response structure',
                    'raw_response' => $data,
                    'response_time_ms' => $responseTime,
                ];
            }

            $oneOz = $data['data']['one_oz'];
            $buyingPerOz = $oneOz['buying'] ?? 0;
            $sellingPerOz = $oneOz['selling'] ?? 0;

            // Convert to per gram (1 troy oz = 31.1035 grams)
            $buyingPerGram = $buyingPerOz / self::TROY_OZ_TO_GRAM;
            $sellingPerGram = $sellingPerOz / self::TROY_OZ_TO_GRAM;

            $result = [
                'success' => true,
                'source' => 'bnm_kijang',
                'buying_per_oz' => $buyingPerOz,
                'selling_per_oz' => $sellingPerOz,
                'buying_per_gram' => round($buyingPerGram, 2),
                'selling_per_gram' => round($sellingPerGram, 2),
                'effective_date' => $data['data']['effective_date'] ?? null,
                'last_updated' => $data['meta']['last_updated'] ?? null,
                'raw_response' => $data,
                'response_time_ms' => $responseTime,
            ];

            // Log successful fetch
            Log::info('BNM Kijang Emas fetch successful', [
                'buying_per_gram' => $result['buying_per_gram'],
                'selling_per_gram' => $result['selling_per_gram'],
                'effective_date' => $result['effective_date'],
                'response_time_ms' => $responseTime,
            ]);

            return $result;

        } catch (\Exception $e) {
            Log::error('BNM API error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Determine base price (999 gold per gram) from active source
     * For pawn shops, we use BID price (what we pay to buy gold)
     */
    protected function determineBasePrice(array $result): float
    {
        if ($result['active_source'] === 'metals_dev' && isset($result['metals_dev'])) {
            // Prefer BID price for pawn valuation (buying price)
            $data = $result['metals_dev'];
            return $data['bid'] ?? $data['spot'] ?? 0;
        }

        if ($result['active_source'] === 'bnm' && isset($result['bnm'])) {
            // Use BNM buying price (what BNM pays to buy back)
            return $result['bnm']['buying_per_gram'] ?? 0;
        }

        return 0;
    }

    /**
     * Calculate prices for all purities based on 999 base price
     */
    protected function calculatePurityPrices(float $basePrice999): array
    {
        $prices = [];

        foreach (self::PURITIES as $purity => $ratio) {
            $prices["price_{$purity}"] = round($basePrice999 * $ratio, 2);
        }

        return $prices;
    }

    /**
     * Store audit record for KPKT compliance
     */
    protected function storeAuditRecord(array $result, ?int $branchId, ?int $userId): ?int
    {
        try {
            $audit = DB::table('gold_price_audit')->insertGetId([
                'branch_id' => $branchId,
                'price_date' => $result['price_date'],
                'fetched_at' => now(),

                // Metals.Dev data
                'metals_dev_spot' => $result['metals_dev']['spot'] ?? null,
                'metals_dev_bid' => $result['metals_dev']['bid'] ?? null,
                'metals_dev_ask' => $result['metals_dev']['ask'] ?? null,
                'metals_dev_high' => $result['metals_dev']['high'] ?? null,
                'metals_dev_low' => $result['metals_dev']['low'] ?? null,
                'metals_dev_change' => $result['metals_dev']['change'] ?? null,
                'metals_dev_change_percent' => $result['metals_dev']['change_percent'] ?? null,
                'metals_dev_timestamp' => isset($result['metals_dev']['timestamp'])
                    ? Carbon::parse($result['metals_dev']['timestamp'])
                    : null,
                'metals_dev_raw' => isset($result['metals_dev']['raw_response'])
                    ? json_encode($result['metals_dev']['raw_response'])
                    : null,

                // BNM data
                'bnm_buying_per_oz' => $result['bnm']['buying_per_oz'] ?? null,
                'bnm_selling_per_oz' => $result['bnm']['selling_per_oz'] ?? null,
                'bnm_buying_per_gram' => $result['bnm']['buying_per_gram'] ?? null,
                'bnm_selling_per_gram' => $result['bnm']['selling_per_gram'] ?? null,
                'bnm_effective_date' => $result['bnm']['effective_date'] ?? null,
                'bnm_last_updated' => isset($result['bnm']['last_updated'])
                    ? Carbon::parse($result['bnm']['last_updated'])
                    : null,
                'bnm_raw' => isset($result['bnm']['raw_response'])
                    ? json_encode($result['bnm']['raw_response'])
                    : null,

                // Active source and calculated prices
                'active_source' => $result['active_source'] ?? 'manual',
                'price_999' => $result['prices']['price_999'] ?? 0,
                'price_916' => $result['prices']['price_916'] ?? 0,
                'price_875' => $result['prices']['price_875'] ?? 0,
                'price_750' => $result['prices']['price_750'] ?? 0,
                'price_585' => $result['prices']['price_585'] ?? null,
                'price_375' => $result['prices']['price_375'] ?? null,

                // Audit fields
                'fetch_status' => $result['success'] ? 'success' : 'failed',
                'error_message' => !empty($result['errors']) ? implode('; ', $result['errors']) : null,
                'created_by' => $userId,
                'ip_address' => request()->ip() ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $audit;

        } catch (\Exception $e) {
            Log::error('Failed to store gold price audit', [
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Update gold_prices table with latest prices
     */
    protected function updateGoldPricesTable(array $result, ?int $branchId, ?int $userId, ?int $auditId): void
    {
        try {
            $priceDate = $result['price_date'];

            // Check if record exists for today
            $existing = DB::table('gold_prices')
                ->where('price_date', $priceDate)
                ->where('branch_id', $branchId)
                ->first();

            $data = [
                'branch_id' => $branchId,
                'price_date' => $priceDate,
                'price_999' => $result['prices']['price_999'] ?? 0,
                'price_916' => $result['prices']['price_916'] ?? 0,
                'price_875' => $result['prices']['price_875'] ?? 0,
                'price_750' => $result['prices']['price_750'] ?? 0,
                'price_585' => $result['prices']['price_585'] ?? null,
                'price_375' => $result['prices']['price_375'] ?? null,
                'bid_price_999' => $result['metals_dev']['bid'] ?? null,
                'ask_price_999' => $result['metals_dev']['ask'] ?? null,
                'bnm_buying_999' => $result['bnm']['buying_per_gram'] ?? null,
                'bnm_selling_999' => $result['bnm']['selling_per_gram'] ?? null,
                'source' => 'api',
                'price_source' => $result['active_source'],
                'audit_id' => $auditId,
                'api_response' => json_encode([
                    'metals_dev' => $result['metals_dev'] ?? null,
                    'bnm' => $result['bnm'] ?? null,
                ]),
                'updated_at' => now(),
            ];

            if ($existing) {
                DB::table('gold_prices')
                    ->where('id', $existing->id)
                    ->update($data);
            } else {
                $data['created_by'] = $userId;
                $data['created_at'] = now();
                DB::table('gold_prices')->insert($data);
            }

            // Clear cache
            Cache::forget('gold_prices_latest');
            Cache::forget("gold_prices_{$priceDate}");

        } catch (\Exception $e) {
            Log::error('Failed to update gold_prices table', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Update API usage counters
     */
    protected function updateApiUsage(array $result): void
    {
        try {
            if (isset($result['metals_dev']) && $result['metals_dev']['success']) {
                DB::table('gold_price_sources')
                    ->where('code', 'metals_dev')
                    ->increment('current_month_usage');
            }

            // BNM doesn't have documented limits, but track anyway
            if (isset($result['bnm']) && $result['bnm']['success']) {
                DB::table('gold_price_sources')
                    ->where('code', 'bnm_kijang')
                    ->increment('current_month_usage');
            }
        } catch (\Exception $e) {
            Log::warning('Failed to update API usage counter', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Get latest gold prices (from cache or DB)
     */
    public function getLatestPrices(?int $branchId = null): ?array
    {
        $cacheKey = $branchId ? "gold_prices_latest_{$branchId}" : 'gold_prices_latest';

        return Cache::remember($cacheKey, 300, function () use ($branchId) {
            $query = DB::table('gold_prices')
                ->orderBy('price_date', 'desc');

            if ($branchId) {
                $query->where(function ($q) use ($branchId) {
                    $q->where('branch_id', $branchId)
                        ->orWhereNull('branch_id');
                });
            }

            $record = $query->first();

            if (!$record) {
                return null;
            }

            return [
                'price_date' => $record->price_date,
                'prices' => [
                    '999' => (float) $record->price_999,
                    '916' => (float) $record->price_916,
                    '875' => (float) $record->price_875,
                    '750' => (float) $record->price_750,
                    '585' => (float) ($record->price_585 ?? 0),
                    '375' => (float) ($record->price_375 ?? 0),
                ],
                'bid_price_999' => $record->bid_price_999 ? (float) $record->bid_price_999 : null,
                'ask_price_999' => $record->ask_price_999 ? (float) $record->ask_price_999 : null,
                'bnm_buying_999' => $record->bnm_buying_999 ? (float) $record->bnm_buying_999 : null,
                'bnm_selling_999' => $record->bnm_selling_999 ? (float) $record->bnm_selling_999 : null,
                'source' => $record->price_source ?? $record->source,
                'updated_at' => $record->updated_at,
            ];
        });
    }

    /**
     * Get gold prices for a specific date
     */
    public function getPricesForDate(string $date, ?int $branchId = null): ?array
    {
        $record = DB::table('gold_prices')
            ->where('price_date', $date)
            ->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)
                    ->orWhereNull('branch_id');
            })
            ->orderBy('branch_id', 'desc') // Prefer branch-specific
            ->first();

        if (!$record) {
            return null;
        }

        return [
            'price_date' => $record->price_date,
            'prices' => [
                '999' => (float) $record->price_999,
                '916' => (float) $record->price_916,
                '875' => (float) $record->price_875,
                '750' => (float) $record->price_750,
            ],
            'source' => $record->price_source ?? $record->source,
        ];
    }

    /**
     * Get audit history for KPKT compliance reports
     */
    public function getAuditHistory(string $startDate, string $endDate, ?int $branchId = null): array
    {
        $query = DB::table('gold_price_audit')
            ->whereBetween('price_date', [$startDate, $endDate])
            ->orderBy('fetched_at', 'desc');

        if ($branchId) {
            $query->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)
                    ->orWhereNull('branch_id');
            });
        }

        return $query->get()->map(function ($record) {
            return [
                'id' => $record->id,
                'price_date' => $record->price_date,
                'fetched_at' => $record->fetched_at,
                'active_source' => $record->active_source,
                'metals_dev' => [
                    'spot' => $record->metals_dev_spot,
                    'bid' => $record->metals_dev_bid,
                    'ask' => $record->metals_dev_ask,
                    'timestamp' => $record->metals_dev_timestamp,
                ],
                'bnm' => [
                    'buying_per_gram' => $record->bnm_buying_per_gram,
                    'selling_per_gram' => $record->bnm_selling_per_gram,
                    'effective_date' => $record->bnm_effective_date,
                ],
                'prices' => [
                    '999' => $record->price_999,
                    '916' => $record->price_916,
                    '875' => $record->price_875,
                    '750' => $record->price_750,
                ],
                'fetch_status' => $record->fetch_status,
                'error_message' => $record->error_message,
            ];
        })->toArray();
    }

    /**
     * Check API source health and usage
     */
    public function getSourceStatus(): array
    {
        $sources = DB::table('gold_price_sources')
            ->where('is_active', true)
            ->get();

        return $sources->map(function ($source) {
            $usagePercent = $source->rate_limit_per_month
                ? round(($source->current_month_usage / $source->rate_limit_per_month) * 100, 2)
                : null;

            return [
                'code' => $source->code,
                'name' => $source->name,
                'provider' => $source->provider,
                'priority' => $source->priority,
                'is_active' => (bool) $source->is_active,
                'rate_limit_per_month' => $source->rate_limit_per_month,
                'current_month_usage' => $source->current_month_usage,
                'usage_percent' => $usagePercent,
                'settings' => json_decode($source->settings, true),
            ];
        })->toArray();
    }

    /**
     * Reset monthly API usage counters (call via scheduled task on 1st of month)
     */
    public function resetMonthlyUsage(): void
    {
        DB::table('gold_price_sources')->update([
            'current_month_usage' => 0,
            'last_reset_at' => now(),
        ]);

        Log::info('Monthly API usage counters reset');
    }
}