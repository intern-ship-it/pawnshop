# Developer-Only Image Backfill — Design

**Date:** 2026-07-11
**Status:** Approved

## Problem

14 of 617 `pledge_items` rows (spanning 12 pledges) have no photo — `photo IS NULL OR photo = ''`. Pledge item photos are currently **write-once**: they are only ever set at pledge creation (`PledgeController::store()`), and no endpoint exists to add or change an item's photo afterwards. There is no way to fix these gaps.

We need a tool that lists the items missing photos and lets a developer upload one per item, reachable only by the developer.

## Key facts about the existing system

These constrain the design and were verified in the codebase, not assumed:

- **Photos are base64 data-URIs in a `LONGTEXT` column**, not files on disk.
  `pledge_items.photo` was widened from VARCHAR(255) by
  `backend/database/migrations/2026_02_04_165000_change_photo_column_to_longtext_in_pledge_items.php`
  explicitly "to store base64 images". There is no disk, no `Storage::` call, and no
  photo-serving route. (Customer selfies *do* use the `public` disk — that is a
  different pattern and is **not** what pledge items use.)
- **Photos must never be bulk-selected.** `PledgeItem::listColumns()`
  (`backend/app/Models/PledgeItem.php:64-77`) deliberately excludes `photo`; its docblock
  records that each photo is ~110KB of base64 and that loading them in bulk exhausts the
  PHP memory limit. `InventoryController` and `PledgeController::index()` strip it too.
- **Roles are hand-rolled**, not Spatie: `roles` table with a `slug`, `users.role_id` FK,
  single role per user. Existing slugs: `super-admin`, `admin`, `manager`, `cashier`,
  `auditor`. **There is no `developer` role.**
- **Passkey already exists**: `User::verifyPasskey()` (`User.php:166-172`) is a
  `Hash::check` against a 6-digit `users.passkey`. `AuthController::verifyPasskey()`
  (`AuthController.php:222`) is the existing endpoint.
- **Audit logging house pattern** is `AuditLog::create([...])`, used across
  `PledgeController`, `CustomerController`, `SettingsController`, etc.
- **Existing photo validation is unsafe**: `PledgeController.php:379` validates
  `items.*.photo` as `'nullable|string'` — no MIME check, no size cap. The new write
  path will not repeat this.

## Decisions

| Question | Decision |
|---|---|
| Who can access | A new **hidden `developer` role** |
| How the route is gated | **Developer role + passkey prompt on entry**, passkey re-verified server-side on the write |
| Role visibility | Hidden from the Roles page **and** from the user-edit role dropdown; account created by seeder only |
| Denial mode | **404 Not Found** — never reveal the page exists |
| What is listed | **All items missing a photo** (self-emptying list) |
| Safety | **Audit log row per upload** |
| Sidebar | **No entry** — direct URL only |

## Architecture

### Access gate — three independent layers

1. **Hidden `developer` role.** Migration/seeder creates role slug `developer`
   (`is_system: true`) and one developer user. `RoleController::index()` filters the slug
   out of the roles list; `UserController` filters it out of the assignable-role list, so
   no super-admin can mint a developer through the UI. New helper `User::isDeveloper()`
   sits alongside `isSuperAdmin()`.
2. **Passkey on entry.** The page is inert until the developer enters their 6-digit
   passkey. The server does **not** trust a client-side "verified" flag: the passkey is
   re-sent and re-verified on the upload request itself, so the gate cannot be bypassed by
   calling the API directly.
3. **404, not 403.** New `developer.only` middleware aborts **404** when
   `auth()->user()?->isDeveloper()` is false. The frontend route renders the normal
   Not-Found screen for non-developers. Nothing leaks the page's existence.

### Backend

New `DeveloperController` under `/api/dev/*`, behind `auth:sanctum` + `developer.only`:

| Route | Purpose |
|---|---|
| `POST /api/dev/verify` | Verify passkey to enter the page |
| `GET  /api/dev/missing-images` | List pledge items with no photo |
| `POST /api/dev/missing-images/{item}/photo` | Upload one item's photo |

**List query** — the query from the audit, joined for display context:

```sql
WHERE pi.photo IS NULL OR pi.photo = ''
```
joined to `pledges`, `branches`, `customers`, `categories`; returns pledge_no, receipt_no,
pledge status, branch, customer name, item_no, barcode, category, description, net_weight.
It **must not select `photo`** (see memory-limit constraint above).

**Upload** — writes the base64 data-URI to `pledge_items.photo`.

### Validation (closing the existing hole)

The upload endpoint validates, rather than accepting any string:
- matches `data:image/(jpeg|png|webp);base64,` prefix
- base64 body decodes cleanly
- decoded size under ~2MB (well above the ~110KB the client compressor emits)

The frontend reuses the same canvas compressor `NewPledge.jsx` already applies
(max width 800, quality 0.7) so backfilled photos match existing ones in size and format.

### Audit trail

Each successful upload writes an `AuditLog` row: `action: 'update'`, `module: 'pledge'`,
`record_type: 'PledgeItem'`, `record_id`, a description naming the pledge and item, and
the request IP. Because the gate is a real per-person role plus that person's passkey (not
a shared secret), the log genuinely identifies **who** backfilled each photo.

### Frontend

`frontend/src/pages/developer/MissingImages.jsx` at route `/dev/missing-images`.
**Not registered in `Sidebar.jsx`.** On mount: passkey prompt; on success: the table
(pledge no, customer, item no, barcode, category, description, weight) with an Upload
button per row. Uploading removes the row and decrements the remaining count. When the
list empties, the page says so — it stays correct rather than being a one-off script.

Follows `UserList.jsx` conventions: `PageWrapper`, `Card`, `Button`, `Modal`,
`apiGet`/`apiPost` from `@/services/api`, lucide icons, framer-motion rows.

## Verification

Against the real database:
- The list returns **14 items across 12 pledges**, matching the phpMyAdmin audit exactly.
- Upload a test image to one item → it renders on that pledge's detail page.
- That item disappears from the missing list (count drops to 13).
- An `audit_logs` row was written naming the developer.
- A non-developer account receives **404** on `/api/dev/*`.

## Risks accepted

- This creates a **mutation path onto live pledge records** that did not previously exist.
  The three-layer gate plus the audit log is what makes that acceptable.

## Out of scope (found during exploration, worth fixing separately)

- `routes/api.php:47-103` — `/api/preview/pledge-receipt/{pledge}` and
  `/api/preview/renewal-receipt/{renewal}` are **unauthenticated** and leak full pledge and
  customer PII.
- `routes/api.php:165` uses middleware alias `permission:` which is not registered (only
  `check.permission` is) — that route would 500.
- `AuditLogController` calls a non-existent `hasRole()` and checks slug `super_admin`
  (underscore) which never matches the real `super-admin`.
