# AiSensy WhatsApp Provider — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AiSensy as a selectable per-branch WhatsApp provider alongside UltraMsg, routing every send (text, reminders, documents, owner dashboard) through one shared `WhatsAppService`.

**Architecture:** Extract all provider logic into `App\Services\WhatsAppService` with two private drivers (UltraMsg, AiSensy). Refactor the 6 duplicated call-sites to use it. AiSensy is campaign/template-based: each `template_key` maps to an AiSensy campaign name + ordered parameter list stored on the template; documents are sent via a short-lived signed public PDF URL.

**Tech Stack:** Laravel 11 (PHP 8.2), PHPUnit 11 + Mockery (dev deps present, harness not yet scaffolded), `Http::fake()` for HTTP tests, React (Vite) frontend.

**Reference spec:** `docs/superpowers/specs/2026-06-04-aisensy-whatsapp-provider-design.md`

---

## Important context for the implementer

- The repo has **PHPUnit 11 installed but no test harness** (no `phpunit.xml`, no base `TestCase`, empty `tests/Feature` & `tests/Unit`). **Task 1 scaffolds it** — nothing else can be tested until then.
- All backend commands run from `c:\pawan\backend`. On Windows PowerShell, run PHPUnit as: `php vendor/bin/phpunit` (or `vendor\bin\phpunit.bat`).
- The `provider` enum currently lives ONLY in the base migration `2025_01_01_000011_create_whatsapp_dayend_audit_tables.php` (`whatsapp_config.provider` = `['ultramsg','twilio','wati']`). We do **not** edit that migration; we add a new ALTER migration. MySQL enum changes need raw SQL (`DB::statement`), not Schema fluent methods.
- The UltraMsg send code exists in **two slightly different forms**: cURL-based (`WhatsAppController`, `SendDueReminders`, `SendDailyOwnerDashboard`) and `Http::` facade-based (`PledgeController`, `RenewalController`, `RedemptionController`). The shared service uses the `Http::` facade form (testable with `Http::fake()`).
- Uniform driver return shape across the whole feature: `['success' => bool, 'message_id' => ?string, 'error' => ?string]`. Note existing call-sites variously used `'message'` and `'error'` keys — the service standardizes on `'error'`, and each refactored call-site reads `$result['error']`.

---

## File Structure

**Create:**
- `backend/phpunit.xml` — test config
- `backend/tests/TestCase.php` — base test case
- `backend/tests/CreatesApplication.php` — app bootstrap trait (if not auto-provided)
- `backend/app/Services/WhatsApp/WhatsAppService.php` — public entry point + provider dispatch
- `backend/app/Services/WhatsApp/Drivers/UltraMsgDriver.php` — UltraMsg text + document + test
- `backend/app/Services/WhatsApp/Drivers/AiSensyDriver.php` — AiSensy text + document + test
- `backend/app/Services/WhatsApp/Drivers/WhatsAppDriver.php` — driver interface
- `backend/database/migrations/2026_06_04_100000_add_aisensy_to_whatsapp_provider_enum.php`
- `backend/database/migrations/2026_06_04_100100_add_aisensy_columns_to_whatsapp_templates.php`
- `backend/app/Http/Controllers/Api/WhatsAppReceiptController.php` — signed public PDF route
- `backend/tests/Unit/WhatsApp/UltraMsgDriverTest.php`
- `backend/tests/Unit/WhatsApp/AiSensyDriverTest.php`
- `backend/tests/Feature/WhatsAppConfigTest.php`

**Modify:**
- `backend/app/Models/WhatsAppConfig.php` — (no schema change; enum value only)
- `backend/app/Models/WhatsAppTemplate.php` — add `aisensy_campaign`, `aisensy_params` to fillable + cast
- `backend/app/Http/Controllers/Api/WhatsAppController.php` — validation + use service
- `backend/app/Http/Controllers/Api/PledgeController.php` — use service for text + document
- `backend/app/Http/Controllers/Api/RenewalController.php` — use service
- `backend/app/Http/Controllers/Api/RedemptionController.php` — use service
- `backend/app/Console/Commands/SendDueReminders.php` — use service
- `backend/app/Console/Commands/SendDailyOwnerDashboard.php` — use service
- `backend/routes/api.php` (or `web.php` for the signed route) — add receipt route
- `frontend/src/pages/settings/WhatsAppSettings.jsx` — provider option, provider-aware fields, campaign mapping UI

---

## Task 1: Scaffold the PHPUnit test harness

**Files:**
- Create: `backend/phpunit.xml`
- Create: `backend/tests/CreatesApplication.php`
- Create: `backend/tests/TestCase.php`
- Test: `backend/tests/Unit/SanityTest.php` (temporary)

- [ ] **Step 1: Create `backend/phpunit.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
         bootstrap="vendor/autoload.php"
         colors="true">
    <testsuites>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="Feature">
            <directory>tests/Feature</directory>
        </testsuite>
    </testsuites>
    <source>
        <include>
            <directory>app</directory>
        </include>
    </source>
    <php>
        <env name="APP_ENV" value="testing"/>
        <env name="DB_CONNECTION" value="sqlite"/>
        <env name="DB_DATABASE" value=":memory:"/>
        <env name="CACHE_STORE" value="array"/>
        <env name="QUEUE_CONNECTION" value="sync"/>
        <env name="SESSION_DRIVER" value="array"/>
        <env name="MAIL_MAILER" value="array"/>
    </php>
</phpunit>
```

- [ ] **Step 2: Create `backend/tests/CreatesApplication.php`**

```php
<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Application;

trait CreatesApplication
{
    public function createApplication(): Application
    {
        $app = require __DIR__.'/../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();
        return $app;
    }
}
```

- [ ] **Step 3: Create `backend/tests/TestCase.php`**

```php
<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;
}
```

- [ ] **Step 4: Create a temporary sanity test `backend/tests/Unit/SanityTest.php`**

```php
<?php

namespace Tests\Unit;

use Tests\TestCase;

class SanityTest extends TestCase
{
    public function test_app_boots(): void
    {
        $this->assertTrue(true);
        $this->assertNotEmpty(config('app.name'));
    }
}
```

- [ ] **Step 5: Run the harness**

Run (from `c:\pawan\backend`): `php vendor/bin/phpunit tests/Unit/SanityTest.php`
Expected: PASS (1 test, 2 assertions). If it errors about a missing app key, run `php artisan key:generate` first.

- [ ] **Step 6: Delete the sanity test and commit**

```bash
rm tests/Unit/SanityTest.php
git add phpunit.xml tests/CreatesApplication.php tests/TestCase.php
git commit -m "test: scaffold PHPUnit harness (phpunit.xml + base TestCase)"
```

---

## Task 2: Migration — add `aisensy` to the provider enum

**Files:**
- Create: `backend/database/migrations/2026_06_04_100000_add_aisensy_to_whatsapp_provider_enum.php`

- [ ] **Step 1: Create the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL enum change requires raw SQL. Skipped on sqlite (tests),
        // where the column is a plain string and accepts any value.
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE whatsapp_config MODIFY COLUMN provider ENUM('ultramsg','twilio','wati','aisensy') NOT NULL DEFAULT 'ultramsg'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE whatsapp_config MODIFY COLUMN provider ENUM('ultramsg','twilio','wati') NOT NULL DEFAULT 'ultramsg'");
        }
    }
};
```

- [ ] **Step 2: Run the migration locally**

Run: `php artisan migrate`
Expected: migration runs without error. (On the live cPanel MySQL it alters the enum; on sqlite test DB it's a no-op.)

- [ ] **Step 3: Commit**

```bash
git add database/migrations/2026_06_04_100000_add_aisensy_to_whatsapp_provider_enum.php
git commit -m "feat: add aisensy to whatsapp_config provider enum"
```

---

## Task 3: Migration + model — AiSensy template mapping columns

**Files:**
- Create: `backend/database/migrations/2026_06_04_100100_add_aisensy_columns_to_whatsapp_templates.php`
- Modify: `backend/app/Models/WhatsAppTemplate.php`
- Test: `backend/tests/Feature/WhatsAppConfigTest.php`

- [ ] **Step 1: Write a failing feature test for the new columns**

Create `backend/tests/Feature/WhatsAppConfigTest.php`:

```php
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `php vendor/bin/phpunit tests/Feature/WhatsAppConfigTest.php`
Expected: FAIL — column `aisensy_campaign` not found / attribute not fillable.

- [ ] **Step 3: Create the migration**

`backend/database/migrations/2026_06_04_100100_add_aisensy_columns_to_whatsapp_templates.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whatsapp_templates', function (Blueprint $table) {
            $table->string('aisensy_campaign')->nullable()->after('content');
            $table->json('aisensy_params')->nullable()->after('aisensy_campaign');
        });
    }

    public function down(): void
    {
        Schema::table('whatsapp_templates', function (Blueprint $table) {
            $table->dropColumn(['aisensy_campaign', 'aisensy_params']);
        });
    }
};
```

- [ ] **Step 4: Update the model `backend/app/Models/WhatsAppTemplate.php`**

Add `'aisensy_campaign'` and `'aisensy_params'` to the `$fillable` array, and add `'aisensy_params' => 'array'` to the `$casts` array. (Open the file; the existing `$fillable` already includes `branch_id, template_key, name, content, variables, is_enabled` — append the two new keys. The existing `$casts` already casts `variables => 'array'` and `is_enabled => 'boolean'` — append `aisensy_params => 'array'`.)

- [ ] **Step 5: Run the test to confirm it passes**

Run: `php vendor/bin/phpunit tests/Feature/WhatsAppConfigTest.php`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add database/migrations/2026_06_04_100100_add_aisensy_columns_to_whatsapp_templates.php app/Models/WhatsAppTemplate.php tests/Feature/WhatsAppConfigTest.php
git commit -m "feat: add aisensy_campaign and aisensy_params to whatsapp_templates"
```

---

## Task 4: Driver interface + UltraMsg driver (text)

**Files:**
- Create: `backend/app/Services/WhatsApp/Drivers/WhatsAppDriver.php`
- Create: `backend/app/Services/WhatsApp/Drivers/UltraMsgDriver.php`
- Test: `backend/tests/Unit/WhatsApp/UltraMsgDriverTest.php`

- [ ] **Step 1: Write a failing unit test for UltraMsg text send**

Create `backend/tests/Unit/WhatsApp/UltraMsgDriverTest.php`:

```php
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
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `php vendor/bin/phpunit tests/Unit/WhatsApp/UltraMsgDriverTest.php`
Expected: FAIL — class `UltraMsgDriver` not found.

- [ ] **Step 3: Create the driver interface `backend/app/Services/WhatsApp/Drivers/WhatsAppDriver.php`**

```php
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
        ?string $recipientName = null
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
        ?string $recipientName = null
    ): array;

    /**
     * @return array{success: bool, error?: ?string}
     */
    public function testConnection(WhatsAppConfig $config): array;
}
```

- [ ] **Step 4: Create `backend/app/Services/WhatsApp/Drivers/UltraMsgDriver.php` (text + testConnection; document added in Task 6)**

```php
<?php

namespace App\Services\WhatsApp\Drivers;

use App\Models\WhatsAppConfig;
use Illuminate\Support\Facades\Http;

class UltraMsgDriver implements WhatsAppDriver
{
    private function http()
    {
        $client = Http::timeout(30);
        // Match existing behaviour: skip SSL verify only in local dev.
        return app()->environment('local') ? $client->withoutVerifying() : $client;
    }

    public function sendText(
        WhatsAppConfig $config,
        string $phone,
        string $renderedMessage,
        ?string $campaign = null,
        array $templateParams = [],
        ?string $recipientName = null
    ): array {
        try {
            $response = $this->http()->asForm()->post(
                "https://api.ultramsg.com/{$config->instance_id}/messages/chat",
                ['token' => $config->api_token, 'to' => $phone, 'body' => $renderedMessage]
            );

            $data = $response->json() ?? [];

            if ($response->successful() && (($data['sent'] ?? null) === 'true' || isset($data['id']))) {
                return ['success' => true, 'message_id' => $data['id'] ?? null, 'error' => null];
            }

            return ['success' => false, 'message_id' => null,
                'error' => $data['error'] ?? $data['message'] ?? ('API request failed: ' . $response->status())];
        } catch (\Throwable $e) {
            return ['success' => false, 'message_id' => null, 'error' => $e->getMessage()];
        }
    }

    public function sendDocument(
        WhatsAppConfig $config,
        string $phone,
        string $pdfBase64,
        string $filename,
        string $caption,
        ?string $publicUrl = null,
        ?string $campaign = null,
        array $templateParams = [],
        ?string $recipientName = null
    ): array {
        // Implemented in Task 6.
        return ['success' => false, 'message_id' => null, 'error' => 'not implemented'];
    }

    public function testConnection(WhatsAppConfig $config): array
    {
        try {
            $response = $this->http()->get(
                "https://api.ultramsg.com/{$config->instance_id}/instance/status",
                ['token' => $config->api_token]
            );
            $data = $response->json() ?? [];
            if ($response->successful() && !isset($data['error'])) {
                return ['success' => true, 'error' => null];
            }
            return ['success' => false, 'error' => $data['error'] ?? 'Connection failed'];
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `php vendor/bin/phpunit tests/Unit/WhatsApp/UltraMsgDriverTest.php`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add app/Services/WhatsApp/Drivers/WhatsAppDriver.php app/Services/WhatsApp/Drivers/UltraMsgDriver.php tests/Unit/WhatsApp/UltraMsgDriverTest.php
git commit -m "feat: add WhatsAppDriver interface and UltraMsg text driver"
```

---

## Task 5: AiSensy driver (text)

**Files:**
- Create: `backend/app/Services/WhatsApp/Drivers/AiSensyDriver.php`
- Test: `backend/tests/Unit/WhatsApp/AiSensyDriverTest.php`

- [ ] **Step 1: Write a failing unit test for AiSensy text send**

Create `backend/tests/Unit/WhatsApp/AiSensyDriverTest.php`:

```php
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
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `php vendor/bin/phpunit tests/Unit/WhatsApp/AiSensyDriverTest.php`
Expected: FAIL — class `AiSensyDriver` not found.

- [ ] **Step 3: Create `backend/app/Services/WhatsApp/Drivers/AiSensyDriver.php`**

```php
<?php

namespace App\Services\WhatsApp\Drivers;

use App\Models\WhatsAppConfig;
use Illuminate\Support\Facades\Http;

class AiSensyDriver implements WhatsAppDriver
{
    private const ENDPOINT = 'https://backend.aisensy.com/campaign/t1/api/v2';

    private function normalizeDestination(string $phone): string
    {
        $phone = preg_replace('/[^0-9]/', '', $phone);
        return '+' . $phone;
    }

    private function http()
    {
        $client = Http::timeout(30);
        return app()->environment('local') ? $client->withoutVerifying() : $client;
    }

    public function sendText(
        WhatsAppConfig $config,
        string $phone,
        string $renderedMessage,
        ?string $campaign = null,
        array $templateParams = [],
        ?string $recipientName = null
    ): array {
        if (empty($campaign)) {
            return ['success' => false, 'message_id' => null,
                'error' => 'No AiSensy campaign configured for this message type'];
        }

        return $this->postCampaign($config, $phone, $campaign, $templateParams, $recipientName, null, null);
    }

    public function sendDocument(
        WhatsAppConfig $config,
        string $phone,
        string $pdfBase64,
        string $filename,
        string $caption,
        ?string $publicUrl = null,
        ?string $campaign = null,
        array $templateParams = [],
        ?string $recipientName = null
    ): array {
        if (empty($campaign)) {
            return ['success' => false, 'message_id' => null,
                'error' => 'No AiSensy campaign configured for this document message type'];
        }
        if (empty($publicUrl)) {
            return ['success' => false, 'message_id' => null,
                'error' => 'AiSensy requires a public document URL; none was provided'];
        }

        return $this->postCampaign($config, $phone, $campaign, $templateParams, $recipientName, $publicUrl, $filename);
    }

    private function postCampaign(
        WhatsAppConfig $config,
        string $phone,
        string $campaign,
        array $templateParams,
        ?string $recipientName,
        ?string $mediaUrl,
        ?string $mediaFilename
    ): array {
        try {
            $payload = [
                'apiKey' => $config->api_token,
                'campaignName' => $campaign,
                'destination' => $this->normalizeDestination($phone),
                'userName' => $recipientName ?: 'Customer',
                'templateParams' => array_values($templateParams),
            ];

            if ($mediaUrl) {
                $payload['media'] = ['url' => $mediaUrl, 'filename' => $mediaFilename ?? 'document.pdf'];
            }

            $response = $this->http()->asJson()->post(self::ENDPOINT, $payload);
            $data = $response->json() ?? [];

            if ($response->successful() && ($data['success'] ?? true) !== false) {
                return ['success' => true, 'message_id' => $data['messageId'] ?? $data['id'] ?? null, 'error' => null];
            }

            return ['success' => false, 'message_id' => null,
                'error' => $data['errorMessage'] ?? $data['message'] ?? ('AiSensy request failed: ' . $response->status())];
        } catch (\Throwable $e) {
            return ['success' => false, 'message_id' => null, 'error' => $e->getMessage()];
        }
    }

    public function testConnection(WhatsAppConfig $config): array
    {
        // AiSensy has no documented health endpoint. Treat presence of an API key as
        // configured; a real failure surfaces on the first send. Never report success
        // when the key is missing.
        if (empty($config->api_token)) {
            return ['success' => false, 'error' => 'AiSensy API key is not set'];
        }
        return ['success' => true, 'error' => null];
    }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `php vendor/bin/phpunit tests/Unit/WhatsApp/AiSensyDriverTest.php`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/Services/WhatsApp/Drivers/AiSensyDriver.php tests/Unit/WhatsApp/AiSensyDriverTest.php
git commit -m "feat: add AiSensy text driver (campaign + templateParams)"
```

---

## Task 6: Document sending in both drivers

**Files:**
- Modify: `backend/app/Services/WhatsApp/Drivers/UltraMsgDriver.php:sendDocument`
- Test: `backend/tests/Unit/WhatsApp/UltraMsgDriverTest.php`, `backend/tests/Unit/WhatsApp/AiSensyDriverTest.php`

- [ ] **Step 1: Add failing tests for document sends**

Append to `UltraMsgDriverTest`:

```php
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
```

Append to `AiSensyDriverTest`:

```php
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
```

- [ ] **Step 2: Run them to confirm failure**

Run: `php vendor/bin/phpunit tests/Unit/WhatsApp/`
Expected: FAIL — UltraMsg document returns 'not implemented'; AiSensy media test may already pass (driver already supports media). Confirm the UltraMsg one fails.

- [ ] **Step 3: Implement `UltraMsgDriver::sendDocument`** (replace the placeholder body from Task 4)

```php
    public function sendDocument(
        WhatsAppConfig $config,
        string $phone,
        string $pdfBase64,
        string $filename,
        string $caption,
        ?string $publicUrl = null,
        ?string $campaign = null,
        array $templateParams = [],
        ?string $recipientName = null
    ): array {
        try {
            $response = $this->http()->timeout(60)->asForm()->post(
                "https://api.ultramsg.com/{$config->instance_id}/messages/document",
                [
                    'token' => $config->api_token,
                    'to' => $phone,
                    'document' => 'data:application/pdf;base64,' . $pdfBase64,
                    'filename' => $filename,
                    'caption' => $caption,
                ]
            );

            $data = $response->json() ?? [];
            if ($response->successful() && (($data['sent'] ?? null) === 'true' || ($data['sent'] ?? null) === true || isset($data['id']))) {
                return ['success' => true, 'message_id' => $data['id'] ?? null, 'error' => null];
            }

            return ['success' => false, 'message_id' => null,
                'error' => $data['error'] ?? $data['message'] ?? ('Document send failed: ' . $response->status())];
        } catch (\Throwable $e) {
            return ['success' => false, 'message_id' => null, 'error' => $e->getMessage()];
        }
    }
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `php vendor/bin/phpunit tests/Unit/WhatsApp/`
Expected: PASS (all driver tests).

- [ ] **Step 5: Commit**

```bash
git add app/Services/WhatsApp/Drivers/UltraMsgDriver.php tests/Unit/WhatsApp/
git commit -m "feat: document sending for UltraMsg (base64) and AiSensy (media url)"
```

---

## Task 7: `WhatsAppService` dispatcher

**Files:**
- Create: `backend/app/Services/WhatsApp/WhatsAppService.php`
- Test: `backend/tests/Unit/WhatsApp/WhatsAppServiceTest.php`

- [ ] **Step 1: Write a failing test for provider dispatch**

Create `backend/tests/Unit/WhatsApp/WhatsAppServiceTest.php`:

```php
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
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `php vendor/bin/phpunit tests/Unit/WhatsApp/WhatsAppServiceTest.php`
Expected: FAIL — class `WhatsAppService` not found.

- [ ] **Step 3: Create `backend/app/Services/WhatsApp/WhatsAppService.php`**

```php
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
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `php vendor/bin/phpunit tests/Unit/WhatsApp/WhatsAppServiceTest.php`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/Services/WhatsApp/WhatsAppService.php tests/Unit/WhatsApp/WhatsAppServiceTest.php
git commit -m "feat: add WhatsAppService provider dispatcher"
```

---

## Task 8: Refactor `WhatsAppController` to use the service

**Files:**
- Modify: `backend/app/Http/Controllers/Api/WhatsAppController.php`
- Test: `backend/tests/Feature/WhatsAppConfigTest.php`

- [ ] **Step 1: Add a failing feature test for `provider=aisensy` validation + template-param persistence via the API**

Append to `backend/tests/Feature/WhatsAppConfigTest.php` (add `use` imports for `User`, `Branch` as needed; if factories don't exist, create the records directly). Test that `updateTemplate` accepts the AiSensy fields:

```php
    public function test_update_template_endpoint_accepts_aisensy_fields(): void
    {
        // Arrange a global template + an authenticated user with a branch.
        $branch = \App\Models\Branch::factory()->create();
        $user = \App\Models\User::factory()->create(['branch_id' => $branch->id]);
        $template = WhatsAppTemplate::create([
            'branch_id' => null, 'template_key' => 'pledge_created',
            'name' => 'Pledge Created', 'content' => 'Hi {customer_name}',
        ]);

        $this->actingAs($user)
            ->putJson("/api/whatsapp/templates/{$template->id}", [
                'aisensy_campaign' => 'pledge_v1',
                'aisensy_params' => ['customer_name', 'pledge_no'],
            ])
            ->assertSuccessful();

        $this->assertDatabaseHas('whatsapp_templates', [
            'template_key' => 'pledge_created',
            'branch_id' => $branch->id,
            'aisensy_campaign' => 'pledge_v1',
        ]);
    }
```

> NOTE: If `Branch`/`User` factories do not exist in this repo, replace the `factory()->create()` calls with direct `Model::create([...])` using the minimum required columns (check the respective migrations for non-nullable fields). Confirm the exact route name for updating a template in `routes/api.php` (it may be `whatsapp/templates/{whatsAppTemplate}`); adjust the URL accordingly.

- [ ] **Step 2: Run it to confirm it fails**

Run: `php vendor/bin/phpunit tests/Feature/WhatsAppConfigTest.php`
Expected: FAIL — `aisensy_campaign`/`aisensy_params` not in validation, so not persisted.

- [ ] **Step 3: Update `WhatsAppController`**

Make these edits:

1. Add constructor injection at the top of the class:
```php
    public function __construct(private \App\Services\WhatsApp\WhatsAppService $whatsapp) {}
```

2. In `updateConfig`, change the provider rule and make `instance_id` nullable:
```php
        $validated = $request->validate([
            'provider' => 'required|in:ultramsg,twilio,wati,aisensy',
            'instance_id' => 'nullable|string|max:100',
            'api_token' => 'nullable|string|max:255',
            'phone_number' => 'required|string|max:20',
            'is_enabled' => 'nullable|boolean',
        ]);
```

3. In `updateTemplate`, extend the validation rules:
```php
        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'content' => 'sometimes|string',
            'variables' => 'nullable|array',
            'is_enabled' => 'sometimes|boolean',
            'aisensy_campaign' => 'sometimes|nullable|string|max:255',
            'aisensy_params' => 'sometimes|nullable|array',
        ]);
```

4. Replace the body of `sendWhatsAppMessage()` and `sendTestMessage()` and the `send`/`resend`/`testConnection` internals so they call `$this->whatsapp`. Specifically:
   - In `testConnection()`, replace `$result = $this->sendTestMessage($config);` with `$result = $this->whatsapp->testConnection($config);`.
   - In `send()`, replace `$result = $this->sendWhatsAppMessage($config, $validated['recipient_phone'], $message);` with:
```php
            $result = $this->whatsapp->sendText(
                $config,
                $validated['recipient_phone'],
                $message,
                $template,
                $validated['data'],
                $validated['recipient_name'] ?? null
            );
```
   - In `resend()`, replace `$result = $this->sendWhatsAppMessage(...)` with `$result = $this->whatsapp->sendText($config, $whatsAppLog->recipient_phone, $whatsAppLog->message_content);` (resend has no template context; UltraMsg uses the stored message, AiSensy resend without a campaign will return a clear error — acceptable).
   - Update the `$result['error']` reads (already uses `$result['error'] ?? 'Unknown error'`, which matches the new shape).

5. Delete the now-unused private methods: `sendTestMessage`, `sendWhatsAppMessage`, `testUltramsg`, `sendViaUltramsg`, `testTwilio`, `sendViaTwilio`, `testWati`, `sendViaWati`.

- [ ] **Step 4: Run the feature test + driver tests**

Run: `php vendor/bin/phpunit tests/Feature/WhatsAppConfigTest.php tests/Unit/WhatsApp/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Api/WhatsAppController.php tests/Feature/WhatsAppConfigTest.php
git commit -m "refactor: WhatsAppController uses WhatsAppService; accept aisensy fields"
```

---

## Task 9: Refactor `SendDueReminders` command

**Files:**
- Modify: `backend/app/Console/Commands/SendDueReminders.php`

- [ ] **Step 1: Update the command to use the service**

1. Add an injected service via the `handle` signature:
```php
    public function handle(\App\Services\WhatsApp\WhatsAppService $whatsapp): int
```
Store it: at the top of `handle`, `$this->whatsapp = $whatsapp;` and add a property `protected \App\Services\WhatsApp\WhatsAppService $whatsapp;`.

2. In `sendReminder()`, the code already has `$template`, `$data` (template data), and the rendered `$message`. Replace:
```php
        $result = $this->sendViaProvider($config, $phone, $message);
```
with:
```php
        $result = $this->whatsapp->sendText($config, $phone, $message, $template, $data, $customer->name);
```

3. The `WhatsAppLog::create([... 'error_message' => $result['error'] ?? null ...])` already reads `$result['error']` — keep it.

4. Delete the now-unused methods: `sendViaProvider`, `sendViaUltramsg`, `sendViaTwilio`, `sendViaWati`.

- [ ] **Step 2: Verify the command still runs (dry-run)**

Run: `php artisan pawnsys:send-due-reminders --dry-run`
Expected: runs to the SUMMARY block without fatal error (dry-run sends nothing). If there is no WhatsApp-enabled branch locally it prints "No branches…" — that's fine.

- [ ] **Step 3: Run the full unit/feature suite to ensure nothing regressed**

Run: `php vendor/bin/phpunit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/Console/Commands/SendDueReminders.php
git commit -m "refactor: SendDueReminders uses WhatsAppService (supports aisensy)"
```

---

## Task 10: Signed public receipt URL route + controller

**Files:**
- Create: `backend/app/Http/Controllers/Api/WhatsAppReceiptController.php`
- Modify: `backend/routes/api.php` (and/or `routes/web.php` — see note)
- Test: `backend/tests/Feature/WhatsAppReceiptTest.php`

> This route gives AiSensy a publicly fetchable PDF URL. It must be a **signed** route (Laravel `signed` middleware) with a short TTL and **no auth middleware** (AiSensy's servers are unauthenticated). Place it in `routes/web.php` if `api.php` has global `auth:sanctum`; otherwise an unauthenticated group in `api.php` is fine. Confirm which by reading the route files first.

- [ ] **Step 1: Write a failing feature test**

Create `backend/tests/Feature/WhatsAppReceiptTest.php`:

```php
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
        $this->get('/whatsapp/receipt/pledge/1')->assertForbidden();
    }

    public function test_signed_request_for_missing_pledge_returns_404(): void
    {
        $url = URL::temporarySignedRoute('whatsapp.receipt', now()->addMinutes(10), ['type' => 'pledge', 'id' => 999999]);
        $this->get($url)->assertNotFound();
    }
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `php vendor/bin/phpunit tests/Feature/WhatsAppReceiptTest.php`
Expected: FAIL — route `whatsapp.receipt` not defined.

- [ ] **Step 3: Create the controller**

`backend/app/Http/Controllers/Api/WhatsAppReceiptController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pledge;
use App\Models\Renewal;
use App\Models\Redemption;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class WhatsAppReceiptController extends Controller
{
    /**
     * Serve a receipt PDF over a signed, time-limited public URL (for AiSensy media fetch).
     */
    public function show(Request $request, string $type, int $id): Response
    {
        $pdfBase64 = match ($type) {
            'pledge' => $this->pledgePdf($id),
            'renewal' => $this->renewalPdf($id),
            'redemption' => $this->redemptionPdf($id),
            default => null,
        };

        if ($pdfBase64 === null) {
            abort(404);
        }

        return response(base64_decode($pdfBase64), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="receipt.pdf"',
        ]);
    }

    private function pledgePdf(int $id): ?string
    {
        $pledge = Pledge::with(['customer', 'items.category', 'branch'])->find($id);
        if (!$pledge) {
            return null;
        }
        return app(\App\Services\WhatsApp\ReceiptPdfBuilder::class)->pledge($pledge);
    }

    private function renewalPdf(int $id): ?string
    {
        $renewal = Renewal::with(['pledge.customer', 'pledge.branch'])->find($id);
        return $renewal ? app(\App\Services\WhatsApp\ReceiptPdfBuilder::class)->renewal($renewal) : null;
    }

    private function redemptionPdf(int $id): ?string
    {
        $redemption = Redemption::with(['pledge.customer', 'pledge.branch'])->find($id);
        return $redemption ? app(\App\Services\WhatsApp\ReceiptPdfBuilder::class)->redemption($redemption) : null;
    }
}
```

> NOTE: This references a `ReceiptPdfBuilder` service that centralizes the (currently duplicated) PDF-generation logic from the three controllers. Task 11 extracts it. For THIS task, to keep the route working and the test green without the builder, temporarily implement the three `*Pdf` methods to `return null;` for unknown and generate a trivial PDF only if the model exists is overkill — instead, **defer real PDF generation to Task 11** and for now make the methods return `null` when the model is missing and a minimal `%PDF` stub string (base64) when found, so the signed-route test passes. Replace with the builder in Task 11.

For Step 3, use this minimal stub for the private methods so the test passes now:
```php
    private function pledgePdf(int $id): ?string
    {
        return Pledge::find($id) ? base64_encode("%PDF-1.4 stub") : null;
    }
    private function renewalPdf(int $id): ?string
    {
        return Renewal::find($id) ? base64_encode("%PDF-1.4 stub") : null;
    }
    private function redemptionPdf(int $id): ?string
    {
        return Redemption::find($id) ? base64_encode("%PDF-1.4 stub") : null;
    }
```
(Remove the `app(ReceiptPdfBuilder…)` lines for now; wire them in Task 11.)

- [ ] **Step 4: Register the route**

Read `routes/api.php` and `routes/web.php` to determine where unauthenticated routes live. Add (in `web.php` if api is globally authed):

```php
use App\Http\Controllers\Api\WhatsAppReceiptController;

Route::get('/whatsapp/receipt/{type}/{id}', [WhatsAppReceiptController::class, 'show'])
    ->middleware('signed')
    ->where('type', 'pledge|renewal|redemption')
    ->name('whatsapp.receipt');
```

- [ ] **Step 5: Run the test to confirm pass**

Run: `php vendor/bin/phpunit tests/Feature/WhatsAppReceiptTest.php`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Api/WhatsAppReceiptController.php routes/ tests/Feature/WhatsAppReceiptTest.php
git commit -m "feat: signed public receipt PDF route for AiSensy media fetch"
```

---

## Task 11: Extract `ReceiptPdfBuilder` and refactor Pledge/Renewal/Redemption sends

**Files:**
- Create: `backend/app/Services/WhatsApp/ReceiptPdfBuilder.php`
- Modify: `backend/app/Http/Controllers/Api/PledgeController.php`
- Modify: `backend/app/Http/Controllers/Api/RenewalController.php`
- Modify: `backend/app/Http/Controllers/Api/RedemptionController.php`
- Modify: `backend/app/Http/Controllers/Api/WhatsAppReceiptController.php` (wire builder)

> The three controllers each contain a near-identical `sendPdfReceipt()` (~150 lines: settings map, logo base64, barcode, multilang image, DomPDF render). The only differences are the PDF blade view, the model variable passed, the paper size, and the filename/caption. Extract the shared logic into `ReceiptPdfBuilder` with one method per receipt type that **returns base64 PDF** (no sending). Each controller then: builds PDF via the builder → calls `$this->whatsapp->sendDocument(...)`, passing a signed public URL when `provider === 'aisensy'`.

- [ ] **Step 1: Create `ReceiptPdfBuilder`**

Create `backend/app/Services/WhatsApp/ReceiptPdfBuilder.php` with public methods `pledge(Pledge $pledge): string`, `renewal(Renewal $renewal): string`, `redemption(Redemption $redemption): string`, each returning **base64-encoded PDF**. Move the shared settings/logo/barcode/multilang logic (currently in `PledgeController::sendPdfReceipt` lines ~1248-1349, `RenewalController::sendPdfReceipt` lines ~744-854, and the equivalent in `RedemptionController`) into a private helper `buildSettingsAndAssets($branch): array`, then per-type render the correct blade:
- pledge → `pdf.pledge-receipt-preprinted`, paper `[0,0,710,450]`
- renewal → `pdf.renewal-receipt-preprinted`, paper `[0,0,710,450]`
- redemption → the view used by `RedemptionController` (read the file to confirm the blade name and paper size)

(Reproduce the exact data arrays each blade expects — copy the existing `$data` array construction verbatim from each controller into the matching builder method. Do not paraphrase the blade variable names.)

- [ ] **Step 2: Wire `WhatsAppReceiptController` to the builder**

Replace the stub `*Pdf` methods from Task 10 with real calls:
```php
    private function pledgePdf(int $id): ?string
    {
        $pledge = Pledge::with(['customer','items.category','branch'])->find($id);
        return $pledge ? app(ReceiptPdfBuilder::class)->pledge($pledge) : null;
    }
```
(and similarly for renewal/redemption; add `use App\Services\WhatsApp\ReceiptPdfBuilder;`).

- [ ] **Step 3: Refactor `PledgeController` send path**

In `PledgeController`:
1. Inject the service + builder where the WhatsApp send happens (constructor or method-resolve via `app()`).
2. Replace the text-send `sendViaProvider(...)` call with `app(\App\Services\WhatsApp\WhatsAppService::class)->sendText($config, $phone, $message, $template, $templateData, $customerName)` — where `$template` is the `pledge_created` `WhatsAppTemplate` (load it the same way other code does) and `$templateData` is the variable map used to render `$message`.
3. Replace the `sendPdfReceipt(...)` body: build base64 via `app(ReceiptPdfBuilder::class)->pledge($pledge)`, compute `$publicUrl = $config->provider === 'aisensy' ? URL::temporarySignedRoute('whatsapp.receipt', now()->addMinutes(15), ['type' => 'pledge', 'id' => $pledge->id]) : null;`, then `app(WhatsAppService::class)->sendDocument($config, $phone, $pdfBase64, "Receipt-{$pledge->pledge_no}.pdf", "📄 Receipt for Pledge {$pledge->pledge_no}", $publicUrl, $template, $templateData, $customerName)`.
4. Delete the now-unused `sendViaProvider`, `sendViaUltramsg`, `sendViaTwilio`, `sendViaWati`, and the inline document-post block.

- [ ] **Step 4: Repeat Step 3 for `RenewalController` and `RedemptionController`**

Use their respective template keys (`renewal_done`, `redemption_done`), filenames (`Renewal-Receipt-{no}.pdf`, `Redemption-Receipt-{no}.pdf`), and `type` values (`renewal`, `redemption`) in the signed URL.

- [ ] **Step 5: Run the full suite + a manual smoke of the receipt route**

Run: `php vendor/bin/phpunit`
Expected: PASS.
Also verify no syntax errors: `php artisan route:list --path=whatsapp`
Expected: shows `whatsapp.receipt`.

- [ ] **Step 6: Commit**

```bash
git add app/Services/WhatsApp/ReceiptPdfBuilder.php app/Http/Controllers/Api/PledgeController.php app/Http/Controllers/Api/RenewalController.php app/Http/Controllers/Api/RedemptionController.php app/Http/Controllers/Api/WhatsAppReceiptController.php
git commit -m "refactor: extract ReceiptPdfBuilder; pledge/renewal/redemption use WhatsAppService"
```

---

## Task 12: Refactor `SendDailyOwnerDashboard` command

**Files:**
- Modify: `backend/app/Console/Commands/SendDailyOwnerDashboard.php`

> This command currently hard-rejects non-ultramsg (`if ($config->provider !== 'ultramsg') { skip }`) for its document send. Route it through the service so AiSensy works when a public URL is available; otherwise skip gracefully with a logged message.

- [ ] **Step 1: Read the command around lines 140-240** to see how it builds the dashboard PDF and phone list.

- [ ] **Step 2: Replace the provider gate + inline document post**

Replace the `if ($config->provider !== 'ultramsg')` skip and the inline `api.ultramsg.com/.../messages/document` post with:
- For UltraMsg: `app(WhatsAppService::class)->sendDocument($config, $phone, $pdfBase64, $filename, $caption, null)`.
- For AiSensy: the owner dashboard PDF has no per-record signed route. If a public URL can be produced, pass it; otherwise log `"AiSensy owner-dashboard document send needs a public URL — skipping"` and continue. (Keep the existing graceful-skip behaviour, just reworded for AiSensy instead of a blanket non-ultramsg reject.)

- [ ] **Step 3: Smoke test**

Run: `php artisan list | findstr owner` to confirm the command still registers, then if applicable `php artisan <owner-dashboard-command> --help`.
Expected: no fatal error.

- [ ] **Step 4: Run the suite**

Run: `php vendor/bin/phpunit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/Console/Commands/SendDailyOwnerDashboard.php
git commit -m "refactor: SendDailyOwnerDashboard uses WhatsAppService"
```

---

## Task 13: Frontend — provider option, provider-aware config, campaign mapping UI

**Files:**
- Modify: `frontend/src/pages/settings/WhatsAppSettings.jsx`

- [ ] **Step 1: Add AiSensy to the provider dropdown**

In the provider `<select>` (around line 729), add after the WATI option:
```jsx
                    <option value="aisensy">AiSensy</option>
```

- [ ] **Step 2: Make the API-token label + instance field provider-aware**

Replace the static "API Token" label and "Instance ID" input with provider-aware versions:
- When `config.provider === 'aisensy'`: label the token field **"API Key"** and **hide** the Instance ID input (AiSensy doesn't use it).
- Otherwise keep "API Token" + "Instance ID" as today.

Concretely, wrap the Instance ID `<Input>` (lines ~735-743) in `{config.provider !== "aisensy" && ( ... )}`, and change the API Token `<Input label="API Token" ...>` to `label={config.provider === "aisensy" ? "API Key" : "API Token"}`.

- [ ] **Step 3: Make the "How it works" helper provider-aware**

Replace the hard-coded UltraMsg steps (lines ~846-853) with a conditional: when `aisensy`, show:
```
1. Create & get your WhatsApp templates approved in AiSensy (Meta)
2. Create a Live API Campaign for each message type
3. Copy your API Key from Manage → API Key
4. Paste the API Key above and enable WhatsApp
5. Map each template to its AiSensy campaign + parameters (Templates tab)
6. Messages will be sent automatically!
```
Keep the existing UltraMsg list for the other providers.

- [ ] **Step 4: Add campaign + params fields to the Edit Template modal (AiSensy only)**

In the Edit Template modal (around lines 1164-1264), when `config.provider === "aisensy"`, render two extra inputs bound to `editingTemplate`:
- **AiSensy Campaign Name** → `editingTemplate.aisensy_campaign`
- **Parameters (ordered, comma-separated variable names)** → a text input that reads/writes `editingTemplate.aisensy_params` as a comma-joined string (split on save).

Add to the templates state mapping in `loadFromApi` (around lines 317-325) so each template carries `aisensy_campaign` and `aisensy_params`:
```jsx
            aisensy_campaign: t.aisensy_campaign || "",
            aisensy_params: t.aisensy_params || [],
```

- [ ] **Step 5: Persist the new fields in `saveTemplate`**

In `saveTemplate` (around line 466), include the AiSensy fields in the payload when present:
```jsx
      const payload = {
        name: editingTemplate.name,
        content: editingTemplate.template,
        is_enabled: editingTemplate.enabled,
      };
      if (config.provider === "aisensy") {
        payload.aisensy_campaign = editingTemplate.aisensy_campaign || null;
        payload.aisensy_params = editingTemplate.aisensy_params || [];
      }
      const response = await whatsappService.updateTemplate(editingTemplate.id, payload);
```
(Ensure the comma-separated params string is converted to an array before this — e.g. on change, store `aisensy_params` as an array split by comma and trimmed.)

- [ ] **Step 6: Build the frontend and eyeball the Settings page**

Run (from `c:\pawan\frontend`): `npm run build`
Expected: build succeeds with no errors. Then run `npm run dev`, open Settings → WhatsApp, select AiSensy, and confirm: Instance ID hides, token label reads "API Key", helper text updates, and the template edit modal shows campaign + params fields.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/settings/WhatsAppSettings.jsx
git commit -m "feat: AiSensy provider UI (config fields + per-template campaign mapping)"
```

---

## Task 14: Full regression pass + manual end-to-end

**Files:** none (verification only)

- [ ] **Step 1: Run the entire backend test suite**

Run: `php vendor/bin/phpunit`
Expected: ALL PASS. Capture the summary line (tests, assertions).

- [ ] **Step 2: Confirm UltraMsg path is unchanged (regression)**

With a branch configured for UltraMsg, send a Test message from Settings → Test and confirm delivery (or, if no live UltraMsg account, assert via `Http::fake` test from Task 8 that the outbound chat request matches the pre-refactor shape: `messages/chat`, `token`, `to`, `body`).

- [ ] **Step 3: Manual AiSensy end-to-end (requires a real AiSensy key + one approved template/campaign)**

1. Settings → WhatsApp → select AiSensy, paste API Key, enable, Save.
2. Templates tab → edit `pledge_created` → set campaign name + ordered params → Save.
3. Test tab → send to a real number → confirm WhatsApp delivery.
4. Settings → reminders dry-run, then a real reminder, confirm a row appears in History with status `sent`.

- [ ] **Step 4: Update CLAUDE.md note (if the repo documents provider integrations)**

If `backend/CLAUDE.md` or root `CLAUDE.md` lists WhatsApp providers, add AiSensy. Otherwise skip.

- [ ] **Step 5: Final commit (if any docs changed)**

```bash
git add -A
git commit -m "docs: note AiSensy provider support"
```

---

## Self-review notes (resolved)

- **Spec coverage:** shared service (T4-7), AiSensy text (T5), documents (T6,11), enum (T2), template columns (T3), config/template validation (T8), all 6 call-sites (T8,9,11,12), signed public URL (T10), frontend (T13). ✓
- **Type consistency:** uniform `['success','message_id','error']` driver shape used in every task; `sendText`/`sendDocument`/`testConnection` signatures stable from T4 onward; service `resolveParams` reads `template->aisensy_params`. ✓
- **Known unknowns flagged inline:** exact template-update route name (T8), where unauthenticated routes live (T10), redemption blade name/paper (T11), owner-dashboard public URL (T12), Branch/User factory existence (T8). Each task tells the implementer to read the file and adjust.
