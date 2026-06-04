<?php

namespace Tests\Unit\WhatsApp;

use App\Models\WhatsAppConfig;
use App\Models\WhatsAppTemplate;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WhatsAppServiceTest extends TestCase
{
    public function test_dispatches_to_ultramsg(): void
    {
        Http::fake(['api.ultramsg.com/*' => Http::response(['sent' => 'true', 'id' => 'm1'], 200)]);
        $config = new WhatsAppConfig(['provider' => 'ultramsg', 'instance_id' => 'i1', 'api_token' => 't1']);

        $result = (new WhatsAppService())->sendText($config, '60123', 'Hello');

        $this->assertTrue($result['success']);
        Http::assertSent(fn ($r) => str_contains($r->url(), 'ultramsg.com'));
    }

    public function test_dispatches_to_aisensy_resolving_params_from_template(): void
    {
        Http::fake(['backend.aisensy.com/*' => Http::response(['success' => true], 200)]);
        $config = new WhatsAppConfig(['provider' => 'aisensy', 'api_token' => 'key']);
        $template = new WhatsAppTemplate([
            'template_key' => 'pledge_created',
            'aisensy_campaign' => 'pledge_v1',
            'aisensy_params' => ['customer_name', 'pledge_no'],
        ]);

        $result = (new WhatsAppService())->sendText(
            $config, '60123', 'rendered', $template,
            ['customer_name' => 'Ali', 'pledge_no' => 'PLG-9', 'extra' => 'x'],
            'Ali'
        );

        $this->assertTrue($result['success']);
        Http::assertSent(fn ($r) => $r->data()['campaignName'] === 'pledge_v1'
            && $r->data()['templateParams'] === ['Ali', 'PLG-9']);
    }

    public function test_unknown_provider_returns_error(): void
    {
        $config = new WhatsAppConfig(['provider' => 'twilio']);
        $result = (new WhatsAppService())->sendText($config, '60123', 'x');
        $this->assertFalse($result['success']);
    }

    public function test_aisensy_missing_param_resolves_to_empty_string(): void
    {
        Http::fake(['backend.aisensy.com/*' => Http::response(['success' => true], 200)]);
        $config = new WhatsAppConfig(['provider' => 'aisensy', 'api_token' => 'key']);
        $template = new WhatsAppTemplate([
            'template_key' => 'x',
            'aisensy_campaign' => 'c1',
            'aisensy_params' => ['a', 'missing', 'b'],
        ]);

        (new WhatsAppService())->sendText($config, '60123', 'r', $template, ['a' => '1', 'b' => '2'], 'N');

        Http::assertSent(fn ($r) => $r->data()['templateParams'] === ['1', '', '2']);
    }

    public function test_send_document_through_service_passes_url_and_params_to_aisensy(): void
    {
        \Illuminate\Support\Facades\Http::fake(['backend.aisensy.com/*' => \Illuminate\Support\Facades\Http::response(['success' => true], 200)]);
        $config = new \App\Models\WhatsAppConfig(['provider' => 'aisensy', 'api_token' => 'key']);
        $template = new \App\Models\WhatsAppTemplate([
            'template_key' => 'pledge_doc',
            'aisensy_campaign' => 'pledge_doc_v1',
            'aisensy_params' => ['customer_name'],
        ]);

        $result = (new \App\Services\WhatsApp\WhatsAppService())->sendDocument(
            $config, '60123', base64_encode('PDF'), 'Receipt.pdf', 'cap',
            'https://example.com/r.pdf', $template, ['customer_name' => 'Ali'], 'Ali'
        );

        $this->assertTrue($result['success']);
        \Illuminate\Support\Facades\Http::assertSent(function ($r) {
            $b = $r->data();
            return $b['campaignName'] === 'pledge_doc_v1'
                && $b['templateParams'] === ['Ali']
                && $b['media']['url'] === 'https://example.com/r.pdf'
                && $b['media']['filename'] === 'Receipt.pdf';
        });
    }
}
