<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PasskeyLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AuditController extends Controller
{
    /**
     * Get audit logs
     */
    public function auditLogs(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = AuditLog::where('branch_id', $branchId)
            ->with(['user:id,name,email']);

        // Filter by user
        if ($userId = $request->get('user_id')) {
            $query->where('user_id', $userId);
        }

        // Filter by module
        if ($module = $request->get('module')) {
            $query->where('module', $module);
        }

        // Filter by action
        if ($action = $request->get('action')) {
            $query->where('action', $action);
        }

        // Filter by date
        if ($from = $request->get('from_date')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->get('to_date')) {
            $query->whereDate('created_at', '<=', $to);
        }

        // Search
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('record_type', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        $logs = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 20));

        return $this->paginated($logs);
    }

    /**
     * Get passkey logs
     */
    public function passkeyLogs(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = PasskeyLog::where('branch_id', $branchId)
            ->with(['user:id,name', 'passkeyUser:id,name']);

        // Filter by user
        if ($userId = $request->get('user_id')) {
            $query->where('user_id', $userId);
        }

        // Filter by action
        if ($action = $request->get('action')) {
            $query->where('action', $action);
        }

        // Filter by module
        if ($module = $request->get('module')) {
            $query->where('module', $module);
        }

        // Filter by date
        if ($from = $request->get('from_date')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->get('to_date')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $logs = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 20));

        return $this->paginated($logs);
    }

    /**
     * Get activity summary
     */
    public function activitySummary(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $days = $request->get('days', 7);

        $fromDate = now()->subDays($days);

        // Actions by type
        $actionsByType = AuditLog::where('branch_id', $branchId)
            ->where('created_at', '>=', $fromDate)
            ->selectRaw('action, COUNT(*) as count')
            ->groupBy('action')
            ->pluck('count', 'action');

        // Actions by module
        $actionsByModule = AuditLog::where('branch_id', $branchId)
            ->where('created_at', '>=', $fromDate)
            ->selectRaw('module, COUNT(*) as count')
            ->groupBy('module')
            ->pluck('count', 'module');

        // Actions by user
        $actionsByUser = AuditLog::where('branch_id', $branchId)
            ->where('created_at', '>=', $fromDate)
            ->selectRaw('user_id, COUNT(*) as count')
            ->groupBy('user_id')
            ->with('user:id,name')
            ->get()
            ->map(fn($item) => [
                'user' => $item->user?->name ?? 'Unknown',
                'count' => $item->count,
            ]);

        // Passkey usage
        $passkeyUsage = PasskeyLog::where('branch_id', $branchId)
            ->where('created_at', '>=', $fromDate)
            ->count();

        return $this->success([
            'period_days' => $days,
            'by_action' => $actionsByType,
            'by_module' => $actionsByModule,
            'by_user' => $actionsByUser,
            'passkey_verifications' => $passkeyUsage,
        ]);
    }
}
