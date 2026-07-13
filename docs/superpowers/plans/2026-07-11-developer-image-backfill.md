# Developer Image Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a hidden `developer` role a URL-only page that lists the pledge items with no photo and lets them upload one per item, with an audit-log row for every upload.

**Architecture:** A new hidden `developer` role (invisible in the Roles page and the user-edit role dropdown, seeded only) plus a `developer.only` middleware that returns **404** — never 403 — for everyone else. Three endpoints under `/api/dev/*` (passkey verify, list-missing, upload-photo). The upload re-verifies the passkey server-side on every call, so the gate cannot be bypassed by calling the API directly. Photos are base64 data-URIs written to the existing `pledge_items.photo` LONGTEXT column. A React page at `/dev/missing-images`, deliberately absent from the sidebar.

**Tech Stack:** Laravel 11 (PHP), Sanctum, PHPUnit; React 19 + react-router v7 + Redux Toolkit + Tailwind, axios via `@/services/api`.

## Global Constraints

Copied from the spec (`docs/superpowers/specs/2026-07-11-developer-image-backfill-design.md`). Every task's requirements implicitly include these.

- **Photos are base64 data-URIs in a `LONGTEXT` column.** NOT files on disk, NOT a blob. Do not use `Storage::`, do not add a disk, do not add an upload path. The customer-selfie code uses the `public` disk — that is a *different* pattern; do not copy it.
- **Never bulk-SELECT the `photo` column.** Each photo is ~110KB of base64; loading many at once exhausts the PHP memory limit. This is why `PledgeItem::listColumns()` (`backend/app/Models/PledgeItem.php:64-77`) excludes it. The list endpoint must not select `photo`.
- **Denial is 404, never 403.** The page must not reveal it exists. Applies to both the API middleware and the frontend route.
- **Role slug is exactly `developer`** (hyphen-style like the existing `super-admin`; not `dev`, not `Developer`).
- **The existing 5 role slugs are:** `super-admin`, `admin`, `manager`, `cashier`, `auditor`. `super-admin` short-circuits to all permissions in several places — the developer gate must be a *role identity* check (`isDeveloper()`), not a permission check, so a super-admin does **not** inherit it.
- **Passkey is 6 characters**, hashed in `users.passkey`, verified by `User::verifyPasskey()` (`Hash::check`). Reuse it; invent no new crypto.
- **Audit rows are written with `AuditLog::create([...])`** — the house pattern. `AuditLog` has `$timestamps = false` and a fillable `created_at`, so `created_at` must be set explicitly.
- **Test suite runs against the real `pawnsys` database.** `backend/phpunit.xml` states the suite contains **no `RefreshDatabase` tests, so it never drops or mutates tables**. Do NOT add `RefreshDatabase`, migrations-on-test, or factories that write rows. Tests in this plan are read-only: they assert on gate/validation behavior, which needs no fixture writes. The one mutating behavior (a real upload) is verified manually in Task 8 against real data and then restored.

---

## File Structure

**Backend (`c:\pawan\backend`)**
| File | Responsibility |
|---|---|
| `database/migrations/2026_07_11_100000_add_developer_role.php` (create) | Insert the hidden `developer` role + the developer user. Reversible. |
| `app/Models/User.php` (modify) | Add `isDeveloper()` beside `isSuperAdmin()`. |
| `app/Http/Middleware/DeveloperOnly.php` (create) | Abort 404 unless the caller is the developer. |
| `bootstrap/app.php` (modify) | Register the `developer.only` alias. |
| `app/Http/Controllers/Api/DeveloperController.php` (create) | The 3 endpoints. |
| `routes/api.php` (modify) | Register `/api/dev/*`. |
| `app/Http/Controllers/Api/RoleController.php` (modify) | Hide the `developer` role from the roles list. |
| `app/Http/Controllers/Api/UserController.php` (modify) | Hide it from the assignable-role list. |
| `tests/Feature/DeveloperBackfillTest.php` (create) | Read-only gate + validation tests. |

**Frontend (`c:\pawan\frontend`)**
| File | Responsibility |
|---|---|
| `src/pages/developer/MissingImages.jsx` (create) | Passkey prompt + missing-items table + per-row upload. |
| `src/routes.jsx` (modify) | Add `/dev/missing-images`. **Not** added to `Sidebar.jsx`. |

---

### Task 1: `isDeveloper()` on the User model

**Files:**
- Modify: `backend/app/Models/User.php:151-164`
- Test: `backend/tests/Feature/DeveloperBackfillTest.php` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `User::isDeveloper(): bool` — true only when `$this->role?->slug === 'developer'`. Used by Task 3's middleware and Task 5's controller.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/Feature/DeveloperBackfillTest.php`. This test constructs models in memory only — it does **not** save anything (see Global Constraints).

```php
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
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd c:\pawan\backend && php artisan test --filter=test_is_developer_true_only_for_developer_slug`
Expected: FAIL — `Call to undefined method App\Models\User::isDeveloper()`

- [ ] **Step 3: Write minimal implementation**

In `backend/app/Models/User.php`, immediately after `isSuperAdmin()` (line 151-154), add:

```php
    /**
     * Hidden developer identity. Deliberately NOT implied by isSuperAdmin() —
     * developer tooling is gated on being the developer, not on being powerful.
     */
    public function isDeveloper(): bool
    {
        return $this->role?->slug === 'developer';
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd c:\pawan\backend && php artisan test --filter=test_is_developer_true_only_for_developer_slug`
Expected: PASS (1 test, 3 assertions)

- [ ] **Step 5: Commit**

```bash
git add backend/app/Models/User.php backend/tests/Feature/DeveloperBackfillTest.php
git commit -m "feat(dev-tools): add User::isDeveloper() role check"
```

---

### Task 2: Migration — seed the hidden developer role and account

**Files:**
- Create: `backend/database/migrations/2026_07_11_100000_add_developer_role.php`

**Interfaces:**
- Consumes: nothing.
- Produces: a `roles` row with slug `developer`, and a `users` row with that `role_id`. Login `developer`, passkey `246810`. Task 8 logs in as this user.

**Note:** the developer account's password and passkey below are the initial values. Change them after first login via the existing profile screen. `users` requires a `branch_id` — reuse the same branch as the seeded superadmin.

- [ ] **Step 1: Write the migration**

Create `backend/database/migrations/2026_07_11_100000_add_developer_role.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    /**
     * Hidden `developer` role + account for internal backfill tooling.
     * This role is filtered out of the Roles page and the user-edit role
     * dropdown, so it can only ever be granted here.
     */
    public function up(): void
    {
        if (DB::table('roles')->where('slug', 'developer')->exists()) {
            return;
        }

        $roleId = DB::table('roles')->insertGetId([
            'name'        => 'Developer',
            'slug'        => 'developer',
            'description' => 'Internal maintenance tooling. Hidden from role management.',
            'is_system'   => true,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        // Reuse whichever branch the existing superadmin sits in (HQ).
        $branchId = DB::table('users')->whereNotNull('branch_id')->value('branch_id')
            ?? DB::table('branches')->value('id');

        if (DB::table('users')->where('username', 'developer')->doesntExist()) {
            DB::table('users')->insert([
                'name'       => 'Developer',
                'username'   => 'developer',
                'email'      => 'developer@pawnsys.local',
                'password'   => Hash::make('Dev@2026!change'),
                'passkey'    => Hash::make('246810'),
                'role_id'    => $roleId,
                'branch_id'  => $branchId,
                'is_active'  => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $roleId = DB::table('roles')->where('slug', 'developer')->value('id');
        DB::table('users')->where('username', 'developer')->delete();
        if ($roleId) {
            DB::table('role_permissions')->where('role_id', $roleId)->delete();
            DB::table('roles')->where('id', $roleId)->delete();
        }
    }
};
```

- [ ] **Step 2: Confirm the `users` columns this migration writes actually exist**

Run: `cd c:\pawan\backend && php artisan tinker --execute="print_r(Schema::getColumnListing('users'));"`
Expected: the printed list includes `name`, `username`, `email`, `password`, `passkey`, `role_id`, `branch_id`, `is_active`.
If any listed column is absent or named differently, correct the insert to match the real schema before running the migration.

- [ ] **Step 3: Run the migration**

Run: `cd c:\pawan\backend && php artisan migrate`
Expected: `2026_07_11_100000_add_developer_role .... DONE`

- [ ] **Step 4: Verify the role and user exist and are linked**

Run:
```bash
cd c:\pawan\backend && php artisan tinker --execute="\$u = App\Models\User::with('role')->where('username','developer')->first(); echo \$u->role->slug, ' | isDeveloper=', var_export(\$u->isDeveloper(), true), PHP_EOL;"
```
Expected: `developer | isDeveloper=true`

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/2026_07_11_100000_add_developer_role.php
git commit -m "feat(dev-tools): seed hidden developer role and account"
```

---

### Task 3: `developer.only` middleware (404 denial)

**Files:**
- Create: `backend/app/Http/Middleware/DeveloperOnly.php`
- Modify: `backend/bootstrap/app.php:27-32`
- Test: `backend/tests/Feature/DeveloperBackfillTest.php`

**Interfaces:**
- Consumes: `User::isDeveloper()` from Task 1.
- Produces: middleware alias `developer.only`. Task 6 applies it to the `/api/dev` route group.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/DeveloperBackfillTest.php` (inside the class):

```php
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
        $dev->setRelation('role', new Role(['slug' => 'developer']));
        $request->setUserResolver(fn () => $dev);

        $response = $middleware->handle($request, fn () => response()->json(['reached' => true]));
        $this->assertSame(200, $response->getStatusCode());
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd c:\pawan\backend && php artisan test --filter=DeveloperBackfillTest`
Expected: FAIL — `Class "App\Http\Middleware\DeveloperOnly" not found`

- [ ] **Step 3: Write minimal implementation**

Create `backend/app/Http/Middleware/DeveloperOnly.php`:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DeveloperOnly
{
    /**
     * Gate for hidden developer tooling.
     *
     * Aborts 404 — never 403 — so that a non-developer who stumbles onto the
     * URL cannot tell there is anything here to attack. Note this is a role
     * identity check: a super-admin is deliberately NOT allowed through.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            abort(404);
        }

        if (!$user->relationLoaded('role')) {
            $user->load('role');
        }

        if (!$user->isDeveloper()) {
            abort(404);
        }

        return $next($request);
    }
}
```

Then in `backend/bootstrap/app.php`, add to the `$middleware->alias([...])` block (line 27-32):

```php
            'developer.only' => \App\Http\Middleware\DeveloperOnly::class,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd c:\pawan\backend && php artisan test --filter=DeveloperBackfillTest`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Middleware/DeveloperOnly.php backend/bootstrap/app.php backend/tests/Feature/DeveloperBackfillTest.php
git commit -m "feat(dev-tools): add developer.only middleware with 404 denial"
```

---

### Task 4: Hide the developer role from the UI

**Files:**
- Modify: `backend/app/Http/Controllers/Api/RoleController.php:17-24`
- Modify: `backend/app/Http/Controllers/Api/UserController.php` (the roles-list method)

**Interfaces:**
- Consumes: the `developer` role from Task 2.
- Produces: nothing consumed by later tasks. Purely a concealment change.

- [ ] **Step 1: Hide it from the Roles & Permissions list**

In `backend/app/Http/Controllers/Api/RoleController.php`, replace `index()` (lines 17-24) with:

```php
    public function index(Request $request): JsonResponse
    {
        $roles = Role::withCount('users')
            ->where('slug', '!=', 'developer') // hidden internal tooling role
            ->orderBy('name')
            ->get();

        return $this->success($roles);
    }
```

- [ ] **Step 2: Find where UserController exposes assignable roles**

Run: `cd c:\pawan\backend && grep -n "Role::" app/Http/Controllers/Api/UserController.php`
Expected: one or more lines returning roles for the user create/edit dropdown (around the `roles()` / `getRoles()` method near line 316 or the `create`/`edit` payload).

- [ ] **Step 3: Exclude the developer role from every `Role::` query found in Step 2**

For each `Role::` query in `UserController.php` that returns roles to the frontend, add the same exclusion so no super-admin can grant the role through the UI:

```php
            ->where('slug', '!=', 'developer') // hidden internal tooling role
```

Do **not** change `RoleController::store/update/destroy` — a hidden role that no query returns cannot be selected there anyway.

- [ ] **Step 4: Verify the role is invisible but still functional**

Run:
```bash
cd c:\pawan\backend && php artisan tinker --execute="echo 'listed: ', App\Models\Role::where('slug','!=','developer')->pluck('slug')->implode(','), PHP_EOL, 'exists: ', App\Models\Role::where('slug','developer')->exists() ? 'yes' : 'no', PHP_EOL;"
```
Expected:
```
listed: admin,auditor,cashier,manager,super-admin
exists: yes
```
(the developer role still exists in the DB, but is absent from the listed set)

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/RoleController.php backend/app/Http/Controllers/Api/UserController.php
git commit -m "feat(dev-tools): hide developer role from role list and user role dropdown"
```

---

### Task 5: `DeveloperController` — verify, list, upload

**Files:**
- Create: `backend/app/Http/Controllers/Api/DeveloperController.php`
- Test: `backend/tests/Feature/DeveloperBackfillTest.php`

**Interfaces:**
- Consumes: `User::isDeveloper()` (Task 1), `User::verifyPasskey()` (existing, `User.php:166`), `AuditLog::create()` (existing).
- Produces:
  - `verify(Request): JsonResponse` — `{success: bool}`; 401 on bad passkey.
  - `missingImages(Request): JsonResponse` — `{success: true, data: [{item_id, pledge_id, pledge_no, receipt_no, pledge_status, branch, customer_name, item_no, barcode, category, description, net_weight}], meta: {total_items, total_pledges}}`.
  - `uploadPhoto(Request, PledgeItem): JsonResponse` — `{success: true}`; 401 bad passkey, 422 bad image, 409 if the item already has a photo.
  - `PHOTO_MAX_BYTES = 2097152` and the accepted MIME list — Task 7's frontend compressor targets well under this.

- [ ] **Step 1: Write the failing validation tests**

Append to `backend/tests/Feature/DeveloperBackfillTest.php` (inside the class). These test the pure validation helper — no DB writes:

```php
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd c:\pawan\backend && php artisan test --filter=DeveloperBackfillTest`
Expected: FAIL — `Class "App\Http\Controllers\Api\DeveloperController" not found`

- [ ] **Step 3: Write the controller**

Create `backend/app/Http/Controllers/Api/DeveloperController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PledgeItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Hidden developer tooling. Every route here sits behind `developer.only`,
 * which 404s for anyone who is not the developer.
 */
class DeveloperController extends Controller
{
    /** Decoded image bytes must stay under this. The client compressor emits ~110KB. */
    public const PHOTO_MAX_BYTES = 2097152; // 2MB

    /** Raster formats only — no SVG (it can carry script). */
    private const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    /**
     * Confirm the developer's own passkey before the page opens.
     * The passkey is re-checked on every write, so this is UX, not the gate.
     */
    public function verify(Request $request): JsonResponse
    {
        $request->validate(['passkey' => 'required|string|size:6']);

        if (!$request->user()->verifyPasskey($request->passkey)) {
            return response()->json(['success' => false, 'message' => 'Invalid passkey.'], 401);
        }

        return response()->json(['success' => true]);
    }

    /**
     * Pledge items with no photo.
     *
     * Deliberately does NOT select `photo` — each one is ~110KB of base64 and
     * bulk-loading them exhausts the PHP memory limit (see PledgeItem::listColumns()).
     */
    public function missingImages(Request $request): JsonResponse
    {
        $rows = DB::table('pledge_items as pi')
            ->join('pledges as p', 'p.id', '=', 'pi.pledge_id')
            ->leftJoin('branches as b', 'b.id', '=', 'p.branch_id')
            ->leftJoin('customers as c', 'c.id', '=', 'p.customer_id')
            ->leftJoin('categories as cat', 'cat.id', '=', 'pi.category_id')
            ->whereNull('pi.photo')
            ->orWhere('pi.photo', '')
            ->select([
                'pi.id as item_id',
                'p.id as pledge_id',
                'p.pledge_no',
                'p.receipt_no',
                'p.status as pledge_status',
                'b.name as branch',
                'c.name as customer_name',
                'pi.item_no',
                'pi.barcode',
                'cat.name as category',
                'pi.description',
                'pi.net_weight',
            ])
            ->orderByDesc('p.pledge_date')
            ->orderBy('pi.item_no')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $rows,
            'meta'    => [
                'total_items'   => $rows->count(),
                'total_pledges' => $rows->pluck('pledge_id')->unique()->count(),
            ],
        ]);
    }

    /**
     * Attach a photo to one item that has none.
     */
    public function uploadPhoto(Request $request, PledgeItem $item): JsonResponse
    {
        $request->validate([
            'passkey' => 'required|string|size:6',
            'photo'   => 'required|string',
        ]);

        // Re-verify server-side: the page's entry prompt is not the gate.
        if (!$request->user()->verifyPasskey($request->passkey)) {
            return response()->json(['success' => false, 'message' => 'Invalid passkey.'], 401);
        }

        if (!$this->isValidBase64Image($request->photo)) {
            return response()->json([
                'success' => false,
                'message' => 'Photo must be a JPEG, PNG or WebP data URI under 2MB.',
            ], 422);
        }

        // This tool only fills gaps; it is not an edit-any-photo tool.
        if (!empty($item->photo)) {
            return response()->json([
                'success' => false,
                'message' => 'This item already has a photo.',
            ], 409);
        }

        $item->photo = $request->photo;
        $item->save();

        $item->loadMissing('pledge');

        AuditLog::create([
            'branch_id'   => $item->pledge?->branch_id,
            'user_id'     => $request->user()->id,
            'action'      => AuditLog::ACTION_UPDATE,
            'module'      => 'pledge',
            'description' => "Developer backfilled missing photo for item {$item->item_no} on pledge {$item->pledge?->pledge_no}",
            'record_type' => 'PledgeItem',
            'record_id'   => $item->id,
            'new_values'  => [
                'photo_bytes' => strlen($request->photo),
                'barcode'     => $item->barcode,
            ],
            'ip_address'  => $request->ip(),
            'user_agent'  => $request->userAgent(),
            'created_at'  => now(),
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * A base64 image data-URI of an allowed raster type, that decodes, and is
     * under the size cap. Public so it can be unit-tested directly.
     *
     * NOTE: PledgeController::store() validates item photos as merely
     * 'nullable|string' — any string at all is accepted there. Do not copy that.
     */
    public function isValidBase64Image(string $value): bool
    {
        if (!preg_match('#^data:(image/[a-z0-9.+-]+);base64,(.+)$#i', $value, $m)) {
            return false;
        }

        [$mime, $payload] = [strtolower($m[1]), $m[2]];

        if (!in_array($mime, self::ALLOWED_MIMES, true)) {
            return false;
        }

        $binary = base64_decode($payload, true); // strict
        if ($binary === false || $binary === '') {
            return false;
        }

        if (strlen($binary) > self::PHOTO_MAX_BYTES) {
            return false;
        }

        // The bytes must really be an image of the claimed kind.
        $info = @getimagesizefromstring($binary);
        if ($info === false) {
            return false;
        }

        return in_array($info['mime'], self::ALLOWED_MIMES, true);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd c:\pawan\backend && php artisan test --filter=DeveloperBackfillTest`
Expected: PASS — 10 tests (3 from Tasks 1&3, 6 rejection cases, 1 acceptance case)

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/DeveloperController.php backend/tests/Feature/DeveloperBackfillTest.php
git commit -m "feat(dev-tools): add DeveloperController with validated photo backfill"
```

---

### Task 6: Register the `/api/dev/*` routes

**Files:**
- Modify: `backend/routes/api.php` (inside the existing `Route::middleware('auth:sanctum')->group()` that starts at line 112)

**Interfaces:**
- Consumes: `DeveloperController` (Task 5), the `developer.only` alias (Task 3).
- Produces: `POST /api/dev/verify`, `GET /api/dev/missing-images`, `POST /api/dev/missing-images/{item}/photo`. Task 7's frontend calls these.

- [ ] **Step 1: Add the route group**

In `backend/routes/api.php`, inside the `auth:sanctum` group, add:

```php
    // ── Hidden developer tooling. `developer.only` 404s for everyone else. ──
    Route::prefix('dev')->middleware('developer.only')->group(function () {
        Route::post('verify', [\App\Http\Controllers\Api\DeveloperController::class, 'verify']);
        Route::get('missing-images', [\App\Http\Controllers\Api\DeveloperController::class, 'missingImages']);
        Route::post('missing-images/{item}/photo', [\App\Http\Controllers\Api\DeveloperController::class, 'uploadPhoto']);
    });
```

- [ ] **Step 2: Verify the routes registered with the right middleware**

Run: `cd c:\pawan\backend && php artisan route:list --path=api/dev`
Expected: 3 routes listed, each showing `auth:sanctum` **and** `developer.only` in its middleware column.

- [ ] **Step 3: Confirm an unauthenticated caller cannot see the endpoint**

Run: `cd c:\pawan\backend && php artisan test --filter=DeveloperBackfillTest`
Expected: still PASS (10 tests) — no regression.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/api.php
git commit -m "feat(dev-tools): register hidden /api/dev routes"
```

---

### Task 7: The `/dev/missing-images` page

**Files:**
- Create: `frontend/src/pages/developer/MissingImages.jsx`
- Modify: `frontend/src/routes.jsx:60-73` (lazy imports) and `:163` (route table)
- **Do NOT modify** `frontend/src/components/layout/Sidebar.jsx` — the page is intentionally unlisted.

**Interfaces:**
- Consumes: `POST /api/dev/verify`, `GET /api/dev/missing-images`, `POST /api/dev/missing-images/{item}/photo` (Task 6).
- Produces: route `/dev/missing-images`.

**Conventions to follow** (mirroring `frontend/src/pages/settings/UserList.jsx`): `PageWrapper`, `Card`, `Button`, `Input`, `apiGet`/`apiPost` from `@/services/api`, lucide icons, framer-motion rows, `cn` from `@/lib/utils`.

- [ ] **Step 1: Create the page**

Create `frontend/src/pages/developer/MissingImages.jsx`:

```jsx
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ImageOff, Loader2, Lock, Upload, CheckCircle2 } from "lucide-react";
import PageWrapper from "@/components/layout/PageWrapper";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { apiGet, apiPost } from "@/services/api";
import { useAppSelector } from "@/store/hooks";

/**
 * Hidden developer tool: fill in the pledge items that have no photo.
 *
 * Not in the sidebar; reachable only by typing the URL. The API 404s for
 * anyone who is not the developer, and re-checks the passkey on every upload —
 * the prompt below is convenience, not the security boundary.
 */

// Same compression NewPledge.jsx applies, so backfilled photos match the
// existing ones in size and format (~110KB rather than multi-MB).
const compressImage = (dataUrl, maxWidth = 800, quality = 0.7) =>
  new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function MissingImages() {
  const { role } = useAppSelector((state) => state.auth);
  const roleSlug = role?.slug || role || "";
  const isDeveloper = roleSlug === "developer";

  const [passkey, setPasskey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total_items: 0, total_pledges: 0 });
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [doneIds, setDoneIds] = useState([]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet("/dev/missing-images");
      setItems(res.data.data || []);
      setMeta(res.data.meta || { total_items: 0, total_pledges: 0 });
    } catch {
      setError("Could not load the list.");
    } finally {
      setLoading(false);
    }
  }, []);

  const unlock = async (e) => {
    e.preventDefault();
    setUnlocking(true);
    setError("");
    try {
      await apiPost("/dev/verify", { passkey });
      setUnlocked(true);
      await loadItems();
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid passkey.");
    } finally {
      setUnlocking(false);
    }
  };

  const upload = async (item, file) => {
    if (!file) return;
    setUploadingId(item.item_id);
    setError("");
    try {
      const compressed = await compressImage(await readFile(file));
      await apiPost(`/dev/missing-images/${item.item_id}/photo`, {
        passkey,
        photo: compressed,
      });
      setDoneIds((prev) => [...prev, item.item_id]);
      setItems((prev) => prev.filter((i) => i.item_id !== item.item_id));
      setMeta((prev) => ({ ...prev, total_items: Math.max(0, prev.total_items - 1) }));
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          `Upload failed for item ${item.item_no}.`,
      );
    } finally {
      setUploadingId(null);
    }
  };

  // Belt-and-braces: the API 404s anyway, but never render the tool's chrome
  // to a non-developer who somehow reaches the route.
  useEffect(() => {
    if (!isDeveloper) setUnlocked(false);
  }, [isDeveloper]);

  if (!isDeveloper) return null;

  if (!unlocked) {
    return (
      <PageWrapper title="Restricted">
        <Card className="max-w-sm mx-auto p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold">Enter passkey</h2>
          </div>
          <form onSubmit={unlock} className="space-y-4">
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              placeholder="6-digit passkey"
              autoFocus
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={passkey.length !== 6 || unlocking} className="w-full">
              {unlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock"}
            </Button>
          </form>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Missing item images"
      subtitle={`${meta.total_items} item(s) across ${meta.total_pledges} pledge(s) have no photo`}
    >
      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {doneIds.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4" />
          Uploaded {doneIds.length} photo(s) this session.
        </div>
      )}

      <Card className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-gray-500">
            <ImageOff className="w-8 h-8" />
            <p>Every pledge item has a photo. Nothing to fix.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3">Pledge</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Item</th>
                <th className="p-3">Barcode</th>
                <th className="p-3">Category</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">Net wt</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <motion.tr
                  key={item.item_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border-t"
                >
                  <td className="p-3 font-medium">{item.pledge_no}</td>
                  <td className="p-3">{item.customer_name}</td>
                  <td className="p-3">{item.item_no}</td>
                  <td className="p-3 font-mono text-xs">{item.barcode}</td>
                  <td className="p-3">{item.category}</td>
                  <td className="p-3 text-gray-500">{item.description || "—"}</td>
                  <td className="p-3 text-right">{item.net_weight}</td>
                  <td className="p-3 text-right">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded border px-3 py-1.5 hover:bg-gray-50">
                      {uploadingId === item.item_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploadingId === item.item_id}
                        onChange={(e) => upload(item, e.target.files?.[0])}
                      />
                    </label>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </PageWrapper>
  );
}
```

- [ ] **Step 2: Confirm the UI primitives this page imports really exist with these names**

Run: `cd c:\pawan\frontend && grep -rn "export default" src/components/ui/Card.jsx src/components/ui/Button.jsx src/components/ui/Input.jsx src/components/layout/PageWrapper.jsx && grep -n "useAppSelector" src/store/hooks.js`
Expected: a default export from each of the four components, and `useAppSelector` exported from `src/store/hooks.js`. If `PageWrapper` does not accept `title`/`subtitle` props, open `src/pages/settings/UserList.jsx` and match how it is actually used there.

- [ ] **Step 3: Register the route (but NOT the sidebar)**

In `frontend/src/routes.jsx`, add the lazy import beside the other page imports:

```jsx
const MissingImages = lazy(() => import("@/pages/developer/MissingImages"));
```

Then add this as the **last** child of the `MainLayout` route, after the settings routes (line ~163). Note it uses `withSuspense`, not `withPermission` — the gate is the role check inside the page plus the API's 404, and `withPermission` has a `super-admin` bypass we specifically do not want:

```jsx
      // HIDDEN DEVELOPER TOOLING — intentionally absent from Sidebar.jsx
      { path: "dev/missing-images", element: withSuspense(MissingImages) },
```

- [ ] **Step 4: Verify the build compiles and the sidebar is untouched**

Run: `cd c:\pawan\frontend && npm run build`
Expected: build succeeds with no errors.

Run: `cd c:\pawan && git diff --name-only`
Expected: `frontend/src/components/layout/Sidebar.jsx` is **NOT** in the list.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/developer/MissingImages.jsx frontend/src/routes.jsx
git commit -m "feat(dev-tools): add hidden /dev/missing-images backfill page"
```

---

### Task 8: End-to-end verification against real data

**Files:** none changed — this task proves the feature works.

**Interfaces:**
- Consumes: everything from Tasks 1-7.
- Produces: the evidence that the spec's acceptance criteria hold.

This is the only task that exercises the mutating path. It runs against the real DB (the test suite deliberately does not), so it restores what it changes.

- [ ] **Step 1: Confirm the list matches the original phpMyAdmin audit**

Run:
```bash
cd c:\pawan\backend && php artisan tinker --execute="\$n = DB::table('pledge_items')->whereNull('photo')->orWhere('photo','')->count(); \$p = DB::table('pledge_items')->whereNull('photo')->orWhere('photo','')->distinct()->count('pledge_id'); echo \$n, ' items across ', \$p, ' pledges', PHP_EOL;"
```
Expected: the count the controller returns must equal the count of a raw, join-free
`WHERE photo IS NULL OR photo = ''` over `pledge_items`. If the two disagree, the JOINs are
dropping or duplicating rows — STOP.

**Note (2026-07-11):** the original audit recorded 14 items across 12 pledges out of 617
total items. On execution the table held only 542 items (13 missing photos, across 11
pledges) — the whole table shrank by 75 rows, so the dev DB was re-seeded/cleaned after the
audit. The controller's count was verified to match the raw query exactly, so the query is
correct; the *data* moved. Do not "fix" the query to force a 14.

- [ ] **Step 2: Confirm a non-developer gets 404, not 403**

Log in to the app as `superadmin`, then in the browser devtools console on any page:

```js
await fetch("/api/dev/missing-images", { headers: { Accept: "application/json" } }).then(r => r.status)
```
Expected: `404`.
A `403` here is a FAILURE — it reveals the endpoint exists.

- [ ] **Step 3: Confirm the developer can see the list in the UI**

Log out. Log in as `developer` / `Dev@2026!change`. Navigate directly to `/dev/missing-images`.
Expected: the passkey prompt appears. Enter `246810`. The table loads showing **14 rows**, and the subtitle reads `14 item(s) across 12 pledge(s) have no photo`. Confirm the sidebar shows **no** link to this page.

- [ ] **Step 4: Upload a photo and verify every downstream effect**

Pick the first row and note its pledge number and item id. Upload any JPEG.

Expected, in order:
1. The row disappears; the banner reads `Uploaded 1 photo(s) this session.`
2. Re-running the Step 1 command now prints `13 items across ...`.
3. The photo renders on that pledge's detail page (`/pledges/{pledge_id}` → the item's thumbnail).
4. An audit row exists:
   ```bash
   cd c:\pawan\backend && php artisan tinker --execute="\$l = App\Models\AuditLog::where('record_type','PledgeItem')->latest('created_at')->first(); echo \$l->user_id, ' | ', \$l->action, ' | ', \$l->description, PHP_EOL;"
   ```
   Expected: the developer's user id, `update`, and a description naming the pledge and item.

- [ ] **Step 5: Confirm the API rejects a direct call with a wrong passkey**

In the devtools console *while logged in as the developer*:

```js
await fetch("/api/dev/missing-images/1/photo", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ passkey: "000000", photo: "data:image/jpeg;base64,AAAA" }),
}).then(r => r.status)
```
Expected: `401` — proving the passkey is enforced server-side on the write, not just by the page's prompt.

- [ ] **Step 6: Restore the test item**

Undo the Step 4 upload so the data returns to its pre-verification state (replace `<ITEM_ID>` with the id you used):

```bash
cd c:\pawan\backend && php artisan tinker --execute="DB::table('pledge_items')->where('id', <ITEM_ID>)->update(['photo' => null]); echo 'restored', PHP_EOL;"
```
Expected: `restored`. Re-run Step 1; it must print `14 items across 12 pledges` again.

Leave the audit row in place — it is a true record that the upload happened.

- [ ] **Step 7: Run the full suite one last time**

Run: `cd c:\pawan\backend && php artisan test --filter=DeveloperBackfillTest`
Expected: PASS (10 tests).

- [ ] **Step 8: Commit**

Nothing to commit — this task changes no files. If Steps 1-7 all passed, the feature is done and verified.

---

## Notes for the implementer

- **Do not commit without the user's explicit approval.** Each task lists a commit step; ask before running it.
- **Do not "fix" `PledgeController.php:379`** (`'items.*.photo' => 'nullable|string'`) as part of this work. It is a real hole, but tightening it changes the pledge-creation path and needs its own testing. It is called out in the spec's out-of-scope section.
- If any step's expected output does not match, STOP and report rather than adapting the code until it passes.
