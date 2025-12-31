<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckBranch
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || !$user->branch_id) {
            return response()->json([
                'success' => false,
                'message' => 'No branch assigned to user',
            ], 403);
        }

        if (!$user->branch->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Branch is inactive',
            ], 403);
        }

        return $next($request);
    }
}
