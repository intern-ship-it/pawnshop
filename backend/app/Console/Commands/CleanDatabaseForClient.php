<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CleanDatabaseForClient extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'pawnsys:clean-for-client 
                            {--confirm : Confirm the cleanup (required to run)}
                            {--keep-users : Keep existing user accounts}
                            {--keep-gold-prices : Keep gold price history}';

    /**
     * The console command description.
     */
    protected $description = 'Clean all transactional/test data from the database for client delivery. Preserves configuration tables.';

    /**
     * Tables that contain TRANSACTIONAL data - will be TRUNCATED
     */
    private array $transactionalTables = [
        // Auction & Reconciliation
        'auction_items',
        'auctions',
        'reconciliation_items',
        'reconciliations',

        // Renewals & Redemptions
        'renewal_interest_breakdown',
        'renewals',
        'redemptions',

        // Pledge related
        'item_location_history',
        'pledge_receipts',
        'pledge_payments',
        'pledge_items',
        'pledges',

        // Storage / Inventory (created manually from settings)
        'slots',
        'boxes',
        'vaults',

        // Customer related
        'customer_owners',
        'customers',

        // Logs & Audit
        'audit_logs',
        'passkey_logs',
        'whatsapp_logs',
        'notifications',

        // Day End
        'day_end_verifications',
        'day_end_reports',

        // Gold Price Logs & Audit
        'gold_price_audit',
        'gold_price_logs',
        'gold_prices',

        // System
        'temp_card_data',
        'personal_access_tokens',
        'password_reset_tokens',
        'sessions',
        'jobs',
        'job_batches',
        'failed_jobs',

        // Cache
        'cache',
        'cache_locks',
    ];

    /**
     * Tables that contain CONFIG data - will be PRESERVED
     */
    private array $preservedTables = [
        'roles',
        'permissions',
        'role_has_permissions',     // pivot
        'user_permissions',         // pivot
        'branches',
        'categories',
        'purities',
        'banks',
        'stone_deductions',
        'interest_rates',
        'margin_presets',
        'settings',
        'terms_conditions',
        'whatsapp_config',
        'whatsapp_templates',
        'gold_price_sources',
        'hardware_devices',
        'users',                    // handled separately
        'migrations',               // Laravel internal
    ];

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        if (!$this->option('confirm')) {
            $this->error('⚠️  This command will DELETE all transactional data from the database!');
            $this->newLine();
            $this->warn('Run with --confirm to proceed:');
            $this->info('  php artisan pawnsys:clean-for-client --confirm');
            $this->newLine();
            $this->info('Options:');
            $this->info('  --keep-users        Keep existing user accounts');
            $this->info('  --keep-gold-prices  Keep gold price history');
            return Command::FAILURE;
        }

        $this->newLine();
        $this->components->warn('🧹 PawnSys Database Cleanup for Client Delivery');
        $this->newLine();

        // Show what will be cleaned
        $this->showCleanupPlan();

        if (!$this->confirm('⚠️  Are you absolutely sure? This action CANNOT be undone!', false)) {
            $this->info('Cleanup cancelled.');
            return Command::SUCCESS;
        }

        $this->newLine();
        $bar = $this->output->createProgressBar(count($this->getTablesToClear()) + 3);
        $bar->setFormat(' %current%/%max% [%bar%] %percent:3s%% -- %message%');
        $bar->start();

        // Disable FK checks
        DB::statement('SET FOREIGN_KEY_CHECKS = 0;');

        $cleaned = 0;
        $errors = [];

        // ── Step 1: Truncate transactional tables ──
        foreach ($this->getTablesToClear() as $table) {
            $bar->setMessage("Cleaning: {$table}");
            $bar->advance();

            if (!Schema::hasTable($table)) {
                continue;
            }

            try {
                $count = DB::table($table)->count();
                DB::table($table)->truncate();
                if ($count > 0) {
                    $cleaned++;
                    $this->logCleanup($table, $count);
                }
            } catch (\Exception $e) {
                $errors[] = "{$table}: {$e->getMessage()}";
            }
        }

        // ── Step 2: Clean users (if not keeping) ──
        $bar->setMessage('Cleaning: users');
        $bar->advance();

        if (!$this->option('keep-users')) {
            try {
                // Delete all users except seeded ones (ID 1-4) 
                $deletedUsers = DB::table('users')->where('id', '>', 4)->count();
                if ($deletedUsers > 0) {
                    DB::table('users')->where('id', '>', 4)->delete();
                    $this->logCleanup('users (non-seeded)', $deletedUsers);
                    $cleaned++;
                }

                // Reset login tracking for remaining users
                DB::table('users')->update([
                    'last_login_at' => null,
                    'last_login_ip' => null,
                    'remember_token' => null,
                ]);
            } catch (\Exception $e) {
                $errors[] = "users: {$e->getMessage()}";
            }
        }

        // ── Step 3: Reset API usage counters ──
        $bar->setMessage('Resetting: API counters');
        $bar->advance();

        try {
            if (Schema::hasTable('gold_price_sources')) {
                DB::table('gold_price_sources')->update([
                    'current_month_usage' => 0,
                    'last_reset_at' => now(),
                ]);
            }
        } catch (\Exception $e) {
            $errors[] = "gold_price_sources: {$e->getMessage()}";
        }

        // Re-enable FK checks
        DB::statement('SET FOREIGN_KEY_CHECKS = 1;');

        $bar->setMessage('Done!');
        $bar->finish();

        // ── Summary ──
        $this->newLine(2);
        $this->components->info("✅ Cleanup completed! {$cleaned} tables cleaned.");
        $this->newLine();

        // Show preserved tables
        $this->info('📋 Preserved configuration tables:');
        $preservedList = collect($this->preservedTables)->filter(function ($table) {
            return Schema::hasTable($table);
        })->map(function ($table) {
            return "   ✓ {$table} (" . DB::table($table)->count() . " rows)";
        });
        foreach ($preservedList as $line) {
            $this->line($line);
        }

        if (count($errors) > 0) {
            $this->newLine();
            $this->error('⚠️  Some errors occurred:');
            foreach ($errors as $error) {
                $this->warn("   • {$error}");
            }
        }

        $this->newLine();
        $this->components->info('🎉 Database is clean and ready for client delivery!');

        return Command::SUCCESS;
    }

    /**
     * Get the list of tables to clear, respecting --keep options
     */
    private function getTablesToClear(): array
    {
        $tables = $this->transactionalTables;

        if ($this->option('keep-gold-prices')) {
            $tables = array_filter($tables, function ($table) {
                return !in_array($table, ['gold_prices', 'gold_price_audit', 'gold_price_logs']);
            });
        }

        return array_values($tables);
    }

    /**
     * Show the cleanup plan before executing
     */
    private function showCleanupPlan(): void
    {
        $this->info('📊 The following data will be DELETED:');
        $this->newLine();

        $tableData = [];
        foreach ($this->getTablesToClear() as $table) {
            if (Schema::hasTable($table)) {
                $count = DB::table($table)->count();
                $tableData[] = [$table, $count, $count > 0 ? '🗑️  DELETE' : '✓ Empty'];
            }
        }

        $this->table(['Table', 'Rows', 'Action'], $tableData);
        $this->newLine();

        $this->info('📦 The following data will be PRESERVED:');
        $preserveData = [];
        foreach ($this->preservedTables as $table) {
            if (Schema::hasTable($table)) {
                $count = DB::table($table)->count();
                $preserveData[] = [$table, $count, '✅ KEEP'];
            }
        }
        $this->table(['Table', 'Rows', 'Action'], $preserveData);
        $this->newLine();

        if (!$this->option('keep-users')) {
            $extraUsers = DB::table('users')->where('id', '>', 4)->count();
            if ($extraUsers > 0) {
                $this->warn("   ⚠️  {$extraUsers} non-seeded user(s) will be deleted. Use --keep-users to keep them.");
            }
        }
    }

    /**
     * Log what was cleaned
     */
    private function logCleanup(string $table, int $count): void
    {
        // Log to Laravel log file for audit trail
        \Log::info("Database cleanup: Truncated {$table} ({$count} rows removed)");
    }
}
