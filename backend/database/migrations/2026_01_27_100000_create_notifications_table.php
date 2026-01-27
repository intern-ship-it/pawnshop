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
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type'); // warning, info, success, danger
            $table->string('title');
            $table->text('message');
            $table->string('category')->default('system'); // system, pledge, gold_price, reconciliation, etc
            $table->json('data')->nullable(); // Additional metadata
            $table->string('action_url')->nullable(); // Optional link to related page
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            // Indexes for quick lookups
            $table->index(['user_id', 'is_read']);
            $table->index(['branch_id', 'is_read']);
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
