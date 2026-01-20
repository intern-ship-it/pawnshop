<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Services\GoldPriceService;

/*
|--------------------------------------------------------------------------
| Console Routes
|--------------------------------------------------------------------------
*/

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Scheduled Tasks
|--------------------------------------------------------------------------
*/

// ==========================================================================
// GOLD PRICE TASKS (KPKT Compliance - Dual Source)
// ==========================================================================

// Fetch gold prices every 15 minutes during business hours (weekdays 8AM-6PM)
// Uses: Metals.Dev (PRIMARY) + BNM Kijang Emas (SECONDARY)
Schedule::call(function () {
    $service = app(GoldPriceService::class);
    $result = $service->fetchAndStorePrices(null, null);

    if (!$result['success']) {
        \Log::warning('Scheduled gold price fetch failed', $result['errors'] ?? []);
    } else {
        \Log::info('Gold price fetch successful', [
            'source' => $result['active_source'],
            'price_999' => $result['prices']['price_999'] ?? null,
        ]);
    }
})
    ->everyFifteenMinutes()
    ->weekdays()
    ->between('08:00', '18:00')
    ->timezone('Asia/Kuala_Lumpur')
    ->name('gold-price-fetch-realtime')
    ->withoutOverlapping();

// Daily gold price fetch at 10:30 AM (after BNM updates at 10:00 AM)
Schedule::call(function () {
    $service = app(GoldPriceService::class);
    $service->fetchAndStorePrices(null, null);
})
    ->dailyAt('10:30')
    ->timezone('Asia/Kuala_Lumpur')
    ->name('gold-price-fetch-daily')
    ->withoutOverlapping();

// Reset monthly API usage counters on 1st of each month
Schedule::call(function () {
    $service = app(GoldPriceService::class);
    $service->resetMonthlyUsage();
    \Log::info('Monthly gold price API usage counters reset');
})
    ->monthlyOn(1, '00:05')
    ->timezone('Asia/Kuala_Lumpur')
    ->name('gold-price-reset-usage');

// ==========================================================================
// EXISTING PAWNSYS TASKS
// ==========================================================================

// Update gold prices daily at 8 AM (legacy command - keep for backward compatibility)
Schedule::command('pawnsys:update-gold-prices')
    ->dailyAt('08:00')
    ->timezone('Asia/Kuala_Lumpur')
    ->name('pawnsys-update-gold-prices');

// Send due date reminders at 9 AM
Schedule::command('pawnsys:send-due-reminders')
    ->dailyAt('09:00')
    ->timezone('Asia/Kuala_Lumpur')
    ->name('pawnsys-due-reminders');

// Update overdue status at midnight
Schedule::command('pawnsys:update-overdue-status')
    ->dailyAt('00:00')
    ->timezone('Asia/Kuala_Lumpur')
    ->name('pawnsys-overdue-status');

// Generate monthly reports on 1st of each month
Schedule::command('pawnsys:generate-monthly-report')
    ->monthlyOn(1, '06:00')
    ->timezone('Asia/Kuala_Lumpur')
    ->name('pawnsys-monthly-report');