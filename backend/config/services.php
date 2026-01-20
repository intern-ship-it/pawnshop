<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Metals.Dev API (Primary Gold Price Source)
    |--------------------------------------------------------------------------
    |
    | Real-time precious metals API with BID/ASK prices
    | Sign up: https://metals.dev/
    | Recommended: Pro plan ($9.99/mo) for 20,000 calls/month
    |
    */
    'metals_dev' => [
        'api_key' => env('METALS_DEV_API_KEY'),
        'base_url' => 'https://api.metals.dev/v1',
        'timeout' => 10,
        'currency' => 'MYR',
        'metal' => 'gold',
    ],

    /*
    |--------------------------------------------------------------------------
    | BNM Kijang Emas API (Secondary/Official Reference)
    |--------------------------------------------------------------------------
    |
    | Bank Negara Malaysia official gold price
    | No API key required
    | Updates daily at 10:00 AM MYT
    |
    */

    'bnm_kijang' => [
        'base_url' => 'https://api.bnm.gov.my/public',
        'endpoint' => '/kijang-emas',
        'timeout' => 10,
    ],

    /*
    |--------------------------------------------------------------------------
    | MetalPriceAPI (Legacy/Backup)
    |--------------------------------------------------------------------------
    |
    | Keep for backward compatibility
    | Note: Does NOT include BID/ASK prices (spot only)
    |
    */
    'metalpriceapi' => [
        'api_key' => env('METAL_PRICE_API_KEY'),
        'base_url' => 'https://api.metalpriceapi.com/v1',
        'timeout' => 10,
    ],

];