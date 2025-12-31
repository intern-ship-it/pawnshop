<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Renewals
        Schema::create('renewals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('pledge_id')->constrained();

            // Renewal Info
            $table->string('renewal_no', 30)->unique();
            $table->integer('renewal_count');

            // Period
            $table->integer('renewal_months');
            $table->date('previous_due_date');
            $table->date('new_due_date');

            // Interest Calculation
            $table->decimal('interest_rate', 5, 2);
            $table->decimal('interest_amount', 15, 2);
            $table->decimal('handling_fee', 10, 2)->default(0);
            $table->decimal('total_payable', 15, 2);

            // Payment
            $table->enum('payment_method', ['cash', 'transfer', 'partial']);
            $table->decimal('cash_amount', 15, 2)->default(0);
            $table->decimal('transfer_amount', 15, 2)->default(0);
            $table->foreignId('bank_id')->nullable()->constrained();
            $table->string('account_number', 30)->nullable();
            $table->string('reference_no', 50)->nullable();

            // Status
            $table->enum('status', ['completed', 'pending', 'cancelled'])->default('completed');

            // T&C
            $table->boolean('terms_accepted')->default(false);
            $table->longText('customer_signature')->nullable();

            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index('pledge_id');
            $table->index('created_at');
        });

        // Renewal Interest Breakdown
        Schema::create('renewal_interest_breakdown', function (Blueprint $table) {
            $table->id();
            $table->foreignId('renewal_id')->constrained()->onDelete('cascade');
            $table->integer('month_number');
            $table->decimal('interest_rate', 5, 2);
            $table->decimal('interest_amount', 15, 2);
            $table->decimal('cumulative_amount', 15, 2);
        });

        // Redemptions
        Schema::create('redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('pledge_id')->constrained();

            // Redemption Info
            $table->string('redemption_no', 30)->unique();

            // Calculation
            $table->decimal('principal_amount', 15, 2);
            $table->integer('interest_months');
            $table->decimal('interest_rate', 5, 2);
            $table->decimal('interest_amount', 15, 2);
            $table->decimal('handling_fee', 10, 2)->default(0);
            $table->decimal('other_charges', 10, 2)->default(0);
            $table->decimal('total_payable', 15, 2);

            // Payment
            $table->enum('payment_method', ['cash', 'transfer', 'partial']);
            $table->decimal('cash_amount', 15, 2)->default(0);
            $table->decimal('transfer_amount', 15, 2)->default(0);
            $table->foreignId('bank_id')->nullable()->constrained();
            $table->string('account_number', 30)->nullable();
            $table->string('reference_no', 50)->nullable();

            // Status
            $table->enum('status', ['completed', 'pending', 'cancelled'])->default('completed');

            // T&C
            $table->boolean('terms_accepted')->default(false);
            $table->longText('customer_signature')->nullable();

            // Item Release
            $table->boolean('items_released')->default(false);
            $table->timestamp('released_at')->nullable();
            $table->foreignId('released_by')->nullable()->constrained('users');

            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('redemptions');
        Schema::dropIfExists('renewal_interest_breakdown');
        Schema::dropIfExists('renewals');
    }
};
