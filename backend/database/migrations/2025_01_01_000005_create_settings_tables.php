<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Settings (Key-Value Store)
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained();
            $table->string('category', 50);
            $table->string('key_name', 100);
            $table->text('value')->nullable();
            $table->enum('value_type', ['string', 'number', 'boolean', 'json'])->default('string');
            $table->text('description')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->unique(['branch_id', 'category', 'key_name']);
        });

        // Categories
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name_en', 100);
            $table->string('name_ms', 100);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Purities
        Schema::create('purities', function (Blueprint $table) {
            $table->id();
            $table->string('code', 10)->unique();
            $table->string('name', 50);
            $table->string('karat', 10)->nullable();
            $table->decimal('percentage', 5, 2);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Banks
        Schema::create('banks', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name', 100);
            $table->string('swift_code', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Stone Deductions
        Schema::create('stone_deductions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->enum('deduction_type', ['percentage', 'amount', 'grams']);
            $table->decimal('value', 10, 3);
            $table->text('description')->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Interest Rates
        Schema::create('interest_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained();
            $table->string('name', 100);
            $table->enum('rate_type', ['standard', 'extended', 'overdue']);
            $table->decimal('rate_percentage', 5, 2);
            $table->integer('from_month')->default(1);
            $table->integer('to_month')->nullable();
            $table->boolean('is_active')->default(true);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->timestamps();
        });

        // Gold Prices
        Schema::create('gold_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained();
            $table->date('price_date');
            $table->decimal('price_999', 10, 2);
            $table->decimal('price_916', 10, 2);
            $table->decimal('price_875', 10, 2);
            $table->decimal('price_750', 10, 2);
            $table->decimal('price_585', 10, 2)->nullable();
            $table->decimal('price_375', 10, 2)->nullable();
            $table->enum('source', ['manual', 'api'])->default('manual');
            $table->json('api_response')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->index('price_date');
        });

        // Terms & Conditions
        Schema::create('terms_conditions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained();
            $table->enum('activity_type', ['pledge', 'renewal', 'redemption', 'auction', 'forfeit']);
            $table->string('title');
            $table->longText('content_ms');
            $table->longText('content_en')->nullable();
            $table->boolean('print_with_receipt')->default(true);
            $table->boolean('require_consent')->default(true);
            $table->boolean('show_on_screen')->default(true);
            $table->boolean('attach_to_whatsapp')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('version')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('terms_conditions');
        Schema::dropIfExists('gold_prices');
        Schema::dropIfExists('interest_rates');
        Schema::dropIfExists('stone_deductions');
        Schema::dropIfExists('banks');
        Schema::dropIfExists('purities');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('settings');
    }
};
