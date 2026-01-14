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
        Schema::table('pledges', function (Blueprint $table) {
            $table->decimal('handling_fee', 10, 2)->default(0)->after('loan_amount');
            $table->decimal('payout_amount', 15, 2)->nullable()->after('handling_fee');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pledges', function (Blueprint $table) {
            $table->dropColumn(['handling_fee', 'payout_amount']);
        });
    }
};
