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
     * Get audit logs with filters and stats
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

        // Date range filter
        if ($dateRange = $request->get('date_range')) {
            $today = now()->startOfDay();

            switch ($dateRange) {
                case 'today':
                    $query->where('created_at', '>=', $today);
                    break;
                case 'week':
                    $query->where('created_at', '>=', $today->copy()->subWeek());
                    break;
                case 'month':
                    $query->where('created_at', '>=', $today->copy()->subMonth());
                    break;
            }
        }

        // Custom date range
        if ($from = $request->get('from_date')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->get('to_date')) {
            $query->whereDate('created_at', '<=', $to);
        }

        // Search - include description
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                    ->orWhere('record_type', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        // Get stats before pagination
        $statsQuery = AuditLog::where('branch_id', $branchId);
        $today = now()->startOfDay();

        $stats = [
            'total' => (clone $statsQuery)->count(),
            'today' => (clone $statsQuery)->where('created_at', '>=', $today)->count(),
            'transactions' => (clone $statsQuery)
                ->whereIn('action', ['create', 'update'])
                ->whereIn('module', ['pledge', 'renewal', 'redemption'])
                ->count(),
            'overrides' => (clone $statsQuery)->where('action', 'override')->count(),
        ];

        $logs = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 50));

        return $this->success([
            'logs' => $logs,
            'stats' => $stats,
        ]);
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

    /**
     * Get filter options for audit logs
     */
    public function getOptions(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = AuditLog::where('branch_id', $branchId);

        // Get unique modules
        $modules = (clone $query)->distinct()->pluck('module')->filter()->values();

        // Get unique actions  
        $actions = (clone $query)->distinct()->pluck('action')->filter()->values();

        // Get users who have logs
        $userIds = (clone $query)->distinct()->pluck('user_id')->filter();
        $users = \App\Models\User::whereIn('id', $userIds)
            ->select('id', 'name')
            ->orderBy('name')
            ->get();

        return $this->success([
            'modules' => $modules,
            'actions' => $actions,
            'users' => $users,
        ]);
    }
}
