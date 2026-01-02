<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Login user and create token
     * Accepts either email or username
     */
    public function login(Request $request): JsonResponse
    {
        // Validate - require password and either email or username
        $request->validate([
            'password' => 'required|string',
        ]);

        // Check if at least one identifier is provided
        if (!$request->filled('email') && !$request->filled('username')) {
            return response()->json([
                'success' => false,
                'message' => 'Username or email is required',
                'errors' => [
                    'username' => ['Username or email is required.'],
                ],
            ], 422);
        }

        // Find user by email or username
        $user = null;
        if ($request->filled('email')) {
            $user = User::where('email', $request->email)->first();
        } elseif ($request->filled('username')) {
            $user = User::where('username', $request->username)->first();
        }

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid username or password',
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Your account has been deactivated',
            ], 403);
        }

        // Update last login
        $user->updateLastLogin($request->ip());

        // Create token
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'username' => $user->username,
                    'employee_id' => $user->employee_id,
                    'phone' => $user->phone,
                    'profile_photo' => $user->profile_photo,
                    'role' => $user->role ? [
                        'id' => $user->role->id,
                        'name' => $user->role->name,
                        'slug' => $user->role->slug,
                    ] : null,
                    'branch' => $user->branch ? [
                        'id' => $user->branch->id,
                        'code' => $user->branch->code,
                        'name' => $user->branch->name,
                    ] : null,
                    'permissions' => $user->getEffectivePermissions(),
                ],
                'token' => $token,
                'token_type' => 'Bearer',
            ],
        ]);
    }

    /**
     * Logout user (revoke token)
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully',
        ]);
    }

    /**
     * Refresh token
     */
    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();

        // Revoke current token
        $request->user()->currentAccessToken()->delete();

        // Create new token
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'data' => [
                'token' => $token,
                'token_type' => 'Bearer',
            ],
        ]);
    }

    /**
     * Get current user
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['role', 'branch']);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'employee_id' => $user->employee_id,
                'phone' => $user->phone,
                'profile_photo' => $user->profile_photo,
                'role' => [
                    'id' => $user->role->id,
                    'name' => $user->role->name,
                    'slug' => $user->role->slug,
                ],
                'branch' => [
                    'id' => $user->branch->id,
                    'code' => $user->branch->code,
                    'name' => $user->branch->name,
                ],
                'permissions' => $user->getEffectivePermissions(),
            ],
        ]);
    }

    /**
     * Verify passkey for restricted actions
     */
    public function verifyPasskey(Request $request): JsonResponse
    {
        $request->validate([
            'passkey' => 'required|string|size:6',
            'user_id' => 'nullable|exists:users,id',
        ]);

        // If user_id provided, verify that user's passkey (for manager approval)
        $userId = $request->user_id ?? $request->user()->id;
        $user = User::find($userId);

        if (!$user->passkey) {
            return response()->json([
                'success' => false,
                'message' => 'User does not have a passkey set.',
            ], 400);
        }

        if (!$user->verifyPasskey($request->passkey)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid passkey.',
            ], 401);
        }

        return response()->json([
            'success' => true,
            'message' => 'Passkey verified.',
            'data' => [
                'verified_by' => $user->id,
                'verified_at' => now()->toISOString(),
            ],
        ]);
    }

    /**
     * Change password
     */
    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->update([
            'password' => Hash::make($request->new_password),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully.',
        ]);
    }
}