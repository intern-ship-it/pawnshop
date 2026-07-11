<?php

namespace App\Services;

use App\Models\User;
use App\Models\WebauthnCredential;
use Cose\Algorithm\Manager as AlgorithmManager;
use Cose\Algorithm\Signature\ECDSA\ES256;
use Cose\Algorithm\Signature\RSA\RS256;
use Illuminate\Support\Facades\Cache;
use Webauthn\AttestationStatement\AttestationStatementSupportManager;
use Webauthn\AttestationStatement\NoneAttestationStatementSupport;
use Webauthn\AuthenticatorAssertionResponse;
use Webauthn\AuthenticatorAssertionResponseValidator;
use Webauthn\AuthenticatorAttestationResponse;
use Webauthn\AuthenticatorAttestationResponseValidator;
use Webauthn\AuthenticatorSelectionCriteria;
use Webauthn\CeremonyStep\CeremonyStepManagerFactory;
use Webauthn\Denormalizer\WebauthnSerializerFactory;
use Webauthn\PublicKeyCredential;
use Webauthn\PublicKeyCredentialCreationOptions;
use Webauthn\PublicKeyCredentialDescriptor;
use Webauthn\PublicKeyCredentialParameters;
use Webauthn\PublicKeyCredentialRequestOptions;
use Webauthn\PublicKeyCredentialRpEntity;
use Webauthn\PublicKeyCredentialSource;
use Webauthn\PublicKeyCredentialUserEntity;

/**
 * All WebAuthn logic for the hidden developer tooling.
 *
 * Key architectural facts:
 *  - No biometric ever reaches this server. The device holds a private key in
 *    secure hardware and signs a challenge; we verify with the public key.
 *  - Credentials are cryptographically bound to an origin (the RP-ID). The same
 *    code runs on localhost, staging and production, so the RP-ID is derived from
 *    the LIVE REQUEST HOST — never hard-coded.
 *  - Every verification path fails CLOSED: an error means "not authenticated",
 *    never "authenticated".
 */
class WebauthnService
{
    /** A ceremony challenge is short-lived and single-use. */
    private const CHALLENGE_TTL_SECONDS = 120;

    private const RP_NAME = 'PawnSys';

    /**
     * The Relying Party ID for a given host: the bare, lowercased host with any
     * port stripped.
     */
    public function rpIdFor(string $host): string
    {
        $host = strtolower(trim($host));

        // Strip a :port if present.
        if (str_contains($host, ':')) {
            $host = explode(':', $host, 2)[0];
        }

        return $host;
    }

    /**
     * The RP-ID for a request — derived from the BROWSER'S ORIGIN, not the API host.
     *
     * These differ in development: the SPA is served from localhost:3000 while the
     * API answers on 127.0.0.1:8001. WebAuthn requires the RP-ID to be equal to (or
     * a registrable suffix of) the *page's* domain, and `127.0.0.1` is neither a
     * suffix of nor equal to `localhost` — the browser rejects it outright with
     * "The relying party ID is not a registrable domain suffix of, nor equal to,
     * the current domain."
     *
     * In production both are the same domain, so this only bites in dev — which is
     * exactly the class of bug that would otherwise ship unnoticed.
     */
    public function rpIdForRequest(\Illuminate\Http\Request $request): string
    {
        $origin = $request->headers->get('Origin');

        if ($origin) {
            $host = parse_url($origin, PHP_URL_HOST);
            if ($host) {
                return $this->rpIdFor($host);
            }
        }

        // Same-origin request (or no Origin header): the API host IS the page host.
        return $this->rpIdFor($request->getHost());
    }

    /**
     * The origin the assertion must have been signed for — again the page's origin,
     * which the library checks against clientDataJSON.
     */
    public function originForRequest(\Illuminate\Http\Request $request): string
    {
        return $request->headers->get('Origin') ?: $request->getSchemeAndHttpHost();
    }

    /**
     * Options for enrolling this device. `userVerification: required` is what makes
     * the authenticator actually demand the fingerprint rather than mere presence.
     */
    public function registerOptions(User $user, string $host): array
    {
        $rpId = $this->rpIdFor($host);
        $challenge = random_bytes(32);

        $options = PublicKeyCredentialCreationOptions::create(
            rp: PublicKeyCredentialRpEntity::create(self::RP_NAME, $rpId),
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
        $rpId = $this->rpIdFor($host);
        $challenge = $this->pullChallenge($user->id, 'register');

        if ($challenge === null) {
            throw new \RuntimeException('Registration challenge expired. Try again.');
        }

        $pkCredential = $this->serializer()->deserialize(
            json_encode($credential),
            PublicKeyCredential::class,
            'json'
        );

        $response = $pkCredential->response;
        if (!$response instanceof AuthenticatorAttestationResponse) {
            throw new \RuntimeException('Not a registration response.');
        }

        $options = PublicKeyCredentialCreationOptions::create(
            rp: PublicKeyCredentialRpEntity::create(self::RP_NAME, $rpId),
            user: PublicKeyCredentialUserEntity::create($user->username, (string) $user->id, $user->name),
            challenge: $this->b64urlDecode($challenge),
        );

        // The library checks signature, challenge, origin, RP-ID hash and the
        // user-presence/verification flags. Note it takes the host explicitly —
        // that is the origin binding, and why the RP-ID must not be hard-coded.
        $source = AuthenticatorAttestationResponseValidator::create(
            $this->ceremonyStepManagerFactory($rpId)->creationCeremony()
        )->check($response, $options, $rpId);

        return WebauthnCredential::create([
            'user_id' => $user->id,
            'credential_id' => $this->b64url($source->publicKeyCredentialId),
            'public_key' => $this->serializer()->serialize($source, 'json'),
            'sign_count' => $source->counter,
            'rp_id' => $rpId,
            'device_label' => $label ?: 'Registered device',
            'last_used_at' => now(),
        ]);
    }

    /** Options for an authentication ceremony on this host. */
    public function loginOptions(User $user, string $host): array
    {
        $rpId = $this->rpIdFor($host);
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
        $rpId = $this->rpIdFor($host);
        $challenge = $this->pullChallenge($user->id, 'login');

        if ($challenge === null) {
            return false;
        }

        try {
            $pkCredential = $this->serializer()->deserialize(
                json_encode($credential),
                PublicKeyCredential::class,
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
                $this->ceremonyStepManagerFactory($rpId)->requestCeremony()
            )->check($source, $response, $options, $rpId, (string) $user->id);

            // Advance the counter — a non-increasing value signals a cloned
            // authenticator, which the library's counter checker rejects.
            $row->update([
                'sign_count' => $updated->counter,
                'public_key' => $this->serializer()->serialize($updated, 'json'),
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

    /** Registered devices for this origin, for display after unlock. */
    public function credentialsFor(User $user, string $host)
    {
        return WebauthnCredential::where('user_id', $user->id)
            ->where('rp_id', $this->rpIdFor($host))
            ->orderBy('id')
            ->get(['id', 'device_label', 'last_used_at', 'created_at']);
    }

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

    private function attestationSupportManager(): AttestationStatementSupportManager
    {
        $manager = AttestationStatementSupportManager::create();
        $manager->add(NoneAttestationStatementSupport::create());

        return $manager;
    }

    private function serializer()
    {
        return (new WebauthnSerializerFactory($this->attestationSupportManager()))->create();
    }

    /** Local development hosts, which the WebAuthn spec exempts from HTTPS. */
    private const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

    private function ceremonyStepManagerFactory(string $rpId): CeremonyStepManagerFactory
    {
        $algorithms = AlgorithmManager::create();
        $algorithms->add(ES256::create());
        $algorithms->add(RS256::create());

        $factory = new CeremonyStepManagerFactory();
        $factory->setAttestationStatementSupportManager($this->attestationSupportManager());
        $factory->setAlgorithmManager($algorithms);

        // The library demands HTTPS unless the RP-ID is explicitly marked "secured".
        // localhost is a secure context per the spec, so dev over http:// is legitimate
        // — but ONLY for genuinely local hosts. A real domain must never be listed
        // here, or we would be accepting unencrypted assertions in production.
        if (in_array($rpId, self::LOCAL_HOSTS, true)) {
            $factory->setSecuredRelyingPartyId([$rpId]);
        }

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
}
