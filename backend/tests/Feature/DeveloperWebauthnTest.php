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
            'dev'        => ['localhost:3000', 'localhost'],
            'dev bare'   => ['localhost', 'localhost'],
            'vite'       => ['127.0.0.1:5173', '127.0.0.1'],
            'staging'    => ['devtesting.dsaraassetventures.com', 'devtesting.dsaraassetventures.com'],
            'production' => ['dsaraassetventures.com', 'dsaraassetventures.com'],
            'uppercase'  => ['DSARAASSETVENTURES.COM', 'dsaraassetventures.com'],
            'with port'  => ['dsaraassetventures.com:443', 'dsaraassetventures.com'],
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

    private function developer(): \App\Models\User
    {
        return \App\Models\User::with('role')->where('username', 'developer')->firstOrFail();
    }

    public function test_register_options_carry_the_derived_rp_id_and_a_challenge(): void
    {
        $svc = new WebauthnService();
        $user = $this->developer();

        $options = $svc->registerOptions($user, 'dsaraassetventures.com');

        $this->assertSame('dsaraassetventures.com', $options['rp']['id']);
        $this->assertNotEmpty($options['challenge']);
        // 'required' is what makes the authenticator actually demand the fingerprint
        // rather than mere user presence (a tap).
        $this->assertSame('required', $options['authenticatorSelection']['userVerification']);

        // The challenge was stashed for exactly this user + purpose.
        $this->assertNotNull($svc->pullChallenge($user->id, 'register'));
    }

    public function test_login_options_are_scoped_to_this_rp_id(): void
    {
        $svc = new WebauthnService();
        $user = $this->developer();

        $options = $svc->loginOptions($user, 'localhost');

        $this->assertSame('localhost', $options['rpId']);
        $this->assertNotEmpty($options['challenge']);
        $this->assertSame('required', $options['userVerification']);
    }

    public function test_garbage_assertion_is_rejected_not_accepted(): void
    {
        $svc = new WebauthnService();

        // No challenge issued, and the payload is nonsense. It must fail CLOSED.
        $this->assertFalse(
            $svc->verifyLogin($this->developer(), 'localhost', ['id' => 'nope', 'rawId' => 'nope'])
        );
    }

    public function test_has_credential_for_is_false_when_none_registered_for_that_rp(): void
    {
        $svc = new WebauthnService();

        // A credential registered on one origin must not count on another.
        $this->assertFalse(
            $svc->hasCredentialFor($this->developer(), 'some-host-with-no-credential.example')
        );
    }
}
