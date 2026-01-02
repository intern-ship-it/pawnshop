<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\GoldPriceService;
use App\Models\GoldPriceLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GoldPriceController extends Controller
{
    protected GoldPriceService $goldPriceService;

    public function __construct(GoldPriceService $goldPriceService)
    {
        $this->goldPriceService = $goldPriceService;
    }

    /**
     * Get current gold prices
     * 
     * GET /api/gold-prices/current
     */
    public function current(): JsonResponse
    {
        $prices = $this->goldPriceService->getCurrentPrices();
        return $this->success($prices);
    }

    /**
     * Get gold prices by carat/purity
     * 
     * GET /api/gold-prices/carat
     */
    public function carat(): JsonResponse
    {
        $prices = $this->goldPriceService->getCaratPrices();
        return $this->success($prices);
    }

    /**
     * Get historical prices for a specific date
     * 
     * GET /api/gold-prices/historical/{date}
     */
    public function historical(string $date): JsonResponse
    {
        // Validate date format
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return $this->error('Invalid date format. Use YYYY-MM-DD', 422);
        }

        $prices = $this->goldPriceService->getHistoricalPrices($date);
        
        if (!$prices['success']) {
            return $this->error($prices['error'] ?? 'Failed to fetch historical prices', 400);
        }

        return $this->success($prices);
    }

    /**
     * Calculate item value based on weight and purity
     * 
     * POST /api/gold-prices/calculate
     */
    public function calculate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'weight_grams' => 'required|numeric|min:0.01|max:10000',
            'purity_code' => 'required|string|in:999,916,875,750,585,375',
            'custom_price' => 'nullable|numeric|min:0',
        ]);

        $result = $this->goldPriceService->calculateItemValue(
            $validated['weight_grams'],
            $validated['purity_code'],
            $validated['custom_price'] ?? null
        );

        return $this->success($result);
    }

    /**
     * Get price history for charts
     * 
     * GET /api/gold-prices/history
     */
    public function history(Request $request): JsonResponse
    {
        $days = $request->input('days', 30);
        $days = min(max($days, 1), 365); // Limit 1-365 days

        $history = GoldPriceLog::getDailyAverages($days);
        
        return $this->success([
            'days' => $days,
            'data' => $history,
        ]);
    }

    /**
     * Force refresh prices (clear cache)
     * 
     * POST /api/gold-prices/refresh
     */
    public function refresh(): JsonResponse
    {
        $this->goldPriceService->clearCache();
        $prices = $this->goldPriceService->getCurrentPrices();
        
        return $this->success($prices, 'Prices refreshed successfully');
    }

    /**
     * Manually set gold price (for when API is down)
     * 
     * POST /api/gold-prices/manual
     */
    public function setManual(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gold_price_per_gram' => 'required|numeric|min:1|max:10000',
            'silver_price_per_gram' => 'nullable|numeric|min:0|max:1000',
        ]);

        GoldPriceLog::create([
            'gold_price_per_gram' => $validated['gold_price_per_gram'],
            'silver_price_per_gram' => $validated['silver_price_per_gram'] ?? null,
            'base_currency' => 'MYR',
            'source' => 'manual',
            'fetched_at' => now(),
        ]);

        // Clear cache so new manual price is used
        $this->goldPriceService->clearCache();

        return $this->success([
            'gold_price_per_gram' => $validated['gold_price_per_gram'],
            'silver_price_per_gram' => $validated['silver_price_per_gram'] ?? null,
        ], 'Manual price set successfully');
    }

    /**
     * Get API usage stats (admin only)
     * 
     * GET /api/gold-prices/usage
     */
    public function usage(): JsonResponse
    {
        $usage = $this->goldPriceService->getUsageStats();
        return $this->success($usage);
    }

    /**
     * Get all prices combined (for dashboard widget)
     * 
     * GET /api/gold-prices/dashboard
     */
    public function dashboard(): JsonResponse
    {
        $currentPrices = $this->goldPriceService->getCurrentPrices();
        $caratPrices = $this->goldPriceService->getCaratPrices();
        
        // Get price change from yesterday
        $lastLog = GoldPriceLog::where('fetched_at', '<', now()->startOfDay())
            ->latest('fetched_at')
            ->first();
        
        $priceChange = null;
        $priceChangePercent = null;
        
        if ($lastLog && isset($currentPrices['prices']['gold']['per_gram'])) {
            $currentGold = $currentPrices['prices']['gold']['per_gram'];
            $previousGold = $lastLog->gold_price_per_gram;
            
            if ($previousGold > 0) {
                $priceChange = round($currentGold - $previousGold, 2);
                $priceChangePercent = round((($currentGold - $previousGold) / $previousGold) * 100, 2);
            }
        }

        return $this->success([
            'current' => $currentPrices,
            'carat' => $caratPrices,
            'change' => [
                'amount' => $priceChange,
                'percent' => $priceChangePercent,
                'direction' => $priceChange > 0 ? 'up' : ($priceChange < 0 ? 'down' : 'unchanged'),
            ],
            'last_updated' => now()->toIso8601String(),
        ]);
    }
}
