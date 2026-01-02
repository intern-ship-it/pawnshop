<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\GoldPriceLog;

class GoldPriceService
{
    protected string $baseUrl = 'https://api.metalpriceapi.com/v1';
    protected ?string $apiKey;
    protected int $cacheTtl;
    protected string $baseCurrency;

    public function __construct()
    {
        $this->apiKey = config('pawnsys.gold_price.api_key');
        $this->cacheTtl = config('pawnsys.gold_price.cache_ttl', 300); // 5 minutes default
        $this->baseCurrency = config('pawnsys.gold_price.base_currency', 'MYR');
    }

    /**
     * Get current gold prices (with caching)
     */
    public function getCurrentPrices(): array
    {
        $cacheKey = "gold_prices_{$this->baseCurrency}";
        
        return Cache::remember($cacheKey, $this->cacheTtl, function () {
            return $this->fetchLivePrices();
        });
    }

    /**
     * Get gold prices by carat (24K, 22K, 18K, etc.)
     */
    public function getCaratPrices(): array
    {
        $cacheKey = "gold_carat_prices_{$this->baseCurrency}";
        
        return Cache::remember($cacheKey, $this->cacheTtl, function () {
            return $this->fetchCaratPrices();
        });
    }

    /**
     * Fetch live prices from MetalPriceAPI
     */
    protected function fetchLivePrices(): array
    {
        if (!$this->apiKey) {
            return $this->getFallbackPrices();
        }

        try {
            $response = Http::timeout(10)->get("{$this->baseUrl}/latest", [
                'api_key' => $this->apiKey,
                'base' => $this->baseCurrency,
                'currencies' => 'XAU,XAG,XPT,XPD',
                'unit' => 'gram',
            ]);

            if ($response->successful() && $response->json('success')) {
                $data = $response->json();
                $rates = $data['rates'] ?? [];
                
                // Calculate price per gram (API returns how much 1 MYR buys, we need inverse)
                $goldPerGram = isset($rates['XAU']) && $rates['XAU'] > 0 
                    ? round(1 / $rates['XAU'], 2) 
                    : null;
                $silverPerGram = isset($rates['XAG']) && $rates['XAG'] > 0 
                    ? round(1 / $rates['XAG'], 2) 
                    : null;

                $result = [
                    'success' => true,
                    'source' => 'metalpriceapi',
                    'timestamp' => $data['timestamp'] ?? time(),
                    'base_currency' => $this->baseCurrency,
                    'prices' => [
                        'gold' => [
                            'per_gram' => $goldPerGram,
                            'per_troy_oz' => $goldPerGram ? round($goldPerGram * 31.1035, 2) : null,
                        ],
                        'silver' => [
                            'per_gram' => $silverPerGram,
                            'per_troy_oz' => $silverPerGram ? round($silverPerGram * 31.1035, 2) : null,
                        ],
                    ],
                    'raw_rates' => $rates,
                ];

                // Log to database
                $this->logPrices($result);

                return $result;
            }

            Log::warning('MetalPriceAPI request failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return $this->getFallbackPrices();

        } catch (\Exception $e) {
            Log::error('MetalPriceAPI error', ['error' => $e->getMessage()]);
            return $this->getFallbackPrices();
        }
    }

    /**
     * Fetch carat prices from MetalPriceAPI
     */
    protected function fetchCaratPrices(): array
    {
        if (!$this->apiKey) {
            return $this->getFallbackCaratPrices();
        }

        try {
            $response = Http::timeout(10)->get("{$this->baseUrl}/carat", [
                'api_key' => $this->apiKey,
                'base' => $this->baseCurrency,
            ]);

            if ($response->successful() && $response->json('success')) {
                $data = $response->json();
                $caratData = $data['data'] ?? [];
                
                // Map karat to Malaysian purity codes
                $result = [
                    'success' => true,
                    'source' => 'metalpriceapi',
                    'timestamp' => $data['timestamp'] ?? time(),
                    'base_currency' => $this->baseCurrency,
                    'unit' => 'per_gram',
                    'prices' => [
                        // Standard karat prices (per gram)
                        '24k' => isset($caratData['24k']) ? round($caratData['24k'] * 5, 2) : null, // Convert carat to gram
                        '22k' => isset($caratData['22k']) ? round($caratData['22k'] * 5, 2) : null,
                        '21k' => isset($caratData['21k']) ? round($caratData['21k'] * 5, 2) : null,
                        '18k' => isset($caratData['18k']) ? round($caratData['18k'] * 5, 2) : null,
                        '14k' => isset($caratData['14k']) ? round($caratData['14k'] * 5, 2) : null,
                        '9k' => isset($caratData['9k']) ? round($caratData['9k'] * 5, 2) : null,
                    ],
                    // Malaysian purity codes mapping
                    'purity_codes' => [
                        '999' => isset($caratData['24k']) ? round($caratData['24k'] * 5, 2) : null,  // 24K = 999
                        '916' => isset($caratData['22k']) ? round($caratData['22k'] * 5, 2) : null,  // 22K = 916
                        '875' => isset($caratData['21k']) ? round($caratData['21k'] * 5, 2) : null,  // 21K = 875
                        '750' => isset($caratData['18k']) ? round($caratData['18k'] * 5, 2) : null,  // 18K = 750
                        '585' => isset($caratData['14k']) ? round($caratData['14k'] * 5, 2) : null,  // 14K = 585
                        '375' => isset($caratData['9k']) ? round($caratData['9k'] * 5, 2) : null,    // 9K = 375
                    ],
                    'raw_data' => $caratData,
                ];

                return $result;
            }

            return $this->getFallbackCaratPrices();

        } catch (\Exception $e) {
            Log::error('MetalPriceAPI carat error', ['error' => $e->getMessage()]);
            return $this->getFallbackCaratPrices();
        }
    }

    /**
     * Get historical prices for a specific date
     */
    public function getHistoricalPrices(string $date): array
    {
        if (!$this->apiKey) {
            return ['success' => false, 'error' => 'API key not configured'];
        }

        try {
            $response = Http::timeout(10)->get("{$this->baseUrl}/{$date}", [
                'api_key' => $this->apiKey,
                'base' => $this->baseCurrency,
                'currencies' => 'XAU,XAG',
                'unit' => 'gram',
            ]);

            if ($response->successful() && $response->json('success')) {
                $data = $response->json();
                $rates = $data['rates'] ?? [];
                
                return [
                    'success' => true,
                    'date' => $date,
                    'prices' => [
                        'gold_per_gram' => isset($rates['XAU']) && $rates['XAU'] > 0 
                            ? round(1 / $rates['XAU'], 2) : null,
                        'silver_per_gram' => isset($rates['XAG']) && $rates['XAG'] > 0 
                            ? round(1 / $rates['XAG'], 2) : null,
                    ],
                ];
            }

            return ['success' => false, 'error' => 'Failed to fetch historical prices'];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Calculate item value based on weight and purity
     */
    public function calculateItemValue(float $weightGrams, string $purityCode, ?float $customGoldPrice = null): array
    {
        $prices = $this->getCaratPrices();
        
        // Get gold price for the purity
        $pricePerGram = $customGoldPrice;
        
        if (!$pricePerGram && $prices['success']) {
            $pricePerGram = $prices['purity_codes'][$purityCode] ?? null;
        }
        
        if (!$pricePerGram) {
            // Use fallback calculation based on 999 price and purity percentage
            $purity999Price = $prices['purity_codes']['999'] ?? config('pawnsys.gold_price.fallback_999', 400);
            $purityPercentages = [
                '999' => 99.9,
                '916' => 91.6,
                '875' => 87.5,
                '750' => 75.0,
                '585' => 58.5,
                '375' => 37.5,
            ];
            $purityPct = $purityPercentages[$purityCode] ?? 100;
            $pricePerGram = round($purity999Price * ($purityPct / 100), 2);
        }

        $marketValue = round($weightGrams * $pricePerGram, 2);
        $loanPercentages = config('pawnsys.pledge.default_loan_percentages', [80, 70, 60]);
        
        return [
            'weight_grams' => $weightGrams,
            'purity_code' => $purityCode,
            'price_per_gram' => $pricePerGram,
            'market_value' => $marketValue,
            'suggested_loans' => array_map(function ($pct) use ($marketValue) {
                return [
                    'percentage' => $pct,
                    'amount' => round($marketValue * ($pct / 100), 2),
                ];
            }, $loanPercentages),
            'source' => $prices['source'] ?? 'fallback',
            'timestamp' => $prices['timestamp'] ?? time(),
        ];
    }

    /**
     * Get API usage stats
     */
    public function getUsageStats(): array
    {
        if (!$this->apiKey) {
            return ['success' => false, 'error' => 'API key not configured'];
        }

        try {
            $response = Http::timeout(10)->get("{$this->baseUrl}/usage", [
                'api_key' => $this->apiKey,
            ]);

            if ($response->successful() && $response->json('success')) {
                return $response->json();
            }

            return ['success' => false, 'error' => 'Failed to fetch usage'];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Clear cached prices (force refresh)
     */
    public function clearCache(): void
    {
        Cache::forget("gold_prices_{$this->baseCurrency}");
        Cache::forget("gold_carat_prices_{$this->baseCurrency}");
    }

    /**
     * Log prices to database
     */
    protected function logPrices(array $data): void
    {
        try {
            GoldPriceLog::create([
                'gold_price_per_gram' => $data['prices']['gold']['per_gram'] ?? null,
                'silver_price_per_gram' => $data['prices']['silver']['per_gram'] ?? null,
                'base_currency' => $data['base_currency'],
                'source' => $data['source'],
                'raw_data' => json_encode($data['raw_rates'] ?? []),
                'fetched_at' => now(),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to log gold prices', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Fallback prices when API is unavailable
     */
    protected function getFallbackPrices(): array
    {
        // Try to get last logged price
        $lastLog = GoldPriceLog::latest('fetched_at')->first();
        
        if ($lastLog) {
            return [
                'success' => true,
                'source' => 'cache',
                'timestamp' => $lastLog->fetched_at->timestamp,
                'base_currency' => $this->baseCurrency,
                'prices' => [
                    'gold' => [
                        'per_gram' => $lastLog->gold_price_per_gram,
                        'per_troy_oz' => round($lastLog->gold_price_per_gram * 31.1035, 2),
                    ],
                    'silver' => [
                        'per_gram' => $lastLog->silver_price_per_gram,
                        'per_troy_oz' => round($lastLog->silver_price_per_gram * 31.1035, 2),
                    ],
                ],
                'cached_at' => $lastLog->fetched_at->toIso8601String(),
            ];
        }

        // Ultimate fallback - configured default prices
        $defaultGold = config('pawnsys.gold_price.fallback_999', 400);
        
        return [
            'success' => true,
            'source' => 'fallback',
            'timestamp' => time(),
            'base_currency' => $this->baseCurrency,
            'prices' => [
                'gold' => [
                    'per_gram' => $defaultGold,
                    'per_troy_oz' => round($defaultGold * 31.1035, 2),
                ],
                'silver' => [
                    'per_gram' => 4.50,
                    'per_troy_oz' => round(4.50 * 31.1035, 2),
                ],
            ],
            'note' => 'Using fallback prices - API not configured',
        ];
    }

    /**
     * Fallback carat prices
     */
    protected function getFallbackCaratPrices(): array
    {
        $gold999 = config('pawnsys.gold_price.fallback_999', 400);
        
        return [
            'success' => true,
            'source' => 'fallback',
            'timestamp' => time(),
            'base_currency' => $this->baseCurrency,
            'unit' => 'per_gram',
            'prices' => [
                '24k' => $gold999,
                '22k' => round($gold999 * 0.916, 2),
                '21k' => round($gold999 * 0.875, 2),
                '18k' => round($gold999 * 0.750, 2),
                '14k' => round($gold999 * 0.585, 2),
                '9k' => round($gold999 * 0.375, 2),
            ],
            'purity_codes' => [
                '999' => $gold999,
                '916' => round($gold999 * 0.916, 2),
                '875' => round($gold999 * 0.875, 2),
                '750' => round($gold999 * 0.750, 2),
                '585' => round($gold999 * 0.585, 2),
                '375' => round($gold999 * 0.375, 2),
            ],
            'note' => 'Using fallback prices - API not configured',
        ];
    }
}
