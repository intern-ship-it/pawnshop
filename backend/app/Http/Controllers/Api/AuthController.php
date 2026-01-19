<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;

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
            $identifier = $request->username;

            // Check if the username field contains an email address
            if (filter_var($identifier, FILTER_VALIDATE_EMAIL)) {
                // It's an email - search by email column
                $user = User::where('email', $identifier)->first();
            } else {
                // It's a username - search by username column
                $user = User::where('username', $identifier)->first();
            }
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

        // Log successful login
        try {
            AuditLog::create([
                'branch_id' => $user->branch_id,
                'user_id' => $user->id,
                'action' => 'login',
                'module' => 'auth',
                'description' => "User {$user->name} logged in",
                'record_type' => 'User',
                'record_id' => $user->id,
                'metadata' => [
                    'browser' => $this->parseBrowser($request->userAgent()),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                'severity' => 'info',
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            // Silently fail - don't block login if audit logging fails
        }

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
                    'profile_photo' => $user->profile_photo ? asset('storage/' . $user->profile_photo) : null,
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
        $user = $request->user();

        // Log logout before revoking token
        try {
            AuditLog::create([
                'branch_id' => $user->branch_id,
                'user_id' => $user->id,
                'action' => 'logout',
                'module' => 'auth',
                'description' => "User {$user->name} logged out",
                'record_type' => 'User',
                'record_id' => $user->id,
                'ip_address' => $request->ip(),
                'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                'severity' => 'info',
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            // Silently fail
        }

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
                'profile_photo' => $user->profile_photo ? asset('storage/' . $user->profile_photo) : null,
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

    /**
     * Update user profile
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'phone' => 'sometimes|string|max:20|nullable',
            'profile_photo' => 'sometimes|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        // Handle profile photo upload
        if ($request->hasFile('profile_photo')) {
            // Delete old photo if exists
            if ($user->profile_photo && \Storage::disk('public')->exists($user->profile_photo)) {
                \Storage::disk('public')->delete($user->profile_photo);
            }

            // Store new photo
            $path = $request->file('profile_photo')->store('profile-photos', 'public');
            $validated['profile_photo'] = $path;
        }

        // Update user
        $user->update($validated);

        // Reload user with relationships
        $user->load('role', 'branch');

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'username' => $user->username,
                    'employee_id' => $user->employee_id,
                    'phone' => $user->phone,
                    'profile_photo' => $user->profile_photo ? asset('storage/' . $user->profile_photo) : null,
                    'role' => $user->role ? [
                        'id' => $user->role->id,
                        'name' => $user->role->name,
                        'slug' => $user->role->slug,
                    ] : null,
                    'branch' => $user->branch ? [
                        'id' => $user->branch->id,
                        'name' => $user->branch->name,
                        'code' => $user->branch->code,
                    ] : null,
                    'last_login_at' => $user->last_login_at,
                    'created_at' => $user->created_at,
                ],
            ],
        ]);
    }

    /**
     * Request password reset (forgot password)
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        // Check if user exists
        $user = User::where('email', $request->email)->first();

        // Always return success to prevent email enumeration
        // But only create token if user exists
        if ($user) {
            // Delete any existing tokens for this email
            DB::table('password_reset_tokens')
                ->where('email', $request->email)
                ->delete();

            // Generate a random token
            $token = Str::random(64);

            // Store the token
            DB::table('password_reset_tokens')->insert([
                'email' => $request->email,
                'token' => Hash::make($token),
                'created_at' => Carbon::now(),
            ]);

            // TODO: Send email with reset link
            // For now, we'll return the token in development
            // In production, this should be sent via email only

            // Mail::to($user->email)->send(new ResetPasswordMail($token, $user));
        }

        return response()->json([
            'success' => true,
            'message' => 'If an account exists with this email, you will receive a password reset link shortly.',
            // Remove this in production - only for development/testing
            'token' => $user ? $token : null,
        ]);
    }

    /**
     * Verify reset token
     */
    public function verifyResetToken(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string',
        ]);

        // Find all password reset records (we need to check hashed tokens)
        $resetRecords = DB::table('password_reset_tokens')->get();

        $validRecord = null;
        foreach ($resetRecords as $record) {
            if (Hash::check($request->token, $record->token)) {
                $validRecord = $record;
                break;
            }
        }

        if (!$validRecord) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid reset token.',
            ], 400);
        }

        // Check if token is expired (60 minutes)
        $createdAt = Carbon::parse($validRecord->created_at);
        if ($createdAt->addMinutes(60)->isPast()) {
            // Delete expired token
            DB::table('password_reset_tokens')
                ->where('email', $validRecord->email)
                ->delete();

            return response()->json([
                'success' => false,
                'message' => 'Reset token has expired. Please request a new one.',
            ], 400);
        }

        return response()->json([
            'success' => true,
            'message' => 'Token is valid.',
            'data' => [
                'email' => $validRecord->email,
            ],
        ]);
    }

    /**
     * Reset password with token
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        // Find all password reset records (we need to check hashed tokens)
        $resetRecords = DB::table('password_reset_tokens')->get();

        $validRecord = null;
        foreach ($resetRecords as $record) {
            if (Hash::check($request->token, $record->token)) {
                $validRecord = $record;
                break;
            }
        }

        if (!$validRecord) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid reset token.',
            ], 400);
        }

        // Check if token is expired (60 minutes)
        $createdAt = Carbon::parse($validRecord->created_at);
        if ($createdAt->addMinutes(60)->isPast()) {
            // Delete expired token
            DB::table('password_reset_tokens')
                ->where('email', $validRecord->email)
                ->delete();

            return response()->json([
                'success' => false,
                'message' => 'Reset token has expired. Please request a new one.',
            ], 400);
        }

        // Find user and update password
        $user = User::where('email', $validRecord->email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
            ], 404);
        }

        // Update password
        $user->update([
            'password' => Hash::make($request->password),
        ]);

        // Delete the used token
        DB::table('password_reset_tokens')
            ->where('email', $validRecord->email)
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'Password has been reset successfully. You can now login with your new password.',
        ]);
    }

    /**
     * Parse browser name from user agent
     */
    private function parseBrowser(?string $ua): string
    {
        if (!$ua)
            return 'Unknown';
        if (str_contains($ua, 'Chrome'))
            return 'Chrome';
        if (str_contains($ua, 'Firefox'))
            return 'Firefox';
        if (str_contains($ua, 'Safari'))
            return 'Safari';
        if (str_contains($ua, 'Edge'))
            return 'Edge';
        return 'Other';
    }
}