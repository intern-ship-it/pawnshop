<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Pledges (Main Transaction)
        Schema::create('pledges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('customer_id')->constrained();

            // Pledge Info
            $table->string('pledge_no', 30)->unique();
            $table->string('receipt_no', 30)->unique();

            // Owner Info (if different from customer)
            $table->foreignId('owner_id')->nullable()->constrained('customer_owners');
            $table->boolean('is_owner')->default(true);

            // Values
            $table->decimal('total_weight', 10, 3);
            $table->decimal('gross_value', 15, 2);
            $table->decimal('total_deduction', 15, 2)->default(0);
            $table->decimal('net_value', 15, 2);
            $table->decimal('loan_percentage', 5, 2);
            $table->decimal('loan_amount', 15, 2);

            // Interest
            $table->decimal('interest_rate', 5, 2);
            $table->decimal('interest_rate_extended', 5, 2);
            $table->decimal('interest_rate_overdue', 5, 2);

            // Dates
            $table->date('pledge_date');
            $table->date('due_date');
            $table->date('grace_end_date');

            // Gold Prices Used
            $table->decimal('gold_price_999', 10, 2)->nullable();
            $table->decimal('gold_price_916', 10, 2)->nullable();
            $table->decimal('gold_price_875', 10, 2)->nullable();
            $table->decimal('gold_price_750', 10, 2)->nullable();

            // Status
            $table->enum('status', ['active', 'renewed', 'redeemed', 'overdue', 'forfeited', 'auctioned'])->default('active');
            $table->integer('renewal_count')->default(0);

            // Signature
            $table->longText('customer_signature')->nullable();

            // T&C
            $table->boolean('terms_accepted')->default(false);
            $table->timestamp('terms_accepted_at')->nullable();

            // Print Tracking
            $table->boolean('receipt_printed')->default(false);
            $table->integer('receipt_print_count')->default(0);

            // Audit
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('approved_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->index('pledge_no');
            $table->index('status');
            $table->index('due_date');
            $table->index('customer_id');
        });

        // Pledge Items
        Schema::create('pledge_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pledge_id')->constrained()->onDelete('cascade');

            // Item Info
            $table->string('item_no', 30);
            $table->string('barcode', 50)->unique();

            // Category & Type
            $table->foreignId('category_id')->constrained();
            $table->foreignId('purity_id')->constrained();

            // Measurements
            $table->decimal('gross_weight', 10, 3);
            $table->enum('stone_deduction_type', ['percentage', 'amount', 'grams'])->default('amount');
            $table->decimal('stone_deduction_value', 10, 3)->default(0);
            $table->decimal('net_weight', 10, 3);

            // Valuation
            $table->decimal('price_per_gram', 10, 2);
            $table->decimal('gross_value', 15, 2);
            $table->decimal('deduction_amount', 15, 2)->default(0);
            $table->decimal('net_value', 15, 2);

            // Description
            $table->text('description')->nullable();
            $table->text('remarks')->nullable();

            // Photo
            $table->string('photo')->nullable();

            // Storage Location
            $table->foreignId('vault_id')->nullable()->constrained();
            $table->foreignId('box_id')->nullable()->constrained();
            $table->foreignId('slot_id')->nullable()->constrained();
            $table->timestamp('location_assigned_at')->nullable();
            $table->foreignId('location_assigned_by')->nullable()->constrained('users');

            // Status
            $table->enum('status', ['stored', 'released', 'auctioned'])->default('stored');
            $table->timestamp('released_at')->nullable();

            $table->timestamps();

            $table->index('barcode');
            $table->index('pledge_id');
        });

        // Pledge Payments
        Schema::create('pledge_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pledge_id')->constrained()->onDelete('cascade');

            // Payment Info
            $table->decimal('total_amount', 15, 2);
            $table->decimal('cash_amount', 15, 2)->default(0);
            $table->decimal('transfer_amount', 15, 2)->default(0);

            // Transfer Details
            $table->foreignId('bank_id')->nullable()->constrained();
            $table->string('account_number', 30)->nullable();
            $table->string('account_name', 100)->nullable();
            $table->string('reference_no', 50)->nullable();

            // Status
            $table->enum('payment_method', ['cash', 'transfer', 'partial']);
            $table->date('payment_date');

            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });

        // Pledge Receipts (Print History)
        Schema::create('pledge_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pledge_id')->constrained()->onDelete('cascade');

            $table->enum('print_type', ['original', 'reprint']);
            $table->enum('copy_type', ['office', 'customer']);

            // Reprint Charge
            $table->boolean('is_chargeable')->default(false);
            $table->decimal('charge_amount', 10, 2)->default(0);
            $table->boolean('charge_paid')->default(false);

            $table->foreignId('printed_by')->constrained('users');
            $table->timestamp('printed_at')->useCurrent();
        });

        // Item Location History
        Schema::create('item_location_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pledge_item_id')->constrained()->onDelete('cascade');
            $table->enum('action', ['stored', 'moved', 'released']);
            $table->foreignId('from_slot_id')->nullable()->constrained('slots');
            $table->foreignId('to_slot_id')->nullable()->constrained('slots');
            $table->text('reason')->nullable();
            $table->foreignId('performed_by')->constrained('users');
            $table->timestamp('performed_at')->useCurrent();
        });

        // Add foreign key to slots for current_item_id
        Schema::table('slots', function (Blueprint $table) {
            $table->foreign('current_item_id')->references('id')->on('pledge_items')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            $table->dropForeign(['current_item_id']);
        });
        Schema::dropIfExists('item_location_history');
        Schema::dropIfExists('pledge_receipts');
        Schema::dropIfExists('pledge_payments');
        Schema::dropIfExists('pledge_items');
        Schema::dropIfExists('pledges');
    }
};
