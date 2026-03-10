<?php

namespace App\Console\Commands;

use App\Models\Pledge;
use App\Models\WhatsAppConfig;
use App\Models\WhatsAppTemplate;
use App\Models\WhatsAppLog;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendDueReminders extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'pawnsys:send-due-reminders
                            {--dry-run : Show what would be sent without actually sending}
                            {--branch= : Only process a specific branch ID}';

    /**
     * The console command description.
     */
    protected $description = 'Send WhatsApp due date reminders (7 days, 3 days, 1 day, overdue)';

    /**
     * Reminder types mapped to template keys and day offsets.
     * Positive = days BEFORE due date, negative = days AFTER due date (overdue).
     */
    protected array $reminderTypes = [
        'reminder_7days' => ['days_before' => 7, 'label' => '7 Days Reminder'],
        'reminder_3days' => ['days_before' => 3, 'label' => '3 Days Reminder'],
        'reminder_1day'  => ['days_before' => 1, 'label' => '1 Day Reminder'],
        'overdue_notice'  => ['days_before' => -1, 'label' => 'Overdue Notice'], // 1 day after due
    ];

    /**
     * Counters for summary output.
     */
    protected int $sent = 0;
    protected int $skipped = 0;
    protected int $failed = 0;
    protected int $noPhone = 0;

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $isDryRun = $this->option('dry-run');
        $branchFilter = $this->option('branch');
        $today = Carbon::today();

        $this->info('========================================');
        $this->info('PawnSys Due Date Reminder');
        $this->info('Date: ' . $today->format('Y-m-d (l)'));
        if ($isDryRun) {
            $this->warn('*** DRY RUN MODE - No messages will be sent ***');
        }
        $this->info('========================================');

        // Get all branches with WhatsApp enabled
        $configQuery = WhatsAppConfig::where('is_enabled', true);
        if ($branchFilter) {
            $configQuery->where('branch_id', $branchFilter);
        }
        $configs = $configQuery->get();

        if ($configs->isEmpty()) {
            $this->warn('No branches with WhatsApp enabled found.');
            Log::info('SendDueReminders: No WhatsApp-enabled branches found');
            return 0;
        }

        $this->info("Found {$configs->count()} branch(es) with WhatsApp enabled.");
        $this->newLine();

        foreach ($configs as $config) {
            $this->processBranch($config, $today, $isDryRun);
        }

        // Summary
        $this->newLine();
        $this->info('========================================');
        $this->info('SUMMARY');
        $this->info('========================================');
        $this->info("Sent:      {$this->sent}");
        $this->info("Skipped:   {$this->skipped} (already sent today)");
        $this->info("No Phone:  {$this->noPhone}");
        $this->info("Failed:    {$this->failed}");
        $this->info('========================================');

        Log::info('SendDueReminders completed', [
            'sent' => $this->sent,
            'skipped' => $this->skipped,
            'failed' => $this->failed,
            'no_phone' => $this->noPhone,
        ]);

        return 0;
    }

    /**
     * Process all reminders for a single branch.
     */
    protected function processBranch(WhatsAppConfig $config, Carbon $today, bool $isDryRun): void
    {
        $branchId = $config->branch_id;
        $branchName = $config->branch?->name ?? "Branch #{$branchId}";

        $this->info("--- {$branchName} ---");

        foreach ($this->reminderTypes as $templateKey => $reminderConfig) {
            $this->processReminderType($config, $branchId, $templateKey, $reminderConfig, $today, $isDryRun);
        }
    }

    /**
     * Process a specific reminder type (e.g., 7-day, 3-day) for a branch.
     */
    protected function processReminderType(
        WhatsAppConfig $config,
        int $branchId,
        string $templateKey,
        array $reminderConfig,
        Carbon $today,
        bool $isDryRun
    ): void {
        $daysBefore = $reminderConfig['days_before'];
        $label = $reminderConfig['label'];

        // Get the template (branch-specific first, then global fallback)
        $template = WhatsAppTemplate::where('template_key', $templateKey)
            ->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->orWhereNull('branch_id');
            })
            ->where('is_enabled', true)
            ->orderBy('branch_id', 'desc') // Branch-specific first
            ->first();

        if (!$template) {
            $this->line("  [{$label}] Template '{$templateKey}' not found or disabled - skipping");
            return;
        }

        // Query pledges based on reminder type
        if ($daysBefore > 0) {
            // Before due date: find pledges due in exactly X days
            $targetDate = $today->copy()->addDays($daysBefore);
            $pledges = Pledge::where('branch_id', $branchId)
                ->where('status', 'active')
                ->whereDate('due_date', $targetDate)
                ->with(['customer:id,name,phone,country_code'])
                ->get();
        } else {
            // Overdue: find pledges that are overdue (due_date < today)
            // Only send once per day, for pledges overdue by 1+ days
            $pledges = Pledge::where('branch_id', $branchId)
                ->where('status', 'active')
                ->where('due_date', '<', $today)
                ->with(['customer:id,name,phone,country_code'])
                ->get();
        }

        if ($pledges->isEmpty()) {
            $this->line("  [{$label}] No pledges found");
            return;
        }

        $this->line("  [{$label}] Found {$pledges->count()} pledge(s)");

        foreach ($pledges as $pledge) {
            $this->sendReminder($config, $pledge, $template, $templateKey, $label, $isDryRun);
        }
    }

    /**
     * Send a single reminder for a pledge.
     */
    protected function sendReminder(
        WhatsAppConfig $config,
        Pledge $pledge,
        WhatsAppTemplate $template,
        string $templateKey,
        string $label,
        bool $isDryRun
    ): void {
        $customer = $pledge->customer;

        // Check customer has phone number
        if (!$customer || !$customer->phone) {
            $this->noPhone++;
            $this->line("    - {$pledge->pledge_no}: No phone number - skipping");
            return;
        }

        // Check if already sent today for this pledge + reminder type
        $alreadySent = WhatsAppLog::where('related_type', $templateKey)
            ->where('related_id', $pledge->id)
            ->where('status', 'sent')
            ->whereDate('created_at', Carbon::today())
            ->exists();

        if ($alreadySent) {
            $this->skipped++;
            $this->line("    - {$pledge->pledge_no}: Already sent today - skipping");
            return;
        }

        // Build phone number (same logic as PledgeController)
        $phone = preg_replace('/[^0-9]/', '', $customer->phone);
        $countryCode = preg_replace('/[^0-9]/', '', $customer->country_code ?? '60');

        if (substr($phone, 0, 1) === '0') {
            $phone = substr($phone, 1);
        }
        $phone = $countryCode . $phone;

        // Build template data
        $data = $this->buildTemplateData($pledge, $customer);

        // Render the message
        $message = $template->render($data);

        if ($isDryRun) {
            $this->sent++;
            $this->info("    - {$pledge->pledge_no} → {$phone} ({$customer->name}) [DRY RUN]");
            return;
        }

        // Send via UltraMsg (or configured provider)
        $result = $this->sendViaProvider($config, $phone, $message);

        // Log the attempt
        $log = WhatsAppLog::create([
            'branch_id' => $pledge->branch_id,
            'template_id' => $template->id,
            'recipient_phone' => $phone,
            'recipient_name' => $customer->name,
            'message_content' => $message,
            'related_type' => $templateKey,
            'related_id' => $pledge->id,
            'status' => $result['success'] ? 'sent' : 'failed',
            'error_message' => $result['error'] ?? null,
            'sent_at' => $result['success'] ? now() : null,
            'sent_by' => null, // System-generated, no user
        ]);

        if ($result['success']) {
            $this->sent++;
            $this->info("    ✓ {$pledge->pledge_no} → {$phone} ({$customer->name})");
        } else {
            $this->failed++;
            $this->error("    ✗ {$pledge->pledge_no} → {$phone}: " . ($result['error'] ?? 'Unknown error'));
        }
    }

    /**
     * Build template variables for a pledge.
     */
    protected function buildTemplateData(Pledge $pledge, $customer): array
    {
        $today = Carbon::today();
        $dueDate = Carbon::parse($pledge->due_date);
        $daysOverdue = $dueDate->lt($today) ? $today->diffInDays($dueDate) : 0;

        return [
            // Common variables
            'customer_name' => $customer->name ?? 'Pelanggan',
            'receipt_no' => $pledge->receipt_no ?? $pledge->pledge_no,
            'pledge_no' => $pledge->pledge_no,
            'due_date' => $dueDate->format('d/m/Y'),
            'loan_amount' => number_format($pledge->loan_amount, 2),

            // Interest variables
            'current_interest' => number_format($pledge->current_interest_amount, 2),
            'redemption_amount' => number_format($pledge->loan_amount + $pledge->current_interest_amount, 2),

            // Overdue-specific
            'overdue_days' => $daysOverdue,
            'overdue_interest' => number_format($pledge->current_interest_amount, 2),

            // Company info (from branch or default)
            'company_name' => $pledge->branch?->name ?? 'PawnSys',
            'company_phone' => $pledge->branch?->phone ?? '',
        ];
    }

    /**
     * Send WhatsApp message via the configured provider.
     * Mirrors WhatsAppController::sendWhatsAppMessage() logic.
     */
    protected function sendViaProvider(WhatsAppConfig $config, string $phone, string $message): array
    {
        return match ($config->provider) {
            'ultramsg' => $this->sendViaUltramsg($config, $phone, $message),
            'twilio'   => $this->sendViaTwilio($config, $phone, $message),
            'wati'     => $this->sendViaWati($config, $phone, $message),
            default    => ['success' => false, 'error' => 'Unknown provider: ' . $config->provider],
        };
    }

    /**
     * Send via UltraMsg API.
     * Exact same logic as WhatsAppController::sendViaUltramsg()
     */
    protected function sendViaUltramsg(WhatsAppConfig $config, string $phone, string $message): array
    {
        try {
            $url = "https://api.ultramsg.com/{$config->instance_id}/messages/chat";

            $params = [
                'token' => $config->api_token,
                'to' => $phone,
                'body' => $message,
            ];

            $ch = curl_init();

            $curlOptions = [
                CURLOPT_URL => $url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_ENCODING => "",
                CURLOPT_MAXREDIRS => 10,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                CURLOPT_CUSTOMREQUEST => "POST",
                CURLOPT_POSTFIELDS => http_build_query($params),
                CURLOPT_HTTPHEADER => [
                    "content-type: application/x-www-form-urlencoded"
                ],
            ];

            // Only disable SSL verification in local environment
            if (app()->environment('local')) {
                $curlOptions[CURLOPT_SSL_VERIFYHOST] = 0;
                $curlOptions[CURLOPT_SSL_VERIFYPEER] = 0;
            }

            curl_setopt_array($ch, $curlOptions);

            $response = curl_exec($ch);
            $err = curl_error($ch);
            curl_close($ch);

            if ($err) {
                return ['success' => false, 'error' => 'cURL Error: ' . $err];
            }

            $result = json_decode($response, true);

            if (isset($result['sent']) && $result['sent'] === 'true') {
                return ['success' => true, 'message_id' => $result['id'] ?? null];
            }

            return ['success' => false, 'error' => $result['error'] ?? $response];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Send via Twilio (placeholder - match your WhatsAppController implementation)
     */
    protected function sendViaTwilio(WhatsAppConfig $config, string $phone, string $message): array
    {
        // TODO: Implement if you use Twilio
        return ['success' => false, 'error' => 'Twilio not implemented in scheduler'];
    }

    /**
     * Send via WATI (placeholder - match your WhatsAppController implementation)
     */
    protected function sendViaWati(WhatsAppConfig $config, string $phone, string $message): array
    {
        // TODO: Implement if you use WATI
        return ['success' => false, 'error' => 'WATI not implemented in scheduler'];
    }
}
