<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | This configuration determines what cross-origin operations may execute
    | in web browsers. Adjust these settings as needed for your React frontend.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'storage/*'],

    'allowed_methods' => ['*'],

   'allowed_origins' => [
    env('FRONTEND_URL', 'http://localhost:5173'),
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8001',
    'https://pajak-kedai.graspsoftwaresolutions.xyz',
    'https://dsaraassetventures.com',
    'https://devtesting.dsaraassetventures.com',
],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['Content-Disposition', 'Content-Type'],

    'max_age' => 0,

    'supports_credentials' => true,

];
