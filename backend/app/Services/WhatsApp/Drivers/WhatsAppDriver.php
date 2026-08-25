<?php

namespace App\Services\WhatsApp\Drivers;

use App\Models\WhatsAppConfig;

interface WhatsAppDriver
{
    /**
     * @return array{success: bool, message_id?: ?string, error?: ?string}
     */
    public function sendText(
        WhatsAppConfig $config,
        string $phone,
        string $renderedMessage,
        ?string $campaign = null,
        array $templateParams = [],
        ?string $recipientName = null,
        /** Idempotency key. Only the gateway driver uses it. */
        ?string $reference = null
    ): array;

    /**
     * @return array{success: bool, message_id?: ?string, error?: ?string}
     */
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
        /** Idempotency key. Only the gateway driver uses it. */
        ?string $reference = null
    ): array;

    /**
     * @return array{success: bool, error?: ?string}
     */
    public function testConnection(WhatsAppConfig $config): array;
}
