<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Allow authentication via query string token parameter.
 * Used for PDF downloads where the browser opens a direct URL
 * (window.open) and cannot send Authorization headers.
 */
class TokenFromQuery
{
    public function handle(Request $request, Closure $next)
    {
        if (!$request->bearerToken() && $request->has('token')) {
            $request->headers->set('Authorization', 'Bearer ' . $request->query('token'));
        }

        return $next($request);
    }
}
