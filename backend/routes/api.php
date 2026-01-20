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
use App\Http\Controllers\Api\DotMatrixPrintController;
use App\Http\Controllers\Api\HardwareController;

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

    /**
     * Gold Price Routes - KPKT Compliance
     * PRIMARY: Metals.Dev (real-time BID/ASK)
     * SECONDARY: BNM Kijang Emas (official reference)
     */
    Route::prefix('gold-prices')->group(function () {
        // Basic Operations
        Route::get('/latest', [GoldPriceController::class, 'latest']);
        Route::post('/fetch', [GoldPriceController::class, 'fetch']);
        Route::get('/date/{date}', [GoldPriceController::class, 'forDate']);
        Route::get('/history', [GoldPriceController::class, 'history']);

        // Manual Entry (requires settings.edit permission)
        Route::post('/manual', [GoldPriceController::class, 'manual'])
            ->middleware('permission:settings.edit');

        // KPKT Compliance & Audit
        Route::get('/audit', [GoldPriceController::class, 'audit']);
        Route::get('/compare', [GoldPriceController::class, 'compare']);
        Route::get('/compliance-report', [GoldPriceController::class, 'complianceReport']);

        // API Source Status
        Route::get('/sources', [GoldPriceController::class, 'sources']);
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
        // View permissions
        Route::middleware('check.permission:customers,view')->group(function () {
            Route::get('/search', [CustomerController::class, 'search']);
            Route::get('/{customer}/pledges', [CustomerController::class, 'pledges']);
            Route::get('/{customer}/active-pledges', [CustomerController::class, 'activePledges']);
            Route::get('/{customer}/statistics', [CustomerController::class, 'statistics']);
        });

        // Blacklist permission
        Route::post('/{customer}/blacklist', [CustomerController::class, 'blacklist'])
            ->middleware('check.permission:customers,blacklist');
    });

    // Customer CRUD with permissions
    Route::get('/customers', [CustomerController::class, 'index'])
        ->middleware('check.permission:customers,view');
    Route::get('/customers/{customer}', [CustomerController::class, 'show'])
        ->middleware('check.permission:customers,view');
    Route::post('/customers', [CustomerController::class, 'store'])
        ->middleware('check.permission:customers,create');
    Route::put('/customers/{customer}', [CustomerController::class, 'update'])
        ->middleware('check.permission:customers,edit');
    Route::delete('/customers/{customer}', [CustomerController::class, 'destroy'])
        ->middleware('check.permission:customers,delete');

    // Pledges
    Route::prefix('pledges')->group(function () {
        // View permissions
        Route::middleware('check.permission:pledges,view')->group(function () {
            Route::get('/by-receipt/{receiptNo}', [PledgeController::class, 'byReceipt']);
            Route::get('/{pledge}/items', [PledgeController::class, 'items']);
            Route::get('/{pledge}/interest-breakdown', [PledgeController::class, 'interestBreakdown']);
            Route::get('/calculate', [PledgeController::class, 'calculate']);
        });

        // Create permissions
        Route::middleware('check.permission:pledges,create')->group(function () {
            Route::post('/{pledge}/assign-storage', [PledgeController::class, 'assignStorage']);
        });

        // Print permissions
        Route::middleware('check.permission:pledges,print')->group(function () {
            Route::post('/{pledge}/print-receipt', [PledgeController::class, 'printReceipt']);
            Route::post('/{pledge}/print-barcode', [PledgeController::class, 'printBarcode']);
        });

        // WhatsApp
        Route::post('/{pledge}/send-whatsapp', [PledgeController::class, 'sendWhatsApp'])
            ->middleware('check.permission:whatsapp,send');

        // Cancel (delete permission)
        Route::post('/{pledge}/cancel', [PledgeController::class, 'cancel'])
            ->middleware('check.permission:pledges,delete');
    });

    // Pledge CRUD with permissions
    Route::get('/pledges', [PledgeController::class, 'index'])
        ->middleware('check.permission:pledges,view');
    Route::get('/pledges/{pledge}', [PledgeController::class, 'show'])
        ->middleware('check.permission:pledges,view');
    Route::post('/pledges', [PledgeController::class, 'store'])
        ->middleware('check.permission:pledges,create');
    Route::put('/pledges/{pledge}', [PledgeController::class, 'update'])
        ->middleware('check.permission:pledges,edit');
    Route::delete('/pledges/{pledge}', [PledgeController::class, 'destroy'])
        ->middleware('check.permission:pledges,delete');

    // Renewals
    Route::prefix('renewals')->group(function () {
        Route::get('/today', [RenewalController::class, 'today']);
        Route::get('/due-list', [RenewalController::class, 'dueList']);
        Route::get('/calculate', [RenewalController::class, 'calculate']);
        Route::post('/{renewal}/print-receipt', [RenewalController::class, 'printReceipt'])
            ->middleware('check.permission:renewals,print');
    });

    // Renewal CRUD with permissions
    Route::get('/renewals', [RenewalController::class, 'index'])
        ->middleware('check.permission:renewals,view');
    Route::get('/renewals/{renewal}', [RenewalController::class, 'show'])
        ->middleware('check.permission:renewals,view');
    Route::post('/renewals', [RenewalController::class, 'store'])
        ->middleware('check.permission:renewals,create');

    // Redemptions
    Route::prefix('redemptions')->group(function () {
        Route::get('/calculate', [RedemptionController::class, 'calculate'])
            ->middleware('check.permission:redemptions,view');
        Route::post('/{redemption}/release-items', [RedemptionController::class, 'releaseItems'])
            ->middleware('check.permission:redemptions,create');
        Route::post('/{redemption}/print-receipt', [RedemptionController::class, 'printReceipt'])
            ->middleware('check.permission:redemptions,print');
    });

    // Redemption CRUD with permissions
    Route::get('/redemptions', [RedemptionController::class, 'index'])
        ->middleware('check.permission:redemptions,view');
    Route::get('/redemptions/{redemption}', [RedemptionController::class, 'show'])
        ->middleware('check.permission:redemptions,view');
    Route::post('/redemptions', [RedemptionController::class, 'store'])
        ->middleware('check.permission:redemptions,create');

    // Inventory
    Route::prefix('inventory')->group(function () {
        // View permissions
        Route::middleware('check.permission:inventory,view')->group(function () {
            Route::get('/by-location', [InventoryController::class, 'byLocation']);
            Route::get('/search', [InventoryController::class, 'search']);
            Route::get('/summary', [InventoryController::class, 'summary']);
            Route::get('/{pledgeItem}/history', [InventoryController::class, 'locationHistory']);
        });

        // Update location permission
        Route::middleware('check.permission:inventory,update_location')->group(function () {
            Route::put('/{pledgeItem}/location', [InventoryController::class, 'updateLocation']);
            Route::post('/bulk-update-location', [InventoryController::class, 'bulkUpdateLocation']);
        });
    });

    // Inventory CRUD with permissions
    Route::get('/inventory', [InventoryController::class, 'index'])
        ->middleware('check.permission:inventory,view');
    Route::get('/inventory/{pledgeItem}', [InventoryController::class, 'show'])
        ->middleware('check.permission:inventory,view');

    // Storage (Vaults, Boxes, Slots)
    Route::prefix('storage')->group(function () {
        // View permissions
        Route::middleware('check.permission:storage,view')->group(function () {
            Route::get('/vaults', [StorageController::class, 'vaults']);
            Route::get('/vaults/{vault}/boxes', [StorageController::class, 'boxes']);
            Route::get('/boxes/{box}/slots', [StorageController::class, 'slots']);
            Route::get('/available-slots', [StorageController::class, 'availableSlots']);
            Route::get('/next-available-slot', [StorageController::class, 'nextAvailableSlot']);
            Route::get('/box-summary/{box}', [StorageController::class, 'boxSummary']);
        });

        // Manage permissions (create/update/delete)
        Route::middleware('check.permission:storage,manage')->group(function () {
            Route::post('/vaults', [StorageController::class, 'createVault']);
            Route::put('/vaults/{vault}', [StorageController::class, 'updateVault']);
            Route::delete('/vaults/{vault}', [StorageController::class, 'deleteVault']);
            Route::post('/boxes', [StorageController::class, 'createBox']);
            Route::put('/boxes/{box}', [StorageController::class, 'updateBox']);
            Route::delete('/boxes/{box}', [StorageController::class, 'deleteBox']);
        });
    });

    // Reconciliation
    Route::prefix('reconciliations')->group(function () {
        // View permissions
        Route::get('/{reconciliation}/report', [ReconciliationController::class, 'report'])
            ->middleware('check.permission:reconciliation,view');

        // Start permission
        Route::post('/start', [ReconciliationController::class, 'start'])
            ->middleware('check.permission:reconciliation,start');

        // Complete permission
        Route::middleware('check.permission:reconciliation,complete')->group(function () {
            Route::post('/{reconciliation}/scan', [ReconciliationController::class, 'scan']);
            Route::post('/{reconciliation}/complete', [ReconciliationController::class, 'complete']);
            Route::post('/{reconciliation}/cancel', [ReconciliationController::class, 'cancel']);
        });
    });

    // Reconciliation list with permissions
    Route::get('/reconciliations', [ReconciliationController::class, 'index'])
        ->middleware('check.permission:reconciliation,view');
    Route::get('/reconciliations/{reconciliation}', [ReconciliationController::class, 'show'])
        ->middleware('check.permission:reconciliation,view');

    // Auctions (not protected as per user request)
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
    Route::prefix('reports')->middleware('check.permission:reports,view')->group(function () {
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
        Route::post('/export', [ReportController::class, 'export'])
            ->middleware('check.permission:reports,export');
    });

    // Day End
    Route::prefix('day-end')->group(function () {
        // View permissions
        Route::middleware('check.permission:dayend,view')->group(function () {
            Route::get('/current', [DayEndController::class, 'current']);
            Route::get('/{date}', [DayEndController::class, 'byDate']);
            Route::get('/{dayEnd}/verifications', [DayEndController::class, 'verifications']);
        });

        // Open permission
        Route::post('/open', [DayEndController::class, 'open'])
            ->middleware('check.permission:dayend,open');

        // Verify permission
        Route::middleware('check.permission:dayend,verify')->group(function () {
            Route::post('/{dayEnd}/verify-item', [DayEndController::class, 'verifyItem']);
            Route::post('/{dayEnd}/verify-amount', [DayEndController::class, 'verifyAmount']);
        });

        // Close permission
        Route::post('/{dayEnd}/close', [DayEndController::class, 'close'])
            ->middleware('check.permission:dayend,close');

        // WhatsApp and Print
        Route::post('/{dayEnd}/send-whatsapp', [DayEndController::class, 'sendWhatsApp'])
            ->middleware('check.permission:whatsapp,send');
        Route::post('/{dayEnd}/print', [DayEndController::class, 'print'])
            ->middleware('check.permission:dayend,view');
    });

    // Day End list with permissions
    Route::get('/day-end', [DayEndController::class, 'index'])
        ->middleware('check.permission:dayend,view');
    Route::get('/day-end/{dayEnd}', [DayEndController::class, 'show'])
        ->middleware('check.permission:dayend,view');

    // Settings
    Route::prefix('settings')->group(function () {
        // View permissions
        Route::middleware('check.permission:settings,view')->group(function () {
            Route::get('/', [SettingsController::class, 'index']);
            Route::get('/by-category/{category}', [SettingsController::class, 'category']);
            Route::get('/gold-prices/history', [SettingsController::class, 'goldPriceHistory']);
        });

        // Edit permissions
        Route::put('/', [SettingsController::class, 'update'])
            ->middleware('check.permission:settings,edit');

        // Gold prices permission
        Route::post('/gold-prices', [SettingsController::class, 'updateGoldPrices'])
            ->middleware('check.permission:settings,gold_prices');

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
        Route::delete('/logo', [SettingsController::class, 'deleteLogo']);
        // logo-image is now a public route
    });

    // Users
    Route::prefix('users')->group(function () {
        // View permissions (for viewing user's permissions)
        Route::get('/{user}/permissions', [UserController::class, 'permissions'])
            ->middleware('check.permission:users,view');

        // Manage permissions (requires special permission)
        Route::put('/{user}/permissions', [UserController::class, 'updatePermissions'])
            ->middleware('check.permission:users,manage_permissions');

        // Edit user operations
        Route::middleware('check.permission:users,edit')->group(function () {
            Route::put('/{user}/passkey', [UserController::class, 'updatePasskey']);
            Route::put('/{user}/toggle-status', [UserController::class, 'toggleStatus']);
        });
    });

    // User CRUD with permissions
    Route::get('/users', [UserController::class, 'index'])
        ->middleware('check.permission:users,view');
    Route::get('/users/{user}', [UserController::class, 'show'])
        ->middleware('check.permission:users,view');
    Route::post('/users', [UserController::class, 'store'])
        ->middleware('check.permission:users,create');
    Route::put('/users/{user}', [UserController::class, 'update'])
        ->middleware('check.permission:users,edit');
    Route::delete('/users/{user}', [UserController::class, 'destroy'])
        ->middleware('check.permission:users,delete');

    // Roles & Permissions
    Route::prefix('roles')->group(function () {
        Route::get('/{role}/permissions', [RoleController::class, 'permissions'])
            ->middleware('check.permission:users,manage_roles');
        Route::put('/{role}/permissions', [RoleController::class, 'updatePermissions'])
            ->middleware('check.permission:users,manage_permissions');
    });

    // Role CRUD with permissions
    Route::get('/roles', [RoleController::class, 'index'])
        ->middleware('check.permission:users,manage_roles');
    Route::get('/roles/{role}', [RoleController::class, 'show'])
        ->middleware('check.permission:users,manage_roles');
    Route::post('/roles', [RoleController::class, 'store'])
        ->middleware('check.permission:users,manage_roles');
    Route::put('/roles/{role}', [RoleController::class, 'update'])
        ->middleware('check.permission:users,manage_roles');
    Route::delete('/roles/{role}', [RoleController::class, 'destroy'])
        ->middleware('check.permission:users,manage_roles');

    Route::get('/permissions', [RoleController::class, 'allPermissions'])
        ->middleware('check.permission:users,manage_permissions');

    // WhatsApp
    Route::prefix('whatsapp')->group(function () {
        // View permissions
        Route::middleware('check.permission:whatsapp,view')->group(function () {
            Route::get('/config', [WhatsAppController::class, 'config']);
            Route::get('/templates', [WhatsAppController::class, 'templates']);
            Route::get('/logs', [WhatsAppController::class, 'logs']);
        });

        // Configure permission
        Route::middleware('check.permission:whatsapp,configure')->group(function () {
            Route::put('/config', [WhatsAppController::class, 'updateConfig']);
            Route::post('/test-connection', [WhatsAppController::class, 'testConnection']);
            Route::put('/templates/{whatsAppTemplate}', [WhatsAppController::class, 'updateTemplate']);
        });

        // Send permission
        Route::middleware('check.permission:whatsapp,send')->group(function () {
            Route::post('/send', [WhatsAppController::class, 'send']);
            Route::post('/logs/{whatsAppLog}/resend', [WhatsAppController::class, 'resend']);
        });
    });

    // Hardware Devices
    Route::prefix('hardware')->group(function () {
        // Options (no permission needed - for dropdowns)
        Route::get('/options', [HardwareController::class, 'getOptions']);

        // View permissions
        Route::middleware('check.permission:settings,view')->group(function () {
            Route::get('/', [HardwareController::class, 'index']);
            Route::get('/defaults', [HardwareController::class, 'getDefaults']);
            Route::get('/{hardwareDevice}', [HardwareController::class, 'show']);
        });

        // Edit permissions
        Route::middleware('check.permission:settings,edit')->group(function () {
            Route::post('/', [HardwareController::class, 'store']);
            Route::put('/{hardwareDevice}', [HardwareController::class, 'update']);
            Route::delete('/{hardwareDevice}', [HardwareController::class, 'destroy']);
            Route::post('/{hardwareDevice}/toggle-active', [HardwareController::class, 'toggleActive']);
            Route::post('/{hardwareDevice}/set-default', [HardwareController::class, 'setDefault']);
            Route::post('/{hardwareDevice}/update-status', [HardwareController::class, 'updateStatus']);
            Route::post('/{hardwareDevice}/test', [HardwareController::class, 'testConnection']);
        });
    });

    // Print
    Route::prefix('print')->group(function () {
        // Pledge print
        Route::middleware('check.permission:pledges,print')->group(function () {
            Route::get('/pledge-receipt/{pledge}/preview', [PrintController::class, 'previewPledgeReceipt']);
            Route::post('/pledge-receipt/{pledge}', [PrintController::class, 'pledgeReceipt']);
        });


        // Dot Matrix Printing (Epson LQ-310)
        Route::prefix('dot-matrix')->group(function () {
            Route::post('/pledge-receipt/{pledge}', [DotMatrixPrintController::class, 'pledgeReceipt'])
                ->middleware('check.permission:pledges,print');
            Route::post('/renewal-receipt/{renewal}', [DotMatrixPrintController::class, 'renewalReceipt'])
                ->middleware('check.permission:renewals,print');
            Route::post('/redemption-receipt/{redemption}', [DotMatrixPrintController::class, 'redemptionReceipt'])
                ->middleware('check.permission:redemptions,print');
        });

        // Barcode print
        Route::middleware('check.permission:inventory,print_barcode')->group(function () {
            Route::get('/barcode/{pledgeItem}', [PrintController::class, 'barcode']);
            Route::post('/barcodes/batch', [PrintController::class, 'batchBarcodes']);
        });

        // Renewal/Redemption print
        Route::post('/renewal-receipt/{renewal}', [PrintController::class, 'renewalReceipt'])
            ->middleware('check.permission:renewals,print');
        Route::post('/redemption-receipt/{redemption}', [PrintController::class, 'redemptionReceipt'])
            ->middleware('check.permission:redemptions,print');
        Route::post('/day-end-report/{dayEndReport}', [PrintController::class, 'dayEndReport'])
            ->middleware('check.permission:dayend,view');
    });

    // Audit Logs
    Route::prefix('audit')->middleware('check.permission:audit,view')->group(function () {
        Route::get('/logs', [AuditController::class, 'auditLogs']);
        Route::get('/options', [AuditController::class, 'getOptions']);
        Route::get('/passkey-logs', [AuditController::class, 'passkeyLogs']);
        Route::get('/activity-summary', [AuditController::class, 'activitySummary']);
    });
});
