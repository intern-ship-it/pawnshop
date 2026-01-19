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
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');

            // Action details
            $table->string('action'); // login, logout, create, update, delete, view, print, etc.
            $table->string('module'); // auth, customer, pledge, renewal, redemption, inventory, settings, etc.
            $table->string('description');

            // Target entity
            $table->string('entity_type')->nullable(); // Model class name
            $table->unsignedBigInteger('entity_id')->nullable(); // Model ID

            // Change details
            $table->json('old_values')->nullable(); // Before change
            $table->json('new_values')->nullable(); // After change
            $table->json('metadata')->nullable(); // Additional context

            // Request info
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->string('request_method', 10)->nullable();
            $table->string('request_url')->nullable();

            // Status
            $table->boolean('is_system')->default(false); // System-generated vs user action
            $table->string('severity')->default('info'); // info, warning, error, critical

            $table->timestamps();

            // Indexes for fast queries
            $table->index(['branch_id', 'created_at']);
            $table->index(['user_id', 'created_at']);
            $table->index(['module', 'action']);
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
