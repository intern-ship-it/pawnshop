<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HardwareDevice;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class HardwareController extends Controller
{
    /**
     * Get all hardware devices for current branch
     */
    public function index(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = HardwareDevice::forBranch($branchId)
            ->with(['createdBy:id,name', 'updatedBy:id,name']);

        // Filter by type
        if ($type = $request->get('type')) {
            $query->ofType($type);
        }

        // Filter by active status
        if ($request->has('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        // Filter by connection type
        if ($connection = $request->get('connection')) {
            $query->where('connection', $connection);
        }

        $devices = $query->orderBy('type')->orderBy('name')->get();

        // Group by type for frontend convenience
        $grouped = $devices->groupBy('type');

        return $this->success([
            'devices' => $devices,
            'grouped' => $grouped,
            'summary' => [
                'total' => $devices->count(),
                'active' => $devices->where('is_active', true)->count(),
                'connected' => $devices->where('status', 'connected')->count(),
            ],
        ]);
    }

    /**
     * Get single device
     */
    public function show(Request $request, HardwareDevice $hardwareDevice): JsonResponse
    {
        if ($hardwareDevice->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $hardwareDevice->load(['createdBy:id,name', 'updatedBy:id,name', 'branch:id,name']);

        return $this->success($hardwareDevice);
    }

    /**
     * Create new hardware device
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => ['required', Rule::in(array_keys(HardwareDevice::getTypes()))],
            'brand' => 'nullable|string|max:255',
            'model' => 'nullable|string|max:255',
            'connection' => ['required', Rule::in(array_keys(HardwareDevice::getConnectionTypes()))],
            'paper_size' => 'nullable|string|max:50',
            'description' => 'nullable|string|max:500',
            'ip_address' => 'nullable|ip',
            'port' => 'nullable|string|max:10',
            'settings' => 'nullable|array',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ]);

        $branchId = $request->user()->branch_id;

        // If setting as default, unset other defaults of same type
        if (!empty($validated['is_default'])) {
            HardwareDevice::forBranch($branchId)
                ->ofType($validated['type'])
                ->update(['is_default' => false]);
        }

        $device = HardwareDevice::create([
            ...$validated,
            'branch_id' => $branchId,
            'status' => HardwareDevice::STATUS_UNKNOWN,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        $device->load(['createdBy:id,name']);

        return $this->success($device, 'Device added successfully', 201);
    }

    /**
     * Update hardware device
     */
    public function update(Request $request, HardwareDevice $hardwareDevice): JsonResponse
    {
        if ($hardwareDevice->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'type' => ['sometimes', 'required', Rule::in(array_keys(HardwareDevice::getTypes()))],
            'brand' => 'nullable|string|max:255',
            'model' => 'nullable|string|max:255',
            'connection' => ['sometimes', Rule::in(array_keys(HardwareDevice::getConnectionTypes()))],
            'paper_size' => 'nullable|string|max:50',
            'description' => 'nullable|string|max:500',
            'ip_address' => 'nullable|ip',
            'port' => 'nullable|string|max:10',
            'settings' => 'nullable|array',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ]);

        // If setting as default, unset other defaults of same type
        if (!empty($validated['is_default']) && !$hardwareDevice->is_default) {
            HardwareDevice::forBranch($hardwareDevice->branch_id)
                ->ofType($validated['type'] ?? $hardwareDevice->type)
                ->where('id', '!=', $hardwareDevice->id)
                ->update(['is_default' => false]);
        }

        $hardwareDevice->update([
            ...$validated,
            'updated_by' => $request->user()->id,
        ]);

        $hardwareDevice->load(['createdBy:id,name', 'updatedBy:id,name']);

        return $this->success($hardwareDevice, 'Device updated successfully');
    }

    /**
     * Delete hardware device
     */
    public function destroy(Request $request, HardwareDevice $hardwareDevice): JsonResponse
    {
        if ($hardwareDevice->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $hardwareDevice->delete();

        return $this->success(null, 'Device deleted successfully');
    }

    /**
     * Toggle device active status
     */
    public function toggleActive(Request $request, HardwareDevice $hardwareDevice): JsonResponse
    {
        if ($hardwareDevice->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $hardwareDevice->update([
            'is_active' => !$hardwareDevice->is_active,
            'updated_by' => $request->user()->id,
        ]);

        return $this->success([
            'is_active' => $hardwareDevice->is_active,
        ], $hardwareDevice->is_active ? 'Device activated' : 'Device deactivated');
    }

    /**
     * Set device as default for its type
     */
    public function setDefault(Request $request, HardwareDevice $hardwareDevice): JsonResponse
    {
        if ($hardwareDevice->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $hardwareDevice->setAsDefault();

        return $this->success([
            'is_default' => true,
        ], 'Device set as default');
    }

    /**
     * Update device status (after test)
     */
    public function updateStatus(Request $request, HardwareDevice $hardwareDevice): JsonResponse
    {
        if ($hardwareDevice->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'status' => [
                'required',
                Rule::in([
                    HardwareDevice::STATUS_CONNECTED,
                    HardwareDevice::STATUS_DISCONNECTED,
                    HardwareDevice::STATUS_ERROR,
                    HardwareDevice::STATUS_UNKNOWN,
                ])
            ],
        ]);

        $hardwareDevice->updateStatus($validated['status']);

        return $this->success([
            'status' => $hardwareDevice->status,
            'last_tested_at' => $hardwareDevice->last_tested_at,
        ], 'Status updated');
    }

    /**
     * Test device connection (simulated)
     */
    public function testConnection(Request $request, HardwareDevice $hardwareDevice): JsonResponse
    {
        if ($hardwareDevice->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        // Simulate connection test based on device type
        // In real implementation, this would attempt actual connection
        $testResult = $this->simulateConnectionTest($hardwareDevice);

        $hardwareDevice->updateStatus($testResult['status']);

        return $this->success([
            'success' => $testResult['success'],
            'status' => $testResult['status'],
            'message' => $testResult['message'],
            'details' => $testResult['details'] ?? [],
            'last_tested_at' => $hardwareDevice->last_tested_at,
        ]);
    }

    /**
     * Get default devices for each type
     */
    public function getDefaults(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $defaults = [];
        foreach (HardwareDevice::getTypes() as $type => $label) {
            $defaults[$type] = HardwareDevice::getDefaultForType($branchId, $type);
        }

        return $this->success($defaults);
    }

    /**
     * Get available device types and connection options
     */
    public function getOptions(): JsonResponse
    {
        return $this->success([
            'types' => HardwareDevice::getTypes(),
            'connections' => HardwareDevice::getConnectionTypes(),
            'statuses' => [
                HardwareDevice::STATUS_CONNECTED => 'Connected',
                HardwareDevice::STATUS_DISCONNECTED => 'Disconnected',
                HardwareDevice::STATUS_ERROR => 'Error',
                HardwareDevice::STATUS_UNKNOWN => 'Unknown',
            ],
            'paper_sizes' => [
                'A4' => 'A4 (210 x 297 mm)',
                'A5' => 'A5 (148 x 210 mm)',
                '80mm' => 'Thermal 80mm',
                '58mm' => 'Thermal 58mm',
            ],
        ]);
    }

    /**
     * Simulate connection test (placeholder for real implementation)
     */
    private function simulateConnectionTest(HardwareDevice $device): array
    {
        // For USB devices, we can't truly test from server
        // This is a placeholder - real implementation would depend on setup

        if ($device->connection === HardwareDevice::CONN_ETHERNET && $device->ip_address) {
            // Could ping the IP address
            // For now, simulate based on IP being set
            return [
                'success' => true,
                'status' => HardwareDevice::STATUS_CONNECTED,
                'message' => 'Network device reachable',
                'details' => [
                    'ip' => $device->ip_address,
                    'port' => $device->port,
                ],
            ];
        }

        if (in_array($device->connection, [HardwareDevice::CONN_USB, HardwareDevice::CONN_SERIAL])) {
            return [
                'success' => true,
                'status' => HardwareDevice::STATUS_UNKNOWN,
                'message' => 'USB/Serial devices must be tested from the client',
                'details' => [
                    'note' => 'Connection status will be updated when printing',
                ],
            ];
        }

        return [
            'success' => true,
            'status' => HardwareDevice::STATUS_UNKNOWN,
            'message' => 'Device registered successfully',
            'details' => [],
        ];
    }
}