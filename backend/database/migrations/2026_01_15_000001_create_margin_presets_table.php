<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('margin_presets', function (Blueprint $table) {
            $table->id();
            $table->integer('value')->comment('Margin percentage value (e.g., 70, 80)');
            $table->string('label', 50)->comment('Display label (e.g., "70%")');
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->foreignId('branch_id')->nullable()->constrained('branches', 'id')->nullOnDelete();
            $table->timestamps();

            // Ensure only one default per branch (or global)
            $table->unique(['is_default', 'branch_id'], 'unique_default_per_branch');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('margin_presets');
    }
};