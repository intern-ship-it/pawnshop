<?php

namespace App\Services\WhatsApp\Drivers;

use App\Models\WhatsAppConfig;
use Illuminate\Support\Facades\Http;

/**
 * Sends through the Grasp WhatsApp Gateway rather than talking to AiSensy
 * directly: app -> gateway -> AiSensy -> Meta -> WhatsApp.
 *
 * Config mapping (reuses the existing columns, no schema change):
 *   api_token   = the gateway's shared SERVICE_API_KEY  (X-Service-Key header)
 *   instance_id = this branch's tenant key              (temple_id in the body)
 *
 * The per-template "campaign name" mapping doubles as the gateway's template
 * name, and aisensy_params supplies the ordered {{n}} values, so the existing
 * Settings UI drives this driver unchanged.
 */
class GraspGatewayDriver implements WhatsAppDriver
{
    private function baseUrl(): string
    {
        return rtrim((string) config('pawnsys.whatsapp.grasp_base_url'), '/');
    }

    private function http(): \Illuminate\Http\Client\PendingRequest
    {
        // The gateway's upstream AiSensy timeout is 30s, so we must wait longer
        // than that or we abandon requests the gateway is still completing.
        $client = Http::timeout(40);
        return app()->environment('local') ? $client->withoutVerifying() : $client;
    }

    /** The gateway forwards `to` verbatim; it wants digits with no '+'. */
    private function normalizeDestination(string $phone): string
    {
        return preg_replace('/[^0-9]/', '', $phone);
    }

    public function sendText(
        WhatsAppConfig $config,
        string $phone,
        string $renderedMessage,
        ?string $campaign = null,
        array $templateParams = [],
        ?string $recipientName = null,
        ?string $reference = null
    ): array {
        return $this->post($config, $phone, $campaign, $templateParams, $recipientName, $reference, null, null);
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
        ?string $recipientName = null,
        ?string $reference = null
    ): array {
        // Meta fetches the file itself, so there is no base64 path on any
        // gateway send endpoint. Without a public URL there is nothing to send.
        if (empty($publicUrl)) {
            return ['success' => false, 'message_id' => null,
                'error' => 'The WhatsApp gateway requires a public document URL; none was provided'];
        }

        return $this->post($config, $phone, $campaign, $templateParams, $recipientName, $reference, $publicUrl, $filename);
    }

    private function post(
        WhatsAppConfig $config,
        string $phone,
        ?string $campaign,
        array $templateParams,
        ?string $recipientName,
        ?string $reference,
        ?string $mediaUrl,
        ?string $mediaFilename
    ): array {
        if (empty($config->instance_id)) {
            return ['success' => false, 'message_id' => null,
                'error' => 'No gateway tenant ID configured for this branch'];
        }
        if (empty($campaign)) {
            return ['success' => false, 'message_id' => null,
                'error' => 'No gateway template configured for this message type'];
        }
        if (empty($reference)) {
            return ['success' => false, 'message_id' => null,
                'error' => 'No idempotency reference supplied for this send'];
        }

        $params = array_values(array_map('strval', $templateParams));

        // The gateway does not validate templates before charging the wallet,
        // and Meta rejects blank parameters (131008) just as hard as a count
        // mismatch. Fail here rather than pay for a message Meta will refuse.
        foreach ($params as $i => $value) {
            if (trim($value) === '') {
                return ['success' => false, 'message_id' => null,
                    'error' => 'Template parameter ' . ($i + 1) . ' is empty; WhatsApp rejects blank parameters'];
            }
        }

        try {
            $payload = [
                'temple_id' => $config->instance_id,
                'to' => $this->normalizeDestination($phone),
                'template' => $campaign,
                'language' => (string) config('pawnsys.whatsapp.grasp_language', 'en'),
                'category' => 'UTILITY',
                'params' => $params,
                'reference' => $reference,
            ];

            if ($recipientName) {
                $payload['name'] = $recipientName;
            }
            if ($mediaUrl) {
                $payload['document'] = ['url' => $mediaUrl, 'filename' => $mediaFilename ?: 'document.pdf'];
            }

            $response = $this->http()
                ->withHeaders(['X-Service-Key' => (string) $config->api_token])
                ->asJson()
                ->post($this->baseUrl() . '/api/internal/send', $payload);

            $body = $response->json() ?? [];

            if ($response->successful() && ($body['success'] ?? false) === true) {
                $status = $body['data']['status'] ?? null;

                // ALREADY_SENT is an idempotent replay of a send that succeeded
                // earlier; it carries no message id but is not a failure.
                if ($status === 'SENT' || $status === 'ALREADY_SENT') {
                    return ['success' => true,
                        'message_id' => $body['data']['provider_message_id'] ?? null,
                        'error' => null];
                }

                // SKIPPED and anything unrecognised arrive success-shaped with
                // HTTP 200, so never trust the status code on its own.
                return ['success' => false, 'message_id' => null,
                    'error' => 'Gateway did not send the message (status: ' . ($status ?? 'unknown') . ')'];
            }

            return ['success' => false, 'message_id' => null, 'error' => $this->errorFrom($response->status(), $body)];
        } catch (\Throwable $e) {
            return ['success' => false, 'message_id' => null, 'error' => $e->getMessage()];
        }
    }

    /**
     * The gateway reports failures as a `message` string everywhere except 422,
     * which returns `errors` as a field-keyed object of message arrays.
     */
    private function errorFrom(int $status, array $body): string
    {
        if (is_array($body['errors'] ?? null)) {
            $parts = [];
            foreach ($body['errors'] as $field => $messages) {
                $parts[] = $field . ': ' . implode(' ', (array) $messages);
            }
            if ($parts) {
                return 'Gateway rejected the request (' . $status . '): ' . implode('; ', $parts);
            }
        }

        return $body['message'] ?? ('WhatsApp gateway request failed: ' . $status);
    }

    public function testConnection(WhatsAppConfig $config): array
    {
        if (empty($config->api_token)) {
            return ['success' => false, 'error' => 'Gateway service key is not set'];
        }
        if (empty($config->instance_id)) {
            return ['success' => false, 'error' => 'Gateway tenant ID is not set'];
        }

        try {
            // /internal/status exercises the service key and the tenant binding
            // together, so it fails loudly on a bad key or an unonboarded tenant.
            $response = $this->http()
                ->withHeaders([
                    'X-Service-Key' => (string) $config->api_token,
                    'X-Temple-ID' => (string) $config->instance_id,
                ])
                ->get($this->baseUrl() . '/api/internal/status');

            $body = $response->json() ?? [];

            if ($response->successful() && ($body['success'] ?? false) === true) {
                return ['success' => true, 'error' => null];
            }

            return ['success' => false, 'error' => $this->errorFrom($response->status(), $body)];
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
