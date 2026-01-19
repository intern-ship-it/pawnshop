<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AuditLogController extends Controller
{
    /**
     * Get audit logs with filters
     */
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::with(['user:id,name', 'branch:id,name,code'])
            ->orderBy('created_at', 'desc');

        // Branch filter (admin can see all, others see own branch)
        $user = $request->user();
        if (!$user->hasRole('super_admin')) {
            $query->where('branch_id', $user->branch_id);
        }

        // Module filter
        if ($module = $request->get('module')) {
            $query->where('module', $module);
        }

        // Action filter
        if ($action = $request->get('action')) {
            $query->where('action', $action);
        }

        // User filter
        if ($userId = $request->get('user_id')) {
            $query->where('user_id', $userId);
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

        // Start/end date
        if ($startDate = $request->get('start_date')) {
            $query->where('created_at', '>=', $startDate);
        }
        if ($endDate = $request->get('end_date')) {
            $query->where('created_at', '<=', $endDate . ' 23:59:59');
        }

        // Search
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($q2) use ($search) {
                        $q2->where('name', 'like', "%{$search}%");
                    });
            });
        }

        // Pagination
        $perPage = min($request->get('per_page', 50), 100);
        $logs = $query->paginate($perPage);

        // Get stats
        $branchId = $user->hasRole('super_admin') ? null : $user->branch_id;
        $stats = $this->getStats($branchId);

        return $this->success([
            'logs' => $logs,
            'stats' => $stats,
        ]);
    }

    /**
     * Get single log
     */
    public function show(Request $request, AuditLog $auditLog): JsonResponse
    {
        $user = $request->user();

        // Check access
        if (!$user->hasRole('super_admin') && $auditLog->branch_id !== $user->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $auditLog->load(['user:id,name,email', 'branch:id,name,code']);

        return $this->success($auditLog);
    }

    /**
     * Get stats
     */
    private function getStats(?int $branchId): array
    {
        $baseQuery = AuditLog::query();

        if ($branchId) {
            $baseQuery->where('branch_id', $branchId);
        }

        $today = now()->startOfDay();
        $weekAgo = now()->subWeek();

        return [
            'total' => (clone $baseQuery)->count(),
            'today' => (clone $baseQuery)->where('created_at', '>=', $today)->count(),
            'this_week' => (clone $baseQuery)->where('created_at', '>=', $weekAgo)->count(),
            'transactions' => (clone $baseQuery)
                ->whereIn('action', ['create', 'update'])
                ->whereIn('module', ['pledge', 'renewal', 'redemption'])
                ->count(),
            'overrides' => (clone $baseQuery)->where('action', 'override')->count(),
            'logins' => (clone $baseQuery)->where('action', 'login')->count(),
        ];
    }

    /**
     * Get filter options
     */
    public function getOptions(Request $request): JsonResponse
    {
        $user = $request->user();
        $branchId = $user->hasRole('super_admin') ? null : $user->branch_id;

        $query = AuditLog::query();
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        // Get unique values for filters
        $modules = (clone $query)->distinct()->pluck('module')->filter()->values();
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

    /**
     * Export logs as CSV
     */
    public function export(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $user = $request->user();

        $query = AuditLog::with(['user:id,name'])
            ->orderBy('created_at', 'desc');

        if (!$user->hasRole('super_admin')) {
            $query->where('branch_id', $user->branch_id);
        }

        // Apply same filters as index
        if ($module = $request->get('module')) {
            $query->where('module', $module);
        }
        if ($action = $request->get('action')) {
            $query->where('action', $action);
        }
        if ($startDate = $request->get('start_date')) {
            $query->where('created_at', '>=', $startDate);
        }
        if ($endDate = $request->get('end_date')) {
            $query->where('created_at', '<=', $endDate . ' 23:59:59');
        }

        $logs = $query->limit(10000)->get();

        $filename = 'audit_log_' . now()->format('Y-m-d_His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($logs) {
            $file = fopen('php://output', 'w');

            // Header row
            fputcsv($file, [
                'ID',
                'Timestamp',
                'User',
                'Module',
                'Action',
                'Description',
                'Record Type',
                'Record ID',
                'IP Address',
                'Severity',
            ]);

            foreach ($logs as $log) {
                fputcsv($file, [
                    $log->id,
                    $log->created_at?->format('Y-m-d H:i:s'),
                    $log->user?->name ?? 'System',
                    $log->module,
                    $log->action,
                    $log->description,
                    $log->record_type,
                    $log->record_id,
                    $log->ip_address,
                    $log->severity ?? 'info',
                ]);
            }

            fclose($file);
        };

        // Log the export
        AuditLog::log(
            AuditLog::ACTION_EXPORT,
            'audit',
            'Exported audit logs',
            null,
            null,
            null,
            ['count' => $logs->count()]
        );

        return response()->stream($callback, 200, $headers);
    }
}
