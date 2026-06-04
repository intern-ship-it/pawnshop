<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class WhatsAppReceiptTest extends TestCase
{
    use RefreshDatabase;

    public function test_unsigned_request_is_rejected(): void
    {
        $this->get('/api/whatsapp/receipt/pledge/1')->assertForbidden();
    }

    public function test_signed_request_for_missing_pledge_returns_404(): void
    {
        $url = URL::temporarySignedRoute('whatsapp.receipt', now()->addMinutes(10), ['type' => 'pledge', 'id' => 999999]);
        $this->get($url)->assertNotFound();
    }
}
