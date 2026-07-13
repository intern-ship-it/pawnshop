<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Tests\TestCase;

class DeveloperBackfillTest extends TestCase
{
    public function test_is_developer_true_only_for_developer_slug(): void
    {
        $dev = new User();
        $dev->setRelation('role', new Role(['slug' => 'developer']));
        $this->assertTrue($dev->isDeveloper());

        $super = new User();
        $super->setRelation('role', new Role(['slug' => 'super-admin']));
        $this->assertFalse($super->isDeveloper(), 'super-admin must NOT inherit developer access');

        $none = new User();
        $none->setRelation('role', null);
        $this->assertFalse($none->isDeveloper());
    }

    public function test_non_developer_gets_404_not_403(): void
    {
        $middleware = new \App\Http\Middleware\DeveloperOnly();

        $request = \Illuminate\Http\Request::create('/api/dev/missing-images', 'GET');
        $notDev = new User();
        $notDev->setRelation('role', new Role(['slug' => 'super-admin']));
        $request->setUserResolver(fn () => $notDev);

        try {
            $middleware->handle($request, fn () => response()->json(['reached' => true]));
            $this->fail('Expected the middleware to abort for a non-developer.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(404, $e->getStatusCode(), 'Denial must be 404 so the page never reveals it exists');
        }
    }

    public function test_developer_passes_middleware(): void
    {
        $middleware = new \App\Http\Middleware\DeveloperOnly();

        $request = \Illuminate\Http\Request::create('/api/dev/missing-images', 'GET');
        $dev = new User();
        $dev->is_active = true;
        $dev->setRelation('role', new Role(['slug' => 'developer']));
        $request->setUserResolver(fn () => $dev);

        $response = $middleware->handle($request, fn () => response()->json(['reached' => true]));
        $this->assertSame(200, $response->getStatusCode());
    }

    public function test_deactivated_developer_gets_404(): void
    {
        $middleware = new \App\Http\Middleware\DeveloperOnly();

        $request = \Illuminate\Http\Request::create('/api/dev/missing-images', 'GET');
        $dev = new User();
        $dev->is_active = false; // revoked via `developer:credentials --deactivate`
        $dev->setRelation('role', new Role(['slug' => 'developer']));
        $request->setUserResolver(fn () => $dev);

        try {
            $middleware->handle($request, fn () => response()->json(['reached' => true]));
            $this->fail('A deactivated developer must not reach the tool.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(404, $e->getStatusCode());
        }
    }

    /**
     * The migration must never commit a usable credential. It seeds the account
     * dormant; `php artisan developer:credentials` mints the real ones at deploy
     * time. Guards against a hardcoded backdoor being reintroduced.
     */
    public function test_migration_seeds_no_usable_credential(): void
    {
        $source = file_get_contents(
            database_path('migrations/2026_07_11_100000_add_developer_role.php')
        );

        $this->assertStringNotContainsString('Hash::make', $source,
            'The migration must not hash any credential — that means one is hardcoded.');
        $this->assertStringContainsString("'is_active' => false", $source,
            'The seeded developer account must start deactivated.');
    }

    public function test_dormant_account_cannot_verify_any_passkey(): void
    {
        $dormant = new User();
        $dormant->passkey = null;

        $this->assertFalse($dormant->verifyPasskey('246810'));
        $this->assertFalse($dormant->verifyPasskey('000000'));
    }

    /**
     * @dataProvider badPhotoProvider
     */
    public function test_rejects_bad_photo_payloads(string $payload, string $why): void
    {
        $controller = new \App\Http\Controllers\Api\DeveloperController();
        $this->assertFalse(
            $controller->isValidBase64Image($payload),
            "Should reject: {$why}"
        );
    }

    public static function badPhotoProvider(): array
    {
        return [
            ['hello world',                          'plain string (the hole in PledgeController)'],
            ['',                                     'empty string'],
            ['data:text/html;base64,PHNjcmlwdD4=',   'non-image mime'],
            ['data:image/svg+xml;base64,PHN2Zz4=',   'svg (script vector)'],
            ['data:image/jpeg;base64,!!!not-b64!!!', 'undecodable base64'],
            ['data:image/jpeg;base64,' . str_repeat('A', 3_000_000), 'over the 2MB cap'],
        ];
    }

    public function test_accepts_a_real_small_jpeg_data_uri(): void
    {
        $controller = new \App\Http\Controllers\Api\DeveloperController();

        // Smallest valid JPEG (1x1 px), base64-encoded.
        $jpeg = base64_encode(base64_decode(
            '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
            . 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
            . 'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
        ));

        $this->assertTrue($controller->isValidBase64Image('data:image/jpeg;base64,' . $jpeg));
    }
}
