<?php

namespace App\Services\WhatsApp;

use App\Models\WhatsAppConfig;
use App\Models\WhatsAppTemplate;
use App\Services\WhatsApp\Drivers\AiSensyDriver;
use App\Services\WhatsApp\Drivers\UltraMsgDriver;
use App\Services\WhatsApp\Drivers\WhatsAppDriver;

class WhatsAppService
{
    private function driver(WhatsAppConfig $config): ?WhatsAppDriver
    {
        return match ($config->provider) {
            'ultramsg' => new UltraMsgDriver(),
            'aisensy'  => new AiSensyDriver(),
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

    public function sendText(
        WhatsAppConfig $config,
        string $phone,
        string $renderedMessage,
        ?WhatsAppTemplate $template = null,
        array $templateData = [],
        ?string $recipientName = null
    ): array {
        $driver = $this->driver($config);
        if (!$driver) {
            return ['success' => false, 'message_id' => null, 'error' => 'Unknown provider: ' . $config->provider];
        }

        return $driver->sendText(
            $config,
            $phone,
            $renderedMessage,
            $template?->aisensy_campaign,
            $this->resolveParams($template, $templateData),
            $recipientName
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

        return $driver->sendDocument(
            $config,
            $phone,
            $pdfBase64,
            $filename,
            $caption,
            $publicUrl,
            $template?->aisensy_campaign,
            $this->resolveParams($template, $templateData),
            $recipientName
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
