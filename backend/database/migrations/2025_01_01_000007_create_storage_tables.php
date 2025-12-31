<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Vaults (Main Locker/Rack)
        Schema::create('vaults', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->string('code', 20);
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->integer('total_boxes')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['branch_id', 'code']);
        });

        // Boxes
        Schema::create('boxes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vault_id')->constrained()->onDelete('cascade');
            $table->integer('box_number');
            $table->string('name', 50)->nullable();
            $table->integer('total_slots')->default(20);
            $table->integer('occupied_slots')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['vault_id', 'box_number']);
        });

        // Slots
        Schema::create('slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('box_id')->constrained()->onDelete('cascade');
            $table->integer('slot_number');
            $table->boolean('is_occupied')->default(false);
            $table->unsignedBigInteger('current_item_id')->nullable();
            $table->timestamp('occupied_at')->nullable();
            $table->timestamps();

            $table->unique(['box_id', 'slot_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('slots');
        Schema::dropIfExists('boxes');
        Schema::dropIfExists('vaults');
    }
};
