<?php

namespace Tests\Feature;

use App\Models\WhatsAppTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WhatsAppConfigTest extends TestCase
{
    use RefreshDatabase;

    public function test_template_persists_aisensy_campaign_and_params(): void
    {
        $template = WhatsAppTemplate::create([
            'branch_id' => null,
            'template_key' => 'pledge_created',
            'name' => 'Pledge Created',
            'content' => 'Hello {customer_name}',
            'aisensy_campaign' => 'pledge_created_v1',
            'aisensy_params' => ['customer_name', 'pledge_no', 'loan_amount'],
        ]);

        $fresh = $template->fresh();

        $this->assertSame('pledge_created_v1', $fresh->aisensy_campaign);
        $this->assertSame(['customer_name', 'pledge_no', 'loan_amount'], $fresh->aisensy_params);
    }
}
