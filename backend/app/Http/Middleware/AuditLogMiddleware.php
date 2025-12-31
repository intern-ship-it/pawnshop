<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\AuditLog;
use Symfony\Component\HttpFoundation\Response;

class AuditLog
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Only log for authenticated users
        if ($request->user()) {
            $this->logRequest($request, $response);
        }

        return $response;
    }

    /**
     * Log the request
     */
    protected function logRequest(Request $request, Response $response): void
    {
        // Only log write operations
        if (!in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'])) {
            return;
        }

        // Skip certain routes
        $skipRoutes = ['api/auth/login', 'api/auth/logout', 'api/auth/refresh'];
        if (in_array($request->path(), $skipRoutes)) {
            return;
        }

        try {
            \App\Models\AuditLog::create([
                'branch_id' => $request->user()->branch_id,
                'user_id' => $request->user()->id,
                'action' => $request->method(),
                'module' => $this->getModuleFromPath($request->path()),
                'record_type' => $this->getRecordType($request),
                'record_id' => $this->getRecordId($request),
                'old_values' => null, // Would need model observer for this
                'new_values' => $response->isSuccessful() ? $request->except(['password', 'passkey']) : null,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
        } catch (\Exception $e) {
            // Don't fail request if logging fails
            \Log::error('Audit log failed: ' . $e->getMessage());
        }
    }

    /**
     * Get module name from path
     */
    protected function getModuleFromPath(string $path): string
    {
        $parts = explode('/', str_replace('api/', '', $path));
        return $parts[0] ?? 'unknown';
    }

    /**
     * Get record type from request
     */
    protected function getRecordType(Request $request): ?string
    {
        $path = $request->path();

        if (str_contains($path, 'customers'))
            return 'Customer';
        if (str_contains($path, 'pledges'))
            return 'Pledge';
        if (str_contains($path, 'renewals'))
            return 'Renewal';
        if (str_contains($path, 'redemptions'))
            return 'Redemption';
        if (str_contains($path, 'users'))
            return 'User';
        if (str_contains($path, 'settings'))
            return 'Setting';

        return null;
    }

    /**
     * Get record ID from route parameters
     */
    protected function getRecordId(Request $request): ?int
    {
        $params = $request->route()->parameters();

        foreach ($params as $param) {
            if (is_object($param) && method_exists($param, 'getKey')) {
                return $param->getKey();
            }
            if (is_numeric($param)) {
                return (int) $param;
            }
        }

        return null;
    }
}
