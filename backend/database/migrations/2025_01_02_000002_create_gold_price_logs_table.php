<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gold_price_logs', function (Blueprint $table) {
            $table->id();
            $table->decimal('gold_price_per_gram', 10, 2)->nullable();
            $table->decimal('silver_price_per_gram', 10, 2)->nullable();
            $table->string('base_currency', 3)->default('MYR');
            $table->string('source', 50)->default('metalpriceapi'); // metalpriceapi, cache, fallback, manual
            $table->json('raw_data')->nullable();
            $table->timestamp('fetched_at');
            
            $table->index('fetched_at');
            $table->index(['base_currency', 'fetched_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gold_price_logs');
    }
};
