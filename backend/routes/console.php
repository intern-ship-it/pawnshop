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

// ==========================================================================
// OWNER DASHBOARD — Daily PDF to WhatsApp
// ==========================================================================
//
// Triggered directly by a dedicated cPanel cron entry at a fixed time
// (e.g. `0 20 * * *`), NOT via the Laravel scheduler. This keeps the cron
// firing only once per day. The `enabled` flag is still re-checked inside
// the command, so disabling delivery in the UI takes effect immediately.
//
// To change the send time: edit the cPanel cron entry — the value shown in
// Settings → Owner Dashboard is read-only and informational.

// Weekly cleanup of owner-dashboard PDFs older than 30 days.
// UltraMsg fetches the file once at send time; after that the local copy is
// only useful for audit/debug. 30 days keeps recent reports retrievable
// without letting storage grow unbounded.
Schedule::call(function () {
    $disk    = \Storage::disk('public');
    $cutoff  = now()->subDays(30)->getTimestamp();
    $deleted = 0;

    foreach ($disk->files('owner-dashboards') as $file) {
        if ($disk->lastModified($file) < $cutoff) {
            $disk->delete($file);
            $deleted++;
        }
    }

    if ($deleted > 0) {
        \Log::info("Owner dashboard cleanup: deleted {$deleted} file(s) older than 30 days");
    }
})
    ->weeklyOn(0, '03:00')
    ->timezone('Asia/Kuala_Lumpur')
    ->name('owner-dashboard-cleanup')
    ->onOneServer();