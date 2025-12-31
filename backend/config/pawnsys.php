<?php

return [

    /*
    |--------------------------------------------------------------------------
    | PawnSys Application Settings
    |--------------------------------------------------------------------------
    */

    // Pledge Settings
    'pledge' => [
        'prefix' => 'PLG',
        'default_loan_percentages' => [80, 70, 60],
        'max_renewal_months' => 6,
        'grace_period_days' => 7,
    ],

    // Interest Rates (Default)
    'interest' => [
        'standard' => 0.5,      // First 6 months: 0.5% per month
        'extended' => 1.5,      // After 6 months: 1.5% per month
        'overdue' => 2.0,       // Overdue: 2.0% per month (max KPKT)
    ],

    // Handling Fee (KPKT Rule)
    'handling_fee' => [
        'enabled' => true,
        'amount' => 0.50,
        'min_loan' => 10.00,    // Only for loans above RM10
    ],

    // Receipt Settings
    'receipt' => [
        'reprint_charge' => 2.00,
        'first_print_free' => true,
    ],

    // Gold Purities
    'purities' => [
        '999' => ['name' => '999 (24K)', 'percentage' => 99.9],
        '916' => ['name' => '916 (22K)', 'percentage' => 91.6],
        '875' => ['name' => '875 (21K)', 'percentage' => 87.5],
        '750' => ['name' => '750 (18K)', 'percentage' => 75.0],
        '585' => ['name' => '585 (14K)', 'percentage' => 58.5],
        '375' => ['name' => '375 (9K)', 'percentage' => 37.5],
    ],

    // Storage Settings
    'storage' => [
        'default_slots_per_box' => 20,
        'default_boxes_per_vault' => 100,
    ],

    // WhatsApp Settings
    'whatsapp' => [
        'provider' => env('WHATSAPP_PROVIDER', 'ultramsg'),
        'instance_id' => env('WHATSAPP_INSTANCE_ID'),
        'api_token' => env('WHATSAPP_API_TOKEN'),
    ],

    // Barcode Settings
    'barcode' => [
        'type' => 'C128',
        'height' => 30,
        'width' => 2,
    ],

    // Reconciliation Settings
    'reconciliation' => [
        'schedule' => 'weekly',  // 'daily', 'weekly', 'monthly'
    ],

    // Date Format (Malaysian)
    'date_format' => 'd/m/Y',
    'datetime_format' => 'd/m/Y H:i:s',

];
