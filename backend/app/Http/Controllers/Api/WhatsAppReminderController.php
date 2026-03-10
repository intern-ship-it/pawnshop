<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pledge;
use App\Models\WhatsAppConfig;
use App\Models\WhatsAppTemplate;
use App\Models\WhatsAppLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;

class WhatsAppReminderController extends Controller
{
    /**
     * Preview what reminders would be sent (dry-run data for frontend).
     * GET /api/whatsapp/reminders/preview
     */
    public function preview(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $today = Carbon::today();

        $reminderTypes = [
            'reminder_7days' => ['days_before' => 7, 'label' => '7 Days Reminder'],
            'reminder_3days' => ['days_before' => 3, 'label' => '3 Days Reminder'],
            'reminder_1day'  => ['days_before' => 1, 'label' => '1 Day Reminder'],
            'overdue_notice'  => ['days_before' => -1, 'label' => 'Overdue Notice'],
        ];

        $preview = [];
        $totalCount = 0;
        $alreadySentCount = 0;

        foreach ($reminderTypes as $templateKey => $config) {
            $daysBefore = $config['days_before'];

            // Check template availability
            $template = WhatsAppTemplate::where('template_key', $templateKey)
                ->where(function ($q) use ($branchId) {
                    $q->where('branch_id', $branchId)->orWhereNull('branch_id');
                })
                ->where('is_enabled', true)
                ->orderBy('branch_id', 'desc')
                ->first();

            // Query pledges
            if ($daysBefore > 0) {
                $targetDate = $today->copy()->addDays($daysBefore);
                $pledges = Pledge::where('branch_id', $branchId)
                    ->where('status', 'active')
                    ->whereDate('due_date', $targetDate)
                    ->with(['customer:id,name,phone,country_code,ic_number'])
                    ->get();
            } else {
                $pledges = Pledge::where('branch_id', $branchId)
                    ->where('status', 'active')
                    ->where('due_date', '<', $today)
                    ->with(['customer:id,name,phone,country_code,ic_number'])
                    ->get();
            }

            $pledgeItems = [];
            foreach ($pledges as $pledge) {
                // Check if already sent today
                $alreadySent = WhatsAppLog::where('related_type', $templateKey)
                    ->where('related_id', $pledge->id)
                    ->where('status', 'sent')
                    ->whereDate('created_at', $today)
                    ->exists();

                if ($alreadySent) {
                    $alreadySentCount++;
                }

                $customer = $pledge->customer;
                $hasPhone = $customer && $customer->phone;

                $pledgeItems[] = [
                    'pledge_id' => $pledge->id,
                    'pledge_no' => $pledge->pledge_no,
                    'receipt_no' => $pledge->receipt_no,
                    'customer_name' => $customer->name ?? 'N/A',
                    'customer_ic' => $customer->ic_number ?? 'N/A',
                    'customer_phone' => $hasPhone ? $customer->phone : null,
                    'loan_amount' => (float) $pledge->loan_amount,
                    'due_date' => $pledge->due_date->format('Y-m-d'),
                    'due_date_display' => $pledge->due_date->format('d/m/Y'),
                    'days_overdue' => $pledge->due_date->lt($today) ? $today->diffInDays($pledge->due_date) : 0,
                    'days_remaining' => $pledge->due_date->gte($today) ? $today->diffInDays($pledge->due_date) : 0,
                    'current_interest' => (float) $pledge->current_interest_amount,
                    'total_payable' => (float) ($pledge->loan_amount + $pledge->current_interest_amount),
                    'has_phone' => $hasPhone,
                    'already_sent_today' => $alreadySent,
                ];

                $totalCount++;
            }

            $preview[] = [
                'template_key' => $templateKey,
                'label' => $config['label'],
                'days_before' => $daysBefore,
                'template_enabled' => $template !== null,
                'template_name' => $template?->name ?? 'Not Found',
                'count' => count($pledgeItems),
                'pledges' => $pledgeItems,
            ];
        }

        // WhatsApp config status
        $whatsappConfig = WhatsAppConfig::where('branch_id', $branchId)->first();

        return $this->success([
            'date' => $today->format('Y-m-d'),
            'date_display' => $today->format('d/m/Y (l)'),
            'branch_id' => $branchId,
            'whatsapp_enabled' => $whatsappConfig?->is_enabled ?? false,
            'whatsapp_provider' => $whatsappConfig?->provider ?? 'not configured',
            'total_pledges' => $totalCount,
            'already_sent_today' => $alreadySentCount,
            'reminders' => $preview,
        ]);
    }

    /**
     * Trigger the reminder command (dry-run or actual send).
     * POST /api/whatsapp/reminders/send
     */
    public function send(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'dry_run' => 'sometimes|boolean',
        ]);

        $isDryRun = $validated['dry_run'] ?? false;
        $branchId = $request->user()->branch_id;

        // Check WhatsApp is configured
        $config = WhatsAppConfig::where('branch_id', $branchId)
            ->where('is_enabled', true)
            ->first();

        if (!$config && !$isDryRun) {
            return $this->error('WhatsApp not configured or disabled for this branch', 422);
        }

        try {
            // Run the artisan command and capture output
            $params = ['--branch' => $branchId];
            if ($isDryRun) {
                $params['--dry-run'] = true;
            }

            $exitCode = Artisan::call('pawnsys:send-due-reminders', $params);
            $output = Artisan::output();

            // Parse output for summary
            $lines = explode("\n", trim($output));
            $summary = [
                'sent' => 0,
                'skipped' => 0,
                'no_phone' => 0,
                'failed' => 0,
            ];

            foreach ($lines as $line) {
                if (preg_match('/^Sent:\s+(\d+)/', trim($line), $m)) $summary['sent'] = (int) $m[1];
                if (preg_match('/^Skipped:\s+(\d+)/', trim($line), $m)) $summary['skipped'] = (int) $m[1];
                if (preg_match('/^No Phone:\s+(\d+)/', trim($line), $m)) $summary['no_phone'] = (int) $m[1];
                if (preg_match('/^Failed:\s+(\d+)/', trim($line), $m)) $summary['failed'] = (int) $m[1];
            }

            return $this->success([
                'dry_run' => $isDryRun,
                'exit_code' => $exitCode,
                'summary' => $summary,
                'output' => $output,
            ], $isDryRun ? 'Dry run completed' : 'Reminders sent');

        } catch (\Exception $e) {
            Log::error('WhatsApp reminder send failed: ' . $e->getMessage());
            return $this->error('Failed to run reminders: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get reminder logs for today.
     * GET /api/whatsapp/reminders/logs
     */
    public function logs(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $date = $request->get('date', Carbon::today()->format('Y-m-d'));

        $logs = WhatsAppLog::where('branch_id', $branchId)
            ->whereIn('related_type', ['reminder_7days', 'reminder_3days', 'reminder_1day', 'overdue_notice'])
            ->whereDate('created_at', $date)
            ->with(['template:id,template_key,name'])
            ->orderBy('created_at', 'desc')
            ->get();

        $summary = [
            'total' => $logs->count(),
            'sent' => $logs->where('status', 'sent')->count(),
            'failed' => $logs->where('status', 'failed')->count(),
            'by_type' => [
                'reminder_7days' => $logs->where('related_type', 'reminder_7days')->count(),
                'reminder_3days' => $logs->where('related_type', 'reminder_3days')->count(),
                'reminder_1day' => $logs->where('related_type', 'reminder_1day')->count(),
                'overdue_notice' => $logs->where('related_type', 'overdue_notice')->count(),
            ],
        ];

        return $this->success([
            'date' => $date,
            'summary' => $summary,
            'logs' => $logs,
        ]);
    }
}
