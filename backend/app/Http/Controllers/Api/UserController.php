<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    /**
     * List all users
     */
    public function index(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = User::where('branch_id', $branchId)
            ->with(['role:id,name,slug']);

        // Search
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('employee_id', 'like', "%{$search}%");
            });
        }

        // Filter by role
        if ($roleId = $request->get('role_id')) {
            $query->where('role_id', $roleId);
        }

        // Filter by status
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $users = $query->orderBy('name')
            ->paginate($request->get('per_page', 15));

        return $this->paginated($users);
    }

    /**
     * Create user
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'employee_id' => 'required|string|max:20|unique:users,employee_id',
            'name' => 'required|string|max:100',
            'email' => 'required|email|max:100|unique:users,email',
            'phone' => 'nullable|string|max:20',
            'password' => 'required|string|min:8',
            'role_id' => 'required|exists:roles,id',
        ]);

        $branchId = $request->user()->branch_id;

        $user = User::create([
            'branch_id' => $branchId,
            'employee_id' => $validated['employee_id'],
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'password' => Hash::make($validated['password']),
            'role_id' => $validated['role_id'],
            'is_active' => true,
        ]);

        $user->load('role');

        return $this->success($user, 'User created successfully', 201);
    }

    /**
     * Get user details
     */
    public function show(Request $request, User $user): JsonResponse
    {
        if ($user->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $user->load(['role', 'branch']);

        return $this->success($user);
    }

    /**
     * Update user
     */
    public function update(Request $request, User $user): JsonResponse
    {
        if ($user->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'email' => 'sometimes|email|max:100|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|max:20',
            'password' => 'nullable|string|min:8',
            'role_id' => 'sometimes|exists:roles,id',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);
        $user->load('role');

        return $this->success($user, 'User updated successfully');
    }

    /**
     * Delete user
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        // Cannot delete self
        if ($user->id === $request->user()->id) {
            return $this->error('Cannot delete your own account', 422);
        }

        $user->delete();

        return $this->success(null, 'User deleted successfully');
    }

    /**
     * Update user passkey
     */
    public function updatePasskey(Request $request, User $user): JsonResponse
    {
        if ($user->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'passkey' => 'required|string|size:6',
        ]);

        $user->update([
            'passkey' => Hash::make($validated['passkey']),
        ]);

        return $this->success(null, 'Passkey updated successfully');
    }

    /**
     * Toggle user status
     */
    public function toggleStatus(Request $request, User $user): JsonResponse
    {
        if ($user->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        // Cannot deactivate self
        if ($user->id === $request->user()->id) {
            return $this->error('Cannot change your own status', 422);
        }

        $user->update([
            'is_active' => !$user->is_active,
        ]);

        $message = $user->is_active ? 'User activated' : 'User deactivated';

        return $this->success($user, $message);
    }
}
