<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WhatsAppConfig;
use App\Models\WhatsAppTemplate;
use App\Models\WhatsAppLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;

class WhatsAppController extends Controller
{
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

        // Hide sensitive data
        $config->api_token = $config->api_token ? '********' : null;

        return $this->success([
            'is_configured' => true,
            'config' => $config,
        ]);
    }

    public function updateConfig(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $validated = $request->validate([
            'provider' => 'required|in:ultramsg,twilio,wati',
            'instance_id' => 'required|string|max:100',
            'api_token' => 'nullable|string|max:255',
            'phone_number' => 'required|string|max:20',
            'is_enabled' => 'nullable|boolean',
        ]);

        // Don't update token if it's masked or empty
        if (empty($validated['api_token']) || $validated['api_token'] === '********') {
            unset($validated['api_token']);
        }

        // Check if config exists
        $config = WhatsAppConfig::where('branch_id', $branchId)->first();

        if ($config) {
            $config->update($validated);
        } else {
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
            $result = $this->sendTestMessage($config);

            if ($result['success']) {
                $config->update(['last_connected_at' => now()]);
                return $this->success(null, 'Connection successful');
            }

            return $this->error('Connection failed: ' . ($result['error'] ?? 'Unknown error'), 422);

        } catch (\Exception $e) {
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

        // If updating global template, create branch-specific copy
        if (!$whatsAppTemplate->branch_id) {
            $validated = $request->validate([
                'name' => 'sometimes|string|max:100',
                'content' => 'sometimes|string',
                'variables' => 'nullable|array',
                'is_enabled' => 'sometimes|boolean',
            ]);

            $whatsAppTemplate = WhatsAppTemplate::create(array_merge(
                $whatsAppTemplate->toArray(),
                $validated,
                ['branch_id' => $branchId]
            ));
        } else {
            if ($whatsAppTemplate->branch_id !== $branchId) {
                return $this->error('Unauthorized', 403);
            }

            $validated = $request->validate([
                'name' => 'sometimes|string|max:100',
                'content' => 'sometimes|string',
                'variables' => 'nullable|array',
                'is_enabled' => 'sometimes|boolean',
            ]);

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
            $result = $this->sendWhatsAppMessage($config, $validated['recipient_phone'], $message);

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

        } catch (\Exception $e) {
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
            $result = $this->sendWhatsAppMessage($config, $whatsAppLog->recipient_phone, $whatsAppLog->message_content);

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

        } catch (\Exception $e) {
            return $this->error('Failed to resend: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Send test message via configured provider
     */
    protected function sendTestMessage(WhatsAppConfig $config): array
    {
        // Test with a simple API call to verify credentials
        return match ($config->provider) {
            'ultramsg' => $this->testUltramsg($config),
            'twilio' => $this->testTwilio($config),
            'wati' => $this->testWati($config),
            default => ['success' => false, 'error' => 'Unknown provider'],
        };
    }

    /**
     * Send WhatsApp message via configured provider
     */
    protected function sendWhatsAppMessage(WhatsAppConfig $config, string $phone, string $message): array
    {
        return match ($config->provider) {
            'ultramsg' => $this->sendViaUltramsg($config, $phone, $message),
            'twilio' => $this->sendViaTwilio($config, $phone, $message),
            'wati' => $this->sendViaWati($config, $phone, $message),
            default => ['success' => false, 'error' => 'Unknown provider'],
        };
    }
    /**
     * Test Ultramsg connection
     */
    protected function testUltramsg(WhatsAppConfig $config): array
    {
        try {
            $url = "https://api.ultramsg.com/{$config->instance_id}/instance/status";

            $params = [
                'token' => $config->api_token,
            ];

            $ch = curl_init();

            $curlOptions = [
                CURLOPT_URL => $url . '?' . http_build_query($params),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 30,
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

            // Check if we got a valid response
            if ($response && !isset($result['error'])) {
                return ['success' => true];
            }

            return ['success' => false, 'error' => $result['error'] ?? $response];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
    /**
     * Send via Ultramsg
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
     * Test Twilio connection (placeholder)
     */
    protected function testTwilio(WhatsAppConfig $config): array
    {
        // TODO: Implement Twilio test
        return ['success' => true];
    }

    /**
     * Send via Twilio (placeholder)
     */
    protected function sendViaTwilio(WhatsAppConfig $config, string $phone, string $message): array
    {
        // TODO: Implement Twilio sending
        return ['success' => false, 'error' => 'Twilio not implemented'];
    }

    /**
     * Test WATI connection (placeholder)
     */
    protected function testWati(WhatsAppConfig $config): array
    {
        // TODO: Implement WATI test
        return ['success' => true];
    }

    /**
     * Send via WATI (placeholder)
     */
    protected function sendViaWati(WhatsAppConfig $config, string $phone, string $message): array
    {
        // TODO: Implement WATI sending
        return ['success' => false, 'error' => 'WATI not implemented'];
    }
}
