<?php

namespace App\Services\WhatsApp;

use App\Models\WhatsAppConfig;
use App\Models\WhatsAppTemplate;
use App\Services\WhatsApp\Drivers\AiSensyDriver;
use App\Services\WhatsApp\Drivers\GraspGatewayDriver;
use App\Services\WhatsApp\Drivers\UltraMsgDriver;
use App\Services\WhatsApp\Drivers\WhatsAppDriver;

class WhatsAppService
{
    private function driver(WhatsAppConfig $config): ?WhatsAppDriver
    {
        return match ($config->provider) {
            'ultramsg' => new UltraMsgDriver(),
            'aisensy'  => new AiSensyDriver(),
            'grasp'    => new GraspGatewayDriver(),
            default    => null,
        };
    }

    /**
     * Resolve ordered templateParams for AiSensy from the template mapping + data.
     */
    private function resolveParams(?WhatsAppTemplate $template, array $data): array
    {
        if (!$template || empty($template->aisensy_params)) {
            return [];
        }
        return array_map(
            fn ($key) => (string) ($data[$key] ?? ''),
            $template->aisensy_params
        );
    }

    /**
     * Build the idempotency key the Grasp gateway requires on every send.
     *
     * The gateway keys its wallet debit on this value, so a retry of a timed-out
     * request must reuse it (no double charge, no double message) while a
     * genuinely different message must not collide with it. Hence: the flow, the
     * business entity, the date, and a digest of the actual content.
     *
     * The digest covers the rendered body as well as the params so that ad-hoc
     * sends — which carry no template and no params — still differ from each
     * other instead of collapsing into one reference per recipient per day.
     */
    private function buildReference(?WhatsAppTemplate $template, array $data, string $phone, string $body, array $params, ?string $override = null): string
    {
        if ($override) {
            return $override;
        }

        $flow = $template?->template_key ?: 'adhoc';
        $entity = $data['pledge_no'] ?? $data['receipt_no'] ?? preg_replace('/[^0-9]/', '', $phone);
        $digest = substr(sha1(json_encode(array_values($params)) . '|' . $body), 0, 8);

        return sprintf('pawnsys:%s:%s:%s:%s', $flow, $entity, now()->format('Y-m-d'), $digest);
    }

    /**
     * Append the admin sign-off to a message body.
     *
     * Applied here rather than at each call site so every outgoing message
     * picks it up. It is idempotent: resending a stored message_content that
     * already carries the sign-off will not stack a second copy.
     *
     * AiSensy discards the rendered body entirely (it sends campaignName +
     * templateParams and Meta renders the approved template), so this only
     * reaches customers on UltraMsg. For AiSensy the same line has to be added
     * to each approved template in the AiSensy dashboard.
     */
    private function withSignoff(string $body): string
    {
        $note = trim((string) config('pawnsys.whatsapp.admin_note'));
        $contact = trim((string) config('pawnsys.whatsapp.admin_contact'));

        if ($note === '' && $contact === '') {
            return $body;
        }

        $signoff = trim($note . ' ' . $contact);

        if ($signoff === '' || str_contains($body, $signoff)) {
            return $body;
        }

        return rtrim($body) . PHP_EOL . PHP_EOL . $signoff;
    }

    public function sendText(
        WhatsAppConfig $config,
        string $phone,
        string $renderedMessage,
        ?WhatsAppTemplate $template = null,
        array $templateData = [],
        ?string $recipientName = null,
        ?string $referenceOverride = null
    ): array {
        $driver = $this->driver($config);
        if (!$driver) {
            return ['success' => false, 'message_id' => null, 'error' => 'Unknown provider: ' . $config->provider];
        }

        $params = $this->resolveParams($template, $templateData);
        $body = $this->withSignoff($renderedMessage);

        return $driver->sendText(
            $config,
            $phone,
            $body,
            $template?->aisensy_campaign,
            $params,
            $recipientName,
            $this->buildReference($template, $templateData, $phone, $body, $params, $referenceOverride)
        );
    }

    public function sendDocument(
        WhatsAppConfig $config,
        string $phone,
        string $pdfBase64,
        string $filename,
        string $caption,
        ?string $publicUrl = null,
        ?WhatsAppTemplate $template = null,
        array $templateData = [],
        ?string $recipientName = null
    ): array {
        $driver = $this->driver($config);
        if (!$driver) {
            return ['success' => false, 'message_id' => null, 'error' => 'Unknown provider: ' . $config->provider];
        }

        $params = $this->resolveParams($template, $templateData);
        $body = $this->withSignoff($caption);

        return $driver->sendDocument(
            $config,
            $phone,
            $pdfBase64,
            $filename,
            $body,
            $publicUrl,
            $template?->aisensy_campaign,
            $params,
            $recipientName,
            $this->buildReference($template, $templateData, $phone, $body, $params)
        );
    }

    public function testConnection(WhatsAppConfig $config): array
    {
        $driver = $this->driver($config);
        if (!$driver) {
            return ['success' => false, 'error' => 'Unknown provider: ' . $config->provider];
        }
        return $driver->testConnection($config);
    }
}
