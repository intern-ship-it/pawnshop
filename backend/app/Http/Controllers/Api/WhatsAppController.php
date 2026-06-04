<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WhatsAppConfig;
use App\Models\WhatsAppTemplate;
use App\Models\WhatsAppLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class WhatsAppController extends Controller
{
    public function __construct(private \App\Services\WhatsApp\WhatsAppService $whatsapp) {}

    /**
     * Get WhatsApp configuration
     */
    public function config(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $config = WhatsAppConfig::where('branch_id', $branchId)->first();

        if (!$config) {
            return $this->success([
                'is_configured' => false,
                'config' => null,
            ]);
        }

        // Convert to array and manually add masked api_token
        // (api_token is in $hidden array so won't be serialized automatically)
        $configData = $config->toArray();
        $configData['api_token'] = $config->api_token ? '********' : null;

        return $this->success([
            'is_configured' => true,
            'config' => $configData,
        ]);
    }

    public function updateConfig(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $validated = $request->validate([
            'provider' => 'required|in:ultramsg,twilio,wati,aisensy',
            'instance_id' => 'nullable|string|max:100',
            'api_token' => 'nullable|string|max:2000',
            'phone_number' => 'required|string|max:20',
            'is_enabled' => 'nullable|boolean',
            'attach_pdf_receipt' => 'nullable|boolean',
        ]);

        // Normalize country code - ensure it starts with +
        if (!empty($validated['phone_number'])) {
            $validated['phone_number'] = trim($validated['phone_number']);
            if (!str_starts_with($validated['phone_number'], '+')) {
                $validated['phone_number'] = '+' . $validated['phone_number'];
            }
        }

        // AiSensy does not use instance_id (an UltraMsg concept). Clear any stale value
        // so it doesn't linger after switching providers.
        if (($validated['provider'] ?? null) === 'aisensy') {
            $validated['instance_id'] = null;
        }

        // Don't update token if it's masked or empty
        if (empty($validated['api_token']) || $validated['api_token'] === '********') {
            unset($validated['api_token']);
        }

        // Check if config exists
        $config = WhatsAppConfig::where('branch_id', $branchId)->first();

        if ($config) {
            $config->update($validated);
        }
        else {
            // For new config, token is required
            if (empty($request->api_token) || $request->api_token === '********') {
                return $this->error('API token is required for new configuration', 422);
            }
            $validated['api_token'] = $request->api_token;
            $validated['branch_id'] = $branchId;
            $config = WhatsAppConfig::create($validated);
        }

        return $this->success($config, 'WhatsApp configuration updated');
    }
    /**
     * Test WhatsApp connection
     */
    public function testConnection(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $config = WhatsAppConfig::where('branch_id', $branchId)->first();

        if (!$config) {
            return $this->error('WhatsApp not configured', 422);
        }

        try {
            $result = $this->whatsapp->testConnection($config);

            if ($result['success']) {
                $config->update(['last_connected_at' => now()]);
                return $this->success(null, 'Connection successful');
            }

            return $this->error('Connection failed: ' . ($result['error'] ?? 'Unknown error'), 422);

        }
        catch (\Exception $e) {
            return $this->error('Connection failed: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get all templates
     */
    public function templates(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $templates = WhatsAppTemplate::where(function ($q) use ($branchId) {
            $q->where('branch_id', $branchId)->orWhereNull('branch_id');
        })
            ->orderBy('template_key')
            ->get();

        return $this->success($templates);
    }

    /**
     * Update template
     */
    public function updateTemplate(Request $request, WhatsAppTemplate $whatsAppTemplate): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'content' => 'sometimes|string',
            'variables' => 'nullable|array',
            'is_enabled' => 'sometimes|boolean',
            'aisensy_campaign' => 'sometimes|nullable|string|max:255',
            'aisensy_params' => 'sometimes|nullable|array',
        ]);

        // If updating global template, find or create branch-specific copy
        if (!$whatsAppTemplate->branch_id) {
            $whatsAppTemplate = WhatsAppTemplate::updateOrCreate(
            [
                'branch_id' => $branchId,
                'template_key' => $whatsAppTemplate->template_key,
            ],
                array_merge(
                collect($whatsAppTemplate->toArray())
                ->except(['id', 'created_at', 'updated_at'])
                ->toArray(),
                $validated,
            ['branch_id' => $branchId]
            )
            );
        }
        else {
            if ($whatsAppTemplate->branch_id !== $branchId) {
                return $this->error('Unauthorized', 403);
            }

            $whatsAppTemplate->update($validated);
        }

        return $this->success($whatsAppTemplate, 'Template updated');
    }

    /**
     * Send WhatsApp message
     */
    public function send(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $validated = $request->validate([
            'template_key' => 'required|string',
            'recipient_phone' => 'required|string',
            'recipient_name' => 'nullable|string',
            'data' => 'required|array',
            'related_type' => 'nullable|string',
            'related_id' => 'nullable|integer',
        ]);

        $config = WhatsAppConfig::where('branch_id', $branchId)
            ->where('is_enabled', true)
            ->first();

        if (!$config) {
            return $this->error('WhatsApp not configured or disabled', 422);
        }

        // Get template
        $template = WhatsAppTemplate::where('template_key', $validated['template_key'])
            ->where(function ($q) use ($branchId) {
            $q->where('branch_id', $branchId)->orWhereNull('branch_id');
        })
            ->where('is_enabled', true)
            ->orderBy('branch_id', 'desc') // Branch-specific first
            ->first();

        if (!$template) {
            return $this->error('Template not found or disabled', 404);
        }

        // Render message
        $message = $template->render($validated['data']);

        // Create log entry
        $log = WhatsAppLog::create([
            'branch_id' => $branchId,
            'template_id' => $template->id,
            'recipient_phone' => $validated['recipient_phone'],
            'recipient_name' => $validated['recipient_name'] ?? null,
            'message_content' => $message,
            'related_type' => $validated['related_type'] ?? null,
            'related_id' => $validated['related_id'] ?? null,
            'status' => 'pending',
            'sent_by' => $request->user()->id,
        ]);

        try {
            $result = $this->whatsapp->sendText(
                $config,
                $validated['recipient_phone'],
                $message,
                $template,
                $validated['data'],
                $validated['recipient_name'] ?? null
            );

            if ($result['success']) {
                $log->update([
                    'status' => 'sent',
                    'sent_at' => now(),
                ]);

                return $this->success([
                    'log_id' => $log->id,
                    'message_id' => $result['message_id'] ?? null,
                ], 'Message sent successfully');
            }

            $log->update([
                'status' => 'failed',
                'error_message' => $result['error'] ?? 'Unknown error',
            ]);

            return $this->error('Failed to send: ' . ($result['error'] ?? 'Unknown error'), 422);

        }
        catch (\Exception $e) {
            $log->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);

            return $this->error('Failed to send: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get WhatsApp logs
     */
    public function logs(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = WhatsAppLog::where('branch_id', $branchId)
            ->with(['template:id,template_key,name', 'sentBy:id,name']);

        // Filter by status
        if ($status = $request->get('status')) {
            $query->where('status', $status);
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
     * Resend failed message
     */
    public function resend(Request $request, WhatsAppLog $whatsAppLog): JsonResponse
    {
        if ($whatsAppLog->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        if ($whatsAppLog->status !== 'failed') {
            return $this->error('Can only resend failed messages', 422);
        }

        $config = WhatsAppConfig::where('branch_id', $whatsAppLog->branch_id)
            ->where('is_enabled', true)
            ->first();

        if (!$config) {
            return $this->error('WhatsApp not configured or disabled', 422);
        }

        try {
            $result = $this->whatsapp->sendText($config, $whatsAppLog->recipient_phone, $whatsAppLog->message_content);

            if ($result['success']) {
                $whatsAppLog->update([
                    'status' => 'sent',
                    'sent_at' => now(),
                    'error_message' => null,
                ]);

                return $this->success(null, 'Message resent successfully');
            }

            $whatsAppLog->update([
                'error_message' => $result['error'] ?? 'Unknown error',
            ]);

            return $this->error('Failed to resend: ' . ($result['error'] ?? 'Unknown error'), 422);

        }
        catch (\Exception $e) {
            return $this->error('Failed to resend: ' . $e->getMessage(), 500);
        }
    }
}
