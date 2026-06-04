<?php

namespace App\Services\WhatsApp\Drivers;

use App\Models\WhatsAppConfig;
use Illuminate\Support\Facades\Http;

class UltraMsgDriver implements WhatsAppDriver
{
    private function http()
    {
        $client = Http::timeout(30);
        // Match existing behaviour: skip SSL verify only in local dev.
        return app()->environment('local') ? $client->withoutVerifying() : $client;
    }

    public function sendText(
        WhatsAppConfig $config,
        string $phone,
        string $renderedMessage,
        ?string $campaign = null,
        array $templateParams = [],
        ?string $recipientName = null
    ): array {
        try {
            $response = $this->http()->asForm()->post(
                "https://api.ultramsg.com/{$config->instance_id}/messages/chat",
                ['token' => $config->api_token, 'to' => $phone, 'body' => $renderedMessage]
            );

            $data = $response->json() ?? [];

            if ($response->successful() && (($data['sent'] ?? null) === 'true' || isset($data['id']))) {
                return ['success' => true, 'message_id' => $data['id'] ?? null, 'error' => null];
            }

            return ['success' => false, 'message_id' => null,
                'error' => $data['error'] ?? $data['message'] ?? ('API request failed: ' . $response->status())];
        } catch (\Throwable $e) {
            return ['success' => false, 'message_id' => null, 'error' => $e->getMessage()];
        }
    }

    public function sendDocument(
        WhatsAppConfig $config,
        string $phone,
        string $pdfBase64,
        string $filename,
        string $caption,
        ?string $publicUrl = null,
        ?string $campaign = null,
        array $templateParams = [],
        ?string $recipientName = null
    ): array {
        // Implemented in a later task.
        return ['success' => false, 'message_id' => null, 'error' => 'not implemented'];
    }

    public function testConnection(WhatsAppConfig $config): array
    {
        try {
            $response = $this->http()->get(
                "https://api.ultramsg.com/{$config->instance_id}/instance/status",
                ['token' => $config->api_token]
            );
            $data = $response->json() ?? [];
            if ($response->successful() && !isset($data['error'])) {
                return ['success' => true, 'error' => null];
            }
            return ['success' => false, 'error' => $data['error'] ?? 'Connection failed'];
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
