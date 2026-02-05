<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Pledge;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class CustomerController extends Controller
{
    /**
     * List all customers
     */
    public function index(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = Customer::where('branch_id', $branchId);

        // Search
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('ic_number', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('customer_no', 'like', "%{$search}%");
            });
        }

        // Filter by status
        if ($request->has('blacklisted')) {
            $query->where('is_blacklisted', $request->boolean('blacklisted'));
        }

        $customers = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));

        return $this->paginated($customers);
    }

    /**
     * Search customers by IC
     */
    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'ic_number' => 'required|string|min:3',
        ]);

        $branchId = $request->user()->branch_id;
        $icNumber = $request->get('ic_number');

        $customer = Customer::where('branch_id', $branchId)
            ->where('ic_number', $icNumber)
            ->with([
                'activePledges' => function ($query) {
                    $query->select('id', 'customer_id', 'pledge_no', 'receipt_no', 'loan_amount', 'status', 'due_date')
                        ->with('items:id,pledge_id,category_id,net_weight,net_value');
                }
            ])
            ->first();

        if (!$customer) {
            return $this->success(null, 'Customer not found');
        }

        return $this->success([
            'customer' => $customer,
            'existing_pledges' => $customer->activePledges,
        ]);
    }

    /**
     * Create new customer
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'ic_number' => 'required|string|max:20|unique:customers,ic_number',
            'ic_type' => 'required|in:mykad,passport,other',
            'gender' => 'nullable|in:male,female',
            'date_of_birth' => 'nullable|date',
            'nationality' => 'nullable|string|max:50',
            'occupation' => 'nullable|string|max:100',
            'phone' => 'required|string|max:20',
            'country_code' => 'nullable|string|max:5',
            'whatsapp' => 'nullable|string|max:20',
            'phone_alt' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:100',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'postcode' => 'nullable|string|max:10',
            'notes' => 'nullable|string',
            // File validations
            'ic_front_photo' => 'nullable|image|mimes:jpeg,png,jpg|max:5120',
            'ic_back_photo' => 'nullable|image|mimes:jpeg,png,jpg|max:5120',
            'selfie_photo' => 'nullable|image|mimes:jpeg,png,jpg|max:5120',
        ]);

        $branchId = $request->user()->branch_id;
        $userId = $request->user()->id;

        // Generate customer number
        $customerNo = Customer::generateCustomerNo($branchId);

        // Calculate age from DOB
        $age = null;
        if (!empty($validated['date_of_birth'])) {
            $age = \Carbon\Carbon::parse($validated['date_of_birth'])->age;
        }

        // Handle file uploads
        $icFrontPath = null;
        $icBackPath = null;
        $selfiePath = null;

        if ($request->hasFile('ic_front_photo')) {
            $icFrontPath = $request->file('ic_front_photo')->store('customers/ic', 'public');
        }

        if ($request->hasFile('ic_back_photo')) {
            $icBackPath = $request->file('ic_back_photo')->store('customers/ic', 'public');
        }

        if ($request->hasFile('selfie_photo')) {
            $selfiePath = $request->file('selfie_photo')->store('customers/selfie', 'public');
        }

        $customer = Customer::create([
            'branch_id' => $branchId,
            'customer_no' => $customerNo,
            'name' => $validated['name'],
            'ic_number' => $validated['ic_number'],
            'ic_type' => $validated['ic_type'],
            'gender' => $validated['gender'] ?? null,
            'date_of_birth' => $validated['date_of_birth'] ?? null,
            'age' => $age,
            'nationality' => $validated['nationality'] ?? 'Malaysian',
            'occupation' => $validated['occupation'] ?? null,
            'phone' => $validated['phone'],
            'country_code' => $validated['country_code'] ?? '+60',
            'whatsapp' => $validated['whatsapp'] ?? null,
            'phone_alt' => $validated['phone_alt'] ?? null,
            'email' => $validated['email'] ?? null,
            'address_line1' => $validated['address_line1'] ?? null,
            'address_line2' => $validated['address_line2'] ?? null,
            'city' => $validated['city'] ?? null,
            'state' => $validated['state'] ?? null,
            'postcode' => $validated['postcode'] ?? null,
            'ic_front_photo' => $icFrontPath,
            'ic_back_photo' => $icBackPath,
            'selfie_photo' => $selfiePath,
            'notes' => $validated['notes'] ?? null,
            'created_by' => $userId,
        ]);

        // Audit log - customer created
        try {
            AuditLog::create([
                'branch_id' => $branchId,
                'user_id' => $userId,
                'action' => 'create',
                'module' => 'customer',
                'description' => "Created customer {$customer->customer_no} - {$customer->name}",
                'record_type' => 'Customer',
                'record_id' => $customer->id,
                'new_values' => [
                    'customer_no' => $customer->customer_no,
                    'name' => $customer->name,
                    'ic_number' => $customer->ic_number,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                'severity' => 'info',
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            Log::warning('Audit log failed: ' . $e->getMessage());
        }

        return $this->success($customer, 'Customer created successfully', 201);
    }

    /**
     * Get customer details
     */
    public function show(Request $request, Customer $customer): JsonResponse
    {
        // Check branch access
        if ($customer->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $customer->load(['createdBy:id,name']);

        return $this->success($customer);
    }

    /**
     * Update customer
     */
    public function update(Request $request, Customer $customer): JsonResponse
    {
        // Check branch access
        if ($customer->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'ic_number' => 'sometimes|string|max:20|unique:customers,ic_number,' . $customer->id,
            'ic_type' => 'sometimes|in:mykad,passport,other',
            'gender' => 'nullable|in:male,female',
            'date_of_birth' => 'nullable|date',
            'nationality' => 'nullable|string|max:50',
            'occupation' => 'nullable|string|max:100',
            'phone' => 'sometimes|string|max:20',
            'country_code' => 'nullable|string|max:5',
            'whatsapp' => 'nullable|string|max:20',
            'phone_alt' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:100',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'postcode' => 'nullable|string|max:10',
            'notes' => 'nullable|string',
            'ic_front_photo' => 'nullable|image|mimes:jpeg,png,jpg|max:5120',
            'ic_back_photo' => 'nullable|image|mimes:jpeg,png,jpg|max:5120',
            'selfie_photo' => 'nullable|image|mimes:jpeg,png,jpg|max:5120',
        ]);

        // Calculate age if DOB changed
        if (isset($validated['date_of_birth'])) {
            $validated['age'] = \Carbon\Carbon::parse($validated['date_of_birth'])->age;
        }

        // Handle file uploads
        if ($request->hasFile('ic_front_photo')) {
            // Delete old file if exists
            if ($customer->ic_front_photo) {
                \Storage::disk('public')->delete($customer->ic_front_photo);
            }
            $validated['ic_front_photo'] = $request->file('ic_front_photo')->store('customers/ic', 'public');
        }

        if ($request->hasFile('ic_back_photo')) {
            if ($customer->ic_back_photo) {
                \Storage::disk('public')->delete($customer->ic_back_photo);
            }
            $validated['ic_back_photo'] = $request->file('ic_back_photo')->store('customers/ic', 'public');
        }

        if ($request->hasFile('selfie_photo')) {
            if ($customer->selfie_photo) {
                \Storage::disk('public')->delete($customer->selfie_photo);
            }
            $validated['selfie_photo'] = $request->file('selfie_photo')->store('customers/selfie', 'public');
        }

        $oldValues = $customer->only(['name', 'phone', 'address_line1']);
        $customer->update($validated);

        // Audit log - customer updated
        try {
            AuditLog::create([
                'branch_id' => $request->user()->branch_id,
                'user_id' => $request->user()->id,
                'action' => 'update',
                'module' => 'customer',
                'description' => "Updated customer {$customer->customer_no} - {$customer->name}",
                'record_type' => 'Customer',
                'record_id' => $customer->id,
                'old_values' => $oldValues,
                'new_values' => $validated,
                'ip_address' => $request->ip(),
                'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                'severity' => 'info',
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            Log::warning('Audit log failed: ' . $e->getMessage());
        }

        return $this->success($customer, 'Customer updated successfully');
    }

    /**
     * Delete customer
     */
    public function destroy(Request $request, Customer $customer): JsonResponse
    {
        if ($customer->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        // Check if customer has pledges
        if ($customer->pledges()->exists()) {
            return $this->error('Cannot delete customer with existing pledges.', 422);
        }

        $customer->delete();

        return $this->success(null, 'Customer deleted successfully');
    }

    /**
     * Get customer pledges
     */
    public function pledges(Request $request, Customer $customer): JsonResponse
    {
        if ($customer->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $pledges = $customer->pledges()
            ->with(['items.category', 'items.purity'])
            ->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));

        return $this->paginated($pledges);
    }

    /**
     * Get customer active pledges
     * Issue 1 FIX: Include both 'active' and 'overdue' pledges
     */
    public function activePledges(Request $request, Customer $customer): JsonResponse
    {
        if ($customer->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $pledges = $customer->pledges()
            ->whereIn('status', ['active', 'overdue']) // FIX: Include overdue
            ->with(['items.category', 'items.purity'])
            ->orderBy('due_date')
            ->get();

        return $this->success($pledges);
    }


    /**
     * Get customer statistics
     * Issue 1 FIX: Count both 'active' and 'overdue' as active pledges
     */
    public function statistics(Request $request, Customer $customer): JsonResponse
    {
        if ($customer->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        // FIX: Count both active and overdue pledges as "active"
        $activePledgeCount = $customer->pledges()->whereIn('status', ['active', 'overdue'])->count();
        $activeLoanAmount = $customer->pledges()->whereIn('status', ['active', 'overdue'])->sum('loan_amount');

        $stats = [
            'total_pledges' => $customer->total_pledges ?? $customer->pledges()->count(),
            'active_pledges' => $activePledgeCount,
            'total_loan_amount' => $activeLoanAmount,
            'total_renewals' => $customer->pledges()->withCount('renewals')->get()->sum('renewals_count'),
            'total_redemptions' => $customer->pledges()->where('status', 'redeemed')->count(),
            'overdue_pledges' => $customer->pledges()->where('status', 'overdue')->count(),
            // Add is_active for frontend convenience
            'is_active' => $activePledgeCount > 0,
        ];

        return $this->success($stats);
    }

    /**
     * Blacklist customer
     */
    public function blacklist(Request $request, Customer $customer): JsonResponse
    {
        if ($customer->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'is_blacklisted' => 'required|boolean',
            'reason' => 'required_if:is_blacklisted,true|nullable|string',
        ]);

        $customer->update([
            'is_blacklisted' => $validated['is_blacklisted'],
            'blacklist_reason' => $validated['reason'] ?? null,
        ]);

        $message = $validated['is_blacklisted']
            ? 'Customer has been blacklisted'
            : 'Customer has been removed from blacklist';

        return $this->success($customer, $message);
    }
}