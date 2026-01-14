<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('margin_presets')) {
            Schema::create('margin_presets', function (Blueprint $table) {
                $table->id();
                $table->integer('value')->comment('Margin percentage value');
                $table->string('label', 50)->comment('Display label');
                $table->boolean('is_default')->default(false);
                $table->boolean('is_active')->default(true);
                $table->integer('sort_order')->default(0);
                $table->unsignedBigInteger('branch_id')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('margin_presets');
    }
};