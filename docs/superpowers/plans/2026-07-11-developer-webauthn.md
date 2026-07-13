# Developer Page WebAuthn (Fingerprint) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require a fingerprint *in addition to* the passkey when entering the hidden developer page, on devices where the developer has registered one — working in production on cPanel, not just localhost.

**Architecture:** The fingerprint never travels; only a signature does. The device's secure enclave holds a private key (possession factor); the server holds the public key and is the sole arbiter. The passkey stays a knowledge factor. The fingerprint gates the **door**; the passkey continues to gate **every write**, unchanged. Credentials are origin-bound, so the RP-ID is derived from the live request host — never hard-coded.

**Tech Stack:** Laravel 11, `web-auth/webauthn-lib` ^5.3 (installed, verified on PHP 8.2), MySQL, React 19 + browser WebAuthn API.

## Global Constraints

Copied from the spec (`docs/superpowers/specs/2026-07-11-developer-webauthn-design.md`) and from live inspection of this codebase. Every task implicitly includes these.

- **`web-auth/webauthn-lib` goes in `require`, NOT `require-dev`.** `deploy.sh:51` runs `composer install --no-dev` on the server; a dev-only dependency would be absent in production. (Already installed at ^5.3 — verify it is in the `require` block.)
- **RP-ID MUST be derived from the request host at runtime.** The same code runs at three origins: `localhost` (dev), `devtesting.dsaraassetventures.com` (staging), `dsaraassetventures.com` (production). A hard-coded RP-ID works on localhost and fails silently in production. The library's `check()` methods take `string $host` precisely for this.
- **Challenges MUST be stored in the CACHE, not the session.** The frontend authenticates with a `Bearer` token (`frontend/src/services/api.js:78`) and `SANCTUM_STATEFUL_DOMAINS` lists only localhost — so **requests are stateless in production and `session()` does not persist between the two WebAuthn round-trips there.** `CACHE_STORE=database` and the `cache` table exists; a cache round-trip was verified working. Session-backed challenges are the single most likely way to make this work in dev and silently break in prod.
- **The upload path must NOT change.** `DeveloperController::uploadPhoto()` re-verifies the passkey server-side on every request. Do not replace this with a session token or a "webauthn verified" flag. Every mutation of a live pledge record stays independently authorized at the moment it happens.
- **No lockout.** On a device with no registered credential, the passkey alone still unlocks the page. Fingerprint is enforced only where a credential exists for that account.
- **All new routes go behind the existing `developer.only` middleware**, which aborts **404** (not 403) — including for super-admins. Nothing may reveal the page exists.
- **"Register this device" must only be reachable AFTER unlock.** Anyone who never gets in must never learn the mechanism exists.
- **Test suite runs against the real `pawnsys` database with NO `RefreshDatabase`** (`backend/phpunit.xml` says so explicitly). Do NOT add fixture-writing tests, factories, or migrations-on-test. Tests here are read-only/pure-unit. `backend/tests/Feature/DeveloperBackfillTest.php` currently has 29 passing tests — do not regress them.
- **Nothing in the frontend is a security boundary.** The "is this device registered?" flag and the fingerprint prompt are UX. All decisions are re-made server-side.

---

## File Structure

**Backend (`c:\pawan\backend`)**
| File | Responsibility |
|---|---|
| `composer.json` (modify) | `web-auth/webauthn-lib` in `require` |
| `database/migrations/2026_07_11_120000_create_webauthn_credentials_table.php` (create) | The credentials table |
| `app/Models/WebauthnCredential.php` (create) | Eloquent model + `belongsTo(User)` |
| `app/Services/WebauthnService.php` (create) | **All** WebAuthn logic: RP-ID derivation, options building, verification, challenge cache. One clear responsibility; keeps the controller thin and makes RP-ID derivation unit-testable in isolation. |
| `app/Http/Controllers/Api/DeveloperWebauthnController.php` (create) | The 4 HTTP endpoints. Thin — delegates to the service. |
| `app/Http/Controllers/Api/DeveloperController.php` (modify) | `verify()` returns `webauthn_required` so the page knows whether to prompt |
| `routes/api.php` (modify) | Register the 4 routes inside the existing `dev` group |
| `tests/Feature/DeveloperWebauthnTest.php` (create) | RP-ID derivation, challenge cache, gate behaviour |

**Frontend (`c:\pawan\frontend`)**
| File | Responsibility |
|---|---|
| `src/pages/developer/webauthn.js` (create) | Browser WebAuthn plumbing: support detection, base64url⇄ArrayBuffer, `navigator.credentials` calls. Isolated so the page component stays readable. |
| `src/pages/developer/MissingImages.jsx` (modify) | Two-step unlock; "Register this device" after unlock |

---

### Task 1: `webauthn_credentials` table + model

**Files:**
- Create: `backend/database/migrations/2026_07_11_120000_create_webauthn_credentials_table.php`
- Create: `backend/app/Models/WebauthnCredential.php`

**Interfaces:**
- Consumes: nothing.
- Produces: `WebauthnCredential` model with fillable `user_id, credential_id, public_key, sign_count, transports, device_label, last_used_at`, and `user()` relation. Task 3's service reads and writes these.

Multiple credentials per user are supported (laptop + phone), each labelled.

- [ ] **Step 1: Write the migration**

Create `backend/database/migrations/2026_07_11_120000_create_webauthn_credentials_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('webauthn_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Base64url credential id from the authenticator. Unique per credential.
            $table->string('credential_id', 512)->unique();

            // The serialized PublicKeyCredentialSource (JSON). This is a PUBLIC key —
            // it is not a secret, and no biometric is stored anywhere, ever.
            $table->text('public_key');

            // Advanced on each use; a non-increasing counter signals a cloned authenticator.
            $table->unsignedBigInteger('sign_count')->default(0);

            // The RP-ID this credential was registered against. Credentials are
            // origin-bound, so a staging credential is invalid on production.
            $table->string('rp_id');

            $table->string('device_label')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'rp_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webauthn_credentials');
    }
};
```

- [ ] **Step 2: Write the model**

Create `backend/app/Models/WebauthnCredential.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A registered authenticator (fingerprint sensor, security key).
 *
 * Stores a PUBLIC key only. No biometric ever reaches this server — the device's
 * secure enclave holds the private key and merely signs a challenge with it.
 */
class WebauthnCredential extends Model
{
    protected $fillable = [
        'user_id',
        'credential_id',
        'public_key',
        'sign_count',
        'rp_id',
        'device_label',
        'last_used_at',
    ];

    protected $casts = [
        'sign_count'   => 'integer',
        'last_used_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

- [ ] **Step 3: Run the migration**

Run: `cd c:\pawan\backend && php artisan migrate`
Expected: `2026_07_11_120000_create_webauthn_credentials_table .... DONE`

- [ ] **Step 4: Verify the table shape**

Run: `cd c:\pawan\backend && php artisan tinker --execute="print_r(Schema::getColumnListing('webauthn_credentials'));"`
Expected: the list contains `id, user_id, credential_id, public_key, sign_count, rp_id, device_label, last_used_at, created_at, updated_at`.

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/2026_07_11_120000_create_webauthn_credentials_table.php backend/app/Models/WebauthnCredential.php
git commit -m "feat(dev-tools): add webauthn_credentials table and model"
```

---

### Task 2: RP-ID derivation (the piece that decides whether production works)

**Files:**
- Create: `backend/app/Services/WebauthnService.php` (first method only)
- Create: `backend/tests/Feature/DeveloperWebauthnTest.php`

**Interfaces:**
- Consumes: nothing.
- Produces: `WebauthnService::rpIdFor(string $host): string` — strips port, lowercases, returns the bare host. Tasks 3-5 use it.

A credential is cryptographically bound to its RP-ID. Get this wrong and the feature works on localhost and dies in production — which is the exact failure this whole task exists to prevent.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/Feature/DeveloperWebauthnTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Services\WebauthnService;
use Tests\TestCase;

class DeveloperWebauthnTest extends TestCase
{
    /**
     * The same code runs at three origins. A hard-coded RP-ID would work in dev
     * and silently fail in production, so derivation is tested against all three.
     *
     * @dataProvider hostProvider
     */
    public function test_rp_id_is_derived_from_the_request_host(string $host, string $expected): void
    {
        $this->assertSame($expected, (new WebauthnService())->rpIdFor($host));
    }

    public static function hostProvider(): array
    {
        return [
            'dev'         => ['localhost:3000', 'localhost'],
            'dev bare'    => ['localhost', 'localhost'],
            'vite'        => ['127.0.0.1:5173', '127.0.0.1'],
            'staging'     => ['devtesting.dsaraassetventures.com', 'devtesting.dsaraassetventures.com'],
            'production'  => ['dsaraassetventures.com', 'dsaraassetventures.com'],
            'uppercase'   => ['DSARAASSETVENTURES.COM', 'dsaraassetventures.com'],
            'with port'   => ['dsaraassetventures.com:443', 'dsaraassetventures.com'],
        ];
    }

    public function test_staging_and_production_yield_different_rp_ids(): void
    {
        $svc = new WebauthnService();

        // Not cosmetic: a credential registered on staging MUST NOT validate on
        // production. If these ever collapse to the same value, the origin binding
        // — the thing that makes WebAuthn phishing-proof — is broken.
        $this->assertNotSame(
            $svc->rpIdFor('devtesting.dsaraassetventures.com'),
            $svc->rpIdFor('dsaraassetventures.com')
        );
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd c:\pawan\backend && php artisan test --filter=DeveloperWebauthnTest`
Expected: FAIL — `Class "App\Services\WebauthnService" not found`

- [ ] **Step 3: Write the minimal implementation**

Create `backend/app/Services/WebauthnService.php`:

```php
<?php

namespace App\Services;

/**
 * All WebAuthn logic for the hidden developer tooling.
 *
 * Key architectural facts:
 *  - No biometric ever reaches this server. The device holds a private key in
 *    secure hardware and signs a challenge; we verify with the public key.
 *  - Credentials are cryptographically bound to an origin (the RP-ID). The same
 *    code runs on localhost, staging and production, so the RP-ID is derived from
 *    the LIVE REQUEST HOST — never hard-coded.
 */
class WebauthnService
{
    /**
     * The Relying Party ID for a given request host: the bare, lowercased host
     * with any port stripped.
     */
    public function rpIdFor(string $host): string
    {
        $host = strtolower(trim($host));

        // Strip a :port if present. (parse_url needs a scheme to see the host.)
        if (str_contains($host, ':')) {
            $host = explode(':', $host, 2)[0];
        }

        return $host;
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd c:\pawan\backend && php artisan test --filter=DeveloperWebauthnTest`
Expected: PASS (8 tests — 7 data sets + the staging/production separation check)

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/WebauthnService.php backend/tests/Feature/DeveloperWebauthnTest.php
git commit -m "feat(dev-tools): derive WebAuthn RP-ID from request host"
```

---

### Task 3: Challenge storage in the cache (NOT the session)

**Files:**
- Modify: `backend/app/Services/WebauthnService.php`
- Test: `backend/tests/Feature/DeveloperWebauthnTest.php`

**Interfaces:**
- Consumes: `rpIdFor()` from Task 2.
- Produces:
  - `WebauthnService::putChallenge(int $userId, string $purpose, string $challenge): void` — `$purpose` is `'register'` or `'login'`; TTL 120s.
  - `WebauthnService::pullChallenge(int $userId, string $purpose): ?string` — returns and **deletes** it (single use). Returns `null` if absent/expired/already used.

Sessions do **not** persist between the two WebAuthn round-trips in production (Bearer-token auth, stateless). The cache does. This is the difference between working in prod and silently failing there.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/DeveloperWebauthnTest.php` (inside the class):

```php
    public function test_challenge_round_trips_through_the_cache(): void
    {
        $svc = new WebauthnService();
        $svc->putChallenge(999001, 'login', 'abc123');

        $this->assertSame('abc123', $svc->pullChallenge(999001, 'login'));
    }

    public function test_challenge_is_single_use(): void
    {
        $svc = new WebauthnService();
        $svc->putChallenge(999002, 'login', 'abc123');

        $this->assertSame('abc123', $svc->pullChallenge(999002, 'login'));
        // A replayed challenge must not verify a second time.
        $this->assertNull($svc->pullChallenge(999002, 'login'));
    }

    public function test_challenges_are_scoped_by_user_and_purpose(): void
    {
        $svc = new WebauthnService();
        $svc->putChallenge(999003, 'login', 'login-chal');

        // A register challenge must not satisfy a login ceremony, nor another user's.
        $this->assertNull($svc->pullChallenge(999003, 'register'));
        $this->assertNull($svc->pullChallenge(999004, 'login'));
        $this->assertSame('login-chal', $svc->pullChallenge(999003, 'login'));
    }

    public function test_missing_challenge_returns_null(): void
    {
        $this->assertNull((new WebauthnService())->pullChallenge(999005, 'login'));
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd c:\pawan\backend && php artisan test --filter=DeveloperWebauthnTest`
Expected: FAIL — `Call to undefined method App\Services\WebauthnService::putChallenge()`

- [ ] **Step 3: Write the implementation**

Add to `backend/app/Services/WebauthnService.php` — the `use` line at the top and the two methods inside the class:

```php
use Illuminate\Support\Facades\Cache;
```

```php
    /** A ceremony challenge is short-lived and single-use. */
    private const CHALLENGE_TTL_SECONDS = 120;

    /**
     * Stash a ceremony challenge.
     *
     * CACHE, not session: the SPA authenticates with a Bearer token and
     * SANCTUM_STATEFUL_DOMAINS covers only localhost, so requests are STATELESS in
     * production and session() would not survive between the two round-trips there.
     * A session-backed challenge is the classic way to make WebAuthn work in dev
     * and silently fail in prod.
     */
    public function putChallenge(int $userId, string $purpose, string $challenge): void
    {
        Cache::put($this->challengeKey($userId, $purpose), $challenge, self::CHALLENGE_TTL_SECONDS);
    }

    /**
     * Retrieve and immediately consume a challenge. Single use: a replay finds nothing.
     */
    public function pullChallenge(int $userId, string $purpose): ?string
    {
        return Cache::pull($this->challengeKey($userId, $purpose));
    }

    private function challengeKey(int $userId, string $purpose): string
    {
        return "webauthn:{$purpose}:{$userId}";
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd c:\pawan\backend && php artisan test --filter=DeveloperWebauthnTest`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/WebauthnService.php backend/tests/Feature/DeveloperWebauthnTest.php
git commit -m "feat(dev-tools): store WebAuthn challenges in cache, single-use"
```

---

### Task 4: Options building and assertion verification

**Files:**
- Modify: `backend/app/Services/WebauthnService.php`
- Test: `backend/tests/Feature/DeveloperWebauthnTest.php`

**Interfaces:**
- Consumes: `rpIdFor()`, `putChallenge()`, `pullChallenge()` (Tasks 2-3); `WebauthnCredential` (Task 1).
- Produces:
  - `WebauthnService::registerOptions(User $user, string $host): array` — the creation options as a JSON-serializable array; stashes the challenge.
  - `WebauthnService::verifyRegistration(User $user, string $host, array $credential, ?string $label): WebauthnCredential` — throws `\RuntimeException` on any failure; persists and returns the credential on success.
  - `WebauthnService::loginOptions(User $user, string $host): array` — request options listing that user's credentials for this RP-ID.
  - `WebauthnService::verifyLogin(User $user, string $host, array $credential): bool` — true only if the assertion is valid; advances `sign_count`.
  - `WebauthnService::hasCredentialFor(User $user, string $host): bool` — whether to prompt at all.

The library is doing the cryptography. Its `check()` methods take `string $host` — pass the derived host, never a constant.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/DeveloperWebauthnTest.php` (inside the class). These are pure/read-only — no fixture writes.

```php
    public function test_register_options_carry_the_derived_rp_id_and_a_challenge(): void
    {
        $svc  = new WebauthnService();
        $user = \App\Models\User::with('role')->where('username', 'developer')->firstOrFail();

        $options = $svc->registerOptions($user, 'dsaraassetventures.com');

        $this->assertSame('dsaraassetventures.com', $options['rp']['id']);
        $this->assertNotEmpty($options['challenge']);
        $this->assertSame('required', $options['authenticatorSelection']['userVerification']);

        // The challenge was stashed for exactly this user + purpose.
        $this->assertNotNull($svc->pullChallenge($user->id, 'register'));
    }

    public function test_login_options_are_scoped_to_this_rp_id(): void
    {
        $svc  = new WebauthnService();
        $user = \App\Models\User::with('role')->where('username', 'developer')->firstOrFail();

        $options = $svc->loginOptions($user, 'localhost');

        $this->assertSame('localhost', $options['rpId']);
        $this->assertNotEmpty($options['challenge']);
        $this->assertSame('required', $options['userVerification']);
    }

    public function test_garbage_assertion_is_rejected_not_accepted(): void
    {
        $svc  = new WebauthnService();
        $user = \App\Models\User::with('role')->where('username', 'developer')->firstOrFail();

        // No challenge issued, and the payload is nonsense. It must fail closed.
        $this->assertFalse($svc->verifyLogin($user, 'localhost', ['id' => 'nope', 'rawId' => 'nope']));
    }

    public function test_has_credential_for_is_false_when_none_registered_for_that_rp(): void
    {
        $svc  = new WebauthnService();
        $user = \App\Models\User::with('role')->where('username', 'developer')->firstOrFail();

        // A credential registered on production must not count on this host.
        $this->assertFalse($svc->hasCredentialFor($user, 'some-host-that-has-no-credential.example'));
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd c:\pawan\backend && php artisan test --filter=DeveloperWebauthnTest`
Expected: FAIL — `Call to undefined method App\Services\WebauthnService::registerOptions()`

- [ ] **Step 3: Write the implementation**

Add these `use` statements to `backend/app/Services/WebauthnService.php`:

```php
use App\Models\User;
use App\Models\WebauthnCredential;
use Cose\Algorithm\Manager as AlgorithmManager;
use Cose\Algorithm\Signature\ECDSA\ES256;
use Cose\Algorithm\Signature\RSA\RS256;
use Webauthn\AttestationStatement\AttestationObjectLoader;
use Webauthn\AttestationStatement\AttestationStatementSupportManager;
use Webauthn\AttestationStatement\NoneAttestationStatementSupport;
use Webauthn\AuthenticatorAssertionResponse;
use Webauthn\AuthenticatorAssertionResponseValidator;
use Webauthn\AuthenticatorAttestationResponse;
use Webauthn\AuthenticatorAttestationResponseValidator;
use Webauthn\CeremonyStep\CeremonyStepManagerFactory;
use Webauthn\Denormalizer\WebauthnSerializerFactory;
use Webauthn\PublicKeyCredentialCreationOptions;
use Webauthn\PublicKeyCredentialDescriptor;
use Webauthn\PublicKeyCredentialRequestOptions;
use Webauthn\PublicKeyCredentialRpEntity;
use Webauthn\PublicKeyCredentialSource;
use Webauthn\PublicKeyCredentialUserEntity;
```

Add these methods inside the class:

```php
    /**
     * Options for enrolling this device. `userVerification: required` is what makes
     * the authenticator actually demand the fingerprint rather than mere presence.
     */
    public function registerOptions(User $user, string $host): array
    {
        $rpId      = $this->rpIdFor($host);
        $challenge = random_bytes(32);

        $options = PublicKeyCredentialCreationOptions::create(
            rp: PublicKeyCredentialRpEntity::create('PawnSys', $rpId),
            user: PublicKeyCredentialUserEntity::create(
                $user->username,
                (string) $user->id,
                $user->name,
            ),
            challenge: $challenge,
            pubKeyCredParams: [
                PublicKeyCredentialParameters::create('public-key', ES256::ID),
                PublicKeyCredentialParameters::create('public-key', RS256::ID),
            ],
            authenticatorSelection: AuthenticatorSelectionCriteria::create(
                authenticatorAttachment: AuthenticatorSelectionCriteria::AUTHENTICATOR_ATTACHMENT_PLATFORM,
                userVerification: AuthenticatorSelectionCriteria::USER_VERIFICATION_REQUIREMENT_REQUIRED,
                residentKey: AuthenticatorSelectionCriteria::RESIDENT_KEY_REQUIREMENT_DISCOURAGED,
            ),
            attestation: PublicKeyCredentialCreationOptions::ATTESTATION_CONVEYANCE_PREFERENCE_NONE,
            excludeCredentials: $this->descriptorsFor($user, $rpId),
        );

        $this->putChallenge($user->id, 'register', $this->b64url($challenge));

        return json_decode($this->serializer()->serialize($options, 'json'), true);
    }

    /**
     * Verify an attestation and persist the new credential.
     *
     * @throws \RuntimeException on any verification failure (fails closed).
     */
    public function verifyRegistration(User $user, string $host, array $credential, ?string $label): WebauthnCredential
    {
        $rpId      = $this->rpIdFor($host);
        $challenge = $this->pullChallenge($user->id, 'register');

        if ($challenge === null) {
            throw new \RuntimeException('Registration challenge expired. Try again.');
        }

        $pkCredential = $this->serializer()->deserialize(
            json_encode($credential),
            \Webauthn\PublicKeyCredential::class,
            'json'
        );

        $response = $pkCredential->response;
        if (!$response instanceof AuthenticatorAttestationResponse) {
            throw new \RuntimeException('Not a registration response.');
        }

        $options = PublicKeyCredentialCreationOptions::create(
            rp: PublicKeyCredentialRpEntity::create('PawnSys', $rpId),
            user: PublicKeyCredentialUserEntity::create($user->username, (string) $user->id, $user->name),
            challenge: $this->b64urlDecode($challenge),
        );

        // The library checks signature, challenge, origin, RP-ID hash and the
        // user-presence/verification flags. Note it takes the host explicitly.
        $source = AuthenticatorAttestationResponseValidator::create(
            $this->ceremonyStepManagerFactory()->creationCeremony()
        )->check($response, $options, $host);

        return WebauthnCredential::create([
            'user_id'       => $user->id,
            'credential_id' => $this->b64url($source->publicKeyCredentialId),
            'public_key'    => $this->serializer()->serialize($source, 'json'),
            'sign_count'    => $source->counter,
            'rp_id'         => $rpId,
            'device_label'  => $label ?: 'Registered device',
            'last_used_at'  => now(),
        ]);
    }

    /** Options for an authentication ceremony on this host. */
    public function loginOptions(User $user, string $host): array
    {
        $rpId      = $this->rpIdFor($host);
        $challenge = random_bytes(32);

        $options = PublicKeyCredentialRequestOptions::create(
            challenge: $challenge,
            rpId: $rpId,
            allowCredentials: $this->descriptorsFor($user, $rpId),
            userVerification: PublicKeyCredentialRequestOptions::USER_VERIFICATION_REQUIREMENT_REQUIRED,
        );

        $this->putChallenge($user->id, 'login', $this->b64url($challenge));

        return json_decode($this->serializer()->serialize($options, 'json'), true);
    }

    /**
     * Verify an assertion. Fails CLOSED — any error means "not authenticated".
     */
    public function verifyLogin(User $user, string $host, array $credential): bool
    {
        $rpId      = $this->rpIdFor($host);
        $challenge = $this->pullChallenge($user->id, 'login');

        if ($challenge === null) {
            return false;
        }

        try {
            $pkCredential = $this->serializer()->deserialize(
                json_encode($credential),
                \Webauthn\PublicKeyCredential::class,
                'json'
            );

            $response = $pkCredential->response;
            if (!$response instanceof AuthenticatorAssertionResponse) {
                return false;
            }

            $row = WebauthnCredential::where('user_id', $user->id)
                ->where('rp_id', $rpId)
                ->where('credential_id', $this->b64url($pkCredential->rawId))
                ->first();

            if (!$row) {
                return false;
            }

            $source = $this->serializer()->deserialize(
                $row->public_key,
                PublicKeyCredentialSource::class,
                'json'
            );

            $options = PublicKeyCredentialRequestOptions::create(
                challenge: $this->b64urlDecode($challenge),
                rpId: $rpId,
                userVerification: PublicKeyCredentialRequestOptions::USER_VERIFICATION_REQUIREMENT_REQUIRED,
            );

            $updated = AuthenticatorAssertionResponseValidator::create(
                $this->ceremonyStepManagerFactory()->requestCeremony()
            )->check($source, $response, $options, $host, (string) $user->id);

            // Advance the counter — a non-increasing value signals a cloned authenticator,
            // which the library's counter checker rejects.
            $row->update([
                'sign_count'   => $updated->counter,
                'public_key'   => $this->serializer()->serialize($updated, 'json'),
                'last_used_at' => now(),
            ]);

            return true;
        } catch (\Throwable $e) {
            // Fail closed. Never let a verification error read as success.
            report($e);
            return false;
        }
    }

    /** Does this user have any credential registered for THIS origin? */
    public function hasCredentialFor(User $user, string $host): bool
    {
        return WebauthnCredential::where('user_id', $user->id)
            ->where('rp_id', $this->rpIdFor($host))
            ->exists();
    }

    /** @return PublicKeyCredentialDescriptor[] */
    private function descriptorsFor(User $user, string $rpId): array
    {
        return WebauthnCredential::where('user_id', $user->id)
            ->where('rp_id', $rpId)
            ->get()
            ->map(fn (WebauthnCredential $c) => PublicKeyCredentialDescriptor::create(
                'public-key',
                $this->b64urlDecode($c->credential_id),
            ))
            ->all();
    }

    private function serializer()
    {
        $attestationManager = AttestationStatementSupportManager::create();
        $attestationManager->add(NoneAttestationStatementSupport::create());

        return (new WebauthnSerializerFactory($attestationManager))->create();
    }

    private function ceremonyStepManagerFactory(): CeremonyStepManagerFactory
    {
        $attestationManager = AttestationStatementSupportManager::create();
        $attestationManager->add(NoneAttestationStatementSupport::create());

        $algorithms = AlgorithmManager::create();
        $algorithms->add(ES256::create());
        $algorithms->add(RS256::create());

        $factory = new CeremonyStepManagerFactory();
        $factory->setAttestationStatementSupportManager($attestationManager);
        $factory->setAlgorithmManager($algorithms);

        return $factory;
    }

    private function b64url(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    private function b64urlDecode(string $encoded): string
    {
        return base64_decode(strtr($encoded, '-_', '+/'), true) ?: '';
    }
```

Also add these two `use` statements (needed by `registerOptions`):

```php
use Webauthn\AuthenticatorSelectionCriteria;
use Webauthn\PublicKeyCredentialParameters;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd c:\pawan\backend && php artisan test --filter=DeveloperWebauthnTest`
Expected: PASS (16 tests).

If the library's v5 constructor signatures differ from the above, STOP and read the actual class rather than guessing:
`cd c:\pawan\backend && grep -n "public static function create" vendor/web-auth/webauthn-lib/src/PublicKeyCredentialCreationOptions.php`

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/WebauthnService.php backend/tests/Feature/DeveloperWebauthnTest.php
git commit -m "feat(dev-tools): WebAuthn options building and assertion verification"
```

---

### Task 5: The four endpoints + `webauthn_required` on unlock

**Files:**
- Create: `backend/app/Http/Controllers/Api/DeveloperWebauthnController.php`
- Modify: `backend/app/Http/Controllers/Api/DeveloperController.php` (the `verify()` method)
- Modify: `backend/routes/api.php` (inside the existing `Route::prefix('dev')->middleware('developer.only')` group)

**Interfaces:**
- Consumes: `WebauthnService` (Tasks 2-4).
- Produces:
  - `POST /api/dev/webauthn/register/options` → `{success, options}`
  - `POST /api/dev/webauthn/register` → `{success, message}`
  - `POST /api/dev/webauthn/login/options` → `{success, options}`
  - `POST /api/dev/webauthn/login` → `{success}`; 401 if the assertion fails
  - `POST /api/dev/verify` now additionally returns `webauthn_required: bool` — Task 6's page uses it to decide whether to prompt.

- [ ] **Step 1: Write the controller**

Create `backend/app/Http/Controllers/Api/DeveloperWebauthnController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\WebauthnService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * WebAuthn ceremonies for the hidden developer tooling.
 *
 * Every route sits behind `developer.only`, which 404s for anyone who is not the
 * developer — including super-admins. Nothing here reveals the page exists.
 */
class DeveloperWebauthnController extends Controller
{
    public function __construct(private readonly WebauthnService $webauthn)
    {
    }

    public function registerOptions(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'options' => $this->webauthn->registerOptions($request->user(), $request->getHost()),
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'credential'   => 'required|array',
            'device_label' => 'nullable|string|max:60',
        ]);

        try {
            $cred = $this->webauthn->verifyRegistration(
                $request->user(),
                $request->getHost(),
                $request->input('credential'),
                $request->input('device_label'),
            );
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        AuditLog::create([
            'branch_id'   => $request->user()->branch_id,
            'user_id'     => $request->user()->id,
            'action'      => AuditLog::ACTION_UPDATE,
            'module'      => 'auth',
            'description' => "Developer registered a fingerprint device ({$cred->device_label}) for {$cred->rp_id}",
            'record_type' => 'WebauthnCredential',
            'record_id'   => $cred->id,
            'ip_address'  => $request->ip(),
            'user_agent'  => $request->userAgent(),
            'created_at'  => now(),
        ]);

        return response()->json(['success' => true, 'message' => 'Device registered.']);
    }

    public function loginOptions(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'options' => $this->webauthn->loginOptions($request->user(), $request->getHost()),
        ]);
    }

    public function login(Request $request): JsonResponse
    {
        $request->validate(['credential' => 'required|array']);

        $ok = $this->webauthn->verifyLogin(
            $request->user(),
            $request->getHost(),
            $request->input('credential'),
        );

        if (!$ok) {
            return response()->json(['success' => false, 'message' => 'Fingerprint not recognised.'], 401);
        }

        return response()->json(['success' => true]);
    }
}
```

- [ ] **Step 2: Tell the page whether a fingerprint is required**

In `backend/app/Http/Controllers/Api/DeveloperController.php`, replace the body of `verify()` with:

```php
    public function verify(Request $request): JsonResponse
    {
        $request->validate(['passkey' => 'required|string|size:6']);

        if (!$request->user()->verifyPasskey($request->passkey)) {
            return response()->json(['success' => false, 'message' => 'Invalid passkey.'], 401);
        }

        // The passkey is correct — but if this account has a credential registered for
        // THIS origin, the page must also complete a fingerprint ceremony. This flag is
        // UX only: the real enforcement is that the webauthn/login endpoint must succeed.
        $webauthnRequired = app(\App\Services\WebauthnService::class)
            ->hasCredentialFor($request->user(), $request->getHost());

        return response()->json([
            'success'           => true,
            'webauthn_required' => $webauthnRequired,
        ]);
    }
```

- [ ] **Step 3: Register the routes**

In `backend/routes/api.php`, inside the existing `Route::prefix('dev')->middleware('developer.only')->group(...)`, add:

```php
            Route::prefix('webauthn')->group(function () {
                Route::post('register/options', [\App\Http\Controllers\Api\DeveloperWebauthnController::class, 'registerOptions']);
                Route::post('register', [\App\Http\Controllers\Api\DeveloperWebauthnController::class, 'register']);
                Route::post('login/options', [\App\Http\Controllers\Api\DeveloperWebauthnController::class, 'loginOptions']);
                Route::post('login', [\App\Http\Controllers\Api\DeveloperWebauthnController::class, 'login']);
            });
```

- [ ] **Step 4: Verify the routes carry BOTH auth:sanctum and developer.only**

Run:
```bash
cd c:\pawan\backend && php artisan tinker --execute="foreach (Route::getRoutes() as \$r) { if (str_starts_with(\$r->uri(), 'api/dev/webauthn')) { echo \$r->uri(), ' => [', implode(', ', \$r->gatherMiddleware()), ']', PHP_EOL; } }"
```
Expected: 4 routes, each showing `api, auth:sanctum, developer.only`.
A route missing `developer.only` is a FAILURE — it would be reachable by any logged-in user.

- [ ] **Step 5: Run the full suite (no regressions)**

Run: `cd c:\pawan\backend && php artisan test`
Expected: PASS — the 29 pre-existing tests plus the 16 new ones.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/Api/DeveloperWebauthnController.php backend/app/Http/Controllers/Api/DeveloperController.php backend/routes/api.php
git commit -m "feat(dev-tools): WebAuthn register/login endpoints behind developer.only"
```

---

### Task 6: Browser WebAuthn plumbing

**Files:**
- Create: `frontend/src/pages/developer/webauthn.js`

**Interfaces:**
- Consumes: the endpoints from Task 5.
- Produces:
  - `isWebauthnSupported(): boolean`
  - `registerDevice(label: string): Promise<void>` — throws on failure.
  - `authenticateDevice(): Promise<void>` — throws on failure/cancel.

Kept out of the page component so the JSX stays readable and this fiddly encoding logic is testable on its own.

- [ ] **Step 1: Create the module**

Create `frontend/src/pages/developer/webauthn.js`:

```js
import { apiPost } from "@/services/api";

/**
 * Browser-side WebAuthn plumbing for the hidden developer page.
 *
 * No fingerprint ever leaves the device: the secure enclave signs a server-issued
 * challenge with a private key it will not release. We only ever move public keys
 * and signatures. Nothing here is a security boundary — the server re-decides
 * everything.
 */

// WebAuthn needs a secure context: HTTPS, or localhost (which the spec exempts).
export const isWebauthnSupported = () =>
  typeof window !== "undefined" &&
  window.PublicKeyCredential !== undefined &&
  window.isSecureContext;

const b64urlToBuf = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer;
};

const bufToB64url = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// The server sends base64url strings; the browser API demands ArrayBuffers.
const decodeCreationOptions = (o) => ({
  ...o,
  challenge: b64urlToBuf(o.challenge),
  user: { ...o.user, id: b64urlToBuf(o.user.id) },
  excludeCredentials: (o.excludeCredentials || []).map((c) => ({
    ...c,
    id: b64urlToBuf(c.id),
  })),
});

const decodeRequestOptions = (o) => ({
  ...o,
  challenge: b64urlToBuf(o.challenge),
  allowCredentials: (o.allowCredentials || []).map((c) => ({
    ...c,
    id: b64urlToBuf(c.id),
  })),
});

const encodeAttestation = (cred) => ({
  id: cred.id,
  rawId: bufToB64url(cred.rawId),
  type: cred.type,
  response: {
    clientDataJSON: bufToB64url(cred.response.clientDataJSON),
    attestationObject: bufToB64url(cred.response.attestationObject),
  },
  clientExtensionResults: cred.getClientExtensionResults(),
});

const encodeAssertion = (cred) => ({
  id: cred.id,
  rawId: bufToB64url(cred.rawId),
  type: cred.type,
  response: {
    clientDataJSON: bufToB64url(cred.response.clientDataJSON),
    authenticatorData: bufToB64url(cred.response.authenticatorData),
    signature: bufToB64url(cred.response.signature),
    userHandle: cred.response.userHandle
      ? bufToB64url(cred.response.userHandle)
      : null,
  },
  clientExtensionResults: cred.getClientExtensionResults(),
});

/** Enrol this device. Throws with a human-readable message on failure. */
export async function registerDevice(label) {
  const { options } = await apiPost("/dev/webauthn/register/options", {});

  const credential = await navigator.credentials.create({
    publicKey: decodeCreationOptions(options),
  });
  if (!credential) throw new Error("Registration was cancelled.");

  await apiPost("/dev/webauthn/register", {
    credential: encodeAttestation(credential),
    device_label: label,
  });
}

/** Prove possession of a registered device. Throws on failure or cancel. */
export async function authenticateDevice() {
  const { options } = await apiPost("/dev/webauthn/login/options", {});

  const credential = await navigator.credentials.get({
    publicKey: decodeRequestOptions(options),
  });
  if (!credential) throw new Error("Fingerprint was cancelled.");

  await apiPost("/dev/webauthn/login", {
    credential: encodeAssertion(credential),
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd c:\pawan\frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/developer/webauthn.js
git commit -m "feat(dev-tools): browser WebAuthn plumbing"
```

---

### Task 7: Two-step unlock + "Register this device"

**Files:**
- Modify: `frontend/src/pages/developer/MissingImages.jsx`

**Interfaces:**
- Consumes: `isWebauthnSupported`, `registerDevice`, `authenticateDevice` (Task 6); `webauthn_required` from `POST /dev/verify` (Task 5).
- Produces: the final UX.

The unlock becomes: passkey → if `webauthn_required` **and** the browser supports it, run the fingerprint ceremony → only then unlock. "Register this device" renders **only after unlock**.

- [ ] **Step 1: Import the plumbing**

In `frontend/src/pages/developer/MissingImages.jsx`, add to the imports:

```jsx
import { Fingerprint } from "lucide-react";
import {
  isWebauthnSupported,
  registerDevice,
  authenticateDevice,
} from "./webauthn";
```

- [ ] **Step 2: Add fingerprint state**

Add alongside the existing `useState` declarations:

```jsx
  // Fingerprint (second factor). Nothing here is a security boundary — the server
  // re-decides. This only drives what the user sees.
  const [registering, setRegistering] = useState(false);
  const [regLabel, setRegLabel] = useState("");
  const [regMsg, setRegMsg] = useState("");
```

- [ ] **Step 3: Make unlock two-step**

Replace the existing `unlock` function with:

```jsx
  const unlock = async (e) => {
    e.preventDefault();
    setUnlocking(true);
    setError("");
    try {
      // Step 1 — knowledge factor.
      const res = await apiPost("/dev/verify", { passkey });

      // Step 2 — possession factor, but only where a device is actually registered
      // for this origin. On an unregistered device the passkey alone is enough, so
      // you can never lock yourself out.
      if (res.webauthn_required) {
        if (!isWebauthnSupported()) {
          setError(
            "This account requires a fingerprint, but this browser cannot provide one. Use the device you registered.",
          );
          return;
        }
        await authenticateDevice();
      }

      setUnlocked(true);
      await loadItems();
    } catch (err) {
      setError(
        err?.name === "NotAllowedError"
          ? "Fingerprint cancelled or timed out. Try again."
          : err?.response?.data?.message || err?.message || "Could not unlock.",
      );
    } finally {
      setUnlocking(false);
    }
  };
```

- [ ] **Step 4: Add the register handler**

Add next to `saveCredentials`:

```jsx
  const handleRegisterDevice = async () => {
    setRegistering(true);
    setRegMsg("");
    try {
      await registerDevice(regLabel || "This device");
      setRegMsg(
        "Device registered. From now on this browser will also ask for your fingerprint.",
      );
      setRegLabel("");
    } catch (err) {
      setRegMsg(
        err?.name === "NotAllowedError"
          ? "Registration cancelled."
          : err?.message || "Could not register this device.",
      );
    } finally {
      setRegistering(false);
    }
  };
```

- [ ] **Step 5: Render "Register this device" — only after unlock**

Inside the credentials panel (`{showCreds && (...)}`), after the existing `</form>`, add:

```jsx
            {isWebauthnSupported() && (
              <div className="mt-6 border-t pt-6">
                <div className="mb-2 flex items-center gap-2">
                  <Fingerprint className="w-5 h-5 text-gray-500" />
                  <h3 className="font-semibold">Fingerprint</h3>
                </div>
                <p className="mb-3 text-sm text-gray-500">
                  Register this device and unlocking will require your fingerprint
                  as well as your passkey — on this device only. Other devices keep
                  working with the passkey alone, so you cannot lock yourself out.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    label="Device name"
                    value={regLabel}
                    onChange={(e) => setRegLabel(e.target.value)}
                    placeholder="e.g. Office laptop"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    leftIcon={Fingerprint}
                    disabled={registering}
                    onClick={handleRegisterDevice}
                  >
                    {registering ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Register this device"
                    )}
                  </Button>
                </div>
                {regMsg && (
                  <p className="mt-2 text-sm text-gray-700">{regMsg}</p>
                )}
              </div>
            )}
```

- [ ] **Step 6: Build**

Run: `cd c:\pawan\frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 7: Confirm the sidebar is still untouched**

Run: `cd c:\pawan && git status --porcelain`
Expected: `frontend/src/components/layout/Sidebar.jsx` is **NOT** listed. The page must stay unlisted.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/developer/MissingImages.jsx
git commit -m "feat(dev-tools): require fingerprint alongside passkey on registered devices"
```

---

### Task 8: End-to-end verification

**Files:** none changed — this proves the feature.

- [ ] **Step 1: The upload path did NOT change**

Run: `cd c:\pawan\backend && grep -n "verifyPasskey" app/Http/Controllers/Api/DeveloperController.php`
Expected: `uploadPhoto()` still calls `verifyPasskey()`. If a WebAuthn/session flag has replaced it, that is a FAILURE — every write must stay independently authorized.

- [ ] **Step 2: Passkey-only still unlocks on an unregistered device (no lockout)**

With no credential registered yet, log in as `developer`, go to `/dev/missing-images`, enter the passkey.
Expected: the page unlocks with **no** fingerprint prompt, and the item list loads.

- [ ] **Step 3: Register this device**

Click "Change passkey / password" → scroll to Fingerprint → name it → "Register this device".
Expected: the OS fingerprint/Windows Hello prompt appears; on success the message confirms registration.
Verify it was stored:
```bash
cd c:\pawan\backend && php artisan tinker --execute="\$c = App\Models\WebauthnCredential::latest('id')->first(); echo \$c->device_label, ' | rp_id=', \$c->rp_id, ' | sign_count=', \$c->sign_count, PHP_EOL;"
```
Expected: the label, `rp_id=localhost`, and a counter.

- [ ] **Step 4: Now the fingerprint is REQUIRED on this device**

Log out, log back in as `developer`, return to the page, enter the correct passkey.
Expected: the fingerprint prompt appears. Complete it → the page unlocks.
**Cancel it instead** → the page does NOT unlock, and shows "Fingerprint cancelled or timed out."
This is the whole point: the correct passkey alone is no longer sufficient on this device.

- [ ] **Step 5: Uploads still work and are still passkey-authorized**

Upload a photo to one item.
Expected: it succeeds. Confirm the audit row exists, then restore the item:
```bash
cd c:\pawan\backend && php artisan tinker --execute="\$l = App\Models\AuditLog::where('record_type','PledgeItem')->latest('created_at')->first(); echo \$l->description, PHP_EOL;"
```

- [ ] **Step 6: A replayed challenge is rejected**

Run: `cd c:\pawan\backend && php artisan test --filter=test_challenge_is_single_use`
Expected: PASS — a challenge cannot be used twice.

- [ ] **Step 7: Full suite**

Run: `cd c:\pawan\backend && php artisan test`
Expected: PASS — 29 pre-existing + 16 new.

- [ ] **Step 8: Production readiness check**

Confirm the library is in `require`, not `require-dev` (else `composer install --no-dev` omits it on the server):
```bash
cd c:\pawan\backend && php -r "\$j = json_decode(file_get_contents('composer.json'), true); echo isset(\$j['require']['web-auth/webauthn-lib']) ? 'OK: in require' : 'FAIL: not in require', PHP_EOL; echo isset(\$j['require-dev']['web-auth/webauthn-lib']) ? 'FAIL: also in require-dev' : 'OK: not in require-dev', PHP_EOL;"
```
Expected: `OK: in require` and `OK: not in require-dev`.

Note for deployment: `deploy.sh` already runs `composer install --no-dev` (line 51) and `artisan migrate --force` (line 125), so no deploy change is needed. Because credentials are origin-bound, **the developer must register a device separately on staging and on production** — a localhost credential will not work there. That is WebAuthn behaving correctly, not a bug.

---

## Notes for the implementer

- **Do not commit without the user's explicit approval.** Ask before each commit step.
- If a library signature does not match this plan, READ the vendor class and adapt — do not guess, and do not weaken a check to make something pass.
- Any verification path must **fail closed**. An exception during assertion checking means "not authenticated", never "authenticated".
