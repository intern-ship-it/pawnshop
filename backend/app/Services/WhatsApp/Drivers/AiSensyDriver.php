<?php

namespace App\Services\WhatsApp\Drivers;

use App\Models\WhatsAppConfig;
use Illuminate\Support\Facades\Http;

class AiSensyDriver implements WhatsAppDriver
{
    private const ENDPOINT = 'https://backend.aisensy.com/campaign/t1/api/v2';

    private function http(): \Illuminate\Http\Client\PendingRequest
    {
        $client = Http::timeout(30);
        return app()->environment('local') ? $client->withoutVerifying() : $client;
    }

    private function normalizeDestination(string $phone): string
    {
        return '+' . preg_replace('/[^0-9]/', '', $phone);
    }

    public function sendText(
        WhatsAppConfig $config,
        string $phone,
        string $renderedMessage,
        ?string $campaign = null,
        array $templateParams = [],
        ?string $recipientName = null
    ): array {
        if (empty($campaign)) {
            return ['success' => false, 'message_id' => null,
                'error' => 'No AiSensy campaign configured for this message type'];
        }

        return $this->postCampaign($config, $phone, $campaign, $templateParams, $recipientName, null, null);
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
        if (empty($campaign)) {
            return ['success' => false, 'message_id' => null,
                'error' => 'No AiSensy campaign configured for this document message type'];
        }
        if (empty($publicUrl)) {
            return ['success' => false, 'message_id' => null,
                'error' => 'AiSensy requires a public document URL; none was provided'];
        }

        return $this->postCampaign($config, $phone, $campaign, $templateParams, $recipientName, $publicUrl, $filename);
    }

    private function postCampaign(
        WhatsAppConfig $config,
        string $phone,
        string $campaign,
        array $templateParams,
        ?string $recipientName,
        ?string $mediaUrl,
        ?string $mediaFilename
    ): array {
        try {
            $payload = [
                'apiKey' => $config->api_token,
                'campaignName' => $campaign,
                'destination' => $this->normalizeDestination($phone),
                'userName' => $recipientName ?: 'Customer',
                'templateParams' => array_values($templateParams),
            ];

            if ($mediaUrl) {
                $payload['media'] = ['url' => $mediaUrl, 'filename' => $mediaFilename ?? 'document.pdf'];
            }

            $response = $this->http()->asJson()->post(self::ENDPOINT, $payload);
            $data = $response->json() ?? [];

            if ($response->successful() && ($data['success'] ?? true) !== false) {
                return ['success' => true, 'message_id' => $data['messageId'] ?? $data['id'] ?? null, 'error' => null];
            }

            return ['success' => false, 'message_id' => null,
                'error' => $data['errorMessage'] ?? $data['message'] ?? ('AiSensy request failed: ' . $response->status())];
        } catch (\Throwable $e) {
            return ['success' => false, 'message_id' => null, 'error' => $e->getMessage()];
        }
    }

    public function testConnection(WhatsAppConfig $config): array
    {
        // AiSensy has no documented health endpoint. Treat presence of an API key as
        // configured; a real failure surfaces on the first send. Never report success
        // when the key is missing.
        if (empty($config->api_token)) {
            return ['success' => false, 'error' => 'AiSensy API key is not set'];
        }
        return ['success' => true, 'error' => null];
    }
}
