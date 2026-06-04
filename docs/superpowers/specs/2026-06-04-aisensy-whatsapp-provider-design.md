# AiSensy WhatsApp Provider Integration — Design

**Date:** 2026-06-04
**Status:** Approved (pending spec review)
**Author:** Engineering

## Goal

Add **AiSensy** as a selectable WhatsApp provider alongside the existing **UltraMsg**
integration, keeping UltraMsg fully functional. The client can switch a branch between
providers from Settings → WhatsApp → Configuration. AiSensy must work everywhere messages
are currently sent: pledge/renewal/redemption confirmations, due-date reminders, owner
dashboard, bulk send, test send, and document (PDF receipt) sends.

## Background: why this is non-trivial

The two providers have fundamentally different sending models:

| | UltraMsg | AiSensy |
|---|---|---|
| Message body | Free text — we render our DB template and POST the full string as `body` | Template-based — we cannot send arbitrary text. We reference a **pre-approved Meta template** by **campaign name** and pass an ordered `templateParams` array that fills `{{1}}`, `{{2}}`… |
| Where the copy lives | Our `whatsapp_templates` table | In AiSensy / Meta (approved separately by the client) |
| Endpoint | `https://api.ultramsg.com/{instance}/messages/chat` (and `/messages/document`) | `https://backend.aisensy.com/campaign/t1/api/v2` (one endpoint for text + media) |
| Auth | `token` + `instance_id` in body | `apiKey` in JSON body |
| Media | base64 data-URI in `document` field | `media: { url, filename }` — URL must be **publicly accessible** |

A second problem discovered during exploration: **the UltraMsg send logic is duplicated
across 6 backend locations**, in two slightly different forms (cURL-based and `Http::`
facade-based):

1. `WhatsAppController` — send / resend / test (cURL)
2. `Console\Commands\SendDueReminders` — reminders (cURL)
3. `PledgeController` — pledge created + PDF receipt (Http::)
4. `RenewalController` — renewal confirmation + PDF (Http::)
5. `RedemptionController` — redemption confirmation + PDF (Http::)
6. `Console\Commands\SendDailyOwnerDashboard` — owner dashboard PDF (cURL)

Adding AiSensy inline to all six would mean six more copy-pastes that drift over time.

## Approach (chosen)

1. **Extract one shared `App\Services\WhatsAppService`** that owns all provider logic.
   Both providers live here as private driver methods. All 6 call-sites are refactored to
   call this service. This is a prerequisite for AiSensy, not optional scope — it's the
   only way to add the provider once instead of six times.

2. **AiSensy is template/campaign-based.** Each of our `template_key`s
   (`pledge_created`, `renewal_done`, `redemption_done`, `reminder_7days`,
   `reminder_3days`, `reminder_1day`, `overdue_notice`, …) maps to an AiSensy **campaign
   name** plus an **ordered list of variable names** that become `templateParams`. The
   client configures these mappings in the UI (their Meta templates are approved
   asynchronously and can change, so hardcoding would be brittle).

3. **Documents** are supported for AiSensy via the `media: { url, filename }` field. We
   add a publicly-accessible, signed, time-limited URL route that serves the generated
   receipt PDF, and pass that URL to AiSensy. UltraMsg continues using its base64 path
   unchanged.

4. **Config fields:** reuse the existing `whatsapp_config` schema. The AiSensy **API key**
   is stored in the existing `api_token` column. A new nullable `api_key`-style column is
   **not** added; instead we add the small amount of AiSensy-specific config that has no
   existing home (campaign mappings) on the **template** records, where it belongs. The
   `provider` enum gains `aisensy`.

## Architecture

```
                       ┌─────────────────────────────────────┐
   6 call-sites ─────▶ │        App\Services\WhatsAppService   │
   (controllers,       │                                      │
    commands)          │  sendText(config, phone, message,    │
                       │           ?templateKey, ?params)     │
                       │  sendDocument(config, phone, pdf,     │
                       │               filename, caption,      │
                       │               ?publicUrl)             │
                       │  testConnection(config)              │
                       │                                      │
                       │   match(provider):                   │
                       │     ultramsg → UltraMsgDriver         │
                       │     aisensy  → AiSensyDriver          │
                       └─────────────────────────────────────┘
                              │                    │
                   ┌──────────▼─────┐    ┌─────────▼──────────┐
                   │ UltraMsgDriver │    │   AiSensyDriver     │
                   │ (chat/document │    │ (campaign/t1/api/v2 │
                   │  endpoints)    │    │  text + media)      │
                   └────────────────┘    └────────────────────┘
```

### Service interface (the one boundary everything goes through)

```php
namespace App\Services;

class WhatsAppService
{
    // Returns ['success' => bool, 'message_id' => ?string, 'error' => ?string]
    public function sendText(
        WhatsAppConfig $config,
        string $phone,
        string $renderedMessage,      // used by UltraMsg
        ?WhatsAppTemplate $template = null,  // used by AiSensy (campaign + param order)
        array $templateData = []      // raw variable map, used to build AiSensy templateParams
    ): array;

    public function sendDocument(
        WhatsAppConfig $config,
        string $phone,
        string $pdfBinary,            // raw PDF bytes
        string $filename,
        string $caption,
        ?string $publicUrl = null     // required by AiSensy; ignored by UltraMsg
    ): array;

    public function testConnection(WhatsAppConfig $config): array;
}
```

- For **UltraMsg**, `sendText` ignores `$template`/`$templateData` and posts
  `$renderedMessage`.
- For **AiSensy**, `sendText` ignores `$renderedMessage`, reads the template's
  `aisensy_campaign` + `aisensy_params` (ordered variable names), resolves each from
  `$templateData`, and posts `campaignName` + `templateParams`.
- This keeps every call-site identical regardless of provider — they already have both the
  rendered message AND the template + data in hand at the send point.

### Drivers

Each driver returns the uniform `['success', 'message_id', 'error']` shape. Internal HTTP
uses the `Http::` facade (with `withoutVerifying()` only in `local`, matching existing
behaviour). The two existing UltraMsg variants collapse into one driver.

**AiSensyDriver text request:**
```json
POST https://backend.aisensy.com/campaign/t1/api/v2
{
  "apiKey": "<config.api_token>",
  "campaignName": "<template.aisensy_campaign>",
  "destination": "+<phone>",
  "userName": "<recipient name>",
  "templateParams": ["<resolved param 1>", "<resolved param 2>", ...]
}
```
**AiSensyDriver document request:** same payload plus
`"media": { "url": "<publicUrl>", "filename": "<filename>" }`.

Success = HTTP 2xx. AiSensy returns `{ "success": true, ... }` / a message id on success;
errors surface the response body's message.

## Data model changes

### `whatsapp_config`
- `provider` enum: add `aisensy` →
  `['ultramsg', 'twilio', 'wati', 'aisensy']`. (Migration alters the enum on both
  `whatsapp_config` and the `whatsapp_dayend_audit` table that also defines it.)
- No new credential columns. AiSensy API key → existing `api_token`.

### `whatsapp_templates`
Add two nullable columns:
- `aisensy_campaign` (string, nullable) — the AiSensy campaign name for this message type.
- `aisensy_params` (json, nullable) — ordered array of variable names, e.g.
  `["customer_name", "pledge_no", "loan_amount", "due_date"]`. These map positionally to
  `templateParams`.

These live on the template (not config) because the campaign + parameter order is a
property of the message type, and templates are already branch-aware with global fallback.

## Document public-URL route

`GET /whatsapp/receipt/{type}/{id}?signature=...` (Laravel **signed** route, short TTL).
- Regenerates (or serves cached) the PDF for the given pledge/renewal/redemption.
- Returns `application/pdf`.
- Used only to hand AiSensy a publicly fetchable URL. Not linked in the UI.
- When `provider = aisensy` and a document send is requested, the service builds this
  signed URL and passes it as `media.url`. UltraMsg path is unchanged (base64).
- `SendDailyOwnerDashboard`: if its document can't be exposed via a signed route, it logs
  and skips for AiSensy (same graceful-skip pattern it already uses for non-ultramsg).

## Frontend changes (`WhatsAppSettings.jsx`)

1. **Provider dropdown:** add `<option value="aisensy">AiSensy</option>`.
2. **Provider-aware Configuration fields:** when `aisensy` is selected:
   - Relabel "API Token" → "API Key".
   - Hide / mark optional the "Instance ID" field (unused by AiSensy).
   - Update the "How it works" helper text to AiSensy's steps (create + approve Meta
     templates, create Live API campaigns, copy API key from Manage → API Key).
3. **Templates tab:** when provider is `aisensy`, each template row's edit modal gains two
   fields — **AiSensy Campaign Name** and **Parameters (ordered)** (the ordered list of
   `{variables}` to send as `templateParams`). Stored via the existing
   `updateTemplate` endpoint.
4. The free-text template body remains editable and is still used by UltraMsg; under
   AiSensy it's informational (the real copy lives in Meta).

## Backend controller/validation changes

- `WhatsAppController::updateConfig` validation: `provider` rule →
  `in:ultramsg,twilio,wati,aisensy`; `instance_id` becomes `nullable` (AiSensy doesn't use
  it; UltraMsg still effectively requires it — enforced conditionally).
- `WhatsAppController::updateTemplate` validation: accept `aisensy_campaign` (nullable
  string) and `aisensy_params` (nullable array).
- All 6 call-sites: replace inline `sendViaUltramsg` / `sendViaProvider` /
  document-post blocks with calls to the injected `WhatsAppService`.
- `WhatsAppTemplate` model: add `aisensy_campaign`, `aisensy_params` to `$fillable` and
  cast `aisensy_params` to `array`.

## Error handling

- Driver methods never throw to the caller; they catch and return
  `['success' => false, 'error' => ...]`, preserving the existing logging/`WhatsAppLog`
  behaviour at each call-site.
- AiSensy-specific failures that must be explicit (not silently swallowed):
  - **Missing campaign mapping** when provider is AiSensy → return a clear error
    (`"No AiSensy campaign configured for template '<key>'"`) and log it; do **not**
    fall back to sending nothing silently.
  - **Param count mismatch** (resolved params ≠ template's expected count) is surfaced in
    the error message from AiSensy and logged.
  - **Document with no public URL** under AiSensy → explicit error, logged, not a silent
    success.
- `testConnection` for AiSensy: a lightweight validated call (e.g. attempt with the
  configured key) returning success/failure; never reports success on an auth failure.

## Testing

- **Unit (service/drivers):** `WhatsAppService` with a faked `Http` (`Http::fake`):
  - UltraMsg text + document build the correct URL/payload and parse `sent`.
  - AiSensy text builds correct `campaignName` + `templateParams` from a template's
    `aisensy_params` order and `templateData`.
  - AiSensy document includes `media.url`/`filename`.
  - Missing campaign mapping → failure result, no HTTP call.
  - Error responses map to `['success' => false, ...]`.
- **Feature:** `updateConfig` accepts `aisensy`; `updateTemplate` persists
  `aisensy_campaign`/`aisensy_params`; `send` routes through the service for both
  providers (asserted via `Http::fake`).
- **Regression:** existing UltraMsg send/test/reminder paths still pass after refactor
  (the 6 call-sites produce the same outbound request they did before).
- **Manual:** with a real AiSensy sandbox key + an approved template, send a test message
  from Settings → Test and confirm delivery; verify a reminder via the dry-run then live.

## Out of scope

- Twilio / WATI remain placeholders (untouched beyond the shared-service signature).
- Inbound AiSensy webhooks / delivery-status callbacks.
- Migrating existing UltraMsg DB templates into Meta templates (client does this in AiSensy).

## Rollout / safety

- Default provider stays `ultramsg`; no branch is switched automatically.
- Enum + nullable-column migrations are additive and reversible.
- Refactor is behaviour-preserving for UltraMsg; covered by regression tests before any
  AiSensy code is exercised.
