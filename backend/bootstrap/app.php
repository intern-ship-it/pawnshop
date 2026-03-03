<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->statefulApi();

        // Allow token from query string for PDF downloads (runs before auth:sanctum)
        $middleware->api(prepend: [
            \App\Http\Middleware\TokenFromQuery::class,
        ]);
        // Disable CSRF for API routes
        $middleware->validateCsrfTokens(except: [
            'api/*',
            'sanctum/csrf-cookie',
        ]);

        $middleware->alias([
            'check.branch' => \App\Http\Middleware\CheckBranch::class,
            'check.permission' => \App\Http\Middleware\CheckPermission::class,
            'audit.log' => \App\Http\Middleware\AuditLogMiddleware::class,
            'token.query' => \App\Http\Middleware\TokenFromQuery::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();