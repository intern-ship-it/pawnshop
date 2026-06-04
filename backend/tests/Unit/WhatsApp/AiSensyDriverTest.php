<?php

namespace Tests\Unit\WhatsApp;

use App\Models\WhatsAppConfig;
use App\Services\WhatsApp\Drivers\AiSensyDriver;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiSensyDriverTest extends TestCase
{
    private function config(): WhatsAppConfig
    {
        return new WhatsAppConfig([
            'provider' => 'aisensy',
            'api_token' => 'aisensy_key_xyz', // API key stored in api_token
            'phone_number' => '+60',
        ]);
    }

    public function test_send_text_posts_campaign_and_params(): void
    {
        Http::fake([
            'backend.aisensy.com/*' => Http::response(['success' => true], 200),
        ]);

        $result = (new AiSensyDriver())->sendText(
            $this->config(),
            '60123456789',
            'ignored rendered text',
            'pledge_created_v1',
            ['Ali', 'PLG-001', '2500.00'],
            'Ali'
        );

        $this->assertTrue($result['success']);

        Http::assertSent(function ($request) {
            $body = $request->data();
            return str_contains($request->url(), 'backend.aisensy.com/campaign/t1/api/v2')
                && $body['apiKey'] === 'aisensy_key_xyz'
                && $body['campaignName'] === 'pledge_created_v1'
                && $body['destination'] === '+60123456789'
                && $body['userName'] === 'Ali'
                && $body['templateParams'] === ['Ali', 'PLG-001', '2500.00'];
        });
    }

    public function test_send_text_fails_without_campaign(): void
    {
        Http::fake(); // no request should be made

        $result = (new AiSensyDriver())->sendText(
            $this->config(), '60123456789', 'x', null, [], 'Ali'
        );

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('campaign', strtolower($result['error']));
        Http::assertNothingSent();
    }

    public function test_test_connection_fails_when_key_missing(): void
    {
        $config = new WhatsAppConfig(['provider' => 'aisensy', 'api_token' => null]);
        $result = (new AiSensyDriver())->testConnection($config);
        $this->assertFalse($result['success']);
    }

    public function test_send_text_defaults_username_to_customer_when_null(): void
    {
        Http::fake(['backend.aisensy.com/*' => Http::response(['success' => true], 200)]);

        (new AiSensyDriver())->sendText(
            $this->config(), '60123456789', 'x', 'camp_v1', ['p1'], null
        );

        Http::assertSent(fn ($request) => $request->data()['userName'] === 'Customer');
    }

    public function test_test_connection_succeeds_when_key_present(): void
    {
        $result = (new AiSensyDriver())->testConnection($this->config());
        $this->assertTrue($result['success']);
    }

    public function test_send_document_includes_media_object(): void
    {
        Http::fake(['backend.aisensy.com/*' => Http::response(['success' => true], 200)]);

        $result = (new AiSensyDriver())->sendDocument(
            $this->config(), '60123456789', base64_encode('PDF'),
            'Receipt-PLG-001.pdf', 'cap', 'https://example.com/r.pdf',
            'pledge_doc_v1', ['Ali'], 'Ali'
        );

        $this->assertTrue($result['success']);
        Http::assertSent(function ($r) {
            $b = $r->data();
            return $b['campaignName'] === 'pledge_doc_v1'
                && $b['media']['url'] === 'https://example.com/r.pdf'
                && $b['media']['filename'] === 'Receipt-PLG-001.pdf';
        });
    }

    public function test_send_document_fails_without_public_url(): void
    {
        Http::fake();
        $result = (new AiSensyDriver())->sendDocument(
            $this->config(), '60123456789', 'x', 'f.pdf', 'cap', null, 'camp', [], 'Ali'
        );
        $this->assertFalse($result['success']);
        Http::assertNothingSent();
    }
}
