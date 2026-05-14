<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Interest Payments (interest-only, no term extension)
        Schema::create('interest_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('pledge_id')->constrained();

            // Payment Info
            $table->string('payment_no', 30)->unique();

            // Period
            $table->integer('interest_months');
            $table->date('period_from');
            $table->date('period_to');

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

            // Notes
            $table->text('notes')->nullable();

            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index('pledge_id');
            $table->index('created_at');
            $table->index('payment_no');
        });

        // Interest Payment Breakdown (month-by-month)
        Schema::create('interest_payment_breakdown', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interest_payment_id')->constrained('interest_payments')->onDelete('cascade');
            $table->integer('month_number');
            $table->decimal('interest_rate', 5, 2);
            $table->decimal('interest_amount', 15, 2);
            $table->decimal('cumulative_amount', 15, 2);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interest_payment_breakdown');
        Schema::dropIfExists('interest_payments');
    }
};
