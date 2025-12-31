<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Reconciliations
        Schema::create('reconciliations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();

            $table->string('reconciliation_no', 30)->unique();
            $table->enum('reconciliation_type', ['daily', 'weekly', 'monthly', 'adhoc']);

            // Counts
            $table->integer('expected_items')->default(0);
            $table->integer('scanned_items')->default(0);
            $table->integer('matched_items')->default(0);
            $table->integer('missing_items')->default(0);
            $table->integer('unexpected_items')->default(0);

            // Status
            $table->enum('status', ['in_progress', 'completed', 'cancelled'])->default('in_progress');

            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();

            $table->foreignId('started_by')->constrained('users');
            $table->foreignId('completed_by')->nullable()->constrained('users');

            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // Reconciliation Items
        Schema::create('reconciliation_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reconciliation_id')->constrained()->onDelete('cascade');
            $table->foreignId('pledge_item_id')->nullable()->constrained();

            $table->string('barcode_scanned', 50)->nullable();
            $table->enum('status', ['matched', 'missing', 'unexpected']);

            $table->timestamp('scanned_at')->nullable();
            $table->foreignId('scanned_by')->nullable()->constrained('users');

            $table->text('notes')->nullable();
        });

        // Auctions
        Schema::create('auctions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();

            $table->string('auction_no', 30)->unique();
            $table->date('auction_date');
            $table->time('auction_time')->nullable();
            $table->string('location')->nullable();

            // Counts
            $table->integer('total_items')->default(0);
            $table->integer('total_sold')->default(0);
            $table->integer('total_unsold')->default(0);

            // Values
            $table->decimal('total_reserve_price', 15, 2)->default(0);
            $table->decimal('total_sold_amount', 15, 2)->default(0);

            $table->enum('status', ['scheduled', 'in_progress', 'completed', 'cancelled'])->default('scheduled');

            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });

        // Auction Items
        Schema::create('auction_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('auction_id')->constrained()->onDelete('cascade');
            $table->foreignId('pledge_item_id')->constrained();

            $table->integer('lot_number');
            $table->decimal('reserve_price', 15, 2);
            $table->decimal('sold_price', 15, 2)->nullable();

            $table->enum('status', ['pending', 'sold', 'unsold', 'withdrawn'])->default('pending');

            $table->string('buyer_name', 100)->nullable();
            $table->string('buyer_ic', 20)->nullable();
            $table->string('buyer_phone', 20)->nullable();

            $table->timestamp('sold_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auction_items');
        Schema::dropIfExists('auctions');
        Schema::dropIfExists('reconciliation_items');
        Schema::dropIfExists('reconciliations');
    }
};
