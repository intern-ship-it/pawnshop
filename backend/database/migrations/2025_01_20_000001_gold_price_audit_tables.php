<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     * 
     * Enhanced gold price storage for KPKT compliance
     * - Dual source: Metals.Dev (PRIMARY) + BNM Kijang Emas (SECONDARY)
     * - Full audit trail with timestamps
     * - BID/ASK prices for accurate pawn valuation
     */
    public function up(): void
    {
        // 1. Create gold_price_sources table for API configuration
        Schema::create('gold_price_sources', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique(); // metals_dev, bnm_kijang
            $table->string('name', 100);
            $table->string('provider', 100); // Metals.Dev, Bank Negara Malaysia
            $table->string('api_endpoint', 255);
            $table->string('api_key')->nullable(); // encrypted
            $table->enum('priority', ['primary', 'secondary', 'backup'])->default('secondary');
            $table->boolean('is_active')->default(true);
            $table->integer('rate_limit_per_month')->nullable();
            $table->integer('current_month_usage')->default(0);
            $table->timestamp('last_reset_at')->nullable();
            $table->json('settings')->nullable(); // Additional config
            $table->timestamps();
        });

        // 2. Create gold_price_audit table for KPKT compliance
        Schema::create('gold_price_audit', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('branches');

            // Date tracking
            $table->date('price_date');
            $table->timestamp('fetched_at');

            // Primary Source: Metals.Dev
            $table->decimal('metals_dev_spot', 10, 2)->nullable()->comment('Spot price per gram MYR');
            $table->decimal('metals_dev_bid', 10, 2)->nullable()->comment('BID/Buying price per gram MYR');
            $table->decimal('metals_dev_ask', 10, 2)->nullable()->comment('ASK/Selling price per gram MYR');
            $table->decimal('metals_dev_high', 10, 2)->nullable();
            $table->decimal('metals_dev_low', 10, 2)->nullable();
            $table->decimal('metals_dev_change', 10, 2)->nullable();
            $table->decimal('metals_dev_change_percent', 6, 4)->nullable();
            $table->timestamp('metals_dev_timestamp')->nullable();
            $table->json('metals_dev_raw')->nullable()->comment('Full API response');

            // Secondary Source: BNM Kijang Emas
            $table->decimal('bnm_buying_per_oz', 12, 2)->nullable()->comment('BNM buying price per oz');
            $table->decimal('bnm_selling_per_oz', 12, 2)->nullable()->comment('BNM selling price per oz');
            $table->decimal('bnm_buying_per_gram', 10, 2)->nullable()->comment('Calculated buying per gram');
            $table->decimal('bnm_selling_per_gram', 10, 2)->nullable()->comment('Calculated selling per gram');
            $table->date('bnm_effective_date')->nullable();
            $table->timestamp('bnm_last_updated')->nullable();
            $table->json('bnm_raw')->nullable()->comment('Full API response');

            // Calculated purity prices (based on selected source)
            $table->enum('active_source', ['metals_dev', 'bnm', 'manual'])->default('metals_dev');
            $table->decimal('price_999', 10, 2)->comment('24K gold per gram');
            $table->decimal('price_916', 10, 2)->comment('22K gold per gram');
            $table->decimal('price_875', 10, 2)->comment('21K gold per gram');
            $table->decimal('price_750', 10, 2)->comment('18K gold per gram');
            $table->decimal('price_585', 10, 2)->nullable()->comment('14K gold per gram');
            $table->decimal('price_375', 10, 2)->nullable()->comment('9K gold per gram');

            // Audit fields
            $table->enum('fetch_status', ['success', 'partial', 'failed'])->default('success');
            $table->text('error_message')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            // Indexes for performance
            $table->index(['price_date', 'branch_id']);
            $table->index(['fetched_at']);
            $table->index(['active_source']);
        });

        // 3. Modify existing gold_prices table to add new columns
        Schema::table('gold_prices', function (Blueprint $table) {
            // Add bid/ask prices
            $table->decimal('bid_price_999', 10, 2)->nullable()->after('price_375')->comment('BID price for 999 gold');
            $table->decimal('ask_price_999', 10, 2)->nullable()->after('bid_price_999')->comment('ASK price for 999 gold');

            // Add BNM reference prices
            $table->decimal('bnm_buying_999', 10, 2)->nullable()->after('ask_price_999')->comment('BNM Kijang Emas buying');
            $table->decimal('bnm_selling_999', 10, 2)->nullable()->after('bnm_buying_999')->comment('BNM Kijang Emas selling');

            // Track which source was used
            $table->enum('price_source', ['metals_dev', 'bnm', 'metalpriceapi', 'manual'])->default('manual')->after('source');

            // Link to audit record
            $table->foreignId('audit_id')->nullable()->after('price_source')->constrained('gold_price_audit')->nullOnDelete();
        });

        // 4. Enhance gold_price_logs table
        Schema::table('gold_price_logs', function (Blueprint $table) {
            // Add more detail columns
            $table->decimal('bid_price', 10, 2)->nullable()->after('silver_price_per_gram');
            $table->decimal('ask_price', 10, 2)->nullable()->after('bid_price');
            $table->string('api_source', 30)->default('metalpriceapi')->after('source');
            $table->enum('fetch_status', ['success', 'failed', 'timeout'])->default('success')->after('api_source');
            $table->text('error_message')->nullable()->after('fetch_status');
            $table->integer('response_time_ms')->nullable()->after('error_message');
        });

        // 5. Insert default API sources
        DB::table('gold_price_sources')->insert([
            [
                'code' => 'metals_dev',
                'name' => 'Metals.Dev API',
                'provider' => 'Metals.Dev',
                'api_endpoint' => 'https://api.metals.dev/v1/metal/spot',
                'api_key' => null, // To be configured in .env
                'priority' => 'primary',
                'is_active' => true,
                'rate_limit_per_month' => 20000, // Pro plan
                'current_month_usage' => 0,
                'settings' => json_encode([
                    'metal' => 'gold',
                    'currency' => 'MYR',
                    'update_interval_seconds' => 60,
                    'has_bid_ask' => true,
                    'sla_uptime' => '99.999%'
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'bnm_kijang',
                'name' => 'BNM Kijang Emas',
                'provider' => 'Bank Negara Malaysia',
                'api_endpoint' => 'https://api.bnm.gov.my/public/kijang-emas',
                'api_key' => null, // No key needed
                'priority' => 'secondary',
                'is_active' => true,
                'rate_limit_per_month' => null, // No documented limit
                'current_month_usage' => 0,
                'settings' => json_encode([
                    'update_frequency' => 'daily',
                    'update_time' => '10:00 MYT',
                    'official_source' => true,
                    'has_buying_selling' => true,
                    'includes_premium' => true
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'metalpriceapi',
                'name' => 'MetalPriceAPI (Legacy)',
                'provider' => 'MetalPriceAPI',
                'api_endpoint' => 'https://api.metalpriceapi.com/v1/latest',
                'api_key' => null, // From existing .env
                'priority' => 'backup',
                'is_active' => false, // Disabled by default
                'rate_limit_per_month' => 100,
                'current_month_usage' => 0,
                'settings' => json_encode([
                    'has_bid_ask' => false,
                    'spot_only' => true
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove columns from gold_price_logs
        Schema::table('gold_price_logs', function (Blueprint $table) {
            $table->dropColumn(['bid_price', 'ask_price', 'api_source', 'fetch_status', 'error_message', 'response_time_ms']);
        });

        // Remove columns from gold_prices
        Schema::table('gold_prices', function (Blueprint $table) {
            $table->dropForeign(['audit_id']);
            $table->dropColumn(['bid_price_999', 'ask_price_999', 'bnm_buying_999', 'bnm_selling_999', 'price_source', 'audit_id']);
        });

        // Drop new tables
        Schema::dropIfExists('gold_price_audit');
        Schema::dropIfExists('gold_price_sources');
    }
};
