<?php

namespace Tests\Unit\WhatsApp;

use App\Models\WhatsAppConfig;
use App\Services\WhatsApp\Drivers\GraspGatewayDriver;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GraspGatewayDriverTest extends TestCase
{
    private function config(): WhatsAppConfig
    {
        return new WhatsAppConfig([
            'provider' => 'grasp',
            'instance_id' => 'pawnsys',   // tenant key
            'api_token' => 'service-key', // shared SERVICE_API_KEY
        ]);
    }

    private function send(GraspGatewayDriver $driver, array $params = ['Ali', 'PLG-9']): array
    {
        return $driver->sendText(
            $this->config(), '+60 12-345 6789', 'body', 'pledge_created', $params, 'Ali', 'ref-1'
        );
    }

    public function test_send_posts_tenant_template_and_ordered_params(): void
    {
        Http::fake(['*/api/internal/send' => Http::response([
            'success' => true,
            'data' => ['status' => 'SENT', 'provider_message_id' => 'wamid.X', 'charged' => '0.05'],
        ], 200)]);

        $result = $this->send(new GraspGatewayDriver());

        $this->assertTrue($result['success']);
        $this->assertSame('wamid.X', $result['message_id']);

        Http::assertSent(function ($r) {
            return $r->hasHeader('X-Service-Key', 'service-key')
                && $r->data()['temple_id'] === 'pawnsys'
                && $r->data()['template'] === 'pledge_created'
                && $r->data()['params'] === ['Ali', 'PLG-9']
                && $r->data()['reference'] === 'ref-1'
                // digits only: the gateway forwards `to` verbatim to AiSensy
                && $r->data()['to'] === '60123456789';
        });
    }

    public function test_already_sent_is_treated_as_success(): void
    {
        Http::fake(['*/api/internal/send' => Http::response([
            'success' => true,
            'data' => ['status' => 'ALREADY_SENT', 'reference' => 'ref-1', 'charged' => 0],
        ], 200)]);

        $result = $this->send(new GraspGatewayDriver());

        $this->assertTrue($result['success']);
        $this->assertNull($result['message_id']);
    }

    public function test_skipped_status_is_a_failure_despite_http_200(): void
    {
        Http::fake(['*/api/internal/send' => Http::response([
            'success' => true,
            'data' => ['status' => 'SKIPPED', 'reason' => 'not allowed'],
        ], 200)]);

        $result = $this->send(new GraspGatewayDriver());

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('SKIPPED', $result['error']);
    }

    public function test_validation_errors_object_is_flattened(): void
    {
        Http::fake(['*/api/internal/send' => Http::response([
            'success' => false,
            'errors' => ['to' => ['String must contain at least 6 character(s)']],
        ], 422)]);

        $result = $this->send(new GraspGatewayDriver());

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('to:', $result['error']);
        $this->assertStringContainsString('at least 6', $result['error']);
    }

    public function test_insufficient_balance_message_is_surfaced(): void
    {
        Http::fake(['*/api/internal/send' => Http::response([
            'success' => false,
            'message' => 'Insufficient WhatsApp balance: 0.0000 MYR available.',
        ], 402)]);

        $result = $this->send(new GraspGatewayDriver());

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('Insufficient WhatsApp balance', $result['error']);
    }

    public function test_blank_parameter_is_rejected_before_the_wallet_is_charged(): void
    {
        Http::fake();

        $result = $this->send(new GraspGatewayDriver(), ['Ali', '  ']);

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('empty', $result['error']);
        Http::assertNothingSent();
    }

    public function test_missing_tenant_template_or_reference_fails_without_a_request(): void
    {
        Http::fake();
        $driver = new GraspGatewayDriver();

        $noTenant = new WhatsAppConfig(['provider' => 'grasp', 'api_token' => 'k']);
        $this->assertFalse($driver->sendText($noTenant, '60123', 'b', 'tpl', ['x'], null, 'r')['success']);
        $this->assertFalse($driver->sendText($this->config(), '60123', 'b', null, ['x'], null, 'r')['success']);
        $this->assertFalse($driver->sendText($this->config(), '60123', 'b', 'tpl', ['x'], null, null)['success']);

        Http::assertNothingSent();
    }

    public function test_document_send_attaches_the_public_url(): void
    {
        Http::fake(['*/api/internal/send' => Http::response([
            'success' => true,
            'data' => ['status' => 'SENT', 'provider_message_id' => 'wamid.D'],
        ], 200)]);

        $result = (new GraspGatewayDriver())->sendDocument(
            $this->config(), '60123456789', 'BASE64', 'receipt.pdf', 'caption',
            'https://example.com/r.pdf', 'pledge_receipt', ['Ali'], 'Ali', 'ref-2'
        );

        $this->assertTrue($result['success']);
        Http::assertSent(fn ($r) => $r->data()['document']['url'] === 'https://example.com/r.pdf'
            && $r->data()['document']['filename'] === 'receipt.pdf');
    }

    public function test_document_send_requires_a_public_url(): void
    {
        Http::fake();

        $result = (new GraspGatewayDriver())->sendDocument(
            $this->config(), '60123456789', 'BASE64', 'receipt.pdf', 'caption',
            null, 'pledge_receipt', ['Ali'], 'Ali', 'ref-2'
        );

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('public document URL', $result['error']);
        Http::assertNothingSent();
    }

    public function test_test_connection_checks_key_and_tenant_together(): void
    {
        Http::fake(['*/api/internal/status' => Http::response(['success' => true, 'data' => []], 200)]);

        $this->assertTrue((new GraspGatewayDriver())->testConnection($this->config())['success']);

        Http::assertSent(fn ($r) => $r->hasHeader('X-Service-Key', 'service-key')
            && $r->hasHeader('X-Temple-ID', 'pawnsys'));
    }

    public function test_test_connection_fails_when_credentials_are_missing(): void
    {
        Http::fake();
        $driver = new GraspGatewayDriver();

        $this->assertFalse($driver->testConnection(new WhatsAppConfig(['provider' => 'grasp']))['success']);
        $this->assertFalse($driver->testConnection(
            new WhatsAppConfig(['provider' => 'grasp', 'api_token' => 'k'])
        )['success']);

        Http::assertNothingSent();
    }
}
