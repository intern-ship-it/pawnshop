<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PledgeItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

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

        // The passkey is correct — but if this account has a credential registered for
        // THIS origin, the page must also complete a fingerprint ceremony. The flag is
        // UX only: the real enforcement is that /dev/webauthn/login must succeed, and
        // every upload still re-verifies the passkey regardless.
        // NOTE: the page's origin, not the API host — in dev the SPA is on
        // localhost:3000 while the API answers on 127.0.0.1:8001, and credentials
        // are bound to the page's domain.
        $webauthn = app(\App\Services\WebauthnService::class);
        $webauthnRequired = $webauthn->hasCredentialFor(
            $request->user(),
            $webauthn->rpIdForRequest($request),
        );

        return response()->json([
            'success' => true,
            'webauthn_required' => $webauthnRequired,
        ]);
    }

    /**
     * Change the developer's own password and/or passkey.
     *
     * Authorized by the CURRENT passkey — the same factor that gates every other
     * write here — plus the current password when the password is being changed.
     * Always acts on the caller, never on another user id.
     */
    public function changeCredentials(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_passkey'  => 'required|string|size:6',
            'new_password'     => 'nullable|string|min:8|confirmed',
            'current_password' => 'required_with:new_password|string',
            'new_passkey'      => 'nullable|string|size:6',
        ]);

        $user = $request->user();

        if (!$user->verifyPasskey($validated['current_passkey'])) {
            return response()->json(['success' => false, 'message' => 'Current passkey is incorrect.'], 401);
        }

        if (empty($validated['new_password']) && empty($validated['new_passkey'])) {
            return response()->json([
                'success' => false,
                'message' => 'Provide a new password, a new passkey, or both.',
            ], 422);
        }

        $changed = [];

        if (!empty($validated['new_password'])) {
            if (!Hash::check($validated['current_password'], $user->password)) {
                return response()->json(['success' => false, 'message' => 'Current password is incorrect.'], 401);
            }
            $user->password = Hash::make($validated['new_password']);
            $changed[] = 'password';
        }

        if (!empty($validated['new_passkey'])) {
            $user->passkey = Hash::make($validated['new_passkey']);
            $changed[] = 'passkey';
        }

        $user->save();

        AuditLog::create([
            'branch_id'   => $user->branch_id,
            'user_id'     => $user->id,
            'action'      => AuditLog::ACTION_UPDATE,
            'module'      => 'auth',
            'description' => 'Developer changed own ' . implode(' and ', $changed),
            'record_type' => 'User',
            'record_id'   => $user->id,
            'ip_address'  => $request->ip(),
            'user_agent'  => $request->userAgent(),
            'created_at'  => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Updated ' . implode(' and ', $changed) . '. Use the new credentials from now on.',
            'changed' => $changed,
        ]);
    }

    /**
     * Pledges that have at least one item with no photo, one row per pledge.
     *
     * Deliberately does NOT select `photo` — each one is ~110KB of base64 and
     * bulk-loading them exhausts the PHP memory limit (see PledgeItem::listColumns()).
     * Photos are fetched one pledge at a time by pledgeItems() below.
     */
    public function missingImages(Request $request): JsonResponse
    {
        // LENGTH() rather than a NULL/'' test so the two agree on what "missing"
        // means: pledgeItems() marks an item missing on the same basis.
        $missing = "SUM(CASE WHEN pi.photo IS NULL OR LENGTH(pi.photo) = 0 THEN 1 ELSE 0 END)";

        $rows = DB::table('pledges as p')
            ->join('pledge_items as pi', 'p.id', '=', 'pi.pledge_id')
            ->leftJoin('branches as b', 'b.id', '=', 'p.branch_id')
            ->leftJoin('customers as c', 'c.id', '=', 'p.customer_id')
            ->groupBy(
                'p.id', 'p.pledge_no', 'p.receipt_no', 'p.status',
                'p.pledge_date', 'b.name', 'c.name', 'c.ic_number',
            )
            ->havingRaw("{$missing} > 0")
            ->select([
                'p.id as pledge_id',
                'p.pledge_no',
                'p.receipt_no',
                'p.status as pledge_status',
                'p.pledge_date',
                'b.name as branch',
                'c.name as customer_name',
                'c.ic_number as customer_ic',
                DB::raw('COUNT(pi.id) as total_items'),
                DB::raw("{$missing} as missing_items"),
            ])
            ->orderByDesc('p.pledge_date')
            ->get()
            // COUNT/SUM come back as strings from MySQL. The client does
            // arithmetic and comparisons on these, so cast them here rather
            // than leave it to JS coercion.
            ->map(function ($row) {
                $row->total_items = (int) $row->total_items;
                $row->missing_items = (int) $row->missing_items;
                return $row;
            });

        return response()->json([
            'success' => true,
            'data'    => $rows,
            'meta'    => [
                'total_items'   => (int) $rows->sum('missing_items'),
                'total_pledges' => $rows->count(),
            ],
        ]);
    }

    /**
     * Every item on one pledge, photos included.
     *
     * Safe to ship the photo column here because it is scoped to a single
     * pledge: the largest pledge in the system holds 4 items (~640KB). Never
     * widen this to more than one pledge at a time.
     */
    public function pledgeItems(Request $request, int $pledge): JsonResponse
    {
        $pledgeRow = DB::table('pledges as p')
            ->leftJoin('customers as c', 'c.id', '=', 'p.customer_id')
            ->leftJoin('branches as b', 'b.id', '=', 'p.branch_id')
            ->where('p.id', $pledge)
            ->select([
                'p.id as pledge_id',
                'p.pledge_no',
                'p.status as pledge_status',
                'p.pledge_date',
                'c.name as customer_name',
                'b.name as branch',
            ])
            ->first();

        if (!$pledgeRow) {
            return response()->json(['success' => false, 'message' => 'Pledge not found.'], 404);
        }

        $items = DB::table('pledge_items as pi')
            ->leftJoin('categories as cat', 'cat.id', '=', 'pi.category_id')
            ->where('pi.pledge_id', $pledge)
            ->orderBy('pi.item_no')
            ->select([
                'pi.id as item_id',
                'pi.item_no',
                'pi.barcode',
                'cat.name_en as category', // `categories` is bilingual: name_en / name_ms, no `name`
                'pi.description',
                'pi.net_weight',
                'pi.gross_weight',
                'pi.photo',
            ])
            ->get()
            ->map(function ($item) {
                $item->has_photo = $item->photo !== null && $item->photo !== '';
                return $item;
            });

        return response()->json([
            'success' => true,
            'data'    => [
                'pledge' => $pledgeRow,
                'items'  => $items,
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
