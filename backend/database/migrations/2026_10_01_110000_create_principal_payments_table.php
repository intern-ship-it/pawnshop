<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Money paid against the loan itself, rather than against its interest.
 *
 * Until now the only way to reduce a pledge's principal was to take goods out of the
 * locker: a customer who wanted to owe less while leaving everything where it was had
 * no option at all. Client-confirmed 2026-10-01, a customer may pay any amount toward
 * the principal at any time, as often as they like, without settling interest first
 * and without the due date moving.
 *
 * The payment reduces the pledge's loan_amount and writes a row to the principal
 * ledger, so months already elapsed keep billing on the larger sum the customer
 * actually held and only later months follow the smaller one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('principal_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('pledge_id')->constrained();

            $table->string('payment_no')->unique();

            // What was paid, and what the loan stood at either side of it -- kept on
            // the row so a receipt reprinted years later still shows the figures the
            // customer was given, whatever the pledge has done since.
            $table->decimal('amount', 12, 2);
            $table->decimal('principal_before', 12, 2);
            $table->decimal('principal_after', 12, 2);

            $table->enum('payment_method', ['cash', 'transfer', 'partial'])->default('cash');
            $table->decimal('cash_amount', 12, 2)->default(0);
            $table->decimal('transfer_amount', 12, 2)->default(0);
            $table->foreignId('bank_id')->nullable()->constrained();
            $table->string('account_number')->nullable();
            $table->string('reference_no')->nullable();

            $table->enum('status', ['completed', 'cancelled'])->default('completed');
            $table->text('notes')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['pledge_id', 'status']);
            $table->index(['branch_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('principal_payments');
    }
};
