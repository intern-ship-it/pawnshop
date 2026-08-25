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

    public function test_ultramsg_body_carries_the_admin_signoff(): void
    {
        config([
            'pawnsys.whatsapp.admin_note' => 'Contact admin on this number for any queries.',
            'pawnsys.whatsapp.admin_contact' => '+60 12 694 5430',
        ]);
        Http::fake(['api.ultramsg.com/*' => Http::response(['sent' => 'true', 'id' => 'm1'], 200)]);
        $config = new WhatsAppConfig(['provider' => 'ultramsg', 'instance_id' => 'i1', 'api_token' => 't1']);

        (new WhatsAppService())->sendText($config, '60123', 'Your pledge is ready.');

        Http::assertSent(function ($r) {
            $body = $r->data()['body'] ?? '';
            return str_contains($body, 'Your pledge is ready.')
                && str_contains($body, 'Contact admin on this number for any queries. +60 12 694 5430');
        });
    }

    public function test_signoff_is_not_appended_twice_on_resend(): void
    {
        config([
            'pawnsys.whatsapp.admin_note' => 'Contact admin on this number for any queries.',
            'pawnsys.whatsapp.admin_contact' => '+60 12 694 5430',
        ]);
        Http::fake(['api.ultramsg.com/*' => Http::response(['sent' => 'true', 'id' => 'm1'], 200)]);
        $config = new WhatsAppConfig(['provider' => 'ultramsg', 'instance_id' => 'i1', 'api_token' => 't1']);

        $alreadySigned = "Hi

Contact admin on this number for any queries. +60 12 694 5430";
        (new WhatsAppService())->sendText($config, '60123', $alreadySigned);

        Http::assertSent(fn ($r) => substr_count($r->data()['body'] ?? '', '+60 12 694 5430') === 1);
    }

    public function test_blank_signoff_config_leaves_the_body_untouched(): void
    {
        config(['pawnsys.whatsapp.admin_note' => '', 'pawnsys.whatsapp.admin_contact' => '']);
        Http::fake(['api.ultramsg.com/*' => Http::response(['sent' => 'true', 'id' => 'm1'], 200)]);
        $config = new WhatsAppConfig(['provider' => 'ultramsg', 'instance_id' => 'i1', 'api_token' => 't1']);

        (new WhatsAppService())->sendText($config, '60123', 'Plain body');

        Http::assertSent(fn ($r) => ($r->data()['body'] ?? '') === 'Plain body');
    }

    public function test_dispatches_to_grasp_gateway_with_a_stable_reference(): void
    {
        Http::fake(['*/api/internal/send' => Http::response([
            'success' => true, 'data' => ['status' => 'SENT', 'provider_message_id' => 'wamid.G'],
        ], 200)]);
        $config = new WhatsAppConfig(['provider' => 'grasp', 'instance_id' => 'pawnsys', 'api_token' => 'key']);
        $template = new WhatsAppTemplate([
            'template_key' => 'pledge_created',
            'aisensy_campaign' => 'pledge_created_v1',
            'aisensy_params' => ['customer_name', 'pledge_no'],
        ]);
        $data = ['customer_name' => 'Ali', 'pledge_no' => 'PLG-9'];

        $service = new WhatsAppService();
        $service->sendText($config, '60123456789', 'rendered', $template, $data, 'Ali');
        $service->sendText($config, '60123456789', 'rendered', $template, $data, 'Ali');

        $references = [];
        Http::assertSent(function ($r) use (&$references) {
            $references[] = $r->data()['reference'];
            return true;
        });

        // Identical content must reuse the reference so a retry cannot double-charge.
        $this->assertCount(2, $references);
        $this->assertSame($references[0], $references[1]);
        $this->assertStringStartsWith('pawnsys:pledge_created:PLG-9:', $references[0]);
    }

    public function test_reference_differs_when_the_message_content_differs(): void
    {
        Http::fake(['*/api/internal/send' => Http::response([
            'success' => true, 'data' => ['status' => 'SENT', 'provider_message_id' => 'x'],
        ], 200)]);
        $config = new WhatsAppConfig(['provider' => 'grasp', 'instance_id' => 'pawnsys', 'api_token' => 'key']);
        $template = new WhatsAppTemplate([
            'template_key' => 'renewal_completed',
            'aisensy_campaign' => 'renewal_v1',
            'aisensy_params' => ['customer_name', 'new_due_date'],
        ]);

        $service = new WhatsAppService();
        $service->sendText($config, '60123456789', 'r', $template,
            ['customer_name' => 'Ali', 'pledge_no' => 'PLG-9', 'new_due_date' => '01/09/2026'], 'Ali');
        $service->sendText($config, '60123456789', 'r', $template,
            ['customer_name' => 'Ali', 'pledge_no' => 'PLG-9', 'new_due_date' => '01/03/2027'], 'Ali');

        $references = [];
        Http::assertSent(function ($r) use (&$references) {
            $references[] = $r->data()['reference'];
            return true;
        });

        // A later renewal on the same pledge must not be swallowed as a replay.
        $this->assertNotSame($references[0], $references[1]);
    }

    public function test_reference_override_wins_so_manual_resends_are_not_replayed(): void
    {
        Http::fake(['*/api/internal/send' => Http::response([
            'success' => true, 'data' => ['status' => 'SENT', 'provider_message_id' => 'x'],
        ], 200)]);
        $config = new WhatsAppConfig(['provider' => 'grasp', 'instance_id' => 'pawnsys', 'api_token' => 'key']);
        $template = new WhatsAppTemplate([
            'template_key' => 'pledge_created',
            'aisensy_campaign' => 'paja_pledge_created_v2',
            'aisensy_params' => ['customer_name'],
        ]);

        (new WhatsAppService())->sendText(
            $config, '60123456789', 'r', $template, ['customer_name' => 'Ali'], 'Ali', 'pawnsys:manual:80'
        );

        Http::assertSent(fn ($r) => $r->data()['reference'] === 'pawnsys:manual:80');
    }

    public function test_sandbox_guard_redirects_every_recipient(): void
    {
        config(['pawnsys.whatsapp.sandbox_to' => '60146478869']);
        Http::fake(['api.ultramsg.com/*' => Http::response(['sent' => 'true', 'id' => 'm1'], 200)]);
        $config = new WhatsAppConfig(['provider' => 'ultramsg', 'instance_id' => 'i1', 'api_token' => 't1']);

        (new WhatsAppService())->sendText($config, '60199999999', 'Hello');

        Http::assertSent(fn ($r) => $r->data()['to'] === '60146478869');
    }

    public function test_without_the_sandbox_guard_the_real_recipient_is_used(): void
    {
        config(['pawnsys.whatsapp.sandbox_to' => null]);
        Http::fake(['api.ultramsg.com/*' => Http::response(['sent' => 'true', 'id' => 'm1'], 200)]);
        $config = new WhatsAppConfig(['provider' => 'ultramsg', 'instance_id' => 'i1', 'api_token' => 't1']);

        (new WhatsAppService())->sendText($config, '60199999999', 'Hello');

        Http::assertSent(fn ($r) => $r->data()['to'] === '60199999999');
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
