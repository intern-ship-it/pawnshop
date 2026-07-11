<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DeveloperOnly
{
    /**
     * Gate for hidden developer tooling.
     *
     * Aborts 404 — never 403 — so that a non-developer who stumbles onto the
     * URL cannot tell there is anything here to attack. Note this is a role
     * identity check: a super-admin is deliberately NOT allowed through.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            abort(404);
        }

        if (!$user->relationLoaded('role')) {
            $user->load('role');
        }

        if (!$user->isDeveloper()) {
            abort(404);
        }

        // A deactivated developer (see `developer:credentials --deactivate`) is
        // no more welcome than a stranger, and learns just as little.
        if (!$user->is_active) {
            abort(404);
        }

        return $next($request);
    }
}
