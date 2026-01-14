<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\PledgeController;
use App\Http\Controllers\Api\RenewalController;
use App\Http\Controllers\Api\RedemptionController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\StorageController;
use App\Http\Controllers\Api\ReconciliationController;
use App\Http\Controllers\Api\AuctionController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\DayEndController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\WhatsAppController;
use App\Http\Controllers\Api\PrintController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\GoldPriceController;
/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public routes
Route::get('/settings/public/company', [SettingsController::class, 'publicCompanyInfo']);
Route::get('/settings/logo-image', [SettingsController::class, 'serveLogoImagePublic']); // Public logo image endpoint
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/auth/verify-reset-token', [AuthController::class, 'verifyResetToken']);
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);


// Protected routes
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/refresh', [AuthController::class, 'refresh']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/verify-passkey', [AuthController::class, 'verifyPasskey']);
        Route::put('/change-password', [AuthController::class, 'changePassword']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
    });

    // Dashboard
    Route::prefix('dashboard')->group(function () {
        Route::get('/summary', [DashboardController::class, 'summary']);
        Route::get('/today-stats', [DashboardController::class, 'todayStats']);
        Route::get('/payment-split', [DashboardController::class, 'paymentSplit']);
        Route::get('/due-reminders', [DashboardController::class, 'dueReminders']);
        Route::get('/overdue-pledges', [DashboardController::class, 'overduePledges']);
        Route::get('/gold-prices', [DashboardController::class, 'goldPrices']);
    });

    // Gold Prices (MetalPriceAPI - Live Prices)
    Route::prefix('gold-prices')->group(function () {
        Route::get('/current', [GoldPriceController::class, 'current']);
        Route::get('/carat', [GoldPriceController::class, 'carat']);
        Route::get('/dashboard', [GoldPriceController::class, 'dashboard']);
        Route::get('/historical/{date}', [GoldPriceController::class, 'historical']);
        Route::get('/history', [GoldPriceController::class, 'history']);
        Route::post('/calculate', [GoldPriceController::class, 'calculate']);
        Route::post('/refresh', [GoldPriceController::class, 'refresh']);
        Route::post('/manual', [GoldPriceController::class, 'setManual']);
        Route::get('/usage', [GoldPriceController::class, 'usage']);
    });

    // Branches
    Route::prefix('branches')->group(function () {
        Route::post('/switch', [BranchController::class, 'switch']);
        Route::get('/{branch}/settings', [BranchController::class, 'settings']);
        Route::put('/{branch}/settings', [BranchController::class, 'updateSettings']);
        Route::get('/{branch}/statistics', [BranchController::class, 'statistics']);
    });
    Route::apiResource('branches', BranchController::class);

    // Customers
    Route::prefix('customers')->group(function () {
        Route::get('/search', [CustomerController::class, 'search']);
        Route::get('/{customer}/pledges', [CustomerController::class, 'pledges']);
        Route::get('/{customer}/active-pledges', [CustomerController::class, 'activePledges']);
        Route::post('/{customer}/blacklist', [CustomerController::class, 'blacklist']);
        Route::get('/{customer}/statistics', [CustomerController::class, 'statistics']);
    });
    Route::apiResource('customers', CustomerController::class);

    // Pledges
    Route::prefix('pledges')->group(function () {
        Route::get('/by-receipt/{receiptNo}', [PledgeController::class, 'byReceipt']);
        Route::get('/{pledge}/items', [PledgeController::class, 'items']);
        Route::get('/{pledge}/interest-breakdown', [PledgeController::class, 'interestBreakdown']);
        Route::post('/{pledge}/assign-storage', [PledgeController::class, 'assignStorage']);
        Route::post('/{pledge}/print-receipt', [PledgeController::class, 'printReceipt']);
        Route::post('/{pledge}/print-barcode', [PledgeController::class, 'printBarcode']);
        Route::post('/{pledge}/send-whatsapp', [PledgeController::class, 'sendWhatsApp']);
        Route::get('/calculate', [PledgeController::class, 'calculate']);
        Route::post('/{pledge}/cancel', [PledgeController::class, 'cancel']);
    });
    Route::apiResource('pledges', PledgeController::class);

    // Renewals
    Route::prefix('renewals')->group(function () {
        Route::get('/today', [RenewalController::class, 'today']);
        Route::get('/due-list', [RenewalController::class, 'dueList']);
        Route::get('/calculate', [RenewalController::class, 'calculate']);
        Route::post('/{renewal}/print-receipt', [RenewalController::class, 'printReceipt']);
    });
    Route::apiResource('renewals', RenewalController::class);

    // Redemptions
    Route::prefix('redemptions')->group(function () {
        Route::get('/calculate', [RedemptionController::class, 'calculate']);
        Route::post('/{redemption}/release-items', [RedemptionController::class, 'releaseItems']);
        Route::post('/{redemption}/print-receipt', [RedemptionController::class, 'printReceipt']);
    });
    Route::apiResource('redemptions', RedemptionController::class);

    // Inventory
    Route::prefix('inventory')->group(function () {
        Route::get('/by-location', [InventoryController::class, 'byLocation']);
        Route::get('/search', [InventoryController::class, 'search']);
        Route::get('/summary', [InventoryController::class, 'summary']);
        Route::put('/{pledgeItem}/location', [InventoryController::class, 'updateLocation']);
        Route::get('/{pledgeItem}/history', [InventoryController::class, 'locationHistory']);
        Route::post('/bulk-update-location', [InventoryController::class, 'bulkUpdateLocation']);
    });
    Route::apiResource('inventory', InventoryController::class)->only(['index', 'show']);

    // Storage (Vaults, Boxes, Slots)
    Route::prefix('storage')->group(function () {
        Route::get('/vaults', [StorageController::class, 'vaults']);
        Route::post('/vaults', [StorageController::class, 'createVault']);
        Route::put('/vaults/{vault}', [StorageController::class, 'updateVault']);
        Route::delete('/vaults/{vault}', [StorageController::class, 'deleteVault']);

        Route::get('/vaults/{vault}/boxes', [StorageController::class, 'boxes']);
        Route::post('/boxes', [StorageController::class, 'createBox']);
        Route::put('/boxes/{box}', [StorageController::class, 'updateBox']);
        Route::delete('/boxes/{box}', [StorageController::class, 'deleteBox']);

        Route::get('/boxes/{box}/slots', [StorageController::class, 'slots']);
        Route::get('/available-slots', [StorageController::class, 'availableSlots']);
        Route::get('/next-available-slot', [StorageController::class, 'nextAvailableSlot']);
        Route::get('/box-summary/{box}', [StorageController::class, 'boxSummary']);
    });

    // Reconciliation
    Route::prefix('reconciliations')->group(function () {
        Route::post('/start', [ReconciliationController::class, 'start']);
        Route::post('/{reconciliation}/scan', [ReconciliationController::class, 'scan']);
        Route::post('/{reconciliation}/complete', [ReconciliationController::class, 'complete']);
        Route::post('/{reconciliation}/cancel', [ReconciliationController::class, 'cancel']);
        Route::get('/{reconciliation}/report', [ReconciliationController::class, 'report']);
    });
    Route::apiResource('reconciliations', ReconciliationController::class)->only(['index', 'show']);

    // Auctions
    Route::prefix('auctions')->group(function () {
        Route::get('/eligible-items', [AuctionController::class, 'eligibleItems']);
        Route::get('/{auction}/items', [AuctionController::class, 'items']);
        Route::post('/{auction}/add-items', [AuctionController::class, 'addItems']);
        Route::delete('/{auction}/items/{auctionItem}', [AuctionController::class, 'removeItem']);
        Route::post('/{auction}/items/{auctionItem}/sell', [AuctionController::class, 'sellItem']);
        Route::post('/{auction}/items/{auctionItem}/unsold', [AuctionController::class, 'markUnsold']);
        Route::post('/{auction}/complete', [AuctionController::class, 'complete']);
        Route::post('/{auction}/cancel', [AuctionController::class, 'cancel']);
    });
    Route::apiResource('auctions', AuctionController::class);

    // Reports
    Route::prefix('reports')->group(function () {
        Route::get('/pledges', [ReportController::class, 'pledges']);
        Route::get('/renewals', [ReportController::class, 'renewals']);
        Route::get('/redemptions', [ReportController::class, 'redemptions']);
        Route::get('/outstanding', [ReportController::class, 'outstanding']);
        Route::get('/overdue', [ReportController::class, 'overdue']);
        Route::get('/payment-split', [ReportController::class, 'paymentSplit']);
        Route::get('/inventory', [ReportController::class, 'inventory']);
        Route::get('/customers', [ReportController::class, 'customers']);
        Route::get('/transactions', [ReportController::class, 'transactions']);
        Route::get('/reprints', [ReportController::class, 'reprints']);
        Route::post('/export', [ReportController::class, 'export']);
    });

    // Day End
    Route::prefix('day-end')->group(function () {
        Route::get('/current', [DayEndController::class, 'current']);
        Route::get('/{date}', [DayEndController::class, 'byDate']);
        Route::post('/open', [DayEndController::class, 'open']);
        Route::get('/{dayEnd}/verifications', [DayEndController::class, 'verifications']);
        Route::post('/{dayEnd}/verify-item', [DayEndController::class, 'verifyItem']);
        Route::post('/{dayEnd}/verify-amount', [DayEndController::class, 'verifyAmount']);
        Route::post('/{dayEnd}/close', [DayEndController::class, 'close']);
        Route::post('/{dayEnd}/send-whatsapp', [DayEndController::class, 'sendWhatsApp']);
        Route::post('/{dayEnd}/print', [DayEndController::class, 'print']);
    });
    Route::apiResource('day-end', DayEndController::class)->only(['index', 'show']);

    // Settings
    Route::prefix('settings')->group(function () {
        Route::get('/', [SettingsController::class, 'index']);
        Route::get('/by-category/{category}', [SettingsController::class, 'category']);
        Route::put('/', [SettingsController::class, 'update']);

        Route::get('/gold-prices/history', [SettingsController::class, 'goldPriceHistory']);
        Route::post('/gold-prices', [SettingsController::class, 'updateGoldPrices']);

        // Categories
        Route::get('/categories', [SettingsController::class, 'categories']);
        Route::post('/categories', [SettingsController::class, 'storeCategory']);
        Route::put('/categories/{category}', [SettingsController::class, 'updateCategory']);
        Route::delete('/categories/{category}', [SettingsController::class, 'deleteCategory']);

        // Purities
        Route::get('/purities', [SettingsController::class, 'purities']);
        Route::post('/purities', [SettingsController::class, 'storePurity']);
        Route::put('/purities/{purity}', [SettingsController::class, 'updatePurity']);
        Route::delete('/purities/{purity}', [SettingsController::class, 'deletePurity']);

        // Banks
        Route::get('/banks', [SettingsController::class, 'banks']);
        Route::post('/banks', [SettingsController::class, 'storeBank']);
        Route::put('/banks/{bank}', [SettingsController::class, 'updateBank']);
        Route::delete('/banks/{bank}', [SettingsController::class, 'deleteBank']);

        // Stone Deductions
        Route::get('/stone-deductions', [SettingsController::class, 'stoneDeductions']);
        Route::post('/stone-deductions', [SettingsController::class, 'storeStoneDeduction']);
        Route::put('/stone-deductions/{stoneDeduction}', [SettingsController::class, 'updateStoneDeduction']);
        Route::delete('/stone-deductions/{stoneDeduction}', [SettingsController::class, 'deleteStoneDeduction']);

        // Interest Rates
        Route::get('/interest-rates', [SettingsController::class, 'interestRates']);
        Route::post('/interest-rates', [SettingsController::class, 'storeInterestRate']);
        Route::put('/interest-rates/{interestRate}', [SettingsController::class, 'updateInterestRate']);
        Route::delete('/interest-rates/{interestRate}', [SettingsController::class, 'deleteInterestRate']);

        // Terms & Conditions
        Route::get('/terms-conditions', [SettingsController::class, 'termsConditions']);
        Route::post('/terms-conditions', [SettingsController::class, 'storeTermsCondition']);
        Route::put('/terms-conditions/{termsCondition}', [SettingsController::class, 'updateTermsCondition']);
        Route::delete('/terms-conditions/{termsCondition}', [SettingsController::class, 'deleteTermsCondition']);

        // Margin Presets
        Route::get('/margin-presets', [SettingsController::class, 'marginPresets']);
        Route::post('/margin-presets', [SettingsController::class, 'storeMarginPreset']);
        Route::put('/margin-presets/{marginPreset}', [SettingsController::class, 'updateMarginPreset']);
        Route::delete('/margin-presets/{marginPreset}', [SettingsController::class, 'deleteMarginPreset']);
        Route::post('/logo', [SettingsController::class, 'uploadLogo']);
        Route::get('/logo', [SettingsController::class, 'getLogo']);
        // logo-image is now a public route
    });

    // Users
    Route::prefix('users')->group(function () {
        Route::get('/{user}/permissions', [UserController::class, 'permissions']);
        Route::put('/{user}/permissions', [UserController::class, 'updatePermissions']);
        Route::put('/{user}/passkey', [UserController::class, 'updatePasskey']);
        Route::put('/{user}/toggle-status', [UserController::class, 'toggleStatus']);
    });
    Route::apiResource('users', UserController::class);

    // Roles & Permissions
    Route::prefix('roles')->group(function () {
        Route::get('/{role}/permissions', [RoleController::class, 'permissions']);
        Route::put('/{role}/permissions', [RoleController::class, 'updatePermissions']);
    });
    Route::apiResource('roles', RoleController::class);
    Route::get('/permissions', [RoleController::class, 'allPermissions']);

    // WhatsApp
    Route::prefix('whatsapp')->group(function () {
        Route::get('/config', [WhatsAppController::class, 'config']);
        Route::put('/config', [WhatsAppController::class, 'updateConfig']);
        Route::post('/test-connection', [WhatsAppController::class, 'testConnection']);
        Route::get('/templates', [WhatsAppController::class, 'templates']);
        Route::put('/templates/{whatsAppTemplate}', [WhatsAppController::class, 'updateTemplate']);
        Route::post('/send', [WhatsAppController::class, 'send']);
        Route::get('/logs', [WhatsAppController::class, 'logs']);
        Route::post('/logs/{whatsAppLog}/resend', [WhatsAppController::class, 'resend']);
    });

    // Print
    Route::prefix('print')->group(function () {
        Route::get('/pledge-receipt/{pledge}/preview', [PrintController::class, 'previewPledgeReceipt']);
        Route::post('/pledge-receipt/{pledge}', [PrintController::class, 'pledgeReceipt']);
        Route::get('/barcode/{pledgeItem}', [PrintController::class, 'barcode']);
        Route::post('/barcodes/batch', [PrintController::class, 'batchBarcodes']);
        Route::post('/renewal-receipt/{renewal}', [PrintController::class, 'renewalReceipt']);
        Route::post('/redemption-receipt/{redemption}', [PrintController::class, 'redemptionReceipt']);
        Route::post('/day-end-report/{dayEndReport}', [PrintController::class, 'dayEndReport']);
    });

    // Audit Logs
    Route::prefix('audit')->group(function () {
        Route::get('/logs', [AuditController::class, 'auditLogs']);
        Route::get('/passkey-logs', [AuditController::class, 'passkeyLogs']);
        Route::get('/activity-summary', [AuditController::class, 'activitySummary']);
    });
});
