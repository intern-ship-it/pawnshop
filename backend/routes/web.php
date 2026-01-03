<?php

use Illuminate\Support\Facades\Route;

// Serve React app for root
Route::get('/', function () {
    return file_get_contents(public_path('index.html'));
});

// Serve React app for all other non-API routes
Route::get('/{any}', function () {
    return file_get_contents(public_path('index.html'));
})->where('any', '^(?!api).*$');