<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When a pledge's principal changed, and to what.
 *
 * Every interest figure in the system is "today's loan_amount x rate", applied to
 * every month including ones long past. That was harmless while the principal never
 * moved. It stopped being harmless when partial redemption started writing a reduced
 * loan_amount onto the pledge: PLG-HQ-2026-0293 carried RM 56,880 for its first three
 * months, had items redeemed, and its first three months are now billed on
 * RM 45,279.42 -- about RM 174 undercharged, for money the customer genuinely held.
 *
 * Client-confirmed 2026-10-01: months before a principal change bill at the amount
 * actually outstanding then; only later months follow the new one.
 *
 * Rows are effective-dated and never updated, so the history is a ledger. A pledge
 * with no rows falls back to loan_amount, which is exactly today's behaviour -- so
 * nothing moves until a change is recorded.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pledge_principal_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pledge_id')->constrained()->cascadeOnDelete();

            // The principal in force FROM this date, inclusive.
            $table->date('effective_from');
            $table->decimal('principal_amount', 12, 2);

            // What moved it: the opening amount, a partial redemption, or a payment
            // made against the principal itself.
            $table->enum('reason', ['initial', 'partial_redemption', 'principal_payment']);

            // The redemption or payment row behind it, where there is one.
            $table->string('source_type')->nullable();
            $table->unsignedBigInteger('source_id')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            // Every read is "this pledge's changes, in date order".
            $table->index(['pledge_id', 'effective_from']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pledge_principal_changes');
    }
};
