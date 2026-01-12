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
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
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
            'name' => 'required|string|max:100',
            'margin_percentage' => 'required|numeric|min:0|max:100',
            'is_default' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $preset = MarginPreset::create($validated);

        return $this->success($preset, 'Margin preset created successfully', 201);
    }

    public function updateMarginPreset(Request $request, MarginPreset $marginPreset): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'margin_percentage' => 'sometimes|numeric|min:0|max:100',
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
            ->get();

        return $this->success($terms);
    }

    public function storeTermsCondition(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'activity_type' => 'required|in:pledge,renewal,redemption,general',
            'title' => 'required|string|max:255',
            'content_ms' => 'required|string',
            'content_en' => 'nullable|string',
            'print_with_receipt' => 'nullable|boolean',
            'require_consent' => 'nullable|boolean',
            'show_on_screen' => 'nullable|boolean',
            'attach_to_whatsapp' => 'nullable|boolean',
        ]);

        $validated['branch_id'] = $request->user()->branch_id;
        $validated['version'] = 1;

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
}
