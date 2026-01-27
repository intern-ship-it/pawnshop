<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\GoldPrice;
use App\Models\Category;
use App\Models\Purity;
use App\Models\Bank;
use App\Models\StoneDeduction;
use App\Models\InterestRate;
use App\Models\TermsCondition;
use App\Models\MarginPreset;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class SettingsController extends Controller
{
    /**
     * Get public company information (for login/public pages)
     * No authentication required
     */
    public function publicCompanyInfo(): JsonResponse
    {
        // Get company settings (not branch-specific, just global)
        $companySettings = Setting::where('category', 'company')
            ->whereNull('branch_id')
            ->get()
            ->pluck('value', 'key_name');

        return response()->json([
            'success' => true,
            'data' => [
                'company' => [
                    'name' => $companySettings['name'] ?? 'PawnSys',
                    'license_number' => $companySettings['registration_no'] ?? '',
                    'address' => $companySettings['address'] ?? '',
                    'phone' => $companySettings['phone'] ?? '',
                    'email' => $companySettings['email'] ?? '',
                ],
            ],
        ]);
    }

    /**
     * Get all settings
     */
    public function index(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $settings = Setting::where(function ($q) use ($branchId) {
            $q->where('branch_id', $branchId)->orWhereNull('branch_id');
        })
            ->get()
            ->groupBy('category');

        return $this->success($settings);
    }

    /**
     * Get settings by category
     */
    public function category(Request $request, string $category): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $settings = Setting::where('category', $category)
            ->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->orWhereNull('branch_id');
            })
            ->get();

        return $this->success($settings);
    }

    /**
     * Update settings
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*.category' => 'required|string',
            'settings.*.key_name' => 'required|string',
            'settings.*.value' => 'nullable',
        ]);

        $branchId = $request->user()->branch_id;
        $userId = $request->user()->id;

        foreach ($validated['settings'] as $setting) {
            Setting::updateOrCreate(
                [
                    'branch_id' => $branchId,
                    'category' => $setting['category'],
                    'key_name' => $setting['key_name'],
                ],
                [
                    'value' => $setting['value'],
                    'updated_by' => $userId,
                ]
            );
        }

        // Audit log - settings updated
        try {
            $settingKeys = array_column($validated['settings'], 'key_name');
            AuditLog::create([
                'branch_id' => $branchId,
                'user_id' => $userId,
                'action' => 'update',
                'module' => 'settings',
                'description' => 'Updated settings: ' . implode(', ', array_slice($settingKeys, 0, 5)) . (count($settingKeys) > 5 ? '...' : ''),
                'record_type' => 'Setting',
                'record_id' => null,
                'new_values' => $validated['settings'],
                'ip_address' => $request->ip(),
                'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                'severity' => 'info',
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            Log::warning('Audit log failed: ' . $e->getMessage());
        }

        return $this->success(null, 'Settings updated successfully');
    }

    /**
     * Get gold price history
     */
    public function goldPriceHistory(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $days = $request->get('days', 30);

        $prices = GoldPrice::where(function ($q) use ($branchId) {
            $q->where('branch_id', $branchId)->orWhereNull('branch_id');
        })
            ->where('price_date', '>=', Carbon::today()->subDays($days))
            ->orderBy('price_date', 'desc')
            ->get();

        return $this->success($prices);
    }

    /**
     * Update gold prices
     */
    public function updateGoldPrices(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'price_date' => 'required|date',
            'price_999' => 'required|numeric|min:0',
            'price_916' => 'required|numeric|min:0',
            'price_875' => 'required|numeric|min:0',
            'price_750' => 'required|numeric|min:0',
            'price_585' => 'nullable|numeric|min:0',
            'price_375' => 'nullable|numeric|min:0',
        ]);

        $branchId = $request->user()->branch_id;

        $goldPrice = GoldPrice::updateOrCreate(
            [
                'branch_id' => $branchId,
                'price_date' => $validated['price_date'],
            ],
            [
                'price_999' => $validated['price_999'],
                'price_916' => $validated['price_916'],
                'price_875' => $validated['price_875'],
                'price_750' => $validated['price_750'],
                'price_585' => $validated['price_585'] ?? null,
                'price_375' => $validated['price_375'] ?? null,
                'source' => 'manual',
                'created_by' => $request->user()->id,
            ]
        );

        // Audit log - gold prices updated
        try {
            AuditLog::create([
                'branch_id' => $branchId,
                'user_id' => $request->user()->id,
                'action' => 'update',
                'module' => 'settings',
                'description' => "Updated gold prices - 999: RM{$validated['price_999']}, 916: RM{$validated['price_916']}",
                'record_type' => 'GoldPrice',
                'record_id' => $goldPrice->id,
                'new_values' => $validated,
                'ip_address' => $request->ip(),
                'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                'severity' => 'info',
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            Log::warning('Audit log failed: ' . $e->getMessage());
        }

        return $this->success($goldPrice, 'Gold prices updated successfully');
    }

    // ===================
    // CATEGORIES
    // ===================

    public function categories(): JsonResponse
    {
        $categories = Category::orderBy('sort_order')->get();
        return $this->success($categories);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:20|unique:categories,code',
            'name_en' => 'required|string|max:100',
            'name_ms' => 'required|string|max:100',
            'sort_order' => 'nullable|integer',
        ]);

        $category = Category::create($validated);

        return $this->success($category, 'Category created successfully', 201);
    }

    public function updateCategory(Request $request, Category $category): JsonResponse
    {
        $validated = $request->validate([
            'name_en' => 'sometimes|string|max:100',
            'name_ms' => 'sometimes|string|max:100',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $category->update($validated);

        return $this->success($category, 'Category updated successfully');
    }

    public function deleteCategory(Category $category): JsonResponse
    {
        if ($category->pledgeItems()->exists()) {
            return $this->error('Cannot delete category with existing items', 422);
        }

        $category->delete();

        return $this->success(null, 'Category deleted successfully');
    }

    // ===================
    // PURITIES
    // ===================

    public function purities(): JsonResponse
    {
        $purities = Purity::orderBy('sort_order')->get();
        return $this->success($purities);
    }

    public function storePurity(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:10|unique:purities,code',
            'name' => 'required|string|max:50',
            'percentage' => 'required|numeric|min:0|max:100',
            'sort_order' => 'nullable|integer',
        ]);

        $purity = Purity::create($validated);

        return $this->success($purity, 'Purity created successfully', 201);
    }

    public function updatePurity(Request $request, Purity $purity): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:50',
            'percentage' => 'sometimes|numeric|min:0|max:100',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $purity->update($validated);

        return $this->success($purity, 'Purity updated successfully');
    }

    public function deletePurity(Purity $purity): JsonResponse
    {
        if ($purity->pledgeItems()->exists()) {
            return $this->error('Cannot delete purity with existing items', 422);
        }

        $purity->delete();

        return $this->success(null, 'Purity deleted successfully');
    }

    // ===================
    // BANKS
    // ===================

    public function banks(): JsonResponse
    {
        $banks = Bank::orderBy('sort_order')->get();
        return $this->success($banks);
    }

    public function storeBank(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:20|unique:banks,code',
            'name' => 'required|string|max:100',
            'swift_code' => 'nullable|string|max:20',
            'sort_order' => 'nullable|integer',
        ]);

        $bank = Bank::create($validated);

        return $this->success($bank, 'Bank created successfully', 201);
    }

    public function updateBank(Request $request, Bank $bank): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'swift_code' => 'nullable|string|max:20',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $bank->update($validated);

        return $this->success($bank, 'Bank updated successfully');
    }

    public function deleteBank(Bank $bank): JsonResponse
    {
        $bank->delete();

        return $this->success(null, 'Bank deleted successfully');
    }

    // ===================
    // STONE DEDUCTIONS
    // ===================

    public function stoneDeductions(): JsonResponse
    {
        $deductions = StoneDeduction::orderBy('sort_order')->get();
        return $this->success($deductions);
    }

    public function storeStoneDeduction(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'deduction_type' => 'required|in:percentage,amount,grams',
            'value' => 'required|numeric|min:0',
            'is_default' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $deduction = StoneDeduction::create($validated);

        return $this->success($deduction, 'Stone deduction created successfully', 201);
    }

    public function updateStoneDeduction(Request $request, StoneDeduction $stoneDeduction): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'deduction_type' => 'sometimes|in:percentage,amount,grams',
            'value' => 'sometimes|numeric|min:0',
            'is_default' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $stoneDeduction->update($validated);

        return $this->success($stoneDeduction, 'Stone deduction updated successfully');
    }

    public function deleteStoneDeduction(StoneDeduction $stoneDeduction): JsonResponse
    {
        $stoneDeduction->delete();

        return $this->success(null, 'Stone deduction deleted successfully');
    }

    // ===================
    // MARGIN PRESETS
    // ===================

    public function marginPresets(): JsonResponse
    {
        $presets = MarginPreset::orderBy('sort_order')->get();
        return $this->success($presets);
    }

    public function storeMarginPreset(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'value' => 'required|integer|min:1|max:100',
            'label' => 'nullable|string|max:50',
            'is_default' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        // Auto-generate label if not provided
        $validated['label'] = $validated['label'] ?? ($validated['value'] . '%');

        $preset = MarginPreset::create($validated);

        return $this->success($preset, 'Margin preset created successfully', 201);
    }

    public function updateMarginPreset(Request $request, MarginPreset $marginPreset): JsonResponse
    {
        $validated = $request->validate([
            'value' => 'sometimes|integer|min:1|max:100',
            'label' => 'sometimes|string|max:50',
            'is_default' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $marginPreset->update($validated);

        return $this->success($marginPreset, 'Margin preset updated successfully');
    }

    public function deleteMarginPreset(MarginPreset $marginPreset): JsonResponse
    {
        $marginPreset->delete();

        return $this->success(null, 'Margin preset deleted successfully');
    }

    // ===================
    // INTEREST RATES
    // ===================

    public function interestRates(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $rates = InterestRate::where(function ($q) use ($branchId) {
            $q->where('branch_id', $branchId)->orWhereNull('branch_id');
        })
            ->orderBy('rate_type')
            ->orderBy('from_month')
            ->get();

        return $this->success($rates);
    }

    public function storeInterestRate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rate_type' => 'required|in:standard,extended,overdue',
            'rate_percentage' => 'required|numeric|min:0|max:100',
            'from_month' => 'nullable|integer|min:1',
            'to_month' => 'nullable|integer',
            'description' => 'nullable|string|max:255',
        ]);

        $validated['branch_id'] = $request->user()->branch_id;

        $rate = InterestRate::create($validated);

        return $this->success($rate, 'Interest rate created successfully', 201);
    }

    public function updateInterestRate(Request $request, InterestRate $interestRate): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        if ($interestRate->branch_id && $interestRate->branch_id !== $branchId) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'rate_percentage' => 'sometimes|numeric|min:0|max:100',
            'from_month' => 'nullable|integer|min:1',
            'to_month' => 'nullable|integer',
            'description' => 'nullable|string|max:255',
            'is_active' => 'sometimes|boolean',
        ]);

        // If updating global rate, create branch-specific copy
        if (!$interestRate->branch_id) {
            $interestRate = InterestRate::create(array_merge(
                $interestRate->toArray(),
                $validated,
                ['branch_id' => $branchId]
            ));
        } else {
            $interestRate->update($validated);
        }

        return $this->success($interestRate, 'Interest rate updated successfully');
    }

    public function deleteInterestRate(InterestRate $interestRate): JsonResponse
    {
        $branchId = request()->user()->branch_id;

        if ($interestRate->branch_id !== $branchId) {
            return $this->error('Unauthorized', 403);
        }

        $interestRate->delete();

        return $this->success(null, 'Interest rate deleted successfully');
    }

    // ===================
    // TERMS & CONDITIONS
    // ===================

    public function termsConditions(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $terms = TermsCondition::where(function ($q) use ($branchId) {
            $q->where('branch_id', $branchId)->orWhereNull('branch_id');
        })
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return $this->success($terms);
    }

    public function storeTermsCondition(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'activity_type' => 'required|in:pledge,renewal,redemption,auction,forfeit',
            'title' => 'required|string|max:255',
            'content_ms' => 'required|string',
            'content_en' => 'nullable|string',
            'print_with_receipt' => 'nullable|boolean',
            'require_consent' => 'nullable|boolean',
            'show_on_screen' => 'nullable|boolean',
            'attach_to_whatsapp' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $validated['branch_id'] = $request->user()->branch_id;
        $validated['version'] = 1;

        // Auto-assign sort_order if not provided
        if (!isset($validated['sort_order'])) {
            $maxOrder = TermsCondition::where('branch_id', $validated['branch_id'])
                ->where('activity_type', $validated['activity_type'])
                ->max('sort_order') ?? 0;
            $validated['sort_order'] = $maxOrder + 1;
        }

        $terms = TermsCondition::create($validated);

        return $this->success($terms, 'Terms and conditions created successfully', 201);
    }

    public function updateTermsCondition(Request $request, TermsCondition $termsCondition): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        if ($termsCondition->branch_id && $termsCondition->branch_id !== $branchId) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'content_ms' => 'sometimes|string',
            'content_en' => 'nullable|string',
            'print_with_receipt' => 'sometimes|boolean',
            'require_consent' => 'sometimes|boolean',
            'show_on_screen' => 'sometimes|boolean',
            'attach_to_whatsapp' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        // If updating global T&C, create branch-specific copy
        if (!$termsCondition->branch_id) {
            $termsCondition = TermsCondition::create(array_merge(
                $termsCondition->toArray(),
                $validated,
                ['branch_id' => $branchId, 'version' => 1]
            ));
        } else {
            $validated['version'] = $termsCondition->version + 1;
            $termsCondition->update($validated);
        }

        return $this->success($termsCondition, 'Terms and conditions updated successfully');
    }

    public function deleteTermsCondition(TermsCondition $termsCondition): JsonResponse
    {
        $branchId = request()->user()->branch_id;

        if ($termsCondition->branch_id !== $branchId) {
            return $this->error('Unauthorized', 403);
        }

        $termsCondition->delete();

        return $this->success(null, 'Terms and conditions deleted successfully');
    }

    /**
     * Update terms and conditions order
     */
    public function updateTermsOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'terms' => 'required|array',
            'terms.*.id' => 'required|integer|exists:terms_conditions,id',
            'terms.*.sort_order' => 'required|integer|min:0',
        ]);

        $branchId = $request->user()->branch_id;

        try {
            foreach ($validated['terms'] as $item) {
                TermsCondition::where('id', $item['id'])
                    ->where(function ($q) use ($branchId) {
                        $q->where('branch_id', $branchId)
                            ->orWhereNull('branch_id');
                    })
                    ->update(['sort_order' => $item['sort_order']]);
            }

            return $this->success(null, 'Terms order updated successfully');
        } catch (\Exception $e) {
            return $this->error('Failed to update order: ' . $e->getMessage(), 500);
        }
    }



    /**
     * Upload company logo
     */
    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate([
            'logo' => 'required|image|mimes:png,jpg,jpeg,svg|max:2048',
        ]);

        try {
            $file = $request->file('logo');
            $filename = 'company_logo_' . time() . '.' . $file->getClientOriginalExtension();

            // Store in public storage
            $path = $file->storeAs('logos', $filename, 'public');

            // Save path to settings table
            $branchId = $request->user()->branch_id;

            Setting::updateOrCreate(
                ['branch_id' => $branchId, 'category' => 'company', 'key_name' => 'logo'],
                ['value' => '/storage/' . $path]
            );

            return $this->success([
                'logo_url' => asset('storage/' . $path),
                'path' => '/storage/' . $path,
            ], 'Logo uploaded successfully');

        } catch (\Exception $e) {
            return $this->error('Failed to upload logo: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get company logo
     */
    public function getLogo(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id ?? null;

        $setting = Setting::where('category', 'company')
            ->where('key_name', 'logo')
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->first();

        // Return the logo-image endpoint URL dynamically based on current environment
        $logoUrl = $setting ? url('/api/settings/logo-image') : null;

        return $this->success([
            'logo_url' => $logoUrl,
            'path' => $setting?->value,
        ]);
    }

    /**
     * Delete company logo
     */
    public function deleteLogo(Request $request): JsonResponse
    {
        try {
            $branchId = $request->user()->branch_id;

            // Find the logo setting
            $setting = Setting::where('category', 'company')
                ->where('key_name', 'logo')
                ->where('branch_id', $branchId)
                ->first();

            if ($setting && $setting->value) {
                // Delete the file from storage
                $storagePath = str_replace('/storage/', '', $setting->value);
                $fullPath = storage_path('app/public/' . $storagePath);

                if (file_exists($fullPath)) {
                    unlink($fullPath);
                }

                // Delete the setting from database
                $setting->delete();
            }

            return $this->success(null, 'Logo removed successfully');

        } catch (\Exception $e) {
            return $this->error('Failed to delete logo: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Serve the logo image file directly with CORS headers
     */
    public function serveLogoImage(Request $request)
    {
        $branchId = $request->user()->branch_id ?? null;

        $setting = Setting::where('category', 'company')
            ->where('key_name', 'logo')
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->first();

        if (!$setting || !$setting->value) {
            return response()->json(['error' => 'Logo not found'], 404);
        }

        // The value is stored as /storage/logos/filename.jpg
        // Convert to actual storage path: logos/filename.jpg
        $storagePath = str_replace('/storage/', '', $setting->value);
        $fullPath = storage_path('app/public/' . $storagePath);

        if (!file_exists($fullPath)) {
            return response()->json(['error' => 'Logo file not found'], 404);
        }

        $mimeType = mime_content_type($fullPath);
        $contents = file_get_contents($fullPath);

        return response($contents, 200)
            ->header('Content-Type', $mimeType)
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            ->header('Access-Control-Allow-Headers', '*')
            ->header('Cache-Control', 'public, max-age=3600');
    }

    /**
     * Serve the logo image file publicly (no auth required) with CORS headers
     */
    public function serveLogoImagePublic(Request $request)
    {
        // Get any logo - prioritize global (null branch_id), then any branch
        $setting = Setting::where('category', 'company')
            ->where('key_name', 'logo')
            ->whereNotNull('value')
            ->orderByRaw('branch_id IS NULL DESC') // Global first
            ->first();

        if (!$setting || !$setting->value) {
            return response()->json(['error' => 'Logo not found'], 404);
        }

        // The value is stored as /storage/logos/filename.jpg
        // Convert to actual storage path: logos/filename.jpg
        $storagePath = str_replace('/storage/', '', $setting->value);
        $fullPath = storage_path('app/public/' . $storagePath);

        if (!file_exists($fullPath)) {
            return response()->json(['error' => 'Logo file not found'], 404);
        }

        $mimeType = mime_content_type($fullPath);
        $contents = file_get_contents($fullPath);

        return response($contents, 200)
            ->header('Content-Type', $mimeType)
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            ->header('Access-Control-Allow-Headers', '*')
            ->header('Cache-Control', 'public, max-age=3600');
    }
}
