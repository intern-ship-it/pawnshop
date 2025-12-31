<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

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

// Update gold prices daily at 8 AM
Schedule::command('pawnsys:update-gold-prices')
    ->dailyAt('08:00')
    ->timezone('Asia/Kuala_Lumpur');

// Send due date reminders at 9 AM
Schedule::command('pawnsys:send-due-reminders')
    ->dailyAt('09:00')
    ->timezone('Asia/Kuala_Lumpur');

// Update overdue status at midnight
Schedule::command('pawnsys:update-overdue-status')
    ->dailyAt('00:00')
    ->timezone('Asia/Kuala_Lumpur');

// Generate monthly reports on 1st of each month
Schedule::command('pawnsys:generate-monthly-report')
    ->monthlyOn(1, '06:00')
    ->timezone('Asia/Kuala_Lumpur');
