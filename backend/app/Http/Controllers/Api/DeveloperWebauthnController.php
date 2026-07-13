<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\WebauthnCredential;
use App\Services\WebauthnService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * WebAuthn ceremonies for the hidden developer tooling.
 *
 * Every route sits behind `developer.only`, which 404s for anyone who is not the
 * developer — including super-admins. Nothing here reveals the page exists.
 *
 * Note the host is always taken from the live request ($this->webauthn->rpIdForRequest($request)) and
 * passed through: credentials are origin-bound, and the same code runs on
 * localhost, staging and production.
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
            'options' => $this->webauthn->registerOptions($request->user(), $this->webauthn->rpIdForRequest($request)),
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'credential' => 'required|array',
            'device_label' => 'nullable|string|max:60',
        ]);

        try {
            $cred = $this->webauthn->verifyRegistration(
                $request->user(),
                $this->webauthn->rpIdForRequest($request),
                $request->input('credential'),
                $request->input('device_label'),
            );
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        AuditLog::create([
            'branch_id' => $request->user()->branch_id,
            'user_id' => $request->user()->id,
            'action' => AuditLog::ACTION_UPDATE,
            'module' => 'auth',
            'description' => "Developer registered a fingerprint device ({$cred->device_label}) for {$cred->rp_id}",
            'record_type' => 'WebauthnCredential',
            'record_id' => $cred->id,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json(['success' => true, 'message' => 'Device registered.']);
    }

    public function loginOptions(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'options' => $this->webauthn->loginOptions($request->user(), $this->webauthn->rpIdForRequest($request)),
        ]);
    }

    public function login(Request $request): JsonResponse
    {
        $request->validate(['credential' => 'required|array']);

        $ok = $this->webauthn->verifyLogin(
            $request->user(),
            $this->webauthn->rpIdForRequest($request),
            $request->input('credential'),
        );

        if (!$ok) {
            return response()->json(['success' => false, 'message' => 'Fingerprint not recognised.'], 401);
        }

        return response()->json(['success' => true]);
    }

    /** Registered devices for this origin. Shown only after unlock. */
    public function devices(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->webauthn->credentialsFor($request->user(), $this->webauthn->rpIdForRequest($request)),
        ]);
    }

    /**
     * Remove a registered device.
     *
     * Without this, a lost or wiped device would strand a credential that can
     * never be cleared from the UI. Scoped to the caller's own credentials.
     */
    public function deleteDevice(Request $request, int $credential): JsonResponse
    {
        $row = WebauthnCredential::where('id', $credential)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$row) {
            return response()->json(['success' => false, 'message' => 'Device not found.'], 404);
        }

        $label = $row->device_label;
        $row->delete();

        AuditLog::create([
            'branch_id' => $request->user()->branch_id,
            'user_id' => $request->user()->id,
            'action' => AuditLog::ACTION_DELETE,
            'module' => 'auth',
            'description' => "Developer removed a fingerprint device ({$label})",
            'record_type' => 'WebauthnCredential',
            'record_id' => $credential,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->json(['success' => true, 'message' => 'Device removed.']);
    }
}
