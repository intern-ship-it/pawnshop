<?php

namespace Tests\Unit\WhatsApp;

use App\Models\WhatsAppConfig;
use App\Services\WhatsApp\Drivers\UltraMsgDriver;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class UltraMsgDriverTest extends TestCase
{
    private function config(): WhatsAppConfig
    {
        return new WhatsAppConfig([
            'provider' => 'ultramsg',
            'instance_id' => 'instance123',
            'api_token' => 'tok_abc',
            'phone_number' => '+60',
        ]);
    }

    public function test_send_text_posts_to_chat_endpoint_and_parses_sent(): void
    {
        Http::fake([
            'api.ultramsg.com/*' => Http::response(['sent' => 'true', 'id' => 'msg_1'], 200),
        ]);

        $driver = new UltraMsgDriver();
        $result = $driver->sendText($this->config(), '60123456789', 'Hello world');

        $this->assertTrue($result['success']);
        $this->assertSame('msg_1', $result['message_id']);

        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'instance123/messages/chat')
                && $request['token'] === 'tok_abc'
                && $request['to'] === '60123456789'
                && $request['body'] === 'Hello world';
        });
    }

    public function test_send_text_returns_error_on_failure_response(): void
    {
        Http::fake([
            'api.ultramsg.com/*' => Http::response(['error' => 'instance stopped'], 200),
        ]);

        $result = (new UltraMsgDriver())->sendText($this->config(), '60123456789', 'Hi');

        $this->assertFalse($result['success']);
        $this->assertSame('instance stopped', $result['error']);
    }

    public function test_send_text_returns_error_on_server_error_without_json(): void
    {
        Http::fake([
            'api.ultramsg.com/*' => Http::response('', 500),
        ]);

        $result = (new UltraMsgDriver())->sendText($this->config(), '60123456789', 'Hi');

        $this->assertFalse($result['success']);
        $this->assertNotEmpty($result['error']);
        $this->assertStringContainsString('500', $result['error']);
    }

    public function test_send_document_posts_to_document_endpoint(): void
    {
        Http::fake([
            'api.ultramsg.com/*' => Http::response(['sent' => 'true', 'id' => 'doc_1'], 200),
        ]);

        $result = (new UltraMsgDriver())->sendDocument(
            $this->config(), '60123456789', base64_encode('PDFBYTES'),
            'Receipt-PLG-001.pdf', 'Your receipt'
        );

        $this->assertTrue($result['success']);
        Http::assertSent(fn ($r) => str_contains($r->url(), 'messages/document')
            && $r['filename'] === 'Receipt-PLG-001.pdf'
            && str_starts_with($r['document'], 'data:application/pdf;base64,'));
    }
}
