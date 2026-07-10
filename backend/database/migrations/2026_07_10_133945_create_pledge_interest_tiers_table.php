<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A pledge's month-based interest ladder, frozen at creation.
     *
     * The rates live on the pledge rather than being read from `interest_rates`
     * at calculation time, so editing a rate in Settings cannot reprice a loan a
     * customer has already signed for.
     *
     * The overdue rate is deliberately absent: it is selected by the pledge's
     * *state* (is it past its due date?), not by which month it is in, so it stays
     * on `pledges.interest_rate_overdue`.
     *
     * Existing pledges get no rows. A pledge with no tiers falls back to the flat
     * `month <= 6 ? standard : extended` behaviour it has always had, which is why
     * no backfill is needed and no existing bill can move.
     */
    public function up(): void
    {
        Schema::create('pledge_interest_tiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pledge_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('from_month');
            // Null means "onwards, with no upper bound" — the extended tier never
            // expires. Month 13 is not a cliff; the rate simply continues.
            $table->unsignedSmallInteger('to_month')->nullable();
            $table->decimal('rate_percentage', 5, 2);
            $table->enum('rate_type', ['standard', 'extended']);
            $table->timestamps();

            $table->index(['pledge_id', 'from_month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pledge_interest_tiers');
    }
};
