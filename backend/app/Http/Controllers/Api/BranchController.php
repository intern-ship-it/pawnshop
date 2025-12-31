<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class BranchController extends Controller
{
    /**
     * List all branches
     */
    public function index(Request $request): JsonResponse
    {
        $query = Branch::query();

        // Only super admin can see all branches
        if (!$request->user()->isSuperAdmin()) {
            $query->where('id', $request->user()->branch_id);
        }

        // Filter by status
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $branches = $query->withCount('users')
            ->orderBy('name')
            ->get();

        return $this->success($branches);
    }

    /**
     * Create branch
     */
    public function store(Request $request): JsonResponse
    {
        // Only super admin can create branches
        if (!$request->user()->isSuperAdmin()) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'code' => 'required|string|max:10|unique:branches,code',
            'name' => 'required|string|max:100',
            'address' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:100',
            'license_no' => 'nullable|string|max:50',
            'license_expiry' => 'nullable|date',
            'is_headquarters' => 'nullable|boolean',
        ]);

        // If setting as HQ, remove HQ status from others
        if ($validated['is_headquarters'] ?? false) {
            Branch::where('is_headquarters', true)->update(['is_headquarters' => false]);
        }

        $branch = Branch::create($validated);

        return $this->success($branch, 'Branch created successfully', 201);
    }

    /**
     * Get branch details
     */
    public function show(Request $request, Branch $branch): JsonResponse
    {
        // Only super admin can view other branches
        if (!$request->user()->isSuperAdmin() && $branch->id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $branch->load(['users' => function ($q) {
            $q->select('id', 'branch_id', 'name', 'email', 'role_id', 'is_active')
                ->with('role:id,name');
        }]);

        return $this->success($branch);
    }

    /**
     * Update branch
     */
    public function update(Request $request, Branch $branch): JsonResponse
    {
        // Only super admin can update branches
        if (!$request->user()->isSuperAdmin()) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'address' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:100',
            'license_no' => 'nullable|string|max:50',
            'license_expiry' => 'nullable|date',
            'is_active' => 'sometimes|boolean',
            'is_headquarters' => 'sometimes|boolean',
            'settings' => 'nullable|array',
        ]);

        // If setting as HQ, remove HQ status from others
        if (($validated['is_headquarters'] ?? false) && !$branch->is_headquarters) {
            Branch::where('is_headquarters', true)->update(['is_headquarters' => false]);
        }

        $branch->update($validated);

        return $this->success($branch, 'Branch updated successfully');
    }

    /**
     * Delete branch
     */
    public function destroy(Request $request, Branch $branch): JsonResponse
    {
        // Only super admin can delete branches
        if (!$request->user()->isSuperAdmin()) {
            return $this->error('Unauthorized', 403);
        }

        // Cannot delete HQ
        if ($branch->is_headquarters) {
            return $this->error('Cannot delete headquarters branch', 422);
        }

        // Check if branch has users
        if ($branch->users()->exists()) {
            return $this->error('Cannot delete branch with users', 422);
        }

        // Check if branch has pledges
        if ($branch->pledges()->exists()) {
            return $this->error('Cannot delete branch with pledges', 422);
        }

        $branch->delete();

        return $this->success(null, 'Branch deleted successfully');
    }

    /**
     * Switch user's active branch (for multi-branch users)
     */
    public function switch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => 'required|exists:branches,id',
        ]);

        $user = $request->user();
        $branch = Branch::find($validated['branch_id']);

        // Only super admin can switch branches
        if (!$user->isSuperAdmin()) {
            return $this->error('Only super admin can switch branches', 403);
        }

        if (!$branch->is_active) {
            return $this->error('Cannot switch to inactive branch', 422);
        }

        // Update user's current branch
        $user->update(['branch_id' => $branch->id]);

        return $this->success([
            'branch' => $branch,
            'user' => $user->fresh(['branch', 'role']),
        ], 'Branch switched successfully');
    }

    /**
     * Get branch settings
     */
    public function settings(Request $request, Branch $branch): JsonResponse
    {
        if (!$request->user()->isSuperAdmin() && $branch->id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        return $this->success($branch->settings ?? []);
    }

    /**
     * Update branch settings
     */
    public function updateSettings(Request $request, Branch $branch): JsonResponse
    {
        if (!$request->user()->isSuperAdmin() && !$request->user()->isAdmin()) {
            return $this->error('Unauthorized', 403);
        }

        if ($branch->id !== $request->user()->branch_id && !$request->user()->isSuperAdmin()) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'settings' => 'required|array',
        ]);

        // Merge with existing settings
        $currentSettings = $branch->settings ?? [];
        $newSettings = array_merge($currentSettings, $validated['settings']);

        $branch->update(['settings' => $newSettings]);

        return $this->success($newSettings, 'Settings updated successfully');
    }

    /**
     * Get branch statistics
     */
    public function statistics(Request $request, Branch $branch): JsonResponse
    {
        if (!$request->user()->isSuperAdmin() && $branch->id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $stats = [
            'users' => $branch->users()->count(),
            'active_users' => $branch->users()->where('is_active', true)->count(),
            'customers' => $branch->customers()->count(),
            'active_pledges' => $branch->pledges()->where('status', 'active')->count(),
            'total_loan_amount' => $branch->pledges()->where('status', 'active')->sum('loan_amount'),
            'vaults' => $branch->vaults()->count(),
        ];

        return $this->success($stats);
    }
}
