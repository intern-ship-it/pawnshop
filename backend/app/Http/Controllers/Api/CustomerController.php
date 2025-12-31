<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Pledge;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

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
            ->with(['activePledges' => function ($query) {
                $query->select('id', 'customer_id', 'pledge_no', 'receipt_no', 'loan_amount', 'status', 'due_date')
                    ->with('items:id,pledge_id,category_id,net_weight,net_value');
            }])
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
            'ic_number' => 'required|string|max:20',
            'ic_type' => 'required|in:mykad,passport,other',
            'gender' => 'required|in:male,female',
            'date_of_birth' => 'nullable|date',
            'nationality' => 'nullable|string|max:50',
            'phone' => 'required|string|max:20',
            'phone_alt' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:100',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'postcode' => 'nullable|string|max:10',
            'notes' => 'nullable|string',
        ]);

        $branchId = $request->user()->branch_id;

        // Check if IC already exists in branch
        $exists = Customer::where('branch_id', $branchId)
            ->where('ic_number', $validated['ic_number'])
            ->exists();

        if ($exists) {
            return $this->error('Customer with this IC already exists.', 422);
        }

        // Calculate age if DOB provided
        if (!empty($validated['date_of_birth'])) {
            $validated['age'] = now()->diffInYears($validated['date_of_birth']);
        }

        $validated['branch_id'] = $branchId;
        $validated['customer_no'] = Customer::generateCustomerNo($branchId);
        $validated['created_by'] = $request->user()->id;

        $customer = Customer::create($validated);

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
        if ($customer->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'phone' => 'sometimes|string|max:20',
            'phone_alt' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:100',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'postcode' => 'nullable|string|max:10',
            'notes' => 'nullable|string',
        ]);

        $customer->update($validated);

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
     */
    public function activePledges(Request $request, Customer $customer): JsonResponse
    {
        if ($customer->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $pledges = $customer->pledges()
            ->where('status', 'active')
            ->with(['items.category', 'items.purity'])
            ->orderBy('due_date')
            ->get();

        return $this->success($pledges);
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
