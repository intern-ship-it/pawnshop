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
        Schema::create('hardware_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->enum('type', [
                'dot_matrix_printer',
                'thermal_printer',
                'barcode_scanner',
                'weighing_scale'
            ]);
            $table->string('brand')->nullable();
            $table->string('model')->nullable();
            $table->enum('connection', ['usb', 'ethernet', 'wireless', 'bluetooth', 'serial'])->default('usb');
            $table->string('paper_size')->nullable(); // A5, A4, 80mm, 58mm
            $table->string('description')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('port')->nullable();
            $table->json('settings')->nullable(); // Device-specific settings
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->enum('status', ['connected', 'disconnected', 'error', 'unknown'])->default('unknown');
            $table->timestamp('last_tested_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();

            // Indexes
            $table->index(['branch_id', 'type']);
            $table->index(['branch_id', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('hardware_devices');
    }
};